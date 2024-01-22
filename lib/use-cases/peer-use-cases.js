/*
  Use cases for interacting with subnet peer nodes.
*/

class PeerUseCases {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Must inject instance of adapters when instantiating Peer Use Cases library.'
      )
    }
    this.relayUseCases = localConfig.relayUseCases
    if (!this.relayUseCases) {
      throw new Error(
        'Must inject instance of Relay Use Cases when instantiating Peer Use Cases library.'
      )
    }

    // Bind 'this' object to all subfunctions.
    this.updateThisNode = this.updateThisNode.bind(this)
    this.connectToPeer = this.connectToPeer.bind(this)
    this.sendPrivateMessage = this.sendPrivateMessage.bind(this)
    this.addSubnetPeer = this.addSubnetPeer.bind(this)
    this.isFreshPeer = this.isFreshPeer.bind(this)

    // State
    this.thisNode = null // placeholder
  }

  // This function is used to pass the 'thisNode' object this use-case library.
  // thisNode is the state of the IPFS node this library controls.
  // This function is called on startup, by the main index.js library.
  updateThisNode (thisNode) {
    this.thisNode = thisNode

    return true
  }

  // 11/3/23 CT: I don't believe this function is called. I believe it can be
  // deprecated and deleted.
  //
  // Connect to a peer through available circuit relays. This ensures a short
  // path between peers, *before* broadcasting the OrbitDB message to them.
  // This method is primarily used by sendPrivateMessage() to allow for fast-
  // startup connection and communication with peers.
  async connectToPeer (peerId, thisNode) {
    try {
      // console.log(`connectToPeer() called on ${peerId}`)

      const relays = thisNode.relayData

      // Get connected peers
      const connectedPeers = await this.adapters.ipfs.getPeers()

      // Check if target peer is currently conected to the node.
      const connectedPeer = connectedPeers.filter(
        peerObj => peerObj.peer === peerId
      )

      // If this node is already connected to the peer, then return.
      // We do not need to do anything.
      if (connectedPeer.length) {
        return true
      }

      // Sort the Circuit Relays by the average of the aboutLatency
      // array. Connect to peers through the Relays with the lowest latencies
      // first.
      const sortedRelays = thisNode.useCases.relays.sortRelays(relays)
      // console.log(`sortedRelays: ${JSON.stringify(sortedRelays, null, 2)}`)

      // Loop through each known circuit relay and attempt to connect to the
      // peer through a relay.
      for (let i = 0; i < sortedRelays.length; i++) {
        const thisRelay = sortedRelays[i]
        // console.log(`thisRelay: ${JSON.stringify(thisRelay, null, 2)}`)

        // Generate a multiaddr for connecting to the peer through a circuit relay.
        const multiaddr = `${thisRelay.multiaddr}/p2p-circuit/p2p/${peerId}`
        // console.log(`multiaddr: ${multiaddr}`)

        // Skip the relay if this node is not connected to it.
        if (thisRelay.connected) {
          // Attempt to connect to the node through a circuit relay.
          const connected = await this.adapters.ipfs.connectToPeer(multiaddr)

          // If the connection was successful, break out of the relay loop.
          // Otherwise try to connect through the next relay.
          if (connected.status) {
            // Exit once we've made a successful connection.
            return true
          }
        }
      }

      // Return false to indicate connection was unsuccessful.
      return false
    } catch (err) {
      console.error('Error in peer-use-cases.js/connectToPeer()')
      throw err
    }
  }

  // Publish a string of text to another peers OrbitDB recieve database.
  // orbitdbId input is optional.
  async sendPrivateMessage (peerId, str, thisNode) {
    try {
      // console.log('sendPrivateMessage() peerId: ', peerId)
      // console.log('\nsendPrivateMessage() str: ', str)

      // const peer = this.peers.state.peers[peerId]
      // console.log('thisNode.peerData: ', thisNode.peerData)
      const peerData = thisNode.peerData.filter(x => x.from === peerId)
      // console.log(
      //   `sendPrivateMessage peerData: ${JSON.stringify(peerData, null, 2)}`
      // )

      // Throw an error if the peer matching the peerId is not found.
      if (peerData.length === 0) {
        throw new Error(`Data for peer ${peerId} not found.`)
      }

      // Encrypt the string with the peers public key.
      const encryptedStr = await this.adapters.encryption.encryptMsg(
        peerData[0],
        str
      )

      // Publish the message to the peers pubsub channel.
      await this.adapters.pubsub.messaging.sendMsg(
        peerId,
        encryptedStr,
        thisNode
      )
      // console.log('--->Successfully published to pubsub channel<---')

      return true
    } catch (err) {
      console.error('Error in peer-use-cases.js/sendPrivateMessage(): ', err)
      throw err
    }
  }

  // This is an event handler that is triggered by a new announcement object
  // being recieved on the general coordination pubsub channel.
  // pubsub-use-cases.js/initializePubSub() depends on this function.
  async addSubnetPeer (announceObj) {
    try {
      // Exit if the announcement object is stale.
      if (!this.isFreshPeer(announceObj)) return

      const thisPeerId = announceObj.from
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

        // Add the name of the node to the top-level of the data.
        // announceObj.name = announceObj.data.jsonLd.name

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
          await this.relayUseCases.addRelay(thisPeerId, this.thisNode)
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
      console.error('Error in peer-use-cases.js/addSubnetPeer()')

      this.adapters.log.statusLog(
        2,
        'Error in peer-use-cases.js/addSubnetPeer(): ',
        err
      )

      throw err
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
}

export default PeerUseCases
