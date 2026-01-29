/*
  Adapter library for working with pubsub channels and messages
*/

// Local libraries
import Messaging from './messaging.js'
import { BroadcastRouter, PrivateChannelRouter } from './msg-router.js'

// Libraries for working with default uint8Array Buffers that pubsub uses
// for sending and receiving messages.
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

class PubsubAdapter {
  constructor (localConfig = {}) {
    // Dependency Injection
    this.ipfs = localConfig.ipfsAdapter
    if (!this.ipfs) {
      console.log('this.ipfs: ', this.ipfs)
      throw new Error(
        'Instance of IPFS adapter required when instantiating Pubsub Adapter.'
      )
    }
    this.log = localConfig.log
    if (!this.log) {
      throw new Error(
        'A status log handler function required when instantitating Pubsub Adapter'
      )
    }
    this.encryption = localConfig.encryption
    if (!this.encryption) {
      throw new Error(
        'An instance of the encryption Adapter must be passed when instantiating the Pubsub Adapter library.'
      )
    }
    this.privateLog = localConfig.privateLog
    if (!this.privateLog) {
      throw new Error(
        'A private log handler must be passed when instantiating the Pubsub Adapter library.'
      )
    }

    // Encapsulate dependencies
    this.messaging = new Messaging(localConfig)

    this.nodeType = localConfig.nodeType
    if (!this.nodeType) {
      this.nodeType = 'node.js'
    }

    // Bind functions that are called by event handlers
    this.parsePubsubMessage = this.parsePubsubMessage.bind(this)
    this.handleNewMessage = this.handleNewMessage.bind(this)
    this.checkForDuplicateMsg = this.checkForDuplicateMsg.bind(this)
    this.manageMsgCache = this.manageMsgCache.bind(this)
    this.injectMetricsHandler = this.injectMetricsHandler.bind(this)

    // State
    this.trackedMsgs = [] // Used reject repeated messages
    this.TRACKED_MSG_SIZE = 100
    this.relayMetricsHandler = () => {} // placeholder

    // Topic handler registry - maps topic names to their handlers
    this.topicHandlers = new Map()

    // Track if global message listener has been set up
    this._globalListenerSetup = false
  }

  // Get and validate the pubsub service
  _getPubsubService () {
    try {
      if (!this.ipfs || !this.ipfs.ipfs) {
        throw new Error('IPFS instance not available')
      }

      // Try new API first (libp2p v3)
      if (this.ipfs.ipfs.libp2p?.services) {
        const pubsub = this.ipfs.ipfs.libp2p.services.get?.('pubsub') ||
                       this.ipfs.ipfs.libp2p.services.pubsub
        if (pubsub) {
          return pubsub
        }
      }

      // Fall back to old API for backwards compatibility (e.g., in tests)
      if (this.ipfs.ipfs.pubsub) {
        return this.ipfs.ipfs.pubsub
      }

      throw new Error('Pubsub service not initialized. Ensure gossipsub is configured in libp2p services.')
    } catch (err) {
      console.error('Error getting pubsub service:', err)
      throw err
    }
  }

  // Set up a single global message listener that routes to topic-specific handlers
  async _setupGlobalMessageListener () {
    if (this._globalListenerSetup) {
      this.log.statusLog(3, 'Global message listener already set up, skipping')
      return
    }

    try {
      const pubsub = this._getPubsubService()

      console.log('DEBUG: Pubsub service:', pubsub)
      console.log('DEBUG: Pubsub service type:', typeof pubsub)
      console.log('DEBUG: Pubsub service constructor:', pubsub.constructor?.name)
      console.log('DEBUG: Pubsub service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pubsub)))
      console.log('DEBUG: Has addEventListener?', typeof pubsub.addEventListener)
      console.log('DEBUG: Has on?', typeof pubsub.on)

      this.log.statusLog(2, 'Setting up global pubsub message listener...')

      // Try multiple event listener patterns for compatibility
      let listenerAttached = false

      // Check if service is started (it's a property, not a method)
      // Services are typically started automatically by libp2p, but verify
      if (pubsub.isStarted === false && typeof pubsub.start === 'function') {
        this.log.statusLog(2, 'Pubsub service not started, starting...')
        await pubsub.start()
        this.log.statusLog(2, 'Pubsub service started')
      }

      // Pattern 1: addEventListener (EventTarget pattern) - for 'message' event
      if (typeof pubsub.addEventListener === 'function') {
        console.log('DEBUG: Using addEventListener pattern for "message" event')
        const messageHandler = (event) => {
          console.log('DEBUG: addEventListener("message") - Raw event received:', event)
          console.log('DEBUG: addEventListener("message") - Event type:', typeof event)
          console.log('DEBUG: addEventListener("message") - Event keys:', Object.keys(event))
          console.log('DEBUG: addEventListener("message") - Event.detail:', event.detail)
          this.log.statusLog(3, 'Pubsub message event received (addEventListener)')
          this._routeMessage(event)
        }
        pubsub.addEventListener('message', messageHandler)
        // Store handler reference for potential cleanup
        this._messageHandler = messageHandler
        listenerAttached = true
        console.log('DEBUG: addEventListener attached successfully')
      }

      // Pattern 2: on() method (EventEmitter pattern) - for 'message' event
      if (typeof pubsub.on === 'function') {
        console.log('DEBUG: Using on() pattern for "message" event')
        pubsub.on('message', (event) => {
          console.log('DEBUG: on("message") - Raw event received:', event)
          console.log('DEBUG: on("message") - Event type:', typeof event)
          console.log('DEBUG: on("message") - Event keys:', Object.keys(event))
          console.log('DEBUG: on("message") - Event.detail:', event.detail)
          this.log.statusLog(3, 'Pubsub message event received (on)')
          this._routeMessage(event)
        })
        listenerAttached = true
      }

      // Pattern 3: Also listen for 'gossipsub:message' event (gossipsub-specific)
      if (typeof pubsub.addEventListener === 'function') {
        console.log('DEBUG: Also listening for "gossipsub:message" event')
        const gossipsubMessageHandler = (event) => {
          console.log('DEBUG: addEventListener("gossipsub:message") - Raw event received:', event)
          console.log('DEBUG: addEventListener("gossipsub:message") - Event.detail:', event.detail)
          // Convert gossipsub:message to message format
          if (event.detail?.msg) {
            const convertedEvent = {
              detail: event.detail.msg
            }
            this.log.statusLog(3, 'Pubsub gossipsub:message event received, converting')
            this._routeMessage(convertedEvent)
          }
        }
        pubsub.addEventListener('gossipsub:message', gossipsubMessageHandler)
        this._gossipsubMessageHandler = gossipsubMessageHandler
        console.log('DEBUG: gossipsub:message listener attached successfully')
      }

      if (!listenerAttached) {
        throw new Error('No supported event listener method found on pubsub service')
      }

      this._globalListenerSetup = true
      this.log.statusLog(0, 'Global pubsub message listener successfully set up')
    } catch (err) {
      console.error('Error setting up global message listener:', err)
      this.log.statusLog(1, `Error setting up global message listener: ${err.message}`)
      throw err
    }
  }

  // Route incoming messages to the appropriate handler based on topic
  async _routeMessage (event) {
    try {
      // In Helia v6/gossipsub, the 'message' event has event.detail as the Message object directly
      // Message structure: { type: 'signed'|'unsigned', topic: string, data: Uint8Array, from?: PeerId, sequenceNumber?: bigint, ... }
      const message = event.detail || event

      // Extract topic from the Message object
      const topic = message.topic

      if (!topic) {
        this.log.statusLog(1, `Received pubsub message without topic. Event keys: ${Object.keys(event).join(', ')}`)
        return
      }

      this.log.statusLog(3, `Routing pubsub message for topic: ${topic}`)

      // Find handler(s) for this topic
      const handler = this.topicHandlers.get(topic)

      if (handler) {
        // Wrap message in expected format (msg.detail structure) for backward compatibility
        // The existing handlers expect: { detail: { topic, from, data, sequenceNumber } }
        const wrappedEvent = {
          detail: {
            topic: message.topic,
            from: message.from, // PeerId object
            data: message.data, // Uint8Array
            sequenceNumber: message.sequenceNumber // bigint
          }
        }

        const fromStr = wrappedEvent.detail.from ? wrappedEvent.detail.from.toString() : 'unknown'
        this.log.statusLog(3, `Calling handler for topic ${topic}, from: ${fromStr}`)

        // Call the handler
        await handler(wrappedEvent)
      } else {
        this.log.statusLog(3, `No handler registered for topic: ${topic}. Registered topics: ${Array.from(this.topicHandlers.keys()).join(', ')}`)
      }
    } catch (err) {
      console.error('Error routing pubsub message:', err)
      this.log.statusLog(1, `Error routing pubsub message: ${err.message}`)
    }
  }

  // This function is called by the peer use case library. RPC data for an
  // /about call (used to measure peer metrics) is passed to this handler.
  injectMetricsHandler (relayMetricsHandler) {
    this.relayMetricsHandler = relayMetricsHandler
  }

  // Subscribe to a pubsub channel. Any data received on that channel is passed
  // to the handler.
  async subscribeToPubsubChannel (chanName, handler, thisNode) {
    try {
      // Ensure global listener is set up
      await this._setupGlobalMessageListener()

      // Get and validate pubsub service
      const pubsub = this._getPubsubService()

      const chanNameStr = chanName.toString()
      const thisNodeId = thisNode.ipfsId

      // Normal use-case, where the pubsub channel is NOT the receiving channel
      // for this node. This applies to general broadcast channels like
      // the coordination channel that all nodes use to annouce themselves.
      if (chanNameStr !== thisNodeId) {
        // Instantiate the Broadcast message router library
        const bRouterOptions = {
          handler,
          thisNode,
          parsePubsubMessage: this.parsePubsubMessage
        }
        const broadcastRouter = new BroadcastRouter(bRouterOptions)

        // Subscribe to the pubsub channel.
        await pubsub.subscribe(chanNameStr)

        // Register handler for this topic (instead of adding a new listener)
        this.topicHandlers.set(chanNameStr, broadcastRouter.route)

      //
      } else {
        // Subscribing to our own pubsub channel. This is the channel other nodes
        // will use to send RPC commands and send private messages.

        // Instantiate the Private message router library
        const pRouterOptions = {
          thisNode,
          messaging: this.messaging,
          handleNewMessage: this.handleNewMessage
        }
        const privateRouter = new PrivateChannelRouter(pRouterOptions)

        // Subscribe to the pubsub channel.
        await pubsub.subscribe(chanNameStr)

        // Register handler for this topic (instead of adding a new listener)
        this.topicHandlers.set(chanNameStr, privateRouter.route)
      }

      this.log.statusLog(
        0,
        `status: Subscribed to pubsub channel: ${chanNameStr}`
      )

      return true
    } catch (err) {
      console.error('Error in subscribeToPubsubChannel():', err)
      this.log.statusLog(1, `Error subscribing to pubsub channel ${chanName}: ${err.message}`)
      throw err
    }
  }

  // Subscribe to the general coordination pubsub channel
  // Dev Note: I probably don't need to pass in the chanName, since I can pull
  // that from the global config library.
  async subscribeToCoordChannel (inObj = {}) {
    try {
      const { chanName, handler } = inObj

      // Ensure global listener is set up
      await this._setupGlobalMessageListener()

      // Get and validate pubsub service
      const pubsub = this._getPubsubService()

      // Subscribe to the pubsub channel.
      // Let the library throw errors for invalid chanName (e.g., from stubbed subscribe)
      await pubsub.subscribe(chanName)

      // Register handler for this topic (instead of adding a new listener)
      if (handler) {
        this.topicHandlers.set(chanName, handler)
        this.log.statusLog(2, `Registered handler for coordination channel: ${chanName}`)
      }

      return true
    } catch (err) {
      console.error('Error in subscribeToCoordChannel():', err)
      this.log.statusLog(1, `Error subscribing to coordination channel: ${err.message}`)
      throw err
    }
  }

  // After the messaging.js library does the lower-level message handling and
  // decryption, it passes the message on to this function, which does any
  // additional parsing needed, and
  // then routes the parsed data on to the user-specified handler.
  async handleNewMessage (msgObj, thisNode) {
    try {
      // console.log('handleNewMessage() will forward this data onto the handler: ', msgObj)

      // Check to see if this is metrics data or user-requested data.
      // If it the response to a metrics query, trigger the handler for that.
      // Dev note: This only handles the response. The JSON RPC must pass
      // through this function to the privateLog, to be handled by the service
      // being measured.
      const isAbout = await this.captureMetrics(msgObj.data.payload, msgObj.from, thisNode)

      // Pass the JSON RPC data to the private log to be handled by the app
      // consuming this library.
      if (!isAbout) {
        this.privateLog(msgObj.data.payload, msgObj.from)

        return true
      }

      return false
    } catch (err) {
      console.error('Error in handleNewMessage()')
      throw err
    }
  }

  // Scans input data. If the data is determined to be an 'about' JSON RPC
  // reponse used for metrics, then the relayMetrics event is triggered and
  // true is returned. Otherwise, false is returned.
  async captureMetrics (decryptedStr, from, thisNode) {
    try {
      // console.log('decryptedStr: ', decryptedStr)
      // console.log('thisNode: ', thisNode)

      const data = JSON.parse(decryptedStr)

      // Handle /about JSON RPC queries.
      if (data.id.includes('metrics') && data.method === 'about') {
        // Request recieved, send response.

        const jsonResponse = `{"jsonrpc": "2.0", "id": "${data.id}", "result": {"method": "about", "receiver": "${from}", "value": ${JSON.stringify(thisNode.schema.state)}}}`
        // console.log(`Responding with this JSON RPC response: ${jsonResponse}`)

        // Encrypt the string with the peers public key.
        const peerData = thisNode.peerData.filter(x => x.from === from)
        const payload = await this.encryption.encryptMsg(
          peerData[0],
          jsonResponse
        )

        await this.messaging.sendMsg(from, payload, thisNode)

        return true

      //
      } else if (data.id.includes('metrics') && data.result && data.result.method === 'about') {
        // Response received.

        // This event is handled by the about-adapter.js. It measures the
        // latency between peers.
        // this.about.relayMetricsReceived(decryptedStr)
        this.relayMetricsHandler(decryptedStr)

        return data.result.value
      }

      // This is not an /about JSON RPC query.
      // console.log('JSON RPC is not targeting the /about endpoint')
      return false
    } catch (err) {
      console.error('Error in captureMetrics: ', err)
      return false
    }
  }

  // CT 1/21/24: This function will be deprecated and moved to pubsub use cases.
  // Attempts to parse data coming in from a pubsub channel. It is assumed that
  // the data is a string in JSON format. If it isn't, parsing will throw an
  // error and the message will be ignored.
  async parsePubsubMessage (inObj = {}) {
    try {
      const { msg, handler, thisNode } = inObj

      // Skip any repeated messages
      const shouldProcess = this.checkForDuplicateMsg(msg)
      if (!shouldProcess) return false

      const thisNodeId = thisNode.ipfsId

      // Get data about the message.
      const from = msg.detail.from.toString()
      const channel = msg.detail.topic

      // Used for debugging.
      this.log.statusLog(
        2,
        `Broadcast pubsub message recieved from ${from} on channel ${channel}`
      )

      // Ignore this message if it originated from this IPFS node.
      if (from === thisNodeId) return true

      let data
      try {
        // Parse the data into a JSON object. It starts as a Buffer that needs
        // to be converted to a string, then parsed to a JSON object.
        // For some reason I have to JSON parse it twice. Not sure why.
        // data = JSON.parse(JSON.parse(msg.data.toString()))

        data = uint8ArrayToString(msg.detail.data)
        data = JSON.parse(JSON.parse(data))
        // console.log('parsePubsubMessage() 1 data: ', data)

        // console.log('pubsub-adapter/index.js parsePubsubMessage() collect test data: ', msg.detail.data.toString('hex'))
      } catch (err) {
        this.log.statusLog(
          1,
          `Failed to parse JSON in message from ${from} in pubsub channel ${channel}.`
        )

        return false
      }

      const retObj = { from, channel, data }
      // console.log(`new pubsub message received: ${JSON.stringify(retObj, null, 2)}`)

      // Hand retObj to the callback.
      await handler(retObj)

      return true
    } catch (err) {
      console.error('Error in parsePubsubMessage(): ', err.message)
      this.log.statusLog(2, `Error in parsePubsubMessage(): ${err.message}`)
      // Do not throw an error. This is a top-level function.

      return false
    }
  }

  // CT 1/21/24: This function will be deprecated and moved to pubsub use cases.
  // Checks to see if a message has already been processed. This protects against
  // redundent processing.
  checkForDuplicateMsg (msg) {
    const sn = msg.detail.sequenceNumber
    // console.log('sn: ', sn)

    const snExists = this.trackedMsgs.find((x) => x === sn)
    // console.log('snExists: ', snExists)

    // Maintain the tracked message cache.
    this.manageMsgCache()

    if (snExists) {
      // console.log(`msg ${sn} already processed. Rejecting.`)
      return false
    }

    // Add the sn to the array of tracked messages.
    this.trackedMsgs.push(sn)

    return true
  }

  // CT 1/21/24: This function will be deprecated and moved to pubsub use cases.
  // Keep the message queue to a resonable size.
  manageMsgCache () {
    // console.log(`trackedMsgs: `, this.trackedMsgs)

    if (this.trackedMsgs.length > this.TRACKED_MSG_SIZE) {
      this.trackedMsgs.shift()
    }
  }

  // Debugging helper: Get pubsub service status
  getPubsubStatus () {
    try {
      const pubsub = this._getPubsubService()
      const topics = pubsub.getTopics ? pubsub.getTopics() : []
      const registeredHandlers = Array.from(this.topicHandlers.keys())

      // Log debug info at level 2
      this.log.statusLog(2, `Pubsub service available: ${!!pubsub}, listener setup: ${this._globalListenerSetup}, topics: ${topics.length}, handlers: ${this.topicHandlers.size}`)

      return {
        serviceAvailable: true,
        globalListenerSetup: this._globalListenerSetup,
        subscribedTopics: topics,
        registeredHandlers,
        handlerCount: this.topicHandlers.size,
        hasAddEventListener: typeof pubsub.addEventListener === 'function',
        hasOn: typeof pubsub.on === 'function'
      }
    } catch (err) {
      console.error('Error in getPubsubStatus:', err)
      return {
        serviceAvailable: false,
        error: err.message,
        globalListenerSetup: this._globalListenerSetup,
        registeredHandlers: Array.from(this.topicHandlers.keys())
      }
    }
  }
}

// module.exports = PubsubAdapter
export default PubsubAdapter
