/*
  Adapter library for working with pubsub channels and messages
*/

// Local libraries
import Messaging from './messaging.js'
import AboutAdapter from './about-adapter.js'
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
    this.about = new AboutAdapter(localConfig)

    this.nodeType = localConfig.nodeType
    if (!this.nodeType) {
      this.nodeType = 'node.js'
    }

    // Bind functions that are called by event handlers
    this.parsePubsubMessage = this.parsePubsubMessage.bind(this)
    this.handleNewMessage = this.handleNewMessage.bind(this)
    this.checkForDuplicateMsg = this.checkForDuplicateMsg.bind(this)
    this.manageMsgCache = this.manageMsgCache.bind(this)

    // State
    this.trackedMsgs = [] // Used reject repeated messages
    this.TRACKED_MSG_SIZE = 100
  }

  // Subscribe to a pubsub channel. Any data received on that channel is passed
  // to the handler.
  async subscribeToPubsubChannel (chanName, handler, thisNode) {
    try {
      // console.log('thisNode: ', thisNode)
      const thisNodeId = thisNode.ipfsId

      // Normal use-case, where the pubsub channel is NOT the receiving channel
      // for this node. This applies to general broadcast channels like
      // the coordination channel that all nodes use to annouce themselves.
      if (chanName !== thisNodeId) {
        // Instantiate the Broadcast message router library
        const bRouterOptions = {
          handler,
          thisNode,
          parsePubsubMessage: this.parsePubsubMessage
        }
        const broadcastRouter = new BroadcastRouter(bRouterOptions)

        // Subscribe to the pubsub channel.
        this.ipfs.ipfs.libp2p.services.pubsub.subscribe(chanName.toString())

        // Route incoming message events to the appropriate handler.
        this.ipfs.ipfs.libp2p.services.pubsub.addEventListener('message', broadcastRouter.route)

      //
      } else {
        // Subscribing to our own pubsub channel. This is the channel other nodes
        // will use to send RPC commands and send private messages.

        // Instantiate the Broadcast message router library
        const pRouterOptions = {
          thisNode,
          messaging: this.messaging,
          handleNewMessage: this.handleNewMessage
        }
        const privateRouter = new PrivateChannelRouter(pRouterOptions)

        // Subscribe to the pubsub channel. Route any incoming messages to the
        // this library.
        this.ipfs.ipfs.libp2p.services.pubsub.subscribe(chanName.toString())

        // Route incoming message events.
        this.ipfs.ipfs.libp2p.services.pubsub.addEventListener('message', privateRouter.route)
      }

      this.log.statusLog(
        0,
        `status: Subscribed to pubsub channel: ${chanName}`
      )

      return true
    } catch (err) {
      console.error('Error in subscribeToPubsubChannel()')
      throw err
    }
  }

  // Subscribe to the general coordination pubsub channel
  // Dev Note: I probably don't need to pass in the chanName, since I can pull
  // that from the global config library.
  async subscribeToCoordChannel (inObj = {}) {
    try {
      const { chanName, handler } = inObj

      // Subscribe to the pubsub channel.
      this.ipfs.ipfs.libp2p.services.pubsub.subscribe(chanName)

      // Route incoming message events to the appropriate handler.
      this.ipfs.ipfs.libp2p.services.pubsub.addEventListener('message', handler)

      return true
    } catch (err) {
      console.error('Error in subscribeToCoordChannel()')
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
        this.about.relayMetricsReceived(decryptedStr)

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
}

// module.exports = PubsubAdapter
export default PubsubAdapter
