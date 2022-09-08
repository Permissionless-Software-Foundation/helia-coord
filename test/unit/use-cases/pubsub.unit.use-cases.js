/*
  Unit tests for the Pubsub use case.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import PubsubUseCases from '../../../lib/use-cases/pubsub-use-cases.js'
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'
import AdapterMock from '../../mocks/adapter-mock.js'

const adapters = new AdapterMock()
// const mockData = require('../../mocks/peers-mock')

describe('#pubsub-Use-Cases', () => {
  let uut
  let sandbox

  beforeEach(() => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    const thisNodeUseCases = new ThisNodeUseCases({
      adapters,
      statusLog: () => {}
    })

    uut = new PubsubUseCases({
      adapters,
      thisNodeUseCases
    })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new PubsubUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of adapters when instantiating Pubsub Use Cases library.'
        )
      }
    })

    it('should throw an error if thisNodeUseCases instance is not included', () => {
      try {
        uut = new PubsubUseCases({
          adapters: {},
          controllers: {}
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'thisNode use cases required when instantiating Pubsub Use Cases library.'
        )
      }
    })
  })

  describe('#initializePubsub', () => {
    it('should subscribe to a node', async () => {
      await uut.initializePubsub('fakeNode')

      assert.isOk(true, 'No throwing an error is a pass')
    })

    it('should catch and throw an error', async () => {
      try {
        // Force an error
        sandbox
          .stub(uut.adapters.pubsub, 'subscribeToPubsubChannel')
          .rejects(new Error('test error'))

        await uut.initializePubsub('fakeNode')

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'test error')
      }
    })
  })
})
