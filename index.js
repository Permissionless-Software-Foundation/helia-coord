/*
  A JS npm library for helping IPFS peers coordinate, find a common interest,
  and stay connected around that interest.

  See the specification document in the dev-docs directory.
*/

// Local libraries
import Adapters from './lib/adapters/index.js'

class IpfsCoord {
  constructor (localConfig = {}) {
    // Dependency Injection
    if (!localConfig.ipfs) {
      throw new Error(
        'An instance of IPFS must be passed when instantiating the ipfs-coord library.'
      )
    }
    if (!localConfig.wallet) {
      throw new Error(
        'An instance of minimal-slp-wallet must be passed when instantiating the ipfs-coord library.'
      )
    }
    this.type = localConfig.type
    if (!this.type) {
      throw new Error(
        'The type of IPFS node (browser or node.js) must be specified.'
      )
    }

    // Retrieve and/or set the debug level.
    // 0 = no debug information.
    // 1 = status logs
    // 2 = verbose errors about peer connections
    this.debugLevel = parseInt(localConfig.debugLevel)
    if (!this.debugLevel) this.debugLevel = 0
    localConfig.debugLevel = this.debugLevel
    console.log(`ipfs-coord debug level: ${localConfig.debugLevel}`)

    // localConfiguration of an optional 'status' log handler for log reports. If none
    // is specified, defaults to console.log.
    if (localConfig.statusLog) {
      this.statusLog = localConfig.statusLog
    } else {
      this.statusLog = console.log
    }
    // If the statusLog handler wasn't specified, then define it.
    localConfig.statusLog = this.statusLog

    // localConfiguration of an optional 'private' log handler for recieving e2e
    // encrypted message. If none is specified, default to console.log.
    if (localConfig.privateLog) {
      this.privateLog = localConfig.privateLog
    } else {
      this.privateLog = console.log
    }
    // If the privateLog handler wasn't specified, then define it.
    localConfig.privateLog = this.privateLog

    // Load the adapter libraries.
    this.adapters = new Adapters(localConfig)
    localConfig.adapters = this.adapters
  }
}

export default IpfsCoord
