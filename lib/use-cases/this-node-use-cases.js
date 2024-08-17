/*
  Use Cases library for the thisNode entity.
*/

// Local libraries
import ThisNodeEntity from '../entities/this-node-entity.js'
import Schema from './schema.js'
import Util from '../util/utils.js'
import { publicIpv4 } from 'public-ip'

class ThisNodeUseCases {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Must inject instance of adapters when instantiating thisNode Use Cases library.'
      )
    }

    // Encapsulate dependencies
    this.utils = new Util()
    this.publicIp = publicIpv4

    // Optional JSON-LD used for announcements. If present, will override
    // default announcement object in Schema library.
    this.tcpPort = localConfig.tcpPort
    this.announceJsonLd = localConfig.announceJsonLd

    // If consuming app wants to configure itself as a Circuit Relay, it can
    // override the default value of false.
    this.isCircuitRelay = localConfig.isCircuitRelay
    if (!this.isCircuitRelay) this.isCircuitRelay = false

    // Additional information for connecting to the circuit relay.
    this.circuitRelayInfo = localConfig.circuitRelayInfo

    // Bind 'this' object to all subfunctions
    this.createSelf = this.createSelf.bind(this)
    this.enforceBlacklist = this.enforceBlacklist.bind(this)
    this.enforceWhitelist = this.enforceWhitelist.bind(this)
  }

  // Create an instance of the 'self' of thisNode. This function aggregates
  // a lot of information pulled from the different adapters.
  async createSelf (initValues = {}) {
    const selfData = {
      // The type of IPFS node this is: browser or node.js
      type: initValues.type
    }

    // Aggregate data from the IPFS adapter.
    selfData.ipfsId = this.adapters.ipfs.ipfsPeerId
    selfData.ipfsMultiaddrs = this.adapters.ipfs.ipfsMultiaddrs

    // Try to auto-detect the public multiaddr and add it.
    if (this.tcpPort) {
      const ip4 = await this.publicIp()
      console.log(`helia-coord using this IP address: ${ip4}, and this TCP port: ${this.tcpPort}`)
      const detectedMultiaddr = `/ip4/${ip4}/tcp/${this.tcpPort}/p2p/${selfData.ipfsId}`
      selfData.ipfsMultiaddrs.push(detectedMultiaddr)
    }

    // Aggregate data from the BCH adapter.
    const bchData = await this.adapters.bch.generateBchId()
    selfData.bchAddr = bchData.cashAddress
    selfData.slpAddr = bchData.slpAddress
    selfData.publicKey = bchData.publicKey
    // selfData.mnemonic = this.adapters.bch.mnemonic

    // Generate an announcement object for this node, to be able to announce
    // itself on the general coordination channel.
    const schemaConfig = {
      ipfsId: selfData.ipfsId,
      type: selfData.type,
      ipfsMultiaddrs: selfData.ipfsMultiaddrs,
      isCircuitRelay: this.isCircuitRelay,
      circuitRelayInfo: this.circuitRelayInfo,
      cashAddress: selfData.bchAddr,
      slpAddress: selfData.slpAddr,
      publicKey: selfData.publicKey,
      // orbitdbId: selfData.orbit.id,
      // apiInfo: '',
      announceJsonLd: this.announceJsonLd
    }
    selfData.schema = new Schema(schemaConfig)

    // console.log('selfData: ', selfData)

    // Create the thisNode entity
    const thisNode = new ThisNodeEntity(selfData)
    this.thisNode = thisNode

    // Attach ther useCases (which includes adapters and controllers) to the
    // thisNode entity.
    // this.thisNode.useCases = this.useCases

    // Subscribe to my own pubsub channel, for receiving info from other peers.
    this.tempHandler = () => {} // This handler will be overwritten by handleNewMessage()

    selfData.pubsub = await this.adapters.pubsub.subscribeToPubsubChannel(
      selfData.ipfsId,
      this.tempHandler,
      this.thisNode
    )
    console.log(`INIT: Subscribed to self private pubsub channel: ${selfData.ipfsId}`)

    return thisNode
  }

  // Enforce the blacklist by actively disconnecting from nodes in the blacklist.
  async enforceBlacklist () {
    try {
      const blacklistPeers = this.thisNode.blacklistPeers
      for (let i = 0; i < blacklistPeers.length; i++) {
        const ipfsId = blacklistPeers[i]

        await this.adapters.ipfs.disconnectFromPeer(ipfsId)
      }

      const blacklistMultiaddrs = this.thisNode.blacklistMultiaddrs
      for (let i = 0; i < blacklistMultiaddrs.length; i++) {
        const multiaddr = blacklistMultiaddrs[i]

        await this.adapters.ipfs.disconnectFromMultiaddr(multiaddr)
      }

      return true
    } catch (err) {
      console.error('Error in enforceBlacklist()')
      throw err
    }
  }

  // An alternative to the blacklist, it's a whitelist, where all nodes are
  // disconnected except ones that have a 'name' property. This ensures that
  // the node only connects to other nodes that are using ipfs-coord.
  async enforceWhitelist () {
    try {
      let showDebugData = false

      // Get all peers.
      const allPeers = await this.adapters.ipfs.getPeers()
      // console.log(`allPeers: ${JSON.stringify(allPeers, null, 2)}`)

      // Get ipfs-coord peers.
      const coordPeers = this.thisNode.peerData
      // console.log(`coordPeers: ${JSON.stringify(coordPeers, null, 2)}`)

      // Try to match each peer up with ipfs-coord info.
      // Add the name from the ipfs-coord info.
      for (let i = 0; i < allPeers.length; i++) {
        const thisPeer = allPeers[i]
        thisPeer.name = ''

        // If IPFS peer exists in the ipfs-coord peer list, then foundPeer
        // will be an array with 1 element.
        const foundPeer = coordPeers.filter(x => x.from.toString().includes(thisPeer.peer.toString())
        )

        // If a connected peer matches an ipfs-coord peer, add the 'name'
        // property to it.
        if (!foundPeer.length) {
          this.adapters.log.statusLog(
            3,
            `Whitelist enforcement disconnecting peer ${thisPeer.peer.toString()}`
          )

          showDebugData = true

          // If a connected peer can not be matched with the list of ipfs-coord
          // peers, then disconnect from it.
          await this.adapters.ipfs.disconnectFromPeer(thisPeer.peer.toString())
        }
      }

      // Show the debugging data once, instead of inside the for-loop, which would
      // show the debugging data each time a peer is disconnected.
      if (showDebugData) {
        // Deep debugging.
        this.adapters.log.statusLog(
          3,
          `allPeers: ${JSON.stringify(allPeers, null, 2)}`
        )
        this.adapters.log.statusLog(
          3,
          `coordPeers: ${JSON.stringify(coordPeers, null, 2)}`
        )
      }

      return true
    } catch (err) {
      console.error('Error in enforceWhitelist()')
      throw err
    }
  }
}

// module.exports = ThisNodeUseCases
export default ThisNodeUseCases
