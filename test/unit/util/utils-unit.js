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

  describe('#filterMultiaddrs', () => {
    it('should filter out undesired multiaddrs', () => {
      const ipfsMultiaddrs = [
        'ip4/tcp/127.0.0.1/addr1',
        'ip4/udp/123.456.789.1/addr1',
        'ip4/quic/123.456.789.1/addr1',
        'ip4/tcp/123.456.789.1/p2p-circuit/p2p/addr1',
        '/ip4/addr1',
        '/ip4/192.168.0.1/addr1',
        '/ip4/10.0.0.1/addr1',
        '/ip4/172.16.0.1/addr1'
      ]

      const result = uut.filterMultiaddrs(ipfsMultiaddrs)
      // console.log('result: ', result)

      assert.equal(result.length, 1)
      assert.equal(result[0], '/ip4/addr1')
    })

    it('should catch, report, and throw errors', () => {
      try {
        uut.filterMultiaddrs(4)

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)

        assert.include(err.message, 'is not a function')
      }
    })
  })

  describe('#parseMultiaddrList', () => {
    it('should return an empty array when the value is unset', () => {
      assert.deepEqual(uut.parseMultiaddrList(), [])
      assert.deepEqual(uut.parseMultiaddrList(''), [])
      assert.deepEqual(uut.parseMultiaddrList('   '), [])
    })

    it('should parse a single multiaddr', () => {
      const addr = '/ip4/192.236.235.173/tcp/4103/p2p/12D3KooWJEGkUM5wmYt83MsDPGQPEpqwcktCiksyH9GykjPmyGXh'

      const result = uut.parseMultiaddrList(addr)

      assert.deepEqual(result, [addr])
    })

    it('should split a comma-delimited list and trim whitespace', () => {
      const addr1 = '/ip4/192.236.235.173/tcp/4103/p2p/12D3KooWJEGkUM5wmYt83MsDPGQPEpqwcktCiksyH9GykjPmyGXh'
      const addr2 = '/ip4/5.78.149.147/tcp/4101/p2p/12D3KooWDDrYph3KNxASGR5a4Bjw8thVTfK6MHiNCSz6GvygXwdR'

      const result = uut.parseMultiaddrList(`${addr1}, ${addr2}`)

      assert.deepEqual(result, [addr1, addr2])
    })

    it('should ignore blank entries', () => {
      const addr = '/ip4/192.236.235.173/tcp/4103'

      const result = uut.parseMultiaddrList(`${addr},,  ,`)

      assert.deepEqual(result, [addr])
    })

    it('should throw on a malformed multiaddr', () => {
      try {
        uut.parseMultiaddrList('192.236.235.173:4103')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'ANNOUNCE_MULTIADDRS')
      }
    })
  })
})
