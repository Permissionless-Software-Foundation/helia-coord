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

    // Initialize v1 relay list. Allows user to overwrite with local config.
    // if (localConfig.v1Relays) {
    //   this.v1Relays = localConfig.v1Relays
    //   // console.log('v1Relays: ', this.v1Relays)
    // }
    // console.log('this-node-use-cases.js v1Relays: ', this.v1Relays)

    // Bind 'this' object to all subfunctions
    this.updateUseCases = this.updateUseCases.bind(this)
    this.createSelf = this.createSelf.bind(this)
    this.addSubnetPeer = this.addSubnetPeer.bind(this)
    this.isFreshPeer = this.isFreshPeer.bind(this)
    this.refreshPeerConnections = this.refreshPeerConnections.bind(this)
    this.enforceBlacklist = this.enforceBlacklist.bind(this)
    this.enforceWhitelist = this.enforceWhitelist.bind(this)
  }

  // Update this instance with copies of the other Use Case libraries.
  updateUseCases (useCaseParent) {
    this.useCases = {
      relays: useCaseParent.relays,
      pubsub: useCaseParent.pubsub,
      peer: useCaseParent.peer
    }
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
    this.thisNode.useCases = this.useCases

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

  // This is an event handler that is triggered by a new announcement object
  // being recieved on the general coordination pubsub channel.
  // pubsub-use-cases.js/initializePubSub() depends on this function.
  async addSubnetPeer (announceObj) {
    try {
      // Exit if the announcement object is stale.
      if (!this.isFreshPeer(announceObj)) return

      const thisPeerId = announceObj.from.toString()
      this.adapters.log.statusLog(
        1,
        `announcement recieved from ${thisPeerId}`
      )

      this.adapters.log.statusLog(
        3,
        `announcement recieved from ${thisPeerId}: `,
        announceObj
      )

      // console.log('this.thisNode.peerList: ', this.thisNode.peerList)

      // Add a timestamp.
      const now = new Date()
      announceObj.data.updatedAt = now.toISOString()

      // If the peer is not already in the list of known peers, then add it.
      if (!this.thisNode.peerList.includes(thisPeerId)) {
        this.adapters.log.statusLog(1, `New peer found: ${thisPeerId}`)

        // Add this peer to the list of subnet peers tracked by this node.
        this.thisNode.peerList.push(thisPeerId)

        // Add the announcement data object to the peerData array tracked by This Node.
        this.thisNode.peerData.push(announceObj)

        // Subscribe to pubsub channel for private messages to peer.
        // Ignore any messages on this channel, since it is only used for
        // broadcasting encrypted messages to the new peer, and they will
        // respond on our own channel.
        this.adapters.ipfs.ipfs.libp2p.services.pubsub.subscribe(thisPeerId)
        // this.adapters.ipfs.ipfs.libp2p.services.pubsub.addEventListener('message', (msg) => {})
        this.adapters.log.statusLog(2, `Subscribed to peer pubsub channel ${thisPeerId}`)

        // If the new peer has the isCircuitRelay flag set, then try to add it
        // to the list of Circuit Relays.
        if (announceObj.data.isCircuitRelay) {
          // console.log('this.thisNode: ', this.thisNode)
          await this.useCases.relays.addRelay(thisPeerId, this.thisNode)
        }
      } else {
        // Peer already exists in the list.
        // console.log(`debug: Updating existing peer: ${thisPeerId}`)

        // Get the data for this peer.
        let thisPeerData = this.thisNode.peerData.filter(
          x => x.from === thisPeerId
        )
        thisPeerData = thisPeerData[0]
        // console.log('addSubnetPeer() thisPeerData: ', thisPeerData)

        if (!thisPeerData) return false

        const dataIndex = this.thisNode.peerData.indexOf(thisPeerData)
        // console.log(`dataIndex: ${dataIndex}`)

        // If the new announceObj is older than the last announceObj, then
        // ignore it.
        const oldBroadcastDate = new Date(thisPeerData.data.broadcastedAt)
        const newBroadcastDate = new Date(announceObj.data.broadcastedAt)
        if (newBroadcastDate.getTime() < oldBroadcastDate.getTime()) {
          return true
        }

        const oldData = this.thisNode.peerData[dataIndex]

        // Replace the old data with the new data.
        this.thisNode.peerData[dataIndex] = announceObj

        // Add any data that should persist from the old entry.
        this.thisNode.peerData[dataIndex].data.connectionAddr = oldData.data.connectionAddr
      }

      // console.log(`addSubnetPeer() finished processing pubsub message from ${announceObj.from}`)

      return true
    } catch (err) {
      console.error('Error in this-node-use-cases.js/addSubnetPeer(): ', err)

      this.adapters.log.statusLog(
        2,
        'Error in this-node-use-cases.js/addSubnetPeer(): ',
        err
      )

    // Do not throw an error. This is a top-level function called by the
    // pubsub handler for the general coordination channel.
    }
  }

  // Detects if a peer has gone 'stale' (inactive), or is still 'fresh' (active).
  // Stale means it hasn't updated it's
  // broadcastedAt property in more than 10 minutes.
  // Return true if the peer is 'fresh', and false if 'stale'.
  isFreshPeer (announceObj) {
    try {
      // Ignore announcements that do not have a broadcastedAt timestamp.
      if (!announceObj.data.broadcastedAt) return false

      // Ignore items that are older than 10 minutes.
      const now = new Date()
      const broadcastTime = new Date(announceObj.data.broadcastedAt)
      const tenMinutes = 60000 * 10
      const timeDiff = now.getTime() - broadcastTime.getTime()
      if (timeDiff > tenMinutes) return false

      return true
    } catch (err) {
      console.error('Error in stalePeer()')
      throw err
    }
  }

  // Called by an Interval, ensures connections are maintained to known pubsub
  // peers. This will heal connections if nodes drop in and out of the network.
  // Connection workflow:
  // - If the peer is a Circuit Relay, skip it. Connecting to it will handled by
  //   a Relay use-case function.
  // - Attempt to connect to peer directly through its advertised multiaddrs.
  // - Connect to peer via v2 Circuit Relay over webRTC.
  async refreshPeerConnections () {
    try {
      // console.log('this.thisNode: ', this.thisNode)

      // const relays = this.cr.state.relays
      const relays = this.thisNode.relayData
      const peers = this.thisNode.peerList
      // console.log('peers: ', peers)

      // Get connected peers
      const connectedPeers = await this.adapters.ipfs.getPeers()
      this.adapters.log.statusLog(
        1,
        'refreshPeerConnections() connectedPeers: ',
        connectedPeers
      )

      // console.log('thisNode.peerData: ', this.thisNode.peerData)

      // Loop through each known peer
      for (let i = 0; i < peers.length; i++) {
        // const thisPeer = this.state.peers[peer]
        const thisPeer = peers[i]
        // console.log(`thisPeer: ${JSON.stringify(thisPeer, null, 2)}`)

        // Check if target peer is currently conected to the node.
        const connectedPeer = connectedPeers.filter(
          peerObj => peerObj === thisPeer
        )
        // console.log('connectedPeer: ', connectedPeer)

        // If this node is already connected to the peer, then skip this peers.
        // We do not need to do anything.
        if (connectedPeer.length) {
          this.adapters.log.statusLog(
            1,
            `Skipping peer in refreshPeerConnections(). Already connected to peer ${thisPeer}`
          )
          continue
        }

        // Get the peer data for the current peer.
        let peerData = this.thisNode.peerData.filter(x => x.from.includes(thisPeer))
        peerData = peerData[0]
        // console.log('peerData: ', peerData)

        // If broadcastedAt value is older than 10 minutes, skip connecting
        // to the peer. It may be stale information.
        if (!this.isFreshPeer(peerData)) {
          this.adapters.log.statusLog(1, `Peer ${peerData.from} is stale. Skipping.`)
          continue
        }

        let connected = { success: false }

        // If peer advertises itself as a Circuit Relay, skip it. Connection
        // will be handled by a Relay use-case function.
        if (peerData.data && peerData.data.isCircuitRelay) {
          continue
        }

        // Try a direct connection with the peer by going through
        // the multiaddrs in the announcement object.
        const filteredMultiaddrs = this.utils.filterMultiaddrs(peerData.data.ipfsMultiaddrs)
        this.adapters.log.statusLog(1, 'filteredMultiaddrs: ', filteredMultiaddrs)

        for (let j = 0; j < filteredMultiaddrs.length; j++) {
          const multiaddr = filteredMultiaddrs[j]
          this.adapters.log.statusLog(1,
            `Trying a direct connecto to peer ${thisPeer} with this multiaddr: ${multiaddr}.`
          )

          // Attempt to connect to the node through a circuit relay.
          connected = await this.adapters.ipfs.connectToPeer({ multiaddr })
          // console.log('direct connection connected: ', connected)

          // If the connection was successful, break out of the relay loop.
          // Otherwise try to connect through the next relay.
          if (connected.success) {
            this.adapters.log.statusLog(1,
              `Successfully connected to peer ${thisPeer} through direct connection: ${multiaddr}.`
            )

            // Add the connection multiaddr to the peer, so that we can see
            // exactly how we're connected to the peer.
            // const thisPeerData = this.thisNode.peerData.filter(x => x.from === thisPeer)
            // thisPeerData[0].data.connectionAddr = multiaddr
            peerData.data.connectionAddr = multiaddr

            // Break out of the loop once we've made a successful connection.
            break
          } else {
            this.adapters.log.statusLog(1,
              `Failed to connect to peer ${thisPeer} through direct connection: ${multiaddr}. Reason: ${connected.details}`
            )
          }
        }

        if (connected.success) {
          continue
        }

        // Sort the Circuit Relays by the average of the aboutLatency
        // array. Connect to peers through the Relays with the lowest latencies
        // first.
        const sortedRelays = this.thisNode.useCases.relays.sortRelays(relays)
        // console.log(`sortedRelays: ${JSON.stringify(sortedRelays, null, 2)}`)

        // Loop through each known circuit relay and attempt to connect to the
        // peer through a relay.
        for (let j = 0; j < sortedRelays.length; j++) {
          const thisRelay = sortedRelays[j]
          // console.log(`thisRelay: ${JSON.stringify(thisRelay, null, 2)}`)

          // Generate a multiaddr for connecting to the peer through a circuit relay.
          // This is for a tcp connection.
          // const multiaddr = `${thisRelay.multiaddr}/p2p-circuit/p2p/${thisPeer}`
          // console.log(`multiaddr: ${multiaddr}`)

          // Use a WebRTC circuit relay connection, since this is the focus for
          // the js-libp2p project and allows establishing of p2p connections.
          const multiaddr = `${thisRelay.multiaddr}/p2p-circuit/webrtc/p2p/${thisPeer}`

          // Skip the relay if this node is not connected to it.
          if (thisRelay.connected) {
            this.adapters.log.statusLog(1, `refreshPeerConnections() connecting to peer with this multiaddr: ${multiaddr}`)

            // Attempt to connect to the node through a circuit relay.
            connected = await this.adapters.ipfs.connectToPeer({ multiaddr })
            // console.log('v2 relay connected: ', connected)

            // If the connection was successful, break out of the relay loop.
            // Otherwise try to connect through the next relay.
            if (connected.success) {
              this.adapters.log.statusLog(1,
                `Successfully connected to peer ${thisPeer} through v2 circuit relay ${thisRelay.multiaddr}.`
              )

              // Add the connection multiaddr to the peer, so that we can see
              // exactly how we're connected to the peer.
              // const thisPeerData = this.thisNode.peerData.filter(x => x.from === thisPeer)
              // thisPeerData[0].data.connectionAddr = multiaddr
              peerData.data.connectionAddr = multiaddr

              // Break out of the loop once we've made a successful connection.
              break
            } else {
              this.adapters.log.statusLog(1,
                `Failed to connect to peer ${thisPeer} through v2 circuit relay: ${multiaddr}. Reason: ${connected.details}`
              )
            }
          }
        }

        if (connected.success) {
          continue
        }
      }

      const now = new Date()
      this.adapters.log.statusLog(
        2,
        `Renewed connections to all known peers at ${now.toLocaleString()}`
      )

      return true
    } catch (err) {
      console.error('Error in refreshPeerConnections()')
      throw err
    }
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
