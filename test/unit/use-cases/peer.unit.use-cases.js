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

      uut.updateThisNode(thisNode)
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

      uut.updateThisNode(thisNode)
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

      uut.updateThisNode(thisNode)

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

      uut.updateThisNode(thisNode)

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

      uut.updateThisNode(thisNode)

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
})
