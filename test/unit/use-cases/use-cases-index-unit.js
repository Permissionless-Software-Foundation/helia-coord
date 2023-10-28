/*
  Unit tests for Use Cases index.js file
*/

// npm libraries
import { assert } from 'chai'

// Local libraries
import UseCases from '../../../lib/use-cases/index.js'

describe('#Use-Cases-index.js', () => {
  let uut

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new UseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of adapters when instantiating Use Cases library.'
        )
      }
    })

    it('should instantiate the use cases library', () => {
      uut = new UseCases({ adapters: {}, statusLog: {} })

      assert.property(uut, 'adapters')
    })
  })
})
