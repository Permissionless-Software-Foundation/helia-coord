/*
  Adapter library for IPFS, so the rest of the business logic doesn't need to
  know specifics about the IPFS API.
*/

import { multiaddr } from '@multiformats/multiaddr'

const CONNECTION_TIMEOUT = 10000

class IpfsAdapter {
  constructor (localConfig = {}) {
    // Input Validation
    this.ipfs = localConfig.ipfs
    if (!this.ipfs) {
      throw new Error(
        'An instance of IPFS must be passed when instantiating the IPFS adapter library.'
      )
    }
    this.log = localConfig.log
    if (!this.log) {
      throw new Error(
        'A status log handler must be specified when instantiating IPFS adapter library.'
      )
    }

    // Bind 'this' object to all subfunctions
    this.start = this.start.bind(this)
    this.connectToPeer = this.connectToPeer.bind(this)
    this.disconnectFromPeer = this.disconnectFromPeer.bind(this)
    this.getPeers = this.getPeers.bind(this)

    // 'embedded' node type used as default, will use embedded js-ipfs.
    // Alternative is 'external' which will use ipfs-http-client to control an
    // external IPFS node.
    this.nodeType = localConfig.nodeType
    if (!this.nodeType) {
      // console.log('No node type specified. Assuming embedded js-ipfs.')
      this.nodeType = 'embedded'
    }

    // Port Settings. Defaults are overwritten if specified in the localConfig.
    this.tcpPort = 4001
    if (localConfig.tcpPort) this.tcpPort = localConfig.tcpPort
    this.wsPort = 4003
    if (localConfig.wsPort) this.wsPort = localConfig.wsPort

    // Placeholders that will be filled in after the node finishes initializing.
    this.ipfsPeerId = ''
    this.ipfsMultiaddrs = ''

    // Encapsulate dependencies
    this.multiaddr = multiaddr
  }

  // Start the IPFS node if it hasn't already been started.
  // Update the state of this adapter with the IPFS node information.
  async start () {
    try {
      // Wait until the IPFS creation Promise has resolved, and the node is
      // fully instantiated.
      this.ipfs = await this.ipfs

      // Get ID information about this IPFS node.
      this.ipfsPeerId = this.ipfs.libp2p.peerId.toString()

      // Get multiaddrs that can be used to connect to this node.
      let addrs = this.ipfs.libp2p.getMultiaddrs()
      addrs = addrs.map(elem => elem.toString())
      this.ipfsMultiaddrs = addrs
    } catch (err) {
      console.error('Error in ipfs-adapter.js/start()')
      throw err
    }
  }

  // Attempts to connect to an IPFS peer, given its IPFS multiaddr.
  // Returns true if the connection succeeded. Otherwise returns false.
  async connectToPeer (inObj = {}) {
    const { multiaddr } = inObj

    try {
      // console.log('connectToPeer() inObj: ', inObj)

      // TODO: Throw error if ipfs ID is passed, instead of a multiaddr.
      // console.log('ipfsAddr: ', ipfsAddr)

      // await this.ipfs.swarm.connect(ipfsAddr, { timeout: CONNECTION_TIMEOUT })
      await this.ipfs.libp2p.dial(this.multiaddr(multiaddr))
      // console.log('connectToPeer() result: ', result)

      this.log.statusLog(1, `Successfully connected to peer node ${multiaddr}`)

      return {
        success: true,
        details: null
      }
    } catch (err) {
      /* exit quietly */
      // console.log('connectToPeer() Error connecting to peer: ', err)
      this.log.statusLog(2, `Error trying to connect to peer node ${multiaddr}: `, err.message)

      return {
        success: false,
        details: err.message
      }
    }
  }

  // Disconnect from a peer.
  async disconnectFromPeer (ipfsId) {
    try {
      // TODO: If given a multiaddr, extract the IPFS ID.

      // Get the list of peers that we're connected to.
      const connectedPeers = await this.getPeers()
      // console.log('connectedPeers: ', connectedPeers)

      // See if we're connected to the given IPFS ID
      const connectedPeer = connectedPeers.filter(x => x.peer === ipfsId)

      // If we're not connected, exit.
      if (!connectedPeer.length) {
        // console.log(`debug: Not connected to ${ipfsId}`)
        return true
      }

      // If connected, disconnect from the peer.
      await this.ipfs.swarm.disconnect(connectedPeer[0].addr, {
        timeout: CONNECTION_TIMEOUT
      })

      return true
    } catch (err) {
      // exit quietly
      return false
    }
  }

  async disconnectFromMultiaddr (multiaddr) {
    try {
      await this.ipfs.swarm.disconnect(multiaddr, {
        timeout: CONNECTION_TIMEOUT
      })

      return true
    } catch (err) {
      return false
    }
  }

  // Get a list of all the IPFS peers This Node is connected to.
  async getPeers () {
    try {
      // console.log('this.ipfs.libp2p: ', this.ipfs.libp2p)

      let connectedPeers = await this.ipfs.libp2p.getPeers()
      connectedPeers = connectedPeers.map(x => x.toString())
      this.log.statusLog(1, 'connectedPeers: ', connectedPeers)

      // const connections = this.ipfs.libp2p.getConnections()
      // console.log('connections: ', connections)

      return connectedPeers
    } catch (err) {
      console.error('Error in ipfs-adapter.js/getPeers(): ', err)
      throw err
    }
  }
}

export default IpfsAdapter
