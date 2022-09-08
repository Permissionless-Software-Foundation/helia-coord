/*
  Unit tests for the bch-lib library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import SlpWallet from 'minimal-slp-wallet/index.js'

// local libraries
import BchLib from '../../../lib/adapters/bch-adapter.js'

describe('#bch-adapter', () => {
  let sandbox
  let uut
  let wallet

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    wallet = new SlpWallet()
    await wallet.walletInfoPromise

    uut = new BchLib({ wallet })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if minimal-slp-wallet instance is not passed in', () => {
      try {
        uut = new BchLib({})
      } catch (err) {
        assert.include(
          err.message,
          'An instance of minimal-slp-wallet must be passed when instantiating the BCH adapter library.'
        )
      }
    })
  })

  describe('#generateBchId', () => {
    it('should generate a new BCH ID if mnemonic is not given', async () => {
      const result = await uut.generateBchId()
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.property(result, 'cashAddress')
      assert.property(result, 'slpAddress')
      assert.property(result, 'publicKey')
    })

    it('should catch and throw an error', async () => {
      try {
        sandbox
          .stub(uut.bchjs.Mnemonic, 'toSeed')
          .rejects(new Error('test error'))

        await uut.generateBchId()

        assert.fail('Unexpected code path. Error was expected to be thrown.')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#generatePrivateKey', () => {
    it('should generate a private key', async () => {
      const result = await uut.generatePrivateKey()
      console.log('result: ', result)

      // The private key shoul be a string.
      assert.isString(result)

      // It shoul be a WIF that starts with a K or L
      // assert.equal(result[0], 'K' || 'L')
    })

    it('should catch and throw an error', async () => {
      try {
        sandbox
          .stub(uut.bchjs.Mnemonic, 'toSeed')
          .rejects(new Error('test error'))

        await uut.generatePrivateKey()

        assert.fail('Unexpected code path. Error was expected to be thrown.')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'test error')
      }
    })
  })
})
