/*
  This library creates a Helia IPFS node. This is done prior to attaching
  helia-coord to the node.
  This library is called by start-node.js.
*/

// Global npm libraries
import { createHelia } from 'helia'
import fs from 'fs'
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
// import { bootstrap } from '@libp2p/bootstrap'
// import { identifyService } from 'libp2p/identify'
import { identify } from '@libp2p/identify'
// import { circuitRelayTransport } from 'libp2p/circuit-relay'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { publicIpv4 } from 'public-ip'
import { multiaddr } from '@multiformats/multiaddr'
import { webRTC } from '@libp2p/webrtc'

const ROOT_DIR = './'
const IPFS_DIR = './.ipfsdata/ipfs'

class CreateHeliaNode {
  constructor () {
    this.publicIp = publicIpv4
  }

  // Start an IPFS node.
  async start () {
    try {
      // Ensure the directory structure exists that is needed by the IPFS node to store data.
      this.ensureBlocksDir()

      // Create an IPFS node
      const ipfs = await this.createNode()
      // console.log('ipfs: ', ipfs)

      this.id = ipfs.libp2p.peerId.toString()
      console.log('IPFS ID: ', this.id)

      // Attempt to guess our ip4 IP address.
      const ip4 = await this.publicIp()
      let detectedMultiaddr = `/ip4/${ip4}/tcp/4001/p2p/${this.id}`
      detectedMultiaddr = multiaddr(detectedMultiaddr)

      // Get the multiaddrs for the node.
      const multiaddrs = ipfs.libp2p.getMultiaddrs()
      multiaddrs.push(detectedMultiaddr)
      console.log('Multiaddrs: ', multiaddrs)

      this.multiaddrs = multiaddrs

      // Signal that this adapter is ready.
      this.isReady = true

      this.ipfs = ipfs

      return this.ipfs
    } catch (err) {
      console.error('Error in start()')

      throw err
    }
  }

  // This function creates an IPFS node using Helia.
  // It returns the node as an object.
  async createNode () {
    try {
      // Create block and data stores.
      const blockstore = new FsBlockstore(`${IPFS_DIR}/blockstore`)
      const datastore = new FsDatastore(`${IPFS_DIR}/datastore`)

      // Configure services
      const services = {
        identify: identify(),
        pubsub: gossipsub({ allowPublishToZeroPeers: true })
      }

      // libp2p is the networking layer that underpins Helia
      const libp2p = await createLibp2p({
        datastore,
        addresses: {
          listen: [
            '/ip4/127.0.0.1/tcp/0',
            '/ip4/0.0.0.0/tcp/4001',
            '/ip4/0.0.0.0/tcp/4003/ws',
            '/webrtc'
          ]
        },
        transports: [
          tcp(),
          webSockets(),
          circuitRelayTransport({ discoverRelays: 3 }),
          webRTC()
        ],
        connectionEncryption: [
          noise()
        ],
        streamMuxers: [
          yamux()
        ],
        services
      })

      // create a Helia node
      const helia = await createHelia({
        blockstore,
        datastore,
        libp2p
      })

      return helia
    } catch (err) {
      console.error('Error creating Helia node: ', err)

      throw err
    }
  }

  async stop () {
    await this.ipfs.stop()

    return true
  }

  // Ensure that the directories exist to store blocks from the IPFS network.
  // This function is called at startup, before the IPFS node is started.
  ensureBlocksDir () {
    try {
      !fs.existsSync(`${ROOT_DIR}.ipfsdata`) && fs.mkdirSync(`${ROOT_DIR}.ipfsdata`)

      !fs.existsSync(`${IPFS_DIR}`) && fs.mkdirSync(`${IPFS_DIR}`)

      !fs.existsSync(`${IPFS_DIR}/blockstore`) && fs.mkdirSync(`${IPFS_DIR}/blockstore`)

      !fs.existsSync(`${IPFS_DIR}/datastore`) && fs.mkdirSync(`${IPFS_DIR}/datastore`)

      return true
    } catch (err) {
      console.error('Error in ensureBlocksDir(): ', err)
      throw err
    }
  }
}

export default CreateHeliaNode
