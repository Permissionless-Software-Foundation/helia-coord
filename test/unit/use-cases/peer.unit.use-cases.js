/*
  Unit tests for the Peer Use Case library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import PeerUseCases from '../../../lib/use-cases/peer-use-cases.js'
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'
import AdapterMock from '../../mocks/adapter-mock.js'
import RelayUseCases from '../../../lib/use-cases/relay-use-cases.js'
import mockData from '../../mocks/peers-mock.js'
import { multiaddr } from '@multiformats/multiaddr'

const adapters = new AdapterMock()

describe('#Use-Cases-Peer', () => {
  let uut
  let sandbox
  let thisNode

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    const thisNodeUseCases = new ThisNodeUseCases({
      adapters,
      statusLog: () => {
      }
    })
    thisNode = await thisNodeUseCases.createSelf({ type: 'node.js' })

    const relayUseCases = new RelayUseCases({
      adapters,
      bootstrapRelays: ['fake-multiaddr']
    })

    uut = new PeerUseCases({ adapters, relayUseCases })
    uut.updateThisNode({ thisNode })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new PeerUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of adapters when instantiating Peer Use Cases library.'
        )
      }
    })

    it('should throw an error if relay use cases are not included', () => {
      try {
        uut = new PeerUseCases({ adapters })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of Relay Use Cases when instantiating Peer Use Cases library.'
        )
      }
    })
  })

  describe('#getMultiaddrs', () => {
    // A valid peer ID is required, because multiaddr() parses it as a CID.
    const PEER_ID =
      '12D3KooWDDrYph3KNxASGR5a4Bjw8thVTfK6MHiNCSz6GvygXwdR'
    const NODE_ADDR = `/ip4/98.97.136.193/tcp/4001/p2p/${PEER_ID}`

    let savedAnnounceMultiaddrs
    let savedPeerId

    beforeEach(() => {
      savedAnnounceMultiaddrs = process.env.ANNOUNCE_MULTIADDRS
      savedPeerId = adapters.ipfs.ipfsPeerId
      adapters.ipfs.ipfsPeerId = PEER_ID
    })

    afterEach(() => {
      adapters.ipfs.ipfsPeerId = savedPeerId

      if (savedAnnounceMultiaddrs === undefined) {
        delete process.env.ANNOUNCE_MULTIADDRS
      } else {
        process.env.ANNOUNCE_MULTIADDRS = savedAnnounceMultiaddrs
      }
    })

    // Build a PeerUseCases instance after the environment is set, because the
    // configured addresses are parsed in the constructor.
    const makeUut = () => {
      const relayUseCases = new RelayUseCases({
        adapters,
        bootstrapRelays: ['fake-multiaddr']
      })
      const localUut = new PeerUseCases({ adapters, relayUseCases })
      localUut.updateThisNode({ thisNode })

      return localUut
    }

    const stubNodeAddrs = () => {
      sandbox.stub(adapters.ipfs.ipfs.libp2p, 'getMultiaddrs').returns([
        multiaddr(`/ip4/127.0.0.1/tcp/4001/p2p/${PEER_ID}`),
        multiaddr(NODE_ADDR)
      ])
    }

    it('should return the filtered node multiaddrs when nothing is configured', () => {
      delete process.env.ANNOUNCE_MULTIADDRS
      stubNodeAddrs()

      const addrs = makeUut().getMultiaddrs()

      assert.deepEqual(addrs, [NODE_ADDR])
    })

    it('should append the operator-supplied announcement multiaddrs', () => {
      process.env.ANNOUNCE_MULTIADDRS =
        `/ip4/192.236.235.173/tcp/4103, /ip4/5.78.149.147/tcp/4101/p2p/${PEER_ID}`
      stubNodeAddrs()

      const addrs = makeUut().getMultiaddrs()

      // An entry without a /p2p/ component gets this node's peer ID appended.
      assert.include(addrs, `/ip4/192.236.235.173/tcp/4103/p2p/${PEER_ID}`)
      // An entry that already has a peer ID is used as-is.
      assert.include(addrs, `/ip4/5.78.149.147/tcp/4101/p2p/${PEER_ID}`)
      assert.include(addrs, NODE_ADDR)
      assert.equal(addrs.length, 3)
    })

    it('should not duplicate an address that is already advertised', () => {
      process.env.ANNOUNCE_MULTIADDRS = NODE_ADDR
      stubNodeAddrs()

      const addrs = makeUut().getMultiaddrs()

      assert.deepEqual(addrs, [NODE_ADDR])
    })
  })

  describe('#sendPrivateMessage', () => {
    it('should throw an error if peer data can not be found', async () => {
      try {
        const result = await uut.sendPrivateMessage(
          'fakeId',
          'messageStr',
          thisNode
        )
        console.log('result: ', result)
      } catch (err) {
        assert.include(err.message, 'Data for peer')
      }
    })

    it('should encrypt a message and add it to the peers OrbitDB', async () => {
      thisNode.peerData.push({ from: 'fakeId' })

      // Mock dependencies
      // sandbox.stub(uut.adapters.encryption, 'encryptMsg')
      sandbox.stub(uut, 'connectToPeer').resolves(true)

      const result = await uut.sendPrivateMessage(
        'fakeId',
        'messageStr',
        thisNode
      )
      // console.log('result: ', result)

      assert.equal(result, true)
    })
  })

  describe('#connectToPeer', () => {
    it('should skip if peer is already connected', async () => {
      // Test data
      const peerId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd'
      thisNode.peerList = [peerId]

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves([{ peer: peerId }])

      // Connect to that peer
      const result = await uut.connectToPeer(peerId, thisNode)

      assert.equal(result, true)
    })

    it('should connect to peer through circuit relay', async () => {
      // Test data
      const peerId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd'
      thisNode.peerList = [peerId]
      thisNode.relayData = [
        {
          multiaddr: '/ip4/139.162.76.54/tcp/5269/ws/p2p/QmaKzQTAtoJWYMiG5ATx41uWsMajr1kSxRdtg919s8fK77',
          connected: true,
          updatedAt: '2021-09-20T15:59:12.961Z',
          ipfsId: 'QmaKzQTAtoJWYMiG5ATx41uWsMajr1kSxRdtg919s8fK77',
          isBootstrap: false,
          metrics: { aboutLatency: [] },
          latencyScore: 10000
        }
      ]

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves([])
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves({ status: true })
      thisNode.useCases = {
        relays: {
          sortRelays: () => thisNode.relayData
        }
      }

      // Connect to that peer
      const result = await uut.connectToPeer(peerId, thisNode)

      assert.equal(result, true)
    })

    it('should return false if not able to connect to peer', async () => {
      // Test data
      const peerId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd'
      thisNode.peerList = [peerId]
      thisNode.relayData = [
        {
          multiaddr: '/ip4/139.162.76.54/tcp/5269/ws/p2p/QmaKzQTAtoJWYMiG5ATx41uWsMajr1kSxRdtg919s8fK77',
          connected: true,
          updatedAt: '2021-09-20T15:59:12.961Z',
          ipfsId: 'QmaKzQTAtoJWYMiG5ATx41uWsMajr1kSxRdtg919s8fK77',
          isBootstrap: false,
          metrics: { aboutLatency: [] },
          latencyScore: 10000
        }
      ]

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves([])
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(false)
      thisNode.useCases = {
        relays: {
          sortRelays: () => thisNode.relayData
        }
      }

      // Connect to that peer
      const result = await uut.connectToPeer(peerId, thisNode)

      assert.equal(result, false)
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.connectToPeer()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#addSubnetPeer', () => {
    it('should track a new peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)

      const announceObj = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          }
        }
      }

      uut.updateThisNode({ thisNode })
      const result = await uut.addSubnetPeer(announceObj)
      // console.log('result: ', result)

      assert.equal(result, true)
    })

    it('should track a new Relay peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.relayUseCases, 'addRelay').resolves()

      const announceObj = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          },
          isCircuitRelay: true
        }
      }

      uut.updateThisNode({ thisNode })
      const result = await uut.addSubnetPeer(announceObj)
      // console.log('result: ', result)

      assert.equal(result, true)
    })

    it('should update an existing peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)

      const announceObj = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          },
          orbitdb: 'orbitdbId'
        }
      }

      uut.updateThisNode({ thisNode })

      // Add the new peer
      await uut.addSubnetPeer(announceObj)

      // Simulate a second announcement object.
      const result = await uut.addSubnetPeer(announceObj)
      // console.log('result: ', result)

      assert.equal(result, true)

      // peerData array should only have one peer.
      assert.equal(uut.thisNode.peerData.length, 1)
    })

    it('should return false if existing peer can not be found', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)

      const announceObj = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          },
          orbitdb: 'orbitdbId'
        }
      }

      uut.updateThisNode({ thisNode })

      // Add the new peer
      await uut.addSubnetPeer(announceObj)

      // Force peer to not be found.
      uut.thisNode.peerData = []

      // Simulate a second announcement object.
      const result = await uut.addSubnetPeer(announceObj)
      // console.log('result: ', result)

      assert.equal(result, false)

      // peerData array should only have one peer.
      // assert.equal(uut.thisNode.peerData.length, 1)
    })

    it('should not update an existing peer if broadcast message is older the current one', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)

      const announceObj1 = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          },
          orbitdb: 'orbitdbId',
          broadcastedAt: new Date('10/07/2023')
        }
      }

      const announceObj2 = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          },
          orbitdb: 'orbitdbId',
          broadcastedAt: new Date('10/05/2023')
        }
      }

      uut.updateThisNode({ thisNode })

      // Add the new peer
      await uut.addSubnetPeer(announceObj1)

      // Simulate a second announcement object.
      const result = await uut.addSubnetPeer(announceObj2)
      // console.log('result: ', result)

      assert.equal(result, true)

      // peerData array should only have one peer.
      assert.equal(uut.thisNode.peerData.length, 1)
    })

    it('should catch, report, and throw an error', async () => {
      try {
        // Force an error
        sandbox.stub(uut, 'isFreshPeer').throws(new Error('test error'))

        const announceObj = {
          from: 'peerId'
        }

        await uut.addSubnetPeer(announceObj)

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#isFreshPeer', () => {
    it('should return false if peer data has no broadcastedAt property', () => {
      const announceObj = {
        data: {}
      }

      const result = uut.isFreshPeer(announceObj)

      assert.equal(result, false)
    })

    it('should return false if broadcast is older than 10 minutes', () => {
      const now = new Date()
      const fifteenMinutes = 15 * 60000
      let fifteenMinutesAgo = now.getTime() - fifteenMinutes
      fifteenMinutesAgo = new Date(fifteenMinutesAgo)

      const announceObj = {
        data: {
          broadcastedAt: fifteenMinutesAgo.toISOString()
        }
      }

      const result = uut.isFreshPeer(announceObj)

      assert.equal(result, false)
    })

    it('should return true if broadcast is newer than 10 minutes', () => {
      const now = new Date()
      const fiveMinutes = 5 * 60000
      let fiveMinutesAgo = now.getTime() - fiveMinutes
      fiveMinutesAgo = new Date(fiveMinutesAgo)

      const announceObj = {
        data: {
          broadcastedAt: fiveMinutesAgo.toISOString()
        }
      }

      const result = uut.isFreshPeer(announceObj)

      assert.equal(result, true)
    })
  })

  describe('#refreshPeerConnections', () => {
    it('should execute with no connected peers', async () => {
      // await uut.createSelf({ type: 'node.js' })

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)

      // Connect to that peer.
      await uut.refreshPeerConnections()
    })

    it('should skip if peer is already connected', async () => {
      // await uut.createSelf({ type: 'node.js' })
      // Add a peer that is already in the list of connected peers.
      uut.thisNode.peerList = ['QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd']

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj2)

      // Mock dependencies
      // sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(['QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd'])
      sandbox.stub(uut, 'updatePeerConnectionInfo').returns()

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    // 2/16/25 CT: Commented out to try new webRTC connection logic.
    // it('should refresh a connection', async () => {
    //   // await uut.createSelf({ type: 'node.js' })
    //   // Add a peer that is not in the list of connected peers.
    //   const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
    //   uut.thisNode.peerList = [ipfsId]
    //   uut.thisNode.peerData = [{ from: ipfsId, data: {} }]

    //   // Add a peer
    //   await uut.addSubnetPeer(mockData.announceObj)

    //   // Force circuit relay to be used.
    //   uut.thisNode.relayData = mockData.mockRelayData

    //   // Mock dependencies
    //   sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
    //   sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
    //   sandbox.stub(uut, 'isFreshPeer').returns(true)
    //   sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])
    //   sandbox.stub(uut.relayUseCases, 'sortRelays').returns(mockData.mockRelayData)

    //   // Connect to that peer.
    //   const result = await uut.refreshPeerConnections()

    //   assert.equal(result, true)
    // })

    it('should connect directly to circuit relays advertised IP and port', async () => {
      // Add a circuit relay peer with advertised IP and port.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{
        from: ipfsId,
        data: {
          isCircuitRelay: true,
          circuitRelayInfo: {
            ip4: '123.456.7.8',
            tcpPort: 4001
          }
        }
      }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
        .onCall(0).resolves({ success: true })
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should connect directly to IPFS peers multiaddr', async () => {
      // Add a circuit relay peer with advertised IP and port.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{ from: ipfsId, data: {} }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
        .onCall(0).resolves({ success: true })
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
      sandbox.stub(uut, 'updatePeerConnectionInfo').returns()

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    // 2/16/25 CT: Commented out to try new webRTC connection logic.
    // it('should report connection errors when connecting directly to IPFS peers multiaddr', async () => {
    //   // Add a circuit relay peer with advertised IP and port.
    //   const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
    //   uut.thisNode.peerList = [ipfsId]
    //   uut.thisNode.peerData = [{ from: ipfsId, data: {} }]

    //   // Add a peer
    //   await uut.addSubnetPeer(mockData.announceObj)

    //   // Force circuit relay to be used.
    //   uut.thisNode.relayData = mockData.mockRelayData

    //   // Mock dependencies
    //   sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
    //   sandbox.stub(uut, 'isFreshPeer').returns(true)
    //   sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
    //     .onCall(0).resolves({ success: false })
    //     .onCall(1).resolves({ sucdess: true })
    //   sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
    //   sandbox.stub(uut.relayUseCases, 'sortRelays').returns(mockData.mockRelayData)

    //   // Connect to that peer.
    //   const result = await uut.refreshPeerConnections()

    //   assert.equal(result, true)
    // })

    // 2/16/25 CT: Commented out to try new webRTC connection logic.
    // it('should connect through v2 Circuit Relay', async () => {
    //   // Add a circuit relay peer with advertised IP and port.
    //   const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
    //   uut.thisNode.peerList = [ipfsId]
    //   uut.thisNode.peerData = [{ from: ipfsId, data: {} }]

    //   // Add a peer
    //   await uut.addSubnetPeer(mockData.announceObj)

    //   // Force circuit relay to be used.
    //   uut.thisNode.relayData = mockData.mockRelayData

    //   // Mock dependencies
    //   sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
    //   sandbox.stub(uut, 'isFreshPeer').returns(true)
    //   sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
    //     .onCall(0).resolves({ success: true })
    //   sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])
    //   sandbox.stub(uut.relayUseCases, 'sortRelays').returns([{
    //     multiaddr: '/ip4/123.45.6.7/p2p/ipfs-id',
    //     connected: true
    //   }])
    //   sandbox.stub(uut, 'updatePeerConnectionInfo').returns()

    //   // Connect to that peer.
    //   const result = await uut.refreshPeerConnections()

    //   assert.equal(result, true)
    // })

    it('should skip if peer is stale', async () => {
      // Add a peer that is not in the list of connected peers.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{ from: ipfsId }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox.stub(uut, 'isFreshPeer').returns(false)

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should catch and throw an error', async () => {
      try {
        // Add a peer
        await uut.addSubnetPeer(mockData.announceObj)

        // Force error
        sandbox
          .stub(uut.adapters.ipfs, 'getPeers')
          .rejects(new Error('test error'))

        // Connect to that peer.
        await uut.refreshPeerConnections()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#sendRPC', () => {
    it('should return false if response is not recieved in time', async () => {
      // Mock dependencies and force desired code path.
      sandbox.stub(uut, 'sendPrivateMessage').resolves()

      // Prep test data.
      uut.waitPeriod = 1
      const ipfsId = 'testId'
      const cmdStr = 'fakeCmd'
      const id = 1
      const thisNode = {
        useCases: {
          peer: {
            sendPrivateMessage: async () => {
            },
            adapters: {
              bch: {
                bchjs: {
                  Util: {
                    sleep: () => {
                    }
                  }
                }
              }
            }
          }
        }
      }

      const result = await uut.sendRPC(ipfsId, cmdStr, id, thisNode)
      // console.log('result: ', result)

      assert.equal(result, false)
    })

    it('should return the result of the RPC call', async () => {
      // Mock dependencies and force desired code path.
      sandbox.stub(uut, 'sendPrivateMessage').resolves()

      // Prep test data.
      uut.waitPeriod = 2000
      const ipfsId = 'testId'
      const cmdStr = 'fakeCmd'
      const id = 1
      const thisNode = {
        useCases: {
          peer: {
            sendPrivateMessage: async () => {
            },
            adapters: {
              bch: {
                bchjs: {
                  Util: {
                    sleep: () => {
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Force positive code path.
      uut.incomingData = '{"id": 1}'

      const result = await uut.sendRPC(ipfsId, cmdStr, id, thisNode)
      // console.log('result: ', result)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.sendRPC()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#queryAbout', () => {
    it('should return true after peer responds to RPC', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'sendRPC').resolves(true)

      const result = await uut.queryAbout()
      assert.equal(result, true)
    })

    it('should return false if peer never responds to RPC', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'sendRPC').resolves(false)

      const result = await uut.queryAbout()
      assert.equal(result, false)
    })

    it('should return false when there is an error', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'sendRPC').rejects(new Error('test error'))

      const result = await uut.queryAbout()
      assert.equal(result, false)
    })
  })
})
