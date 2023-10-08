/*
*/

// Global npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import Util from '../../../lib/util/utils.js'

describe('#utils.js', () => {
  let sandbox
  let uut // Unit Under Test

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    uut = new Util()
  })

  afterEach(() => sandbox.restore())

  describe('#sleep', () => {
    it('should sleep for 1 ms', async () => {
      await uut.sleep(1)

      assert.isOk(true)
    })
  })
})
