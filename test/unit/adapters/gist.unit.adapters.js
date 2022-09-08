/*
  Unit tests for the schema.js library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// local libraries
import Gist from '../../../lib/adapters/gist.js'

describe('#Adapter-Gist', () => {
  let sandbox
  let uut

  beforeEach(() => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    uut = new Gist()
  })

  afterEach(() => sandbox.restore())

  describe('#getCRList', () => {
    it('should get data from GitHub', async () => {
      // Mock network dependencies
      sandbox.stub(uut.axios, 'get').resolves({
        data: {
          files: {
            'psf-public-circuit-relays.json': {
              content: JSON.stringify({ key: 'value' })
            }
          }
        }
      })

      const result = await uut.getCRList()
      // console.log('result: ', result)

      assert.property(result, 'key')
      assert.equal(result.key, 'value')
    })
  })
})
