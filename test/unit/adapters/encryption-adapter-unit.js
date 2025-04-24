/*
  Unit tests for the encryption adapter library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import SlpWallet from 'minimal-slp-wallet'

// local libraries
import EncryptionAdapter from '../../../lib/adapters/encryption-adapter.js'
import BchAdapter from '../../../lib/adapters/bch-adapter.js'
import LogsAdapter from '../../../lib/adapters/logs-adapter.js'

describe('#Adapters - Encryption', () => {
  let uut
  let sandbox
  let wallet

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    // Instantiate bch adapter.
    wallet = new SlpWallet()
    await wallet.walletInfoPromise
    const bch = new BchAdapter({ wallet })

    // Instantiate log adapter.
    const statusLog = () => {}
    const log = new LogsAdapter({ statusLog })

    // Instantiate the library under test. Must instantiate dependencies first.
    uut = new EncryptionAdapter({ bch, log })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if bch adapter is not included', () => {
      try {
        uut = new EncryptionAdapter()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must pass in an instance of bch Adapter when instantiating the encryption Adapter library.'
        )
      }
    })

    it('should throw an error if log adapter is not included', async () => {
      try {
        // Instantiate bch adapter.
        wallet = new SlpWallet()
        await wallet.walletInfoPromise
        const bch = new BchAdapter({ wallet })

        uut = new EncryptionAdapter({ bch })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must pass in an instance of log Adapter when instantiating the encryption Adapter library.'
        )
      }
    })
  })

  describe('#decryptMsg', () => {
    it('should decrypt a message', async () => {
      // Mock dependencies
      sandbox
        .stub(uut.bchEncrypt.encryption, 'decryptFile')
        .resolves('decryptedMsg')

      const result = await uut.decryptMsg('F6')
      // console.log('result: ', result)

      assert.isOk(result)
    })

    it('should return false on BAD MAC error messages', async () => {
      // Force a BAD MAC error
      sandbox
        .stub(uut.bchEncrypt.encryption, 'decryptFile')
        .rejects(new Error('Bad MAC'))

      const result = await uut.decryptMsg('F6')

      assert.equal(result, false)
    })

    it('should catch and throw an error', async () => {
      try {
        // Force an error
        sandbox
          .stub(uut.bchEncrypt.encryption, 'decryptFile')
          .rejects(new Error('test error'))

        await uut.decryptMsg('F6')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#encryptMsg', () => {
    it('should catch and throw errors', async () => {
      try {
        const peer = {
          data: {
            encryptionKey: 'abc123'
          }
        }

        await uut.encryptMsg(peer, 'testMsg')
        // console.log('result: ', result)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'pubkey must be a hex string')
      }
    })
    it('should throw an error is peer is not provided', async () => {
      try {
        await uut.encryptMsg()
        // console.log('result: ', result)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Peer public key is not available yet.')
      }
    })
    it('should throw an error is msg is not provided', async () => {
      try {
        const peer = {
          data: {
            encryptionKey: 'abc123'
          }
        }

        await uut.encryptMsg(peer)
        // console.log('result: ', result)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Message is required.')
      }
    })
    it('should throw an error is peer data is not provided', async () => {
      try {
        const peer = {
        }

        await uut.encryptMsg(peer, 'testMsg')
        // console.log('result: ', result)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Peer public key is not available yet.')
      }
    })

    it('should encrypt a string', async () => {
      // Mock dependencies
      sandbox
        .stub(uut.bchEncrypt.encryption, 'encryptFile')
        .resolves('encryptedMsg')

      const peer = {
        data: {
          encryptionKey: 'abc123'
        }
      }

      const result = await uut.encryptMsg(peer, 'testMsg')
      // console.log('result: ', result)

      assert.equal(result, 'encryptedMsg')
    })
  })
})
