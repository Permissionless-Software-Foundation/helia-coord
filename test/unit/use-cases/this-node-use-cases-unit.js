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
