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
    // this.initializePubsub = this.initializePubsub.bind(this)
    this.coordChanHandler = this.coordChanHandler.bind(this)

    // Allow the app to override the default CoinJoin pubsub handler.
    this.coinjoinPubsubHandler = () => true
    if (localConfig.coinjoinPubsubHandler) this.coinjoinPubsubHandler = localConfig.coinjoinPubsubHandler
  }

  // This controller handles and filters new messages coming in to the
  // coordination channel.
  async coordChanHandler (msg) {
    try {
      // console.log('coordChanHandler() started. msg.detail: ', msg.detail)

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
      // console.log('coordChanHandler() parsed data: ', parsedData)

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
