/*
  Unit tests for the pubsub-controller.js library
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import PubsubController from '../../../lib/controllers/pubsub-controller.js'
import AdapterMock from '../../mocks/adapter-mock.js'
import UseCasesMock from '../../mocks/use-case-mocks.js'
import globalConfig from '../../../config/global-config.js'

const adapters = new AdapterMock()

describe('#Pubsub-Controller', () => {
  let uut
  let sandbox
  let useCases

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    useCases = new UseCasesMock()

    uut = new PubsubController({
      adapters,
      useCases
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new PubsubController()
      } catch (err) {
        assert.include(
          err.message,
          'Instance of adapters required when instantiating Pubsub Controllers'
        )
      }
    })

    it('should throw an error if use cases are not included', () => {
      try {
        uut = new PubsubController({ adapters })
      } catch (err) {
        assert.include(
          err.message,
          'Instance of use cases required when instantiating Pubsub Controllers'
        )
      }
    })

    it('should overwrite default coinjoin channel handler', () => {
      const coinjoinPubsubHandler = sandbox.spy()

      const uut = new PubsubController({ adapters, useCases, coinjoinPubsubHandler })
      uut.coinjoinPubsubHandler()
      assert.isTrue(coinjoinPubsubHandler.called)
    })
  })

  describe('#coordChanHandler', () => {
    it('should return false if message is for channel other than coordination channel', async () => {
      const msg = {
        detail: {
          from: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          topic: 'random-channel',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.coordChanHandler(msg)

      assert.equal(result, false)
    })

    it('should return true if message is successfully filtered, parsed, and passed Use Case', async () => {
      const msg = {
        detail: {
          from: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          topic: globalConfig.DEFAULT_COORDINATION_ROOM,
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      // Mock dependencies and force desired code path.
      sandbox.stub(uut.useCases.pubsub, 'parseCoordPubsub').resolves({})
      sandbox.stub(uut.useCases.peer, 'addSubnetPeer').resolves()

      const result = await uut.coordChanHandler(msg)

      assert.equal(result, true)
    })

    it('should catch, report, and return false on errors', async () => {
      const result = await uut.coordChanHandler()

      assert.equal(result, false)
    })
  })

  describe('#coinjoinPubsubHandler', () => {
    it('should always return true', () => {
      const result = uut.coinjoinPubsubHandler()

      assert.equal(result, true)
    })
  })
})
