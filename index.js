/*
  A JS npm library for helping IPFS peers coordinate, find a common interest,
  and stay connected around that interest.

  See the specification document in the dev-docs directory.
*/

// Local libraries
import Adapters from './lib/adapters/index.js'
import UseCases from './lib/use-cases/index.js'
import Controllers from './lib/controllers/index.js'

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
    // 3 = everything
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

    // Load the Use Cases
    this.useCases = new UseCases(localConfig)
    localConfig.useCases = this.useCases

    // Load Controllers
    this.controllers = new Controllers(localConfig)
  }

  // Returns a Promise that resolves to true once the IPFS node has been
  // initialized and has had a chance to connect to circuit relays and
  // coordination pubsub channels.
  async start () {
    // Wait for the IPFS to finish initializing, then retrieve information
    // about the node like it's ID and multiaddrs.
    await this.adapters.ipfs.start()

    // Create an instance of the 'self' which represents this IPFS node, BCH
    // wallet, and other things that make up this helia-coord powered IPFS node.
    this.thisNode = await this.useCases.thisNode.createSelf({ type: this.type })
    // console.log('thisNode: ', this.thisNode)

    // Pass instance of thisNode to the other use-case libraries.
    this.useCases.peer.updateThisNode(this.thisNode)
    this.useCases.pubsub.updateThisNode(this.thisNode)

    // Subscribe to Pubsub Channels
    // await this.useCases.pubsub.initializePubsub(this.thisNode)
    await this.useCases.pubsub.initializePubsub({ controllers: this.controllers })

    // Start timer-based controllers.
    await this.controllers.timer.startTimers(this.thisNode)

    // Kick-off initial connection to Circuit Relays and Peers.
    // Note: Deliberatly *not* using await here, so that it doesn't block startup
    // of ipfs-service-provider.
    this._initializeConnections()

    return true
  }

  // This function kicks off initial connections to the circuit relays and then
  // peers. This function is intended to be called once at startup. This handles
  // the initial connections, but the timer-controller manages the connections
  // after this initial function.
  async _initializeConnections () {
    try {
      // Load list of Circuit Relays from GitHub Gist.
      await this.useCases.relays.getCRGist(this.thisNode)
      console.log('Finished connecting to Circuit Relays in GitHub Gist.')

      await this.useCases.thisNode.refreshPeerConnections()
      console.log('Initial connections to subnet Peers complete.')

      return true
    } catch (err) {
      console.error('Error in _initializeConnections(): ', err)
      // throw err

      // Do not throw errors as it will prevent the node from starting.
      return false
    }
  }
}

export default IpfsCoord
