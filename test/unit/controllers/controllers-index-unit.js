/*
  Unit tests for the main Controllers index.js file.
*/

// npm libraries
import { assert } from 'chai'

// Local libraries
import Controllers from '../../../lib/controllers/index.js'

describe('#index.js-Controllers', () => {
  let uut

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new Controllers()

        assert.fail('Unexpected code path')

        console.log(uut)
      } catch (err) {
        assert.include(
          err.message,
          'Instance of adapters required when instantiating Controllers'
        )
      }
    })

    it('should throw an error if Use Cases are not injected', () => {
      try {
        uut = new Controllers({ adapters: {} })

        assert.fail('Unexpected code path')

        console.log(uut)
      } catch (err) {
        assert.include(
          err.message,
          'Instance of useCases required when instantiating Controllers'
        )
      }
    })
  })
})
