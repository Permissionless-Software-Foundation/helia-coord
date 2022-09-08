/*
  Unit tests for the main index.js file.
*/

// Global npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import SlpWallet from 'minimal-slp-wallet/index.js'

// Local libraries
import IpfsCoord from '../../index.js'
import ipfs from '../mocks/ipfs-mock.js'

describe('#ipfs-coord - index.js', () => {
  let sandbox
  let uut // Unit Under Test
  let wallet

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    wallet = new SlpWallet()
    await wallet.walletInfoPromise

    uut = new IpfsCoord({ wallet, ipfs, type: 'node.js' })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if ipfs instance is not passed as input', () => {
      try {
        uut = new IpfsCoord({})

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'An instance of IPFS must be passed when instantiating the ipfs-coord library.'
        )
      }
    })

    it('should throw an error if bch-js instance is not passed as input', () => {
      try {
        uut = new IpfsCoord({ ipfs })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'An instance of minimal-slp-wallet must be passed when instantiating the ipfs-coord library.'
        )
      }
    })

    it('should throw an error if node type is not defined', () => {
      try {
        const wallet = new SlpWallet()
        uut = new IpfsCoord({ ipfs, wallet })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'The type of IPFS node (browser or node.js) must be specified.'
        )
      }
    })

    it('should override default logs', async () => {
      uut = new IpfsCoord({
        wallet,
        ipfs,
        type: 'node.js',
        statusLog: console.log,
        privateLog: console.log
      })
    })

    it('should set debugLevel to 0 if not specified', () => {
      uut = new IpfsCoord({
        wallet,
        ipfs,
        type: 'node.js',
        statusLog: console.log,
        privateLog: console.log
      })

      assert.equal(uut.debugLevel, 0)
    })

    it('should set debugLevel to 2 if specified', () => {
      uut = new IpfsCoord({
        wallet,
        ipfs,
        type: 'node.js',
        statusLog: console.log,
        privateLog: console.log,
        debugLevel: 2
      })

      assert.equal(uut.debugLevel, 2)
    })

    it('should default debugLevel to 0 non-integer is used', () => {
      uut = new IpfsCoord({
        wallet,
        ipfs,
        type: 'node.js',
        statusLog: console.log,
        privateLog: console.log,
        debugLevel: 'abcd'
      })

      assert.equal(uut.debugLevel, 0)
    })
  })

  describe('#start', () => {
    it('should return true after ipfs-coord dependencies have been started.', async () => {
      // Mock the dependencies.
      sandbox.stub(uut.adapters.ipfs, 'start').resolves({})
      sandbox.stub(uut.useCases.thisNode, 'createSelf').resolves({})
      sandbox.stub(uut.useCases.relays, 'initializeRelays').resolves({})
      sandbox.stub(uut.useCases.pubsub, 'initializePubsub').resolves({})
      sandbox.stub(uut.controllers.timer, 'startTimers').resolves({})
      sandbox.stub(uut, '_initializeConnections').resolves({})

      const result = await uut.start()

      assert.equal(result, true)
    })
  })

  describe('#_initializeConnections', () => {
    it('should kick-off initial connections', async () => {
      // Mock dependencies
      sandbox.stub(uut.useCases.relays, 'initializeRelays').resolves()
      sandbox.stub(uut.useCases.relays, 'getCRGist').resolves()
      sandbox.stub(uut.useCases.thisNode, 'refreshPeerConnections').resolves()

      const result = await uut._initializeConnections()

      assert.equal(result, true)
    })

    it('should return falses on error', async () => {
      // Force and error
      sandbox
        .stub(uut.useCases.relays, 'initializeRelays')
        .rejects(new Error('test error'))

      const result = await uut._initializeConnections()

      assert.equal(result, false)
    })
  })
})
