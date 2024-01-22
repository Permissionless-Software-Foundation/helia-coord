/*
  Unit tests for the main Controllers index.js file.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import TimerControllers from '../../../lib/controllers/timer-controller.js'
import AdapterMock from '../../mocks/adapter-mock.js'
import UseCasesMock from '../../mocks/use-case-mocks.js'
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'

const adapters = new AdapterMock()

describe('#Controllers-Timer', () => {
  let uut
  let sandbox
  let useCases
  let thisNode
  let clock

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()
    clock = sinon.useFakeTimers()

    useCases = new UseCasesMock()

    uut = new TimerControllers({
      adapters,
      useCases,
      statusLog: () => {
      }
    })

    const thisNodeUseCases = new ThisNodeUseCases({
      adapters,
      controllers: {},
      statusLog: () => {
      }
    })
    thisNode = await thisNodeUseCases.createSelf({ type: 'node.js' })
  })

  afterEach(() => {
    sandbox.restore()
    clock.restore()

    uut.stopAllTimers()
  })

  after(() => {
    console.log('Stopping all timers')
    uut.stopAllTimers()
  })

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new TimerControllers()
      } catch (err) {
        assert.include(
          err.message,
          'Instance of adapters required when instantiating Timer Controllers'
        )
      }
    })

    it('should throw an error if use cases are not included', () => {
      try {
        uut = new TimerControllers({ adapters })
      } catch (err) {
        assert.include(
          err.message,
          'Instance of use cases required when instantiating Timer Controllers'
        )
      }
    })

    it('should throw an error if status log handler is not included', () => {
      try {
        uut = new TimerControllers({ adapters, useCases })
      } catch (err) {
        assert.include(
          err.message,
          'Handler for status logs required when instantiating Timer Controllers'
        )
      }
    })
  })

  describe('#startTimers', () => {
    it('should start the timers', () => {
      const result = uut.startTimers()

      assert.property(result, 'circuitRelayTimerHandle')
      assert.property(result, 'announceTimerHandle')
      assert.property(result, 'peerTimerHandle')
      assert.property(result, 'relaySearchHandle')
      assert.property(result, 'checkBlacklistHandle')
      assert.property(result, 'listPubsubChannelsHandle')

      // Clean up test by stopping the timers.
      clearInterval(result.circuitRelayTimerHandle)
      clearInterval(result.announceTimerHandle)
      clearInterval(result.peerTimerHandle)
      clearInterval(result.relaySearchHandle)
      clearInterval(result.checkBlacklistHandle)
      clearInterval(result.listPubsubChannelsHandle)
    })

    it('should execute the functions inside the timers', () => {
      // Mock all functions inside the timers so they don't actually execute.
      sandbox.stub(uut, 'manageCircuitRelays').resolves()
      sandbox.stub(uut, 'manageAnnouncement').resolves()
      sandbox.stub(uut, 'managePeers').resolves()
      sandbox.stub(uut, 'searchForRelays').resolves()
      sandbox.stub(uut, 'listPubsubChannels').resolves()

      const thisNode = {
        peerData: []
      }

      uut.startTimers(thisNode)
      clock.tick(200000)

      assert.isOk(true)
    })
  })

  describe('#manageCircuitRelays', () => {
    it('should refresh connections with known circuit relays', async () => {
      const result = await uut.manageCircuitRelays(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, true)
    })

    it('should catch and report an error', async () => {
      // Force an error
      sandbox
        .stub(useCases.relays, 'connectToCRs')
        .rejects(new Error('test error'))

      const result = await uut.manageCircuitRelays(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, false)
    })
  })

  describe('#manageAnnouncement', () => {
    it('should publish an announcement to the general coordination pubsub channel', async () => {
      const result = await uut.manageAnnouncement(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, true)
    })

    it('should catch and report an error', async () => {
      // Force an error
      sandbox
        .stub(thisNode.schema, 'announcement')
        .throws(new Error('test error'))

      const result = await uut.manageAnnouncement(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, false)
    })
  })

  describe('#managePeers', () => {
    it('should refresh connections to peers', async () => {
      const result = await uut.managePeers(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, true)
    })

    it('should catch and report an error', async () => {
      // Force an error
      sandbox
        .stub(useCases.thisNode, 'refreshPeerConnections')
        .throws(new Error('test error'))

      const result = await uut.managePeers(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, false)
    })
  })

  describe('#blacklist', () => {
    it('should return true after executing the use case', async () => {
      const result = await uut.blacklist(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      // Force an error
      // sandbox
      //   .stub(useCases.thisNode, 'enforceBlacklist')
      //   .rejects(new Error('test error'))
      sandbox
        .stub(useCases.thisNode, 'enforceWhitelist')
        .rejects(new Error('test error'))

      const result = await uut.blacklist(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, false)
    })
  })

  describe('#searchForRelays', () => {
    it('should find and relay-potential peers that are not in the relayData array', async () => {
      // Mock test data
      const thisNode = {
        relayData: [{ ipfsId: 'id1' }],
        peerData: [{ from: 'id2', data: { isCircuitRelay: true } }]
      }

      const result = await uut.searchForRelays(thisNode, useCases)

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, true)
    })

    it('should report errors but not throw them', async () => {
      const result = await uut.searchForRelays()

      // Force the timer interval to excute.
      clock.tick(200000)

      assert.equal(result, false)
    })
  })

  describe('#listPubsubChannels', () => {
    it('should list pubsub channels', async () => {
      const result = await uut.listPubsubChannels()

      assert.equal(result, true)
    })
  })
})
