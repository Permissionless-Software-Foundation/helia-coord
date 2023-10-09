/*
  Unit tests for the main Adapters index.js file.
*/

// npm libraries
import { assert } from 'chai'
import SlpWallet from 'minimal-slp-wallet'

// Local libraries
import Adapters from '../../../lib/adapters/index.js'
import ipfs from '../../mocks/ipfs-mock.js'

// const Adapters = require('../../../lib/adapters')
// const BCHJS = require('@psf/bch-js')
// const bchjs = new BCHJS()
// const ipfs = require('../../mocks/ipfs-mock')
// const wallet = new SlpWallet()

describe('#Adapters - index.js', () => {
  let uut, wallet

  beforeEach(async () => {
    wallet = new SlpWallet()
    await wallet.walletInfoPromise
  })

  describe('#constructor', () => {
    it('should throw an error if ipfs is not included', () => {
      try {
        uut = new Adapters()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'An instance of IPFS must be passed when instantiating the Adapters library.'
        )
      }
    })

    it('should throw an error if minimal-slp-wallet is not included', () => {
      try {
        uut = new Adapters({ ipfs: {} })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'An instance of minimal-slp-wallet must be passed when instantiating the Adapters library.'
        )
      }
    })

    it('should throw an error if node type is not specified', () => {
      try {
        uut = new Adapters({ ipfs: {}, wallet: {} })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'The type of IPFS node (browser or node.js) must be specified.'
        )
      }
    })

    it('should instantiate other adapter libraries', () => {
      uut = new Adapters({
        ipfs,
        wallet,
        type: 'node.js',
        statusLog: () => {},
        privateLog: () => {}
      })

      assert.property(uut, 'log')
    })
  })
})
