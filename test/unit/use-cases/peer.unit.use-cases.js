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
    it('should persit the multiaddr if it exist', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)

      const announceObj = {
        from: 'peerId',
        data: {
          jsonLd: {
            name: 'test'
          },
          orbitdb: 'orbitdbId'
        },
        multiaddr: ['/ip4/123.45.6.7/p2p/ipfs-id']
      }
      uut.updateThisNode({ thisNode })

      // Add the new peer
      uut.thisNode.peerList.push(announceObj.from)
      uut.thisNode.peerData.push(announceObj)

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
    it('should handle Error', () => {
      try {
        uut.isFreshPeer(null)
      } catch (error) {
        assert.include(error.message, 'Cannot read properties of null')
      }
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
    it('should update logs on fails direct connection', async () => {
      // Add a circuit relay peer with advertised IP and port.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{ from: ipfsId, data: { ipfsMultiaddrs: [] } }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
        .onCall(0).resolves({ success: false })
        .resolves({ success: true })
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
      sandbox.stub(uut, 'updatePeerConnectionInfo').returns()

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })
    it('should connect to circuit relay ', async () => {
      // Add a circuit relay peer with advertised IP and port.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{ from: ipfsId, data: { ipfsMultiaddrs: ['/p2p-circuit/ip4/123.45.6.7/tcp/4001/p2p/ipfs-id'] } }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
        .onCall(0).resolves({ success: false })
        .resolves({ success: true })
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
      sandbox.stub(uut, 'updatePeerConnectionInfo').returns()

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })
    it('should update logs on fails circuit relay connection', async () => {
      // Add a circuit relay peer with advertised IP and port.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{ from: ipfsId, data: { ipfsMultiaddrs: ['/p2p-circuit/ip4/123.45.6.7/tcp/4001/p2p/ipfs-id'] } }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
        .onCall(0).resolves({ success: false })
        .resolves({ success: false })
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
      sandbox.stub(uut, 'updatePeerConnectionInfo').returns()

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
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

  describe('#updatePeerConnectionInfo', () => {
    it('should update the peer connection info', async () => {
      uut.thisNode.peerData = [{ from: 'peerId' }]
      sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getConnections').returns([{ remoteAddr: '/ip4/123.45.6.7/p2p/ipfs-id' }])
      const result = await uut.updatePeerConnectionInfo({ thisPeer: 'peerId' })
      assert.equal(result, true)
      assert.equal(uut.thisNode.peerData[0].multiaddr, '/ip4/123.45.6.7/p2p/ipfs-id')
    })
    it('should return false if the peer is not connected', async () => {
      uut.thisNode.peerData = [{ from: 'peerId' }]
      sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getConnections').returns([])
      const result = await uut.updatePeerConnectionInfo({ thisPeer: 'peerId' })
      assert.equal(result, false)
    })
    it('should return false if the peer is not found', async () => {
      uut.thisNode.peerData = [{ from: 'peerId' }]
      sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getConnections').returns([{ remoteAddr: '/ip4/123.45.6.7/p2p/ipfs-id' }])
      const result = await uut.updatePeerConnectionInfo({ thisPeer: 'peerId2' })
      assert.equal(result, false)
    })
    it('should handle errors', async () => {
      try {
        uut.thisNode.peerData = [{ from: 'peerId' }]
        sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getConnections').throws(new Error('test error'))
        await uut.updatePeerConnectionInfo({ thisPeer: 'peerId' })
        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'test error')
      }
    })
  })
  describe('#getWebRtcMultiaddr', () => {
    it('should return the webRTC multiaddr', async () => {
      const thisNodeMock = thisNode
      const webRtcMultiaddr1 = '/ip4/127.0.0.1/tcp/5000/ws/p2p-circuit/webrtc/p2p/ipfs-id'
      const webRtcMultiaddr2 = '/ip4/127.0.0.1/tcp/5001/ws/p2p-circuit/webrtc/p2p/ipfs-id2'

      thisNodeMock.ipfsMultiaddrs = ['/ip4/123.45.6.7/p2p/ipfs-id', webRtcMultiaddr1, webRtcMultiaddr2]
      sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getMultiaddrs').returns([webRtcMultiaddr2])

      await uut.getWebRtcMultiaddr({ thisNode: thisNodeMock })

      assert.equal(thisNodeMock.ipfsMultiaddrs.length, 2)
      assert.equal(thisNodeMock.ipfsMultiaddrs[0], '/ip4/123.45.6.7/p2p/ipfs-id')
      assert.equal(thisNodeMock.ipfsMultiaddrs[1], webRtcMultiaddr2, 'expected webRTC multiaddr to be updated')
    })
    it('should return false on error', async () => {
      const result = await uut.getWebRtcMultiaddr(null)
      assert.equal(result, false)
    })
  })
  describe('#getMultiaddrs', () => {
    it('should filter multiaddrs with a low chance of success', async () => {
      const webRtcMultiaddr1 = '/ip4/157.178.192.100/tcp/5000/ws/p2p-circuit/webrtc/p2p/ipfs-id'
      const lowChanceMultiaddrsExamples = [
        '/ip4/127.0.0.1/tcp/4001/p2p/QmHash', // localhost
        '/ip4/192.168.1.100/tcp/4001/p2p/QmHash', // private network (192.168.x.x)
        '/ip4/172.16.0.100/tcp/4001/p2p/QmHash', // private network (172.16-31.x.x)
        '/ip4/10.0.0.100/tcp/4001/p2p/QmHash', // private network (10.x.x.x)
        '/ip4/1.2.3.4/p2p/4001/quic/p2p/QmHash', // QUIC protocol
        '/ip4/1.2.3.4/udp/4001/p2p/QmHash', // UDP protocol
        '/ip4/192.168.0.100/udp/4001/quic/p2p/QmHash', // private network with QUIC
        '/ip4/172.20.0.100/udp/4001/p2p/QmHash' // private network with UDP

      ]
      sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getMultiaddrs').returns([...lowChanceMultiaddrsExamples, webRtcMultiaddr1])
      const result = await uut.getMultiaddrs()
      assert.equal(result.length, 1)
      assert.equal(result[0], webRtcMultiaddr1)
    })
    it('should return empty array on error', async () => {
      sandbox.stub(uut.adapters.ipfs.ipfs.libp2p, 'getMultiaddrs').throws(new Error('test error'))
      const result = await uut.getMultiaddrs()
      assert.equal(result.length, 0)
    })
  })
  describe('relayMetricsHandler', () => {
    it('should return true', async () => {
      uut.incomingData = 'data'
      await uut.relayMetricsHandler('updated data')
      assert.equal(uut.incomingData, 'updated data')
    })
  })

  describe('updateThisNode', () => {
    it('should update the thisNode object', async () => {
      const thisNodeMock = { data: 'mock node' }
      const result = await uut.updateThisNode({ thisNode: thisNodeMock })
      assert.equal(result, true)
      assert.equal(uut.thisNode.data, 'mock node')
    })
    it('should keep as default if no data is provided', async () => {
      const result = await uut.updateThisNode()
      assert.equal(result, true)
      assert.isUndefined(uut.thisNode)
    })
  })
})
