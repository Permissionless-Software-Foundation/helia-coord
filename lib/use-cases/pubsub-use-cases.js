/*
  A Use Case library for interacting with the Pubsub Entity.
*/

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
  }

  // Connect to the default pubsub rooms.
  async initializePubsub (thisNode) {
    try {
      // Subscribe to the coordination channel, where new peers announce themselves
      // to the network.
      console.log(`INIT: subscribing to coordination pubsub channel: ${this.config.DEFAULT_COORDINATION_ROOM}`)
      await this.adapters.pubsub.subscribeToPubsubChannel(
        this.config.DEFAULT_COORDINATION_ROOM,
        // this.adapters.peers.addPeer
        this.thisNodeUseCases.addSubnetPeer,
        thisNode
      )

      // Subscribe to the BCH CoinJoin coordination channel. This code is here
      // so that Circuit Relays automatically subscribe to the channel and
      // relay the messages.
      console.log(`INIT: subscribing to CoinJoin pubsub channel: ${this.config.BCH_COINJOIN_ROOM}`)
      await this.adapters.pubsub.subscribeToPubsubChannel(
        this.config.BCH_COINJOIN_ROOM,
        this.coinjoinPubsubHandler,
        thisNode
      )
    } catch (err) {
      console.error('Error in pubsub-use-cases.js/initializePubsub()')
      throw err
    }
  }
}

export default PubsubUseCase
