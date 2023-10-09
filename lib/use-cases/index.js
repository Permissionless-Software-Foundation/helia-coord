/*
  This is a top-level Use Cases library. This library loads all other
  use case libraries, and bundles them into a single object.
*/

// Local libraries
import ThisNodeUseCases from './this-node-use-cases.js'
import RelayUseCases from './relay-use-cases.js'
import PubsubUseCases from './pubsub-use-cases.js'
import PeerUseCases from './peer-use-cases.js'

class UseCases {
  constructor (localConfig = {}) {
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Must inject instance of adapters when instantiating Use Cases library.'
      )
    }

    // Encapsulate dependencies
    this.thisNode = new ThisNodeUseCases(localConfig)

    // Other use-cases depend on the thisNode use case.
    localConfig.thisNodeUseCases = this.thisNode

    this.relays = new RelayUseCases(localConfig)
    this.pubsub = new PubsubUseCases(localConfig)
    this.peer = new PeerUseCases(localConfig)

    // Pass the instances of the other use cases to the ThisNode Use Cases.
    this.thisNode.updateUseCases(this)
  }
}

export default UseCases
