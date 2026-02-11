/*
  Production-grade Helia IPFS node factory.
  This library creates and configures a Helia node with libp2p, including:
  - KAD-DHT with custom protocol for private PSF network
  - Bootstrap peer discovery
  - Circuit relay transport and optional circuit relay server
  - Persistent identity via keychain
  - Content routing (libp2pRouting + bitswap)
  - UnixFS file system

  This is the canonical node configuration used by ipfs-service-provider
  and other consumers of helia-coord.
*/

// Global npm libraries
import { createHelia } from 'helia'
import { libp2pRouting } from '@helia/routers'
import { bitswap } from '@helia/block-brokers'
import fs from 'fs'
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { publicIpv4 } from 'public-ip'
import { multiaddr } from '@multiformats/multiaddr'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { keychain } from '@libp2p/keychain'
import { unixfs } from '@helia/unixfs'
import { ping } from '@libp2p/ping'
import { loadOrCreateSelfKey } from '@libp2p/config'

// Default PSF bootstrap peers
const DEFAULT_BOOTSTRAP_PEERS = [
  '/ip4/78.46.129.7/tcp/4001/p2p/12D3KooWEBzgK8a5TpMfLotuj7jJnEK41gbD9LZK6qCpxNrX43E9',
  '/ip4/5.78.70.29/tcp/4001/p2p/12D3KooWSREJ6x2DJSYrA1xRD2Qs6D4DHncsHmNnTHuMKHnqpG2i',
  '/ip4/143.198.134.59/tcp/4101/p2p/12D3KooWHogx3RcyNiSuY6SzS8GxzTAqtDCYzy17yQ1StWaLvX9j'
]

class CreateHeliaNode {
  constructor (localConfig = {}) {
    // Configurable options with production defaults
    this.ipfsDir = localConfig.ipfsDir || './.ipfsdata/ipfs'
    this.tcpPort = localConfig.tcpPort || 4001
    this.wsPort = localConfig.wsPort || 4003
    this.isCircuitRelay = localConfig.isCircuitRelay || false
    this.bootstrapPeers = localConfig.bootstrapPeers || DEFAULT_BOOTSTRAP_PEERS

    // getSeed is an async function that returns a seed string for keychain.
    // If not provided, a random seed is generated.
    if (localConfig.getSeed) {
      this.getSeed = localConfig.getSeed
    } else {
      this.getSeed = async () => {
        const seedNum = Math.floor(Math.random() * 1000000000000000000000)
        return seedNum.toString()
      }
    }

    // Encapsulate dependencies for testing/override
    this.fs = fs
    this.createLibp2p = createLibp2p
    this.createHelia = createHelia
    this.publicIp = publicIpv4
    this.multiaddr = multiaddr

    // Properties of this class instance
    this.isReady = false

    // Bind 'this' object to all subfunctions
    this.start = this.start.bind(this)
    this.createNode = this.createNode.bind(this)
    this.stop = this.stop.bind(this)
    this.ensureBlocksDir = this.ensureBlocksDir.bind(this)
  }

  // Start an IPFS node.
  async start () {
    try {
      // Ensure the directory structure exists that is needed by the IPFS node to store data.
      this.ensureBlocksDir()

      // Create an IPFS node
      const ipfs = await this.createNode()

      this.id = ipfs.libp2p.peerId.toString()
      console.log('IPFS ID: ', this.id)

      // Attempt to guess our ip4 IP address.
      const ip4 = await this.publicIp()
      let detectedMultiaddr = `/ip4/${ip4}/tcp/${this.tcpPort}/p2p/${this.id}`
      detectedMultiaddr = this.multiaddr(detectedMultiaddr)

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
      console.error('Error in create-helia-node.js/start()')
      throw err
    }
  }

  // This function creates an IPFS node using Helia.
  // It returns the node as an object.
  async createNode () {
    try {
      const ipfsDir = this.ipfsDir

      // Create block and data stores.
      const blockstore = new FsBlockstore(`${ipfsDir}/blockstore`)
      const datastore = new FsDatastore(`${ipfsDir}/datastore`)

      // Create an identity
      const keychainInit = {
        selfKey: 'myKey',
        pass: await this.getSeed()
      }
      const privateKey = await loadOrCreateSelfKey(datastore, keychainInit)

      // Configure services
      const services = {
        identify: identify(),
        identifyPush: identifyPush(),
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
        ping: ping(),
        keychain: keychain(keychainInit),
        dht: kadDHT({
          protocol: '/psf/kad/1.0.0',
          clientMode: false
        })
      }

      // Conditionally add circuit relay server
      if (this.isCircuitRelay) {
        console.log('Helia (IPFS) node IS configured as Circuit Relay')
        services.relay = circuitRelayServer({
          hopTimeout: 30 * 1000,
          reservations: {
            maxReservations: 15,
            reservationClearInterval: 300 * 1000,
            applyDefaultLimit: true,
            defaultDurationLimit: 2 * 60 * 1000,
            defaultDataLimit: BigInt(2 << 7)
          },
          maxInboundHopStreams: 32,
          maxOutboundHopStreams: 64
        })
      } else {
        console.log('Helia (IPFS) node IS NOT configured as Circuit Relay')
      }

      const transports = [
        tcp(),
        webSockets(),
        circuitRelayTransport({
          discoverRelays: 3,
          reservationConcurrency: 3
        }),
        webRTC(),
        webRTCDirect()
      ]

      // libp2p is the networking layer that underpins Helia
      const libp2p = await this.createLibp2p({
        privateKey,
        datastore,
        addresses: {
          listen: [
            '/ip4/127.0.0.1/tcp/0',
            `/ip4/0.0.0.0/tcp/${this.tcpPort}`,
            `/ip4/0.0.0.0/tcp/${this.wsPort}/ws`,
            '/webrtc',
            '/p2p-circuit'
          ]
        },
        transports,
        connectionEncrypters: [
          noise()
        ],
        streamMuxers: [
          yamux()
        ],
        peerDiscovery: [
          bootstrap({
            list: this.bootstrapPeers
          })
        ],
        services
      })

      // create a Helia node
      const helia = await this.createHelia({
        blockstore,
        datastore,
        libp2p,
        routers: [
          libp2pRouting(libp2p)
        ],
        blockBrokers: [
          bitswap()
        ]
      })

      // Attach IPFS file system.
      const heliaFs = unixfs(helia)
      helia.fs = heliaFs

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
      const ipfsDir = this.ipfsDir
      const parentDir = ipfsDir.substring(0, ipfsDir.lastIndexOf('/'))

      !this.fs.existsSync(parentDir) && this.fs.mkdirSync(parentDir, { recursive: true })

      !this.fs.existsSync(ipfsDir) && this.fs.mkdirSync(ipfsDir, { recursive: true })

      !this.fs.existsSync(`${ipfsDir}/blockstore`) && this.fs.mkdirSync(`${ipfsDir}/blockstore`)

      !this.fs.existsSync(`${ipfsDir}/datastore`) && this.fs.mkdirSync(`${ipfsDir}/datastore`)

      !this.fs.existsSync(`${ipfsDir}/datastore/pkcs8`) && this.fs.mkdirSync(`${ipfsDir}/datastore/pkcs8`)

      return true
    } catch (err) {
      console.error('Error in create-helia-node.js/ensureBlocksDir(): ', err)
      throw err
    }
  }
}

export default CreateHeliaNode
