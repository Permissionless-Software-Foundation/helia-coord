/*
  Unit tests for the ipfs-adapters.js library
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// local libraries
import IPFSAdapter from '../../../lib/adapters/ipfs-adapter.js'
import ipfs from '../../mocks/ipfs-mock.js'

describe('#Adapter - IPFS', () => {
  let sandbox
  let uut

  beforeEach(() => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    const log = {
      statusLog: () => {}
    }
    uut = new IPFSAdapter({ ipfs, log })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if ipfs instance is not passed in', () => {
      try {
        uut = new IPFSAdapter({})
      } catch (err) {
        assert.include(
          err.message,
          'An instance of IPFS must be passed when instantiating the IPFS adapter library.'
        )
      }
    })

    it('should throw an error if log instance is not passed in', () => {
      try {
        uut = new IPFSAdapter({ ipfs })
      } catch (err) {
        assert.include(
          err.message,
          'A status log handler must be specified when instantiating IPFS adapter library.'
        )
      }
    })

    it('should overwrite default ports when user specifies them at run time', async () => {
      const log = {
        statusLog: () => {}
      }
      uut = new IPFSAdapter({ ipfs, log, tcpPort: 6000, wsPort: 6001 })

      assert.equal(uut.tcpPort, 6000)
      assert.equal(uut.wsPort, 6001)
    })
  })

  describe('#start', () => {
    it('should populate ID and multiaddrs', async () => {
      await uut.start()

      // console.log('uut: ', uut)

      assert.property(uut, 'ipfsPeerId')
      assert.property(uut, 'ipfsMultiaddrs')
    })

    it('should configure an exteranl go-ipfs node', async () => {
      const log = {
        statusLog: () => {}
      }
      uut = new IPFSAdapter({ ipfs, log, nodeType: 'external' })

      await uut.start()

      // console.log('uut: ', uut)

      assert.equal(uut.nodeType, 'external')
    })

    it('should catch and throw an error', async () => {
      try {
        // Force an error
        // sandbox.stub(uut.ipfs, 'id').rejects(new Error('test error'))
        sandbox.stub(uut.ipfs.libp2p.peerId, 'toString').throws(new Error('test error'))

        await uut.start()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#connectToPeer', () => {
    it('should return true after connecting to peer', async () => {
      // Mock dependencies
      sandbox.stub(uut.ipfs.libp2p, 'dial').resolves()
      sandbox.stub(uut, 'multiaddr').returns()

      const result = await uut.connectToPeer({ multiaddr: 'fakeId' })

      assert.equal(result.success, true)
    })

    it('should return false when issues connecting to peer', async () => {
      // Force an error
      sandbox.stub(uut.ipfs.swarm, 'connect').rejects(new Error('test error'))

      const result = await uut.connectToPeer({ multiaddr: 'fakeId' })

      assert.equal(result.success, false)
    })

    it('should report connection errors at debugLevel 1', async () => {
      uut.debugLevel = 1

      // Force an error
      sandbox.stub(uut.ipfs.swarm, 'connect').rejects(new Error('test error'))

      const result = await uut.connectToPeer({ multiaddr: 'fakeId' })

      assert.equal(result.success, false)
    })

    it('should report full errors at debugLevel 2', async () => {
      uut.debugLevel = 2

      // Force an error
      sandbox.stub(uut.ipfs.swarm, 'connect').rejects(new Error('test error'))

      const result = await uut.connectToPeer({ multiaddr: 'fakeId' })

      assert.equal(result.success, false)
    })
  })

  describe('#getPeers', () => {
    it('should return an array of peers', async () => {
      const result = await uut.getPeers()

      assert.isArray(result)
    })

    it('should catch and throw an error', async () => {
      try {
        // Force an error
        sandbox.stub(uut.ipfs.libp2p, 'getPeers').rejects(new Error('test error'))

        await uut.getPeers()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#disconnectFromPeer', () => {
    it('should return true if thisNode is not connected to the peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'getPeers').resolves([])

      const result = await uut.disconnectFromPeer('testId')

      assert.equal(result, true)
    })

    it('should disconnect if thisNode is connected to the peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'getPeers').resolves([{ peer: 'testId' }])

      const result = await uut.disconnectFromPeer('testId')

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      // Force an error
      sandbox.stub(uut, 'getPeers').rejects(new Error('test error'))

      const result = await uut.disconnectFromPeer('testId')

      assert.equal(result, false)
    })
  })

  describe('#disconnectFromMultiaddr', () => {
    it('should return true when disconnect succeeds', async () => {
      // Mock dependencies
      sandbox.stub(uut.ipfs.swarm, 'disconnect').resolves()

      const result = await uut.disconnectFromMultiaddr()

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      // Mock dependencies
      sandbox
        .stub(uut.ipfs.swarm, 'disconnect')
        .rejects(new Error('test error'))

      const result = await uut.disconnectFromMultiaddr()

      assert.equal(result, false)
    })
  })
})
