/*
  Unit tests for the Pubsub use case.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import PubsubUseCases from '../../../lib/use-cases/pubsub-use-cases.js'
import ThisNodeUseCases from '../../../lib/use-cases/this-node-use-cases.js'
import AdapterMock from '../../mocks/adapter-mock.js'
import config from '../../../config/global-config.js'

const adapters = new AdapterMock()
// const mockData = require('../../mocks/peers-mock')

describe('#pubsub-Use-Cases', () => {
  let uut
  let sandbox
  let thisNodeUseCases

  beforeEach(() => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    thisNodeUseCases = new ThisNodeUseCases({
      adapters,
      statusLog: () => {}
    })

    uut = new PubsubUseCases({
      adapters,
      thisNodeUseCases
    })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters is not included', () => {
      try {
        uut = new PubsubUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Must inject instance of adapters when instantiating Pubsub Use Cases library.'
        )
      }
    })

    it('should throw an error if thisNodeUseCases instance is not included', () => {
      try {
        uut = new PubsubUseCases({
          adapters: {},
          controllers: {}
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'thisNode use cases required when instantiating Pubsub Use Cases library.'
        )
      }
    })

    it('should allow parent app to override coinjoin pubsub handler', () => {
      const localHandler = () => {}

      // Use default handler
      uut = new PubsubUseCases({
        adapters: {},
        thisNodeUseCases
      })
      const normalHandleResult = uut.coinjoinPubsubHandler()
      assert.equal(normalHandleResult, true)

      // Replace default handler
      uut = new PubsubUseCases({
        adapters: {},
        thisNodeUseCases,
        coinjoinPubsubHandler: localHandler
      })

      assert.isOk(uut.coinjoinPubsubHandler)
    })
  })

  describe('#initializePubsub', () => {
    it('should subscribe to a node', async () => {
      sandbox.stub(uut.adapters.pubsub, 'subscribeToCoordChannel').resolves()

      uut.updateThisNode({
        pubsubChannels: []
      })

      const controllers = {
        pubsub: {
          coordChanHandler: () => {}
        }
      }

      const result = await uut.initializePubsub({ controllers })

      assert.equal(result, true)
    })
    it('should throw an error if controllers are not provided', async () => {
      try {
        sandbox.stub(uut.adapters.pubsub, 'subscribeToCoordChannel').resolves()

        uut.updateThisNode({
          pubsubChannels: []
        })

        await uut.initializePubsub()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Instance of controllers must be passed to initializePubsub()')
      }
    })

    it('should catch and throw an error', async () => {
      try {
        await uut.initializePubsub()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log(err)
        assert.include(err.message, 'Instance of thisNode object')
      }
    })
  })

  // TODO: Remove. This code has been moved to pubsub-controller.
  // describe('#initializePubsub', () => {
  //   it('should subscribe to a node', async () => {
  //     await uut.initializePubsub('fakeNode')
  //
  //     assert.isOk(true, 'No throwing an error is a pass')
  //   })
  //
  //   it('should catch and throw an error', async () => {
  //     try {
  //       // Force an error
  //       sandbox
  //         .stub(uut.adapters.pubsub, 'subscribeToPubsubChannel')
  //         .rejects(new Error('test error'))
  //
  //       await uut.initializePubsub('fakeNode')
  //
  //       assert.fail('Unexpected code path')
  //     } catch (err) {
  //       // console.log(err)
  //       assert.include(err.message, 'test error')
  //     }
  //   })
  // })

  describe('#checkForDuplicateMsg', () => {
    it('should return true if message sn HAS NOT been seen', () => {
      const msg = {
        detail: {
          sequenceNumber: 123
        }
      }

      const result = uut.checkForDuplicateMsg(msg)

      assert.equal(result, true)
    })

    it('should return false if message sn HAS been seen', () => {
      const msg = {
        detail: {
          sequenceNumber: 123
        }
      }

      uut.checkForDuplicateMsg(msg)
      const result = uut.checkForDuplicateMsg(msg)

      assert.equal(result, false)
    })
  })

  describe('#manageMsgCache', () => {
    it('should shift out an element if the array is too big', () => {
      uut.trackedMsgs = [1, 2, 3, 4]
      uut.TRACKED_MSG_SIZE = 3

      uut.manageMsgCache()
      // console.log('uut.trackedMsgs: ', uut.trackedMsgs)

      assert.equal(uut.trackedMsgs.length, 3)
    })
  })

  describe('#parseCoordPubsub', () => {
    it('should parse a coord pubsub message', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'checkForDuplicateMsg').returns(true)

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: config.DEFAULT_COORDINATION_ROOM,
          data: Buffer.from('227b5c226170694e616d655c223a5c22697066732d636f6f72642d616e6e6f756e63655c222c5c2261706956657273696f6e5c223a5c22312e332e325c222c5c22617069496e666f5c223a5c22596f752073686f756c642070757420616e20495046532068617368206f72207765622055524c206865726520746f20796f757220646f63756d656e746174696f6e2e5c222c5c2262726f616463617374656441745c223a5c22323032332d31302d32375431393a34393a35372e3031385a5c222c5c226970667349645c223a5c22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c22747970655c223a5c226e6f64652e6a735c222c5c22697066734d756c746961646472735c223a5b5c222f6970342f3132372e302e302e312f7463702f343030312f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f3132372e302e302e312f7463702f343030332f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f3132372e302e302e312f7564702f343030312f717569632f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7463702f33323037382f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7463702f343030312f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7463702f35303130352f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7564702f343030312f717569632f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7564702f35323638302f717569632f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c225d2c5c226f7262697464625c223a5c225c222c5c226369726375697452656c6179735c223a5b5d2c5c2269734369726375697452656c61795c223a66616c73652c5c226369726375697452656c6179496e666f5c223a7b7d2c5c2263727970746f4164647265737365735c223a5b7b5c22626c6f636b636861696e5c223a5c224243485c222c5c22747970655c223a5c2263617368416464725c222c5c22616464726573735c223a5c22626974636f696e636173683a7170336a78683639703032303339726b74797a6b38746a7170387479726b61357071797a65706c7267785c227d2c7b5c22626c6f636b636861696e5c223a5c224243485c222c5c22747970655c223a5c22736c70416464725c222c5c22616464726573735c223a5c2273696d706c656c65646765723a7170336a78683639703032303339726b74797a6b38746a7170387479726b6135707167656a3632726b635c227d5d2c5c22656e63727970745075624b65795c223a5c223032373561396363316133393933333639623739663361343535653232306332633535643237366163313436623461313832343132656562613639343736643438325c222c5c226a736f6e4c645c223a7b5c2240636f6e746578745c223a5c2268747470733a2f2f736368656d612e6f72672f5c222c5c2240747970655c223a5c225765624150495c222c5c226e616d655c223a5c2267656e657269632d70327764622d70726f64756374696f6e5c222c5c2276657273696f6e5c223a5c22332e302e305c222c5c2270726f746f636f6c5c223a5c2270327764625c222c5c226465736372697074696f6e5c223a5c225468697320697320612050524f544f545950452061636365737320706f696e7420746f2074686520505346207061792d746f2d77726974652064617461626173652e20444220636f6e74656e74206d617920626520776970656420617420616e79206d6f6d656e742e20446f206e6f7420646570656e64206f6e207468697320444220666f722070726f64756374696f6e207573652120436f737420746f20777269746520746f2074686520444220697320302e30312050534620746f6b656e732e5c222c5c22646f63756d656e746174696f6e5c223a5c2268747470733a2f2f70327764622e66756c6c737461636b2e636173682f5c222c5c2270726f76696465725c223a7b5c2240747970655c223a5c224f7267616e697a6174696f6e5c222c5c226e616d655c223a5c225065726d697373696f6e6c65737320536f66747761726520466f756e646174696f6e5c222c5c2275726c5c223a5c2268747470733a2f2f5053466f756e646174696f6e2e636173685c227d2c5c226964656e7469666965725c223a5c22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c227d7d22', 'hex')
        }
      }

      const result = await uut.parseCoordPubsub({ msg })
      // console.log('result: ', result)

      // Assert the returned object has expected properties.
      assert.property(result, 'from')
      assert.property(result, 'channel')
      assert.property(result, 'data')
      assert.property(result.data, 'ipfsMultiaddrs')
    })

    it('should return false if message can not be parsed', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'checkForDuplicateMsg').returns(true)

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: config.DEFAULT_COORDINATION_ROOM,
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parseCoordPubsub({ msg })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, false)
    })

    it('should return flase if message is from thisNode', async () => {
      uut.adapters.ipfs.ipfsPeerId = '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f'

      const msg = {
        detail: {
          from: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          topic: config.DEFAULT_COORDINATION_ROOM,
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parseCoordPubsub({ msg })

      assert.equal(result, false)
    })

    it('should catch, report, and throw errors', async () => {
      try {
        await uut.parseCoordPubsub()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'Cannot read')
      }
    })

    it('should return false if this is a duplicate message', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'checkForDuplicateMsg').returns(false)

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: config.DEFAULT_COORDINATION_ROOM,
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parseCoordPubsub({ msg })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, false)
    })
  })
})
