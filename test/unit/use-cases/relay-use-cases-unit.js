/*
  Unit tests for the Circuit Relays use case.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import RelayUseCases from '../../../lib/use-cases/relay-use-cases.js'
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'
import AdapterMock from '../../mocks/adapter-mock.js'
import mockData from '../../mocks/peers-mock.js'
import relayMockData from '../../mocks/circuit-relay-mocks.js'

const adapters = new AdapterMock()

describe('#relay-Use-Cases', () => {
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

    uut = new RelayUseCases({
      adapters,
      statusLog: () => {
      },
      bootstrapRelays: ['fake-multiaddr']
    })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new RelayUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of adapters when instantiating Relay Use Cases library.'
        )
      }
    })
  })

  describe('#initializeRelays', () => {
    it('should initialize the node.js circuit relays', async () => {
      const result = await uut.initializeRelays(thisNode)

      // assert.isOk(true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should initialize the browser circuit relays', async () => {
      thisNode.type = 'browser'

      const result = await uut.initializeRelays(thisNode)

      // assert.isOk(true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should catch and throw an error', async () => {
      try {
        // Force an error
        sandbox
          .stub(uut.adapters.ipfs, 'connectToPeer')
          .rejects(new Error('test error'))

        uut.bootstrapCircuitRelays = {
          node: [{
            multiaddr: 'fake-multiaddr'
          }]
        }

        await uut.initializeRelays(thisNode)

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#getCRGist', () => {
    it('should load list from GitHub and connect to node.js circuit relays', async () => {
      // Mock dependencies
      const data = {
        browser: [],
        node: [{
          ipfsId: '123'
        }]
      }
      sandbox.stub(uut.adapters.gist, 'getCRList').resolves(data)
      sandbox.stub(uut, 'removeDuplicates').resolves()

      const result = await uut.getCRGist(thisNode)

      assert.equal(result, true)
    })

    it('should load list from GitHub and connect to browser circuit relays', async () => {
      thisNode.type = 'browser'

      // Force desired code path.
      thisNode.relayData.push({
        ipfsId: 'fake-id'
      })

      // Mock dependencies
      const data = {
        browser: [{
          ipfsId: 'fake-id'
        }],
        node: []
      }
      sandbox.stub(uut.adapters.gist, 'getCRList').resolves(data)
      sandbox.stub(uut, 'removeDuplicates').resolves()

      const result = await uut.getCRGist(thisNode)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Force desired code path.
        sandbox.stub(uut.adapters.gist, 'getCRList').rejects(new Error('test error'))

        await uut.getCRGist()

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#connectToCRs', () => {
    it('should connect to array of circuit relays', async () => {
      await uut.connectToCRs(thisNode)

      assert.equal(true, true, 'Not throwing an error is a success')
    })

    it('Should try to connect to circuit relays', async () => {
      // Force circuit relay to be used.
      thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'sortRelays').returns(thisNode.relayData)

      // uut.state.relays = crMockData.circuitRelays
      await uut.connectToCRs(thisNode)

      assert.equal(true, true, 'Not throwing an error is a success')
    })

    it('Should skip relays that are already connected', async () => {
      // Force circuit relay to be used.
      thisNode.relayData = mockData.mockRelayData

      // Force mock ciruit relay to appear as being already connected.
      thisNode.relayData[0].multiaddr = mockData.swarmPeers[0].peer

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers)
      sandbox.stub(uut, 'sortRelays').returns(thisNode.relayData)

      // uut.state.relays = crMockData.circuitRelays
      await uut.connectToCRs(thisNode)

      assert.equal(true, true, 'Not throwing an error is a success')
    })

    it('Should try to connect to circuit relays', async () => {
      // Force circuit relay to be used.
      thisNode.relayData = mockData.mockRelayData

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'getPeers').resolves(mockData.swarmPeers2)
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox.stub(uut, 'sortRelays').returns(thisNode.relayData)

      // uut.state.relays = crMockData.circuitRelays
      await uut.connectToCRs(thisNode)

      assert.equal(true, true, 'Not throwing an error is a success')
    })

    it('should return false when error occurs.', async () => {
      // Force desired code path
      sandbox.stub(uut, 'sortRelays').throws(new Error('test error'))

      const result = await uut.connectToCRs(thisNode)

      assert.equal(result, false)
    })
  })

  describe('#addRelay', () => {
    it('should return true if peer is already in relayData array', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [{ ipfsId }]
      }

      const result = await uut.addRelay(ipfsId, thisNode)

      assert.equal(result, true)
    })

    it('should connect to a peers multiaddr', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: ['/ip4/addr1'],
              isCircuitRelay: true
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox
        .stub(uut.adapters.ipfs, 'getPeers')
        .resolves([{ peer: ipfsId, addr: '/ip4/addr1' }])

      const result = await uut.addRelay(ipfsId, thisNode)

      // console.log('thisNode: ', thisNode)

      // Function should return true.
      assert.equal(result, true)

      // relayData array should be updated
      assert.isArray(thisNode.relayData) // Its an array.
      assert.equal(thisNode.relayData.length, 1) //  Should be one element

      // Assert expected properties of the object.
      assert.property(thisNode.relayData[0], 'multiaddr')
      assert.property(thisNode.relayData[0], 'connected')
      assert.property(thisNode.relayData[0], 'updatedAt')
      assert.property(thisNode.relayData[0], 'ipfsId')
      assert.property(thisNode.relayData[0], 'isBootstrap')
      assert.property(thisNode.relayData[0], 'metrics')

      // Assert expected values.
      assert.include(thisNode.relayData[0].multiaddr, '/p2p/testId')
      assert.equal(thisNode.relayData[0].connected, true)
      assert.equal(thisNode.relayData[0].ipfsId, 'testId')
      assert.equal(thisNode.relayData[0].isBootstrap, false)
      assert.isArray(thisNode.relayData[0].metrics.aboutLatency)
    })

    it('should return false if thisNode can not connect to peer', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: ['addr1']
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(false)

      const result = await uut.addRelay(ipfsId, thisNode)

      assert.equal(result, false)
    })

    it('should not connect to peer with p2p-circuit in multiaddr', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: ['addr1/p2p-circuit/addr2']
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox.stub(uut.adapters.ipfs, 'disconnectFromPeer').resolves()
      sandbox
        .stub(uut.adapters.ipfs, 'getPeers')
        .resolves([{ peer: ipfsId, addr: 'addr1/p2p-circuit/addr2' }])

      const result = await uut.addRelay(ipfsId, thisNode)

      assert.equal(result, false)
    })

    it('should return false on error', async () => {
      const result = await uut.addRelay()

      assert.equal(result, false)
    })

    it('should not connect to peer with p2p-circuit in multiaddr', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: ['addr1/p2p-circuit/addr2']
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox.stub(uut.adapters.ipfs, 'disconnectFromPeer').resolves()
      sandbox
        .stub(uut.adapters.ipfs, 'getPeers')
        .resolves([{ peer: ipfsId, addr: 'addr1/p2p-circuit/addr2' }])

      const result = await uut.addRelay(ipfsId, thisNode)

      assert.equal(result, false)
    })

    it('should report connection failure and return false', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: ['/ip4/addr1'],
              isCircuitRelay: true
            }
          }
        ]
      }

      // Force desired code path.
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(false)

      const result = await uut.addRelay(ipfsId, thisNode)

      // console.log('thisNode: ', thisNode)

      // Function should return true.
      assert.equal(result, false)
    })

    it('should detect and add optional connection data to multiaddr', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: ['/ip4/addr1'],
              isCircuitRelay: true,
              circuitRelayInfo: {
                ip4: '555.555.555.555',
                crDomain: '666.666.666.666'
              }
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox
        .stub(uut.adapters.ipfs, 'getPeers')
        .resolves([{ peer: ipfsId, addr: '/ip4/addr1' }])

      const result = await uut.addRelay(ipfsId, thisNode)

      // console.log(`thisNode: ${JSON.stringify(thisNode, null, 2)}`)

      // Function should return true.
      assert.equal(result, true)

      // Assert the expected circuit relay multiaddrs have been added.
      const ip4Exists = thisNode.peerData[0].data.ipfsMultiaddrs.filter(x => x.includes('555.555'))
      assert.equal(ip4Exists.length, 1)
      const dnsExists = thisNode.peerData[0].data.ipfsMultiaddrs.filter(x => x.includes('666.666'))
      assert.equal(dnsExists.length, 1)
    })

    it('should filter out undesired multiaddrs', async () => {
      // Mock test data
      const ipfsId = 'testId'
      const thisNode = {
        relayData: [],
        peerData: [
          {
            data: {
              ipfsId,
              ipfsMultiaddrs: [
                'ip4/tcp/127.0.0.1/addr1',
                'ip4/udp/123.456.789.1/addr1',
                'ip4/quic/123.456.789.1/addr1',
                'ip4/tcp/123.456.789.1/p2p-circuit/p2p/addr1',
                '/ip4/addr1',
                '/ip4/192.168.0.1/addr1',
                '/ip4/172.16.0.1/addr1'
              ],
              isCircuitRelay: true
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves(true)
      sandbox
        .stub(uut.adapters.ipfs, 'getPeers')
        .resolves([{ peer: ipfsId, addr: '/ip4/addr1' }])

      const result = await uut.addRelay(ipfsId, thisNode)

      // console.log('thisNode: ', thisNode)

      // Function should return true.
      assert.equal(result, true)

      // relayData array should be updated
      assert.isArray(thisNode.relayData) // Its an array.
      assert.equal(thisNode.relayData.length, 1) //  Should be one element

      // Assert expected properties of the object.
      assert.property(thisNode.relayData[0], 'multiaddr')
      assert.property(thisNode.relayData[0], 'connected')
      assert.property(thisNode.relayData[0], 'updatedAt')
      assert.property(thisNode.relayData[0], 'ipfsId')
      assert.property(thisNode.relayData[0], 'isBootstrap')
      assert.property(thisNode.relayData[0], 'metrics')

      // Assert expected values.
      assert.include(thisNode.relayData[0].multiaddr, '/p2p/testId')
      assert.equal(thisNode.relayData[0].connected, true)
      assert.equal(thisNode.relayData[0].ipfsId, 'testId')
      assert.equal(thisNode.relayData[0].isBootstrap, false)
      assert.isArray(thisNode.relayData[0].metrics.aboutLatency)
    })
  })

  describe('#measureRelays', () => {
    it('should catch and throw errors', async () => {
      try {
        await uut.measureRelays()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })

    it('should skip bootstrap relays', async () => {
      // Mock test data
      const thisNode = {
        relayData: [
          {
            isBootstrap: true,
            metrics: {
              aboutLatency: []
            }
          }
        ],
        peerData: []
      }

      await uut.measureRelays(thisNode)
      // console.log('thisNode: ', thisNode)

      // Assert that the latecy metrics are unchanged.
      assert.equal(thisNode.relayData[0].metrics.aboutLatency.length, 0)
    })

    it('should give disconnected relays the worst latency score', async () => {
      // Mock test data
      const thisNode = {
        relayData: [
          {
            ipfsId: 'testId',
            isBootstrap: false,
            connected: false,
            metrics: {
              aboutLatency: []
            }
          }
        ],
        peerData: [
          {
            data: {
              ipfsId: 'testId',
              isCircuitRelay: true
            }
          }
        ]
      }

      await uut.measureRelays(thisNode)
      // console.log('thisNode: ', thisNode)

      assert.equal(thisNode.relayData[0].metrics.aboutLatency[0], 10000)
    })

    it('should score the latency of a relay peer', async () => {
      // Mock test data
      const thisNode = {
        relayData: [
          {
            ipfsId: 'testId',
            isBootstrap: false,
            connected: true,
            metrics: {
              aboutLatency: []
            }
          }
        ],
        peerData: [
          {
            data: {
              ipfsId: 'testId',
              isCircuitRelay: true
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.bch.bchjs.Util, 'sleep').resolves()
      sandbox.stub(uut.adapters.pubsub.about, 'queryAbout').resolves(true)

      await uut.measureRelays(thisNode)
      // console.log(
      //   'thisNode.relayData[0].metrics.aboutLatency: ',
      //   thisNode.relayData[0].metrics.aboutLatency
      // )

      assert.isNumber(thisNode.relayData[0].metrics.aboutLatency[0])
    })

    it('should replace oldest data with new data', async () => {
      // Mock test data
      const thisNode = {
        relayData: [
          {
            ipfsId: 'testId',
            isBootstrap: false,
            connected: true,
            metrics: {
              aboutLatency: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            }
          }
        ],
        peerData: [
          {
            data: {
              ipfsId: 'testId',
              isCircuitRelay: true
            }
          }
        ]
      }

      // Mock dependencies
      sandbox.stub(uut.adapters.bch.bchjs.Util, 'sleep').resolves()

      await uut.measureRelays(thisNode)
      // console.log(
      //   'thisNode.relayData[0].metrics.aboutLatency: ',
      //   thisNode.relayData[0].metrics.aboutLatency
      // )

      // First element of '1' should have been shifted out and replaced by '2'
      assert.equal(thisNode.relayData[0].metrics.aboutLatency[0], 2)
    })
  })

  describe('#sortRelays', () => {
    it('should sort an array of relay data', () => {
      const relayData = [
        { metrics: { aboutLatency: [5, 6, 7] } },
        { metrics: { aboutLatency: [7, 8, 9] } },
        { metrics: { aboutLatency: [6, 7, 8] } }
      ]

      const result = uut.sortRelays(relayData)
      // console.log('result: ', result)

      assert.equal(result[0].latencyScore, 6)
      assert.equal(result[2].latencyScore, 8)
    })

    it('should give highest score to Boostrap nodes', () => {
      const relayData = [{ isBootstrap: true }]

      const result = uut.sortRelays(relayData)
      // console.log('result: ', result)

      assert.equal(result[0].latencyScore, 10000)
    })

    it('should give highest score to empty metrics array', () => {
      const relayData = [{ metrics: { aboutLatency: [] } }]

      const result = uut.sortRelays(relayData)
      // console.log('result: ', result)

      assert.equal(result[0].latencyScore, 10000)
    })

    it('should catch and throw errors', () => {
      try {
        uut.sortRelays()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#removeDuplicates', () => {
    it('should remove duplicate entries', () => {
      // Mock test data
      const thisNode = {
        relayData: relayMockData.duplicateRelays
      }

      const result = uut.removeDuplicates(thisNode)

      // console.log('thisNode.relayData: ', thisNode.relayData)

      assert.equal(result, true)
      assert.equal(thisNode.relayData.length, 3)
    })

    it('should catch and throw errors', () => {
      try {
        uut.removeDuplicates()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#connectToBootstrapRelays', () => {
    it('should connect to a list of v1 Circuit Relays', async () => {
      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs, 'connectToPeer').resolves()

      uut.bootstrapRelays = ['fake-multiaddr']

      const result = await uut.connectToBootstrapRelays()

      assert.equal(result, true)
    })

    it('should catch, report, and throw errors', async () => {
      try {
        // Force and error
        uut.bootstrapRelays = null

        await uut.connectToBootstrapRelays()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })
})
