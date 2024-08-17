/*
  Unit tests for the about adapter library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import cloneDeep from 'lodash.clonedeep'

// local libraries
import ResendMsg from '../../../../lib/adapters/pubsub-adapter/resend-msg.js'
import ipfsLib from '../../../mocks/ipfs-mock.js'
import IPFSAdapter from '../../../../lib/adapters/ipfs-adapter.js'
import SlpWallet from 'minimal-slp-wallet'
import BchAdapter from '../../../../lib/adapters/bch-adapter.js'
import EncryptionAdapter from '../../../../lib/adapters/encryption-adapter.js'
import Messaging from '../../../../lib/adapters/pubsub-adapter/messaging.js'

describe('#ResendMsg-adapter', () => {
  let uut
  let sandbox
  let ipfs, ipfsAdapter

  const log = {
    statusLog: () => {}
  }

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    // Instantiate the IPFS adapter
    ipfs = cloneDeep(ipfsLib)
    ipfsAdapter = new IPFSAdapter({ ipfs, log })

    // Instantiate the Encryption adapater
    const wallet = new SlpWallet()
    await wallet.walletInfoPromise
    const bch = new BchAdapter({ wallet })
    const encryption = new EncryptionAdapter({ bch, log })

    const msgLib = new Messaging({ ipfsAdapter, log, encryption })
    const msgObj = false

    // Instantiate the library under test. Must instantiate dependencies first.
    uut = new ResendMsg({ msgObj, msgLib })
  })

  afterEach(() => sandbox.restore())

  describe('#resend', () => {
    it('should return 0 if message object is empty', async () => {
      const result = await uut.resend()

      assert.equal(result, 0)
    })
  })
})
