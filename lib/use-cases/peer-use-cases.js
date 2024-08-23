/*
  Use cases for interacting with subnet peer nodes.
*/

// Global npm libraries
import { multiaddr } from '@multiformats/multiaddr'
import globalConfig from '../../config/global-config.js'

// Local libraries
import Util from '../util/utils.js'

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

    // Encapsulate dependencies
    this.utils = new Util()
    this.multiaddr = multiaddr
    this.config = globalConfig

    // Bind 'this' object to all subfunctions.
    this.updateThisNode = this.updateThisNode.bind(this)
    this.updateThisNode = this.updateThisNode.bind(this)
    this.connectToPeer = this.connectToPeer.bind(this)
    this.sendPrivateMessage = this.sendPrivateMessage.bind(this)
    this.addSubnetPeer = this.addSubnetPeer.bind(this)
    this.isFreshPeer = this.isFreshPeer.bind(this)
    this.updatePeerConnectionInfo = this.updatePeerConnectionInfo.bind(this)
    this.queryAbout = this.queryAbout.bind(this)
    this.sendRPC = this.sendRPC.bind(this)
    this.relayMetricsHandler = this.relayMetricsHandler.bind(this)

    // Inject the relayMetricsHandler function into the pubsub adapter.
    this.adapters.pubsub.injectMetricsHandler(this.relayMetricsHandler)

    // STATE
    this.thisNode = null // placeholder
    // Time to wait for a reponse from the RPC.
    this.waitPeriod = this.config.MAX_LATENCY
    // Used to pass asynchronous data when pubsub data is received.
    this.incomingData = false
  }

  // This function is used to pass the 'thisNode' object this use-case library.
  // thisNode is the state of the IPFS node this library controls.
  // This function is called on startup, by the main index.js library.
  updateThisNode (inObj = {}) {
    const { thisNode } = inObj

    this.thisNode = thisNode

    this.relayUseCases.injectDeps(inObj)

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
        2,
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

        announceObj.multiaddr = null

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

        // Preserve the connection multiaddr if it exists.
        if (this.thisNode.peerData[dataIndex].multiaddr) {
          announceObj.multiaddr = this.thisNode.peerData[dataIndex].multiaddr
        } else {
          announceObj.multiaddr = null
        }

        // Replace the old data with the new data.
        this.thisNode.peerData[dataIndex] = announceObj

        // Add any data that should persist from the old entry.
        // TODO: Deprecate in favor of multiaddr property.
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
      if (!announceObj.data || !announceObj.data.broadcastedAt) return false

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

  // Called by an Timer Controller, ensures connections are maintained to known pubsub
  // peers. This will heal connections if nodes drop in and out of the network.
  // Connection workflow:
  // - If the peer is a Circuit Relay, skip it. Connecting to it will handled by
  //   a Relay use-case function.
  // - Attempt to connect to peer directly through its advertised multiaddrs.
  // - If direct connection fails, connect to peer via v2 Circuit Relay over webRTC.
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
        'starting refreshPeerConnections() connectedPeers: ',
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

          // Add the connection multiaddr for this peer to the thisNode object.
          this.updatePeerConnectionInfo({ thisPeer })

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

        // Skip direct connection if the node has a preference for a circuit
        // relay connection.
        const connectPref = peerData.data.ipfsConnectPref
        if (connectPref !== 'cr') {
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

              // Add the connection multiaddr for this peer to the thisNode object.
              this.updatePeerConnectionInfo({ thisPeer })

              // Add the connection multiaddr to the peer, so that we can see
              // exactly how we're connected to the peer.
              const thisPeerData = this.thisNode.peerData.filter(x => x.from === thisPeer)
              thisPeerData[0].data.connectionAddr = multiaddr
              peerData.data.connectionAddr = multiaddr

              // Break out of the loop once we've made a successful connection.
              break
            } else {
              this.adapters.log.statusLog(1,
                `Failed to connect to peer ${thisPeer} through direct connection: ${multiaddr}. Reason: ${connected.details}`
              )
            }
          }
        }

        if (connected.success) {
          continue
        }

        // Skip this section if the peer has a preference for direct connection.
        if (connectPref !== 'direct') {
          // Sort the Circuit Relays by the average of the aboutLatency
          // array. Connect to peers through the Relays with the lowest latencies
          // first.
          const sortedRelays = this.relayUseCases.sortRelays(relays)
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

            // Skip relay multiaddrs that start with /p2p
            if (multiaddr.slice(0, 4) === '/p2p') continue

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

                // Add the connection multiaddr for this peer to the thisNode object.
                this.updatePeerConnectionInfo({ thisPeer })

                // Add the connection multiaddr to the peer, so that we can see
                // exactly how we're connected to the peer.
                const thisPeerData = this.thisNode.peerData.filter(x => x.from === thisPeer)
                thisPeerData[0].data.connectionAddr = multiaddr
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

  // This function is called to update the multiaddr connection string that
  // this node is using to connect to the peer
  updatePeerConnectionInfo (inObj = {}) {
    try {
      const { thisPeer } = inObj

      const connectionInfo = this.adapters.ipfs.ipfs.libp2p.getConnections(thisPeer)
      // console.log('connectionInfo: ', connectionInfo)
      if (connectionInfo.length === 0) {
        console.log(`updatePeerConnectionInfo(): Not connected to peer ${thisPeer}`)
        return false
      }

      const connMultiaddr = connectionInfo[0].remoteAddr.toString()
      // console.log('connMultiaddr: ', connMultiaddr)

      // Find the index of the peer in the peerData array.
      const peerIndex = this.thisNode.peerData.findIndex(x => x.from === thisPeer)
      if (peerIndex < 0) {
        console.log(`updatePeerConnectionInfo(): could not find peer ${thisPeer} in thisNode.peerData array!`)
        return false
      }

      this.thisNode.peerData[peerIndex].multiaddr = connMultiaddr

      return true
    } catch (err) {
      console.error('Error in peer-use-cases.js/updatePeerConnectionInfo()')
      throw err
    }
  }

  // Query the /about JSON RPC endpoint for a subnet peer.
  // This function will return true on success or false on failure or timeout
  // of 10 seconds.
  // This function is used to measure the time for a response from the peer.
  async queryAbout (ipfsId, thisNode) {
    try {
      // console.log(`Querying Relay ${ipfsId}`)
      // console.log('thisNode: ', thisNode)

      // Generate the JSON RPC command
      const idNum = Math.floor(Math.random() * 10000).toString()
      const id = `metrics${idNum}`
      const cmdStr = `{"jsonrpc":"2.0","id":"${id}","method":"about"}`
      // console.log(`cmdStr: ${cmdStr}`)

      // console.log(`Sending JSON RPC /about command to ${ipfsId}`)
      const result = await this.sendRPC(ipfsId, cmdStr, id, thisNode)
      // console.log('sendRPC result: ', result)

      return result
    } catch (err) {
      console.error('Error in queryAbout(): ', err)

      // Do not throw an error.
      return false
    }
  }

  // Send the RPC command to the service, wait a period of time for a response.
  // Timeout if a response is not recieved.
  async sendRPC (ipfsId, cmdStr, id, thisNode) {
    try {
      let retData = this.incomingData

      // Send the RPC command to the server/service.
      await this.sendPrivateMessage(ipfsId, cmdStr, thisNode)

      // Used for calculating the timeout.
      const start = new Date()
      let now = start
      let timeDiff = 0

      // Wait for the response from the server. Exit once the response is
      // recieved, or a timeout occurs.
      do {
        await this.adapters.bch.bchjs.Util.sleep(250)

        now = new Date()

        timeDiff = now.getTime() - start.getTime()
        // console.log('timeDiff: ', timeDiff)

        retData = this.incomingData

        // If data came in on the event emitter, analize it.
        if (retData) {
          // console.log('retData: ', retData)

          const jsonData = JSON.parse(retData)
          const respId = jsonData.id

          // If the JSON RPC ID matches, then it's the response thisNode was
          // waiting for.
          if (respId === id) {
            // responseRecieved = true
            // this.eventEmitter.removeListener('relayMetrics', cb)

            retData = false

            return true
          }
        }

      // console.log('retData: ', retData)
      } while (
        // Exit once the RPC data comes back, or if a period of time passes.
        timeDiff < this.waitPeriod
      )

      // this.eventEmitter.removeListener('relayMetrics', cb)
      return false
    } catch (err) {
      console.error('Error in sendRPC')
      // this.eventEmitter.removeListener('relayMetrics', cb)
      throw err
    }
  }

  // This handler function is passed to the pubsub adapter on startup. When
  // a response to the /about request is recieved, the data is passed to
  // this handler. The data is used by sendRPC().
  relayMetricsHandler (inData) {
    this.incomingData = inData
  }
}

export default PeerUseCases
