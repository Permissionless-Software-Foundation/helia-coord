/*
  A Use Case library for working with Circuit Relays.

  TODO: Build these methods:
  - pruneConnections() - Disconnect dead or misbehaving nodes.
  - addRelay() - Add a new relay to the state.
*/

// Local libraries
// import bootstrapCircuitRelays from '../../config/bootstrap-circuit-relays.js'

class RelayUseCases {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Must inject instance of adapters when instantiating Relay Use Cases library.'
      )
    }

    // Encapsulate dependencies
    // this.bootstrapCircuitRelays = bootstrapCircuitRelays

    // Initialize v1 relay list. Allows user to overwrite with local config.
    this.bootstrapRelays = []
    if (localConfig.bootstrapRelays) {
      this.bootstrapRelays = localConfig.bootstrapRelays
      // console.log('bootstrapRelays: ', this.bootstrapRelays)
    }

    // Bind 'this' object to all subfunctions
    this.connectToBootstrapRelays = this.connectToBootstrapRelays.bind(this)
    this.getCRGist = this.getCRGist.bind(this)
    this.connectToCRs = this.connectToCRs.bind(this)
    this.sortRelays = this.sortRelays.bind(this)
    this.addRelay = this.addRelay.bind(this)
    this.measureRelays = this.measureRelays.bind(this)
    this.removeDuplicates = this.removeDuplicates.bind(this)
  }

  // Download a list of Circuit Relays from a GitHub Gist, and try to connect
  // to all of the ones in the list.
  async getCRGist (thisNode) {
    try {
      const gistCRs = await this.adapters.gist.getCRList()

      let gistRelays
      if (thisNode.type === 'browser') {
        gistRelays = gistCRs.browser
      } else {
        gistRelays = gistCRs.node
      }

      console.log(`Relays from the gist: ${JSON.stringify(gistRelays, null, 2)}`)

      for (let i = 0; i < gistRelays.length; i++) {
        const thisRelay = gistRelays[i]

        // If this relay is already in the list of circuit relays, then skip.
        const alreadyExists = thisNode.relayData.filter(
          x => x.ipfsId === thisRelay.ipfsId
        )
        if (alreadyExists.length) continue

        // Attempt to connect to the Circuit Relay peer.
        // console.log(`getCRGist() Connecting to Circuit Relay ${thisRelay.multiaddr}`)
        this.adapters.log.statusLog(1, `getCRGist() Connecting to Circuit Relay ${thisRelay.multiaddr}`)
        const connectionStatus = await this.adapters.ipfs.connectToPeer(
          { multiaddr: thisRelay.multiaddr }
        )

        const now = new Date()

        const newRelayObj = {
          multiaddr: thisRelay.multiaddr,
          connected: connectionStatus.status,
          updatedAt: now,
          ipfsId: thisRelay.ipfsId,
          isBootstrap: false,
          metrics: {
            aboutLatency: []
          }
        }

        // Record relay information in thisNode entity.
        thisNode.relayData.push(newRelayObj)
      }

      // Remove duplicate Circuit Relays.
      await this.removeDuplicates(thisNode)

      // Cycle through optional peers and try to connect to each one.
      const recommendedPeers = gistCRs.recommendedPeers
      for (let i = 0; i < recommendedPeers.length; i++) {
        const thisPeer = recommendedPeers[i]

        await this.adapters.ipfs.connectToPeer(
          { multiaddr: thisPeer.multiaddr }
        )
      }

      return true
    } catch (err) {
      console.error('Error in relay-use-case.js/getCRGist()')
      throw err
    }
  }

  // Renew the connection to each circuit relay in the state.
  async connectToCRs (thisNode) {
    try {
      let knownRelays = thisNode.relayData

      // Sort the Relays by their latency. This way Relays with the lowest latency
      // (relative to thisNode) are used first.
      knownRelays = this.sortRelays(knownRelays)
      // console.log('knownRelays: ', knownRelays)

      for (let i = 0; i < knownRelays.length; i++) {
        const thisRelay = knownRelays[i]
        // console.log('thisRelay: ', thisRelay)

        // Get connected peers
        const connectedPeers = await this.adapters.ipfs.getPeers()
        // console.log('connectedPeers: ', connectedPeers)

        // Check if target circuit-relay is currently conected to the node.
        const connectedPeer = connectedPeers.filter(peerId => thisRelay.ipfsId.includes(peerId))
        // console.log('connectedPeer: ', connectedPeer)

        // Get the peer data corresponding to this relay
        // let peerData = thisNode.peerData.filter(x => x.from.includes(thisRelay.ipfsId))
        const peerIds = thisNode.peerData.map(x => x.from)
        // console.log('peerIds: ', peerIds)
        const peerIndex = peerIds.indexOf(thisRelay.ipfsId)
        // console.log('peerIndex: ', peerIndex)
        // peerData = peerData[0]

        // Update the connection state.

        if (connectedPeer.length && thisRelay.multiaddr.includes('/tcp/')) {
          // Already connected.
          thisRelay.connected = true
          // console.log(`Already connected to Circuit Relay ${thisRelay.multiaddr}`)
          this.adapters.log.statusLog(2, `Already connected to Circuit Relay ${thisRelay.multiaddr}`)

          // Make sure the peer data corresponding to this connect relay reflects
          // the multiaddr that was used to successfully connect to it.
          if (peerIndex > -1) {
            // peerData.connectionAddr = thisRelay.multiaddr
            thisNode.peerData[peerIndex].data.connectionAddr = thisRelay.multiaddr
          }
        } else if (connectedPeer.length) {
          // We are connected to the relay, but the multiaddr needs to be fixed.

          const libp2p = this.adapters.ipfs.ipfs.libp2p
          const remoteConnection = libp2p.getConnections(connectedPeer[0])
          // console.log(`multiaddr ${thisRelay.multiaddr} should be ${remoteConnection[0].remoteAddr.toString()} `)

          thisRelay.multiaddr = remoteConnection[0].remoteAddr.toString()

          // Make sure the peer data corresponding to this connect relay reflects
          // the multiaddr that was used to successfully connect to it.
          if (peerIndex > -1) {
            // peerData.connectionAddr = thisRelay.multiaddr
            thisNode.peerData[peerIndex].data.connectionAddr = remoteConnection[0].remoteAddr.toString()
          }

          // console.log(`Multiaddr changed to ${thisRelay.multiaddr}`)

          if (thisRelay.multiaddr.includes('/p2p-circuit')) {
            for (const connection of libp2p.getConnections()) {
              console.log('connection.remoteAddr: ', connection.remoteAddr.toString())
              // Logs the PeerId string and the observed remote multiaddr of each Connection
            }
          }
        } else {
          // console.log('peerData: ', peerData)

          // If this node is not connected, try to connect again.
          // console.log(`Connecting to Circuit Relay ${thisRelay.multiaddr}`)
          const connStatus = await this.adapters.ipfs.connectToPeer(
            { multiaddr: thisRelay.multiaddr }
          )
          thisRelay.connected = connStatus.success
          // console.log(`thisRelay.connected: ${thisRelay.connected}`)

          // Debugging: Trying to figure out the best way to select the multiaddr
          if (thisRelay.connected && !thisRelay.multiaddr.includes('/tcp/')) {
            // console.log('thisRelay.multiaddr: ', thisRelay.multiaddr)

            const libp2p = this.adapters.ipfs.ipfs.libp2p
            for (const connection of libp2p.getConnections()) {
              console.log('connection.remoteAddr: ', connection.remoteAddr.toString())
              // Logs the PeerId string and the observed remote multiaddr of each Connection
            }
          }

          if (thisRelay.connected) {
            this.adapters.log.statusLog(
              2,
              `Connected to Circuit Relay peer ${thisRelay.ipfsId} with multiaddress ${thisRelay.multiaddr}`
            )
            console.log(`connectToCRs() Connected to Circuit Relay peer ${thisRelay.ipfsId}`)
          } else {
            this.adapters.log.statusLog(
              2,
              `Could not connect to Circuit Relay with this multiaddr: ${thisRelay.multiaddr}, reason: ${connStatus.details}`
            )
          }
        }
        // console.log('thisRelay.connected: ', thisRelay.connected)

        // Update the timestamp.
        const now = new Date()
        thisRelay.updatedAt = now

        // Update the state tracked by This Node.
        thisNode.relayData[i] = thisRelay
      }

      // const now = new Date()
      // this.adapters.log.statusLog(
      //   `status: ${now.toLocaleString()}: Renewed connections to all known Circuit Relay nodes.`
      // )
    } catch (err) {
      console.error('Error in helia-coord/connectToCRs(): ', err)
      return false
    }
  }

  // If a list of Bootstrap Circuit Relays is provided, then renew connections
  // to them. These are expected to be ipfs-service-provider nodes configured
  // as a v2 Circuit Relay. They can facilitate webRTC connections between other
  // peers.
  async connectToBootstrapRelays (relays) {
    try {
      for (let i = 0; i < this.bootstrapRelays.length; i++) {
        const thisRelay = this.bootstrapRelays[i]

        try {
          this.adapters.log.statusLog(2, `Connecting to v1 Relay: ${thisRelay}`)

          await this.adapters.ipfs.connectToPeer(
            { multiaddr: thisRelay }
          )
        } catch (err) {
          /* exit quietly */
        }
      }

      return true
    } catch (err) {
      console.error('Error in connectToBootstrapRelays()')
      throw err
    }
  }

  // Sort the relay data relative to the measured latency metrics.
  sortRelays (relayData) {
    try {
      // Loop through each element and add a latency score.
      for (let i = 0; i < relayData.length; i++) {
        const thisRelay = relayData[i]

        // Ensure an initial default value is assigned.
        thisRelay.latencyScore = 10000

        // Assign bootstrap nodes the maximum latency.
        if (thisRelay.isBootstrap) {
          thisRelay.latencyScore = 10000
        } else {
          // Average the latencies measured for this Relay.
          thisRelay.latencyScore = Math.floor(
            this._average(thisRelay.metrics.aboutLatency)
          )

          // Handle corner-case of empty arrays.
          if (isNaN(thisRelay.latencyScore)) thisRelay.latencyScore = 10000
        }

      // console.log('thisRelay: ', thisRelay)
      }

      // Sort the array by the latency score.
      // https://flaviocopes.com/how-to-sort-array-of-objects-by-property-javascript/
      const sortedList = relayData.sort((a, b) => a.latencyScore > b.latencyScore ? 1 : -1
      )
      // console.log('Relay sortedList: ', sortedList)

      return sortedList
    } catch (err) {
      console.error('Error in sortRelays()')
      throw err
    }
  }

  // Average together the elements of an array.
  _average (arr) {
    return arr.reduce((p, c) => p + c, 0) / arr.length
  }

  // If a subnet Peer has the isCircuitRelay flag set, try to connect to them
  // directly. If the connection succeeds, add them to the list of Circuit Relays.
  // Triggered when a new subnet peer is found that has their Relay flag set.
  async addRelay (ipfsId, thisNode) {
    try {
      const now = new Date()
      // console.log(`debug: addRelay() called at ${now.toLocaleString()}`)

      // Check to see if peer is already in the list of Circuit Relays.
      const alreadyInList = thisNode.relayData.filter(x => x.ipfsId.includes(ipfsId)
      )
      // Exit if this peer is already in the list of Relays.
      if (alreadyInList.length) return true

      // this.adapters.log.statusLog(1, 'New Circuit Relay Peer Found!')

      // Get the peer data.
      let peerData = thisNode.peerData.filter(x => x.data.ipfsId === ipfsId)
      peerData = peerData[0]
      // console.log('peerData: ', peerData)

      // Exit if this peer is not a circuit relay.
      // CT Added 9/4/21.
      // Added because testing was showing that some non-relay peers where getting
      // pings with about metrics.
      const isCircuitRelay = peerData.data.isCircuitRelay
      if (!isCircuitRelay) return false // Return true?

      this.adapters.log.statusLog(
        1,
        `New Circuit Relay Peer Found: ${peerData.from}`
      )

      // Grab the optional connection information if the Circuit Relay provides
      // it. If they do, construct a connection string and add it to the
      // list of multiaddrs.
      const circuitRelayInfo = peerData.data.circuitRelayInfo
      if (circuitRelayInfo) {
        if (circuitRelayInfo.ip4) {
          const ip4TcpMultiaddr = `/ip4/${circuitRelayInfo.ip4}/tcp/${circuitRelayInfo.tcpPort}/p2p/${peerData.from}`
          peerData.data.ipfsMultiaddrs.push(ip4TcpMultiaddr)
        }
        if (circuitRelayInfo.crDomain) {
          const dnsMultiaddr = `/dns4/${circuitRelayInfo.crDomain}/tcp/443/wss/ipfs/${peerData.from}`
          peerData.data.ipfsMultiaddrs.push(dnsMultiaddr)
        }

        // Debugging
        // console.log(
        //   `peer multiaddrs: ${JSON.stringify(
        //     peerData.data.ipfsMultiaddrs,
        //     null,
        //     2
        //   )}`
        // )
      }

      let multiaddr = ''
      let connectSuccess = false

      // Filter out multiaddrs that are poor connection choices
      const originalMultiaddrs = peerData.data.ipfsMultiaddrs
      const filteredMultiaddrs = originalMultiaddrs.filter((x) => {
        if (x.includes('127.0.0.1')) return false
        if (x.includes('udp')) return false
        if (x.includes('quic')) return false
        if (x.includes('p2p-circuit')) return false
        if (x.includes('192.168.')) return false
        if (x.includes('172.16.')) return false
        return true
      })
      // console.log('filteredMultiaddrs: ', filteredMultiaddrs)

      // Try to connect to one of the multiaddrs.
      for (let i = 0; i < filteredMultiaddrs.length; i++) {
        const thisAddr = filteredMultiaddrs[i]
        // console.log('thisAddr: ', thisAddr)

        // Try to connect to the IPFS peer.
        connectSuccess = await this.adapters.ipfs.connectToPeer({ multiaddr: thisAddr })

        if (connectSuccess.status) {
          multiaddr = thisAddr
          break
        }
      }

      // If we could not successfully connect to the peer with any of the given
      // multiaddrs, then do not add it to the list of Relays.
      if (!connectSuccess) {
        this.adapters.log.statusLog(
          1,
          `: Could not add potential Circuit Relay: ${ipfsId}`
        )
        return false
      }

      // Add tail end of multiaddr if it's omitted. (this happens in go-ipfs v0.11.0)
      if (!multiaddr.includes(ipfsId)) {
        multiaddr = `${multiaddr}/p2p/${ipfsId}`
      }

      // On successful connection, add the Circuit Relay to the list.
      // const now = new Date()
      const newRelayObj = {
        multiaddr,
        connected: true,
        updatedAt: now,
        ipfsId,
        isBootstrap: false,
        metrics: {
          aboutLatency: []
        }
      }
      // console.log(`newRelayObj: ${JSON.stringify(newRelayObj, null, 2)}`)
      thisNode.relayData.push(newRelayObj)

      // console.log(`New Circuit Relay added: ${multiaddr}`)
      this.adapters.log.statusLog(1, `New Circuit Relay added: ${multiaddr}`)

      return true
    } catch (err) {
      console.error('Error in addRelay(): ', err)
      // top-level function. Do not throw an error.
      return false
    }
  }

  // Called when periodically checking the Relay connection. Maintains network
  // metrics about each Relay.
  // Called by the manageCircuitRelays() Timer Controller.
  async measureRelays (thisNode) {
    try {
      // Loop through each Circuit Relay
      for (let i = 0; i < thisNode.relayData.length; i++) {
        const thisRelay = thisNode.relayData[i]

        // If the relay is from the bootstrap list, skip it.
        // if (thisRelay.isBootstrap) continue

        // Get the peer data.
        let peerData = thisNode.peerData.filter(x => {
          if (!x.data) {
            console.log('broken peer data: ', x)
          }
          // console.log(`x.data.ipfsId: ${x.data.ipfsId}`)
          // console.log(`thisRelay.ipfsId: ${thisRelay.ipfsId}`)
          return x.data.ipfsId === thisRelay.ipfsId
        })
        peerData = peerData[0]
        // console.log(`peerData: ${JSON.stringify(peerData, null, 2)}`)

        // Skip if this Relay is not advertising as a relay.
        if (!peerData || !peerData.data.isCircuitRelay) continue

        // console.log(`peerData: ${JSON.stringify(peerData, null, 2)}`)

        // If this node is not connected to the Relay, give it the worst score.
        if (!thisRelay.connected) {
          thisRelay.metrics.aboutLatency.push(10000)
          continue
        }

        // Poll the /about JSON endpoint, and track the time it takes to recieve
        // a response.
        const startTime = new Date()
        const testResult = await this.adapters.pubsub.about.queryAbout(
          thisRelay.ipfsId,
          thisNode
        )
        // console.log('testResult: ', testResult)
        // await this.adapters.bch.bchjs.Util.sleep(2000)
        const endTime = new Date()

        let diffTime = 10000
        if (testResult) diffTime = endTime.getTime() - startTime.getTime()
        // console.log(`Time difference: ${diffTime} mS`)

        // Prune the metrics array if it's too big.
        if (thisRelay.metrics.aboutLatency.length > 9) {
          thisRelay.metrics.aboutLatency.shift()
        }

        // Save the new metric value.
        thisRelay.metrics.aboutLatency.push(diffTime)
      }
    } catch (err) {
      console.error('Error in measureRelays(): ', err)
      throw err
    }
  }

  // Remove any duplicate entries of Circuit Relays.
  // This is middleware that edits the thisNode.relayData in place.
  removeDuplicates (thisNode) {
    try {
      const startingRelays = thisNode.relayData
      // console.log('thisNode.relayData: ', thisNode.relayData)

      // https://stackoverflow.com/questions/2218999/how-to-remove-all-duplicates-from-an-array-of-objects
      const endingRelays = startingRelays.filter(
        (relay, index, self) => index === self.findIndex(t => t.ipfsId === relay.ipfsId)
      )
      // console.log('endingRelays: ', endingRelays)

      thisNode.relayData = endingRelays

      return true
    } catch (err) {
      console.error('Error in removeDuplicates()')
      throw err
    }
  }
}

export default RelayUseCases
