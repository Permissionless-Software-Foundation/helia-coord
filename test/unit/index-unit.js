/*
  Unit tests for the main index.js file.
*/

// Global npm libraries
import {assert} from 'chai'
import sinon from 'sinon'
import SlpWallet from 'minimal-slp-wallet'

// Local libraries
import IpfsCoord from '../../index.js'
import ipfs from '../mocks/ipfs-mock.js'

describe('#ipfs-coord', () => {
  let sandbox
  let uut // Unit Under Test

  beforeEach(() => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    const wallet = new SlpWallet()
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
  })
})
