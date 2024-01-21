/*
  This library defines the pubsub controllers.

  In Clean Architecture, Controllers are inputs to the system. When a pubsub
  message is recieved, this is an input to the system.
*/

// Local libraries
import globalConfig from '../../config/global-config.js'

class PubsubController {
  constructor (localConfig = {}) {
    // Dependency Injection
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters required when instantiating Pubsub Controllers'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of use cases required when instantiating Pubsub Controllers'
      )
    }

    // Encapsulate dependencies
    this.config = globalConfig

    // Bind 'this' object to all subfunctions.
    this.initializePubsub = this.initializePubsub.bind(this)
    this.coordChanHandler = this.coordChanHandler.bind(this)

    // Allow the app to override the default CoinJoin pubsub handler.
    this.coinjoinPubsubHandler = () => true
    if (localConfig.coinjoinPubsubHandler) this.coinjoinPubsubHandler = localConfig.coinjoinPubsubHandler
  }

  // Connect to the default pubsub rooms.
  async initializePubsub () {
    try {
      // Subscribe to the coordination channel, where new peers announce themselves
      // to the network.
      console.log(`INIT: subscribing to coordination pubsub channel: ${this.config.DEFAULT_COORDINATION_ROOM}`)
      // await this.adapters.pubsub.subscribeToPubsubChannel(
      //   this.config.DEFAULT_COORDINATION_ROOM,
      //   this.coordChanHandler
      // )
      await this.adapters.pubsub.subscribeToCoordChannel({
        chanName: this.config.DEFAULT_COORDINATION_ROOM,
        handler: this.coordChanHandler
      })

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

  // This controller handles and filters new messages coming in to the
  // coordination channel.
  async coordChanHandler (msg) {
    try {
      // console.log('coordChanHandler() started. msg: ', msg)

      // Automatically exit if message is a private message
      // TODO: Allow the user to load a list is other pubsub channels to localConfig?
      // 10/27/23 libp2p@v0.45.16: pubsub messages from other topics trigger
      // this event handler even though they shouldn't. This filters out all
      // pubsub messages that not within the scope of this pubsub topic.
      if (msg.detail.topic !== this.config.DEFAULT_COORDINATION_ROOM) {
        return false
      }

      // Parse the message.
      const parsedData = await this.useCases.pubsub.parseCoordPubsub({ msg })
      console.log('coordChanHandler() parsed data: ', parsedData)

      await this.useCases.peer.addSubnetPeer(parsedData)

      return true
    } catch (err) {
      console.error('Error in controllers/pubsub-controller.js/coordChanHandler(): ', err)
      // Do not throw error. This is a top-level function.
      return false
    }
  }
}

export default PubsubController
