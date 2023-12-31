/*
  This is a top-level library for the Adapters. This file loads all other
  adapter libraries.
*/

// Public npm libraries

// Local libraries
import LogsAdapter from './logs-adapter.js'
import BchAdapter from './bch-adapter.js'
import IpfsAdapter from './ipfs-adapter.js'
import EncryptionAdapter from './encryption-adapter.js'
import PubsubAdapter from './pubsub-adapter/index.js'
import Gist from './gist.js'

class Adapters {
  constructor (localConfig = {}) {
    // Dependency injection
    if (!localConfig.ipfs) {
      throw new Error(
        'An instance of IPFS must be passed when instantiating the Adapters library.'
      )
    }
    if (!localConfig.wallet) {
      throw new Error(
        'An instance of minimal-slp-wallet must be passed when instantiating the Adapters library.'
      )
    }

    // Input Validation
    if (!localConfig.type) {
      throw new Error(
        'The type of IPFS node (browser or node.js) must be specified.'
      )
    }

    // BEGIN: Encapsulate dependencies

    // Some adapter libraries depend on other adapter libraries. Pass them
    // in the localConfig object.

    this.log = new LogsAdapter(localConfig)
    localConfig.log = this.log

    this.bch = new BchAdapter(localConfig)
    localConfig.bch = this.bch

    this.ipfs = new IpfsAdapter(localConfig)
    localConfig.ipfsAdapter = this.ipfs

    this.encryption = new EncryptionAdapter(localConfig)
    localConfig.encryption = this.encryption

    this.pubsub = new PubsubAdapter(localConfig)
    this.gist = new Gist(localConfig)

  // END: Encapsulate dependencies
  }
}

// module.exports = Adapters
export default Adapters
