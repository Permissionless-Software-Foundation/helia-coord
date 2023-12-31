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

    uut = new PeerUseCases({ adapters, controllers: {} })
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
})
