/*
  A Use Case library for interacting with the Pubsub Entity.
*/

// Global npm libraries
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

// Local libraries
import globalConfig from '../../config/global-config.js'

class PubsubUseCase {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Must inject instance of adapters when instantiating Pubsub Use Cases library.'
      )
    }
    this.thisNodeUseCases = localConfig.thisNodeUseCases
    if (!this.thisNodeUseCases) {
      throw new Error(
        'thisNode use cases required when instantiating Pubsub Use Cases library.'
      )
    }

    // Allow the app to override the default CoinJoin pubsub handler.
    this.coinjoinPubsubHandler = () => true
    if (localConfig.coinjoinPubsubHandler) this.coinjoinPubsubHandler = localConfig.coinjoinPubsubHandler

    // Encapsulate dependencies
    this.config = globalConfig

    // Bind 'this' object to all subfunctions
    this.initializePubsub = this.initializePubsub.bind(this)
    this.parseCoordPubsub = this.parseCoordPubsub.bind(this)
    this.checkForDuplicateMsg = this.checkForDuplicateMsg.bind(this)
    this.manageMsgCache = this.manageMsgCache.bind(this)

    // State
    this.trackedMsgs = [] // Used reject repeated messages
    this.TRACKED_MSG_SIZE = 100
    this.thisNode = null // placeholder
  }

  // This function is used to pass the 'thisNode' object this use-case library.
  // thisNode is the state of the IPFS node this library controls.
  // This function is called on startup, by the main index.js library.
  updateThisNode (thisNode) {
    this.thisNode = thisNode

    return true
  }

  // Connect to the default pubsub rooms.
  async initializePubsub (inObj = {}) {
    try {
      // Input validation
      if (!this.thisNode) {
        throw new Error('Instance of thisNode object must be updated by calling updateThisNode() first.')
      }
      const { controllers } = inObj
      if (!controllers) {
        throw new Error('Instance of controllers must be passed to initializePubsub()')
      }

      // Subscribe to the coordination channel, where new peers announce themselves
      // to the network.
      console.log(`INIT: subscribing to coordination pubsub channel: ${this.config.DEFAULT_COORDINATION_ROOM}`)
      // await this.adapters.pubsub.subscribeToPubsubChannel(
      //   this.config.DEFAULT_COORDINATION_ROOM,
      //   this.coordChanHandler
      // )
      await this.adapters.pubsub.subscribeToCoordChannel({
        chanName: this.config.DEFAULT_COORDINATION_ROOM,
        handler: controllers.pubsub.coordChanHandler
      })

      // Add the pubsub information to the thisNode object.
      const pubsubObj = {
        channelName: this.config.DEFAULT_COORDINATION_ROOM,
        handler: 'controllers.pubsub.coordChanHandler'
      }
      this.thisNode.pubsubChannels.push(pubsubObj)

      // Subscribe to the BCH CoinJoin coordination channel. This code is here
      // so that Circuit Relays automatically subscribe to the channel and
      // relay the messages.
      // console.log(`INIT: subscribing to CoinJoin pubsub channel: ${this.config.BCH_COINJOIN_ROOM}`)
      // await this.adapters.pubsub.subscribeToPubsubChannel(
      //   this.config.BCH_COINJOIN_ROOM,
      //   this.coinjoinPubsubHandler
      // )

      return true
    } catch (err) {
      console.error('Error in pubsub-use-cases.js/initializePubsub()')
      throw err
    }
  }

  // Connect to the default pubsub rooms.
  // async initializePubsub () {
  //   try {
  //
  //
  //     // Subscribe to the coordination channel, where new peers announce themselves
  //     // to the network.
  //     console.log(`INIT: subscribing to coordination pubsub channel: ${this.config.DEFAULT_COORDINATION_ROOM}`)
  //     await this.adapters.pubsub.subscribeToPubsubChannel(
  //       this.config.DEFAULT_COORDINATION_ROOM,
  //       // this.adapters.peers.addPeer
  //       this.thisNodeUseCases.addSubnetPeer,
  //       thisNode
  //     )
  //
  //     // Add the pubsub information to the thisNode object.
  //     let pubsubObj = {
  //       channelName: this.config.DEFAULT_COORDINATION_ROOM,
  //       handler: this.thisNodeUseCases.addSubnetPeer
  //     }
  //     this.thisNode.pubsubChannels.push(pubsubObj)
  //
  //     // Subscribe to the BCH CoinJoin coordination channel. This code is here
  //     // so that Circuit Relays automatically subscribe to the channel and
  //     // relay the messages.
  //     console.log(`INIT: subscribing to CoinJoin pubsub channel: ${this.config.BCH_COINJOIN_ROOM}`)
  //     await this.adapters.pubsub.subscribeToPubsubChannel(
  //       this.config.BCH_COINJOIN_ROOM,
  //       this.coinjoinPubsubHandler,
  //       thisNode
  //     )
  //
  //     // Add the pubsub information to the thisNode object.
  //     pubsubObj = {
  //       channelName: this.config.BCH_COINJOIN_ROOM,
  //       handler: this.coinjoinPubsubHandler
  //     }
  //     this.thisNode.pubsubChannels.push(pubsubObj)
  //   } catch (err) {
  //     console.error('Error in pubsub-use-cases.js/initializePubsub()')
  //     throw err
  //   }
  // }

  // Parse incoming messages on the general coordination pubsub channel.
  parseCoordPubsub (inObj = {}) {
    try {
      const { msg } = inObj

      // Skip any repeated messages
      const shouldProcess = this.checkForDuplicateMsg(msg)
      if (!shouldProcess) {
        // console.log('parseCoordPubsub() duplicate message.')
        return false
      }

      // Get data about the message.
      const from = msg.detail.from.toString()
      const channel = msg.detail.topic

      // Ignore this message if it originated from this IPFS node.
      const thisNodeId = this.adapters.ipfs.ipfsPeerId
      if (from === thisNodeId) {
        // console.log('parseCoordPubsub() message came from this node.')
        return false
      }

      // Used for debugging.
      this.adapters.log.statusLog(
        2,
        `Coordination pubsub message recieved from ${from} on channel ${channel}`
      )

      let data
      try {
        // Parse the data into a JSON object. It starts as a Buffer that needs
        // to be converted to a string, then parsed to a JSON object.
        // For some reason I have to JSON parse it twice. Not sure why.
        data = uint8ArrayToString(msg.detail.data)
        data = JSON.parse(JSON.parse(data))
      } catch (err) {
        this.adapters.log.statusLog(
          1,
          `Failed to parse JSON in message from ${from} in pubsub channel ${channel}.`
        )

        return false
      }

      const retObj = { from, channel, data }
      // console.log(`new pubsub message received: ${JSON.stringify(retObj, null, 2)}`)

      return retObj
    } catch (err) {
      console.error('Error in use-cases/pubsub-use-cases.js/parseCoordPubsub()')
      throw err
    }
  }

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

  // Keep the message queue to a resonable size.
  manageMsgCache () {
    // console.log(`trackedMsgs: `, this.trackedMsgs)

    if (this.trackedMsgs.length > this.TRACKED_MSG_SIZE) {
      this.trackedMsgs.shift()
    }
  }
}

export default PubsubUseCase
