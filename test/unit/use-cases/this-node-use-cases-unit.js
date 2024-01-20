/*
  Unit tests for the this-node use case.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'
import AdapterMock from '../../mocks/adapter-mock.js'
// import mockData from '../../mocks/peers-mock.js'
// import UseCasesMock from '../../mocks/use-case-mocks.js'

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

    // const useCases = new UseCasesMock()
    // uut.updateUseCases(useCases)
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

  // describe('#refreshPeerConnections', () => {
  //   it('should execute with no connected peers', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //
  //     // Connect to that peer.
  //     await uut.refreshPeerConnections()
  //   })
  //
  //   it('should skip if peer is already connected', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a peer that is already in the list of connected peers.
  //     uut.thisNode.peerList = ['QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd']
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj2)
  //
  //     // Mock dependencies
  //     // sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(['QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd'])
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should refresh a connection', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a peer that is not in the list of connected peers.
  //     const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
  //     uut.thisNode.peerList = [ipfsId]
  //     uut.thisNode.peerData = [{ from: ipfsId, data: {} }]
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Force circuit relay to be used.
  //     uut.thisNode.relayData = mockData.mockRelayData
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
  //     sandbox.stub(uut, 'isFreshPeer').returns(true)
  //     sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should connect directly to circuit relays advertised IP and port', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a circuit relay peer with advertised IP and port.
  //     const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
  //     uut.thisNode.peerList = [ipfsId]
  //     uut.thisNode.peerData = [{
  //       from: ipfsId,
  //       data: {
  //         isCircuitRelay: true,
  //         circuitRelayInfo: {
  //           ip4: '123.456.7.8',
  //           tcpPort: 4001
  //         }
  //       }
  //     }]
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Force circuit relay to be used.
  //     uut.thisNode.relayData = mockData.mockRelayData
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut, 'isFreshPeer').returns(true)
  //     sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
  //       .onCall(0).resolves({ success: true })
  //     sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should connect directly to IPFS peers multiaddr', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a circuit relay peer with advertised IP and port.
  //     const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
  //     uut.thisNode.peerList = [ipfsId]
  //     uut.thisNode.peerData = [{ from: ipfsId, data: {} }]
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Force circuit relay to be used.
  //     uut.thisNode.relayData = mockData.mockRelayData
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut, 'isFreshPeer').returns(true)
  //     sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
  //       .onCall(0).resolves({ success: true })
  //     sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should report connection errors when connecting directly to IPFS peers multiaddr', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a circuit relay peer with advertised IP and port.
  //     const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
  //     uut.thisNode.peerList = [ipfsId]
  //     uut.thisNode.peerData = [{ from: ipfsId, data: {} }]
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Force circuit relay to be used.
  //     uut.thisNode.relayData = mockData.mockRelayData
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut, 'isFreshPeer').returns(true)
  //     sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
  //       .onCall(0).resolves({ success: false })
  //       .onCall(1).resolves({ sucdess: true })
  //     sandbox.stub(uut.utils, 'filterMultiaddrs').returns(['/ip4/123.45.6.7/p2p/ipfs-id'])
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should connect through v2 Circuit Relay', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a circuit relay peer with advertised IP and port.
  //     const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
  //     uut.thisNode.peerList = [ipfsId]
  //     uut.thisNode.peerData = [{ from: ipfsId, data: {} }]
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Force circuit relay to be used.
  //     uut.thisNode.relayData = mockData.mockRelayData
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut, 'isFreshPeer').returns(true)
  //     sandbox.stub(uut.adapters.ipfs, 'connectToPeer')
  //       .onCall(0).resolves({ success: true })
  //     sandbox.stub(uut.utils, 'filterMultiaddrs').returns([])
  //     sandbox.stub(uut.thisNode.useCases.relays, 'sortRelays').returns([{
  //       multiaddr: '/ip4/123.45.6.7/p2p/ipfs-id',
  //       connected: true
  //     }])
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should skip if peer is stale', async () => {
  //     await uut.createSelf({ type: 'node.js' })
  //     // Add a peer that is not in the list of connected peers.
  //     const ipfsId = 'QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsje'
  //     uut.thisNode.peerList = [ipfsId]
  //     uut.thisNode.peerData = [{ from: ipfsId }]
  //
  //     // Add a peer
  //     await uut.addSubnetPeer(mockData.announceObj)
  //
  //     // Force circuit relay to be used.
  //     uut.thisNode.relayData = mockData.mockRelayData
  //
  //     // Mock dependencies
  //     sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
  //     sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
  //     sandbox.stub(uut, 'isFreshPeer').returns(false)
  //
  //     // Connect to that peer.
  //     const result = await uut.refreshPeerConnections()
  //
  //     assert.equal(result, true)
  //   })
  //
  //   it('should catch and throw an error', async () => {
  //     try {
  //       await uut.createSelf({ type: 'node.js' })
  //
  //       // Add a peer
  //       await uut.addSubnetPeer(mockData.announceObj)
  //
  //       // Force error
  //       sandbox
  //         .stub(uut.adapters.ipfs, 'getPeers')
  //         .rejects(new Error('test error'))
  //
  //       // Connect to that peer.
  //       await uut.refreshPeerConnections()
  //
  //       assert.fail('Unexpected code path')
  //     } catch (err) {
  //       // console.log('err: ', err)
  //       assert.include(err.message, 'test error')
  //     }
  //   })
  // })

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
