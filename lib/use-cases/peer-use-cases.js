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
          if (connected) {
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
}

export default PeerUseCases
