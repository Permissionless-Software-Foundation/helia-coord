/*
  Unit tests for the this-node use case.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'
import AdapterMock from '../../mocks/adapter-mock.js'
import mockData from '../../mocks/peers-mock.js'
import UseCasesMock from '../../mocks/use-case-mocks.js'

const adapters = new AdapterMock()

describe('#thisNode-Use-Cases', () => {
  let uut
  let sandbox

  beforeEach(() => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    uut = new ThisNodeUseCases({
      adapters,
      v1Relays: ['fake-addr']
    })

    const useCases = new UseCasesMock()
    uut.updateUseCases(useCases)
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new ThisNodeUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of adapters when instantiating thisNode Use Cases library.'
        )
      }
    })

    it('should instantiate the use cases library', () => {
      uut = new ThisNodeUseCases({
        adapters: {}
      })

      assert.property(uut, 'adapters')
    })
  })

  describe('#createSelf', () => {
    it('should create a thisNode entity', async () => {
      uut = new ThisNodeUseCases({ adapters, statusLog: {}, tcpPort: 4001 })

      // Mock dependencies
      sandbox.stub(uut, 'publicIp').resolves('123.456.789.10')

      const result = await uut.createSelf({ type: 'node.js' })
      // console.log('result: ', result)

      assert.property(result, 'ipfsId')
      assert.property(result, 'type')
    })
  })

  describe('#addSubnetPeer', () => {
    it('should track a new peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)

      const announceObj = {
        from: 'peerId',
        data: {}
      }

      await uut.createSelf({ type: 'node.js' })
      const result = await uut.addSubnetPeer(announceObj)
      // console.log('result: ', result)

      assert.equal(result, true)
    })

    it('should track a new Relay peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.useCases.relays, 'addRelay').resolves()

      const announceObj = {
        from: 'peerId',
        data: {
          isCircuitRelay: true
        }
      }

      await uut.createSelf({ type: 'node.js' })
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
          orbitdb: 'orbitdbId'
        }
      }

      await uut.createSelf({ type: 'node.js' })

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
          orbitdb: 'orbitdbId'
        }
      }

      await uut.createSelf({ type: 'node.js' })

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
          orbitdb: 'orbitdbId',
          broadcastedAt: new Date('10/07/2023')
        }
      }

      const announceObj2 = {
        from: 'peerId',
        data: {
          orbitdb: 'orbitdbId',
          broadcastedAt: new Date('10/05/2023')
        }
      }

      await uut.createSelf({ type: 'node.js' })

      // Add the new peer
      await uut.addSubnetPeer(announceObj1)

      // Simulate a second announcement object.
      const result = await uut.addSubnetPeer(announceObj2)
      // console.log('result: ', result)

      assert.equal(result, true)

      // peerData array should only have one peer.
      assert.equal(uut.thisNode.peerData.length, 1)
    })

    it('should catch and report an error', async () => {
      try {
        const announceObj = {
          from: 'peerId'
        }

        await uut.addSubnetPeer(announceObj)

        assert.isOk(true, 'Not throwing an error is a pass')
      } catch (err) {
        // console.log(err)
        assert.fail('Unexpected code path')
      }
    })
  })

  describe('#refreshPeerConnections', () => {
    it('should execute with no connected peers', async () => {
      await uut.createSelf({ type: 'node.js' })

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)

      // Connect to that peer.
      await uut.refreshPeerConnections()
    })

    it('should skip if peer is already connected', async () => {
      await uut.createSelf({ type: 'node.js' })
      // Add a peer that is already in the list of connected peers.
      uut.thisNode.peerList = ['QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd']

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj2)

      // Mock dependencies
      // sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(['QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd'])

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should refresh a connection', async () => {
      await uut.createSelf({ type: 'node.js' })
      // Add a peer that is not in the list of connected peers.
      const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
      uut.thisNode.peerList = [ipfsId]
      uut.thisNode.peerData = [{ from: ipfsId, data: {} }]

      // Add a peer
      await uut.addSubnetPeer(mockData.announceObj)

      // Force circuit relay to be used.
      uut.thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox.stub(uut, 'isFreshPeer').returns(true)
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should connect directly to circuit relays advertised IP and port', async () => {
      await uut.createSelf({ type: 'node.js' })
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
      await uut.createSelf({ type: 'node.js' })
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

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should report connection errors when connecting directly to IPFS peers multiaddr', async () => {
      await uut.createSelf({ type: 'node.js' })
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
        .onCall(0).resolves({ success: false })
        .onCall(1).resolves({ sucdess: true })
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should connect through v2 Circuit Relay', async () => {
      await uut.createSelf({ type: 'node.js' })
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
      sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])
      sandbox.stub(uut.thisNode.useCases.relays, 'sortRelays').returns([{
        multiaddr: '/ip4/123.45.6.7/p2p/ipfs-id',
        connected: true
      }])

      // Connect to that peer.
      const result = await uut.refreshPeerConnections()

      assert.equal(result, true)
    })

    it('should skip if peer is stale', async () => {
      await uut.createSelf({ type: 'node.js' })
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
        await uut.createSelf({ type: 'node.js' })

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

  describe('#enforceBlacklist', () => {
    it('should disconnect from blacklisted peers', async () => {
      await uut.createSelf({ type: 'node.js' })

      // Set up test data
      uut.thisNode.blacklistPeers = ['testId']
      uut.thisNode.blacklistMultiaddrs = ['testId']

      const result = await uut.enforceBlacklist()

      assert.equal(result, true)
    })

    it('catch and throw an error', async () => {
      try {
        await uut.enforceBlacklist()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#enforceWhitelist', () => {
    it('should disconnect from non-ipfs-coord peers', async () => {
      await uut.createSelf({ type: 'node.js' })

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves([{ peer: 'badId' }])
      const spy1 = sandbox
        .stub(uut.adapters.ipfs, 'disconnectFromPeer')
        .resolves()

      const result = await uut.enforceWhitelist()

      // Assert that the method completed.
      assert.equal(result, true)

      // Assert that disconnectFromPeer() was called.
      assert.equal(spy1.called, true)
    })

    it('should skip ipfs-coord peers', async () => {
      await uut.createSelf({ type: 'node.js' })
      uut.thisNode.peerData = [
        {
          from: 'goodId',
          data: {
            jsonLd: {
              name: 'good-name'
            }
          }
        }
      ]

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves([{ peer: 'goodId' }])
      const spy1 = sandbox
        .stub(uut.adapters.ipfs, 'disconnectFromPeer')
        .resolves()

      const result = await uut.enforceWhitelist()

      // Assert that the method completed.
      assert.equal(result, true)

      // Assert that disconnectFromPeer() was not called.
      assert.equal(spy1.called, false)
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.enforceWhitelist()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })
})
