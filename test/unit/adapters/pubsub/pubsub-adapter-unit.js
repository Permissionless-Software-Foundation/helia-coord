/*
  Unit tests for pubsub-adapter.js library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import SlpWallet from 'minimal-slp-wallet'
import cloneDeep from 'lodash.clonedeep'

// local libraries
import Pubsub from '../../../../lib/adapters/pubsub-adapter/index.js'
import ipfsLib from '../../../mocks/ipfs-mock.js'
import mockDataLib from '../../../mocks/pubsub-mocks.js'
import IPFSAdapter from '../../../../lib/adapters/ipfs-adapter.js'
import thisNodeMock from '../../../mocks/thisnode-mocks.js'
import EncryptionAdapter from '../../../../lib/adapters/encryption-adapter.js'
import BchAdapter from '../../../../lib/adapters/bch-adapter.js'
import { BroadcastRouter, PrivateChannelRouter } from '../../../../lib/adapters/pubsub-adapter/msg-router.js'
import globalConfig from '../../../../config/global-config.js'

describe('#Adapter - Pubsub', () => {
  let sandbox
  let uut
  let ipfs, ipfsAdapter, encryption
  let thisNode
  let mockData

  const log = {
    statusLog: () => {
    }
  }

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    ipfs = cloneDeep(ipfsLib)
    thisNode = cloneDeep(thisNodeMock)
    mockData = cloneDeep(mockDataLib)

    // Instantiate the IPFS adapter
    ipfsAdapter = new IPFSAdapter({ ipfs, log })

    // Instantiate the Encryption adapater
    const wallet = new SlpWallet()
    await wallet.walletInfoPromise
    const bch = new BchAdapter({ wallet })
    encryption = new EncryptionAdapter({ bch, log })

    // Instantiate the library under test. Must instantiate dependencies first.
    uut = new Pubsub({ ipfsAdapter, log, encryption, privateLog: {} })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if IPFS adapter not specified', () => {
      try {
        uut = new Pubsub()

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of IPFS adapter required when instantiating Pubsub Adapter.'
        )
      }
    })

    it('should throw an error if status log handler not specified', () => {
      try {
        uut = new Pubsub({ ipfsAdapter })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'A status log handler function required when instantitating Pubsub Adapter'
        )
      }
    })

    it('should throw an error if encryption library is not included', () => {
      try {
        uut = new Pubsub({ ipfsAdapter, log })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'An instance of the encryption Adapter must be passed when instantiating the Pubsub Adapter library.'
        )
      }
    })

    it('should throw an error if privateLog is not included', () => {
      try {
        uut = new Pubsub({ ipfsAdapter, log, encryption })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'A private log handler must be passed when instantiating the Pubsub Adapter library.'
        )
      }
    })
  })

  describe('#parsePubsubMessage', () => {
    it('should parse a pubsub message', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'checkForDuplicateMsg').returns(true)

      const handler = () => {}

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('227b5c226170694e616d655c223a5c22697066732d636f6f72642d616e6e6f756e63655c222c5c2261706956657273696f6e5c223a5c22312e332e325c222c5c22617069496e666f5c223a5c22596f752073686f756c642070757420616e20495046532068617368206f72207765622055524c206865726520746f20796f757220646f63756d656e746174696f6e2e5c222c5c2262726f616463617374656441745c223a5c22323032332d31302d32375431393a34393a35372e3031385a5c222c5c226970667349645c223a5c22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c22747970655c223a5c226e6f64652e6a735c222c5c22697066734d756c746961646472735c223a5b5c222f6970342f3132372e302e302e312f7463702f343030312f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f3132372e302e302e312f7463702f343030332f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f3132372e302e302e312f7564702f343030312f717569632f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7463702f33323037382f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7463702f343030312f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7463702f35303130352f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7564702f343030312f717569632f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c222c5c222f6970342f352e3136312e3135352e3137392f7564702f35323638302f717569632f7032702f313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c225d2c5c226f7262697464625c223a5c225c222c5c226369726375697452656c6179735c223a5b5d2c5c2269734369726375697452656c61795c223a66616c73652c5c226369726375697452656c6179496e666f5c223a7b7d2c5c2263727970746f4164647265737365735c223a5b7b5c22626c6f636b636861696e5c223a5c224243485c222c5c22747970655c223a5c2263617368416464725c222c5c22616464726573735c223a5c22626974636f696e636173683a7170336a78683639703032303339726b74797a6b38746a7170387479726b61357071797a65706c7267785c227d2c7b5c22626c6f636b636861696e5c223a5c224243485c222c5c22747970655c223a5c22736c70416464725c222c5c22616464726573735c223a5c2273696d706c656c65646765723a7170336a78683639703032303339726b74797a6b38746a7170387479726b6135707167656a3632726b635c227d5d2c5c22656e63727970745075624b65795c223a5c223032373561396363316133393933333639623739663361343535653232306332633535643237366163313436623461313832343132656562613639343736643438325c222c5c226a736f6e4c645c223a7b5c2240636f6e746578745c223a5c2268747470733a2f2f736368656d612e6f72672f5c222c5c2240747970655c223a5c225765624150495c222c5c226e616d655c223a5c2267656e657269632d70327764622d70726f64756374696f6e5c222c5c2276657273696f6e5c223a5c22332e302e305c222c5c2270726f746f636f6c5c223a5c2270327764625c222c5c226465736372697074696f6e5c223a5c225468697320697320612050524f544f545950452061636365737320706f696e7420746f2074686520505346207061792d746f2d77726974652064617461626173652e20444220636f6e74656e74206d617920626520776970656420617420616e79206d6f6d656e742e20446f206e6f7420646570656e64206f6e207468697320444220666f722070726f64756374696f6e207573652120436f737420746f20777269746520746f2074686520444220697320302e30312050534620746f6b656e732e5c222c5c22646f63756d656e746174696f6e5c223a5c2268747470733a2f2f70327764622e66756c6c737461636b2e636173682f5c222c5c2270726f76696465725c223a7b5c2240747970655c223a5c224f7267616e697a6174696f6e5c222c5c226e616d655c223a5c225065726d697373696f6e6c65737320536f66747761726520466f756e646174696f6e5c222c5c2275726c5c223a5c2268747470733a2f2f5053466f756e646174696f6e2e636173685c227d2c5c226964656e7469666965725c223a5c22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e51455766717142587368767141565c227d7d22', 'hex')
        }
      }

      const result = await uut.parsePubsubMessage({ msg, handler, thisNode })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should return false if message can not be parsed', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'checkForDuplicateMsg').returns(true)

      const handler = () => {}

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parsePubsubMessage({ msg, handler, thisNode })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, false)
    })

    it('should quietly exit if message is from thisNode', async () => {
      const handler = () => {
      }

      const msg = {
        detail: {
          from: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parsePubsubMessage({ msg, handler, thisNode })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    // This is a top-level function. It should not throw errors, but log
    // the error message.
    it('should catch and handle errors', async () => {
      const result = await uut.parsePubsubMessage()

      // assert.isOk(true, 'Not throwing an error is a pass')
      assert.equal(result, false)
    })

    it('should parse a message for an external IPFS node', async () => {
      const handler = () => {
      }

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parsePubsubMessage({ msg, handler, thisNode })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should throw an error if data can not be parsed', async () => {
      const handler = () => {}

      // Force desired code path
      mockData.mockMsg.data = Buffer.from('54234', 'hex')

      const result = await uut.parsePubsubMessage({ msg: mockData.mockMsg, handler, thisNode })
      // console.log('result: ', result)

      assert.equal(result, false)
    })

    it('should return false if this is a duplicate message', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'checkForDuplicateMsg').returns(false)

      const handler = () => {}

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.parsePubsubMessage({ msg, handler, thisNode })

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, false)
    })
  })

  describe('#captureMetrics', () => {
    it('should capture an about REQUEST', async () => {
      // Mock dependencies
      sandbox.stub(uut.encryption, 'encryptMsg').resolves('encrypted-payload')
      sandbox.stub(uut.messaging, 'sendMsg').resolves()

      const decryptedStr = mockData.aboutRequest
      const from = 'fake-id'

      const result = await uut.captureMetrics(decryptedStr, from, thisNode)
      // console.log(result)

      assert.equal(result, true)
    })

    it('should capture an about RESPONSE', async () => {
      const decryptedStr = mockData.aboutResponse
      const from = 'fake-id'

      const result = await uut.captureMetrics(decryptedStr, from, thisNode)
      // console.log(result)

      // Should return the decrypted response data.
      assert.property(result, 'ipfsId')
    })

    it('should return false for message not an /about request or response', async () => {
      const decryptedStr = mockData.badId
      const from = 'fake-id'

      const result = await uut.captureMetrics(decryptedStr, from, thisNode)
      // console.log(result)

      assert.equal(result, false)
    })

    it('should return false on an error', async () => {
      const result = await uut.captureMetrics()
      // console.log(result)

      assert.equal(result, false)
    })
  })

  describe('#handleNewMessage', () => {
    it('should return false if incoming message is an /about request or response', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'captureMetrics').resolves(true)

      const result = await uut.handleNewMessage(mockData.msgObj, thisNode)
      // console.log(result)

      assert.equal(result, false)
    })

    it('return true if incoming message is NOT an /about request or response', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'captureMetrics').resolves(false)
      uut.privateLog = () => {
      }

      const result = await uut.handleNewMessage(mockData.msgObj, thisNode)
      // console.log(result)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.handleNewMessage()

        assert.fail('Unexpected result')
      } catch (err) {
        // console.log(err)
        assert.include(
          err.message,
          'Cannot read'
        )
      }
    })
  })

  describe('#subscribeToPubsubChannel', () => {
    // This tests the ability to subscribe to general broadcast channels like
    // the psf-ipfs-coordination-002 channel.
    it('should subscribe to a broadcast pubsub channel', async () => {
      // Mock dependencies
      sandbox.stub(uut.ipfs.ipfs.pubsub, 'subscribe').resolves()

      const chanName = 'test'
      const handler = () => {
      }

      const result = await uut.subscribeToPubsubChannel(chanName, handler, thisNode)

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    // This tests the ability to subscribe to private, encrypted channels, like
    // the one this node uses to receive messages from other nodes.
    it('should subscribe to a private pubsub channel', async () => {
      // Mock dependencies
      sandbox.stub(uut.ipfs.ipfs.pubsub, 'subscribe').resolves()

      const chanName = thisNode.ipfsId
      const handler = () => {
      }

      const result = await uut.subscribeToPubsubChannel(chanName, handler, thisNode)

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.subscribeToPubsubChannel()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#BroadcastRouter', () => {
    it('should route a broadcast message and return true', async () => {
      // Mock dependencies
      // sandbox.stub(uut.ipfs.ipfs.pubsub, 'subscribe').resolves()

      // const chanName = 'test'
      const handler = () => {}
      const parsePubsubMessage = async () => {}

      // Instantiate the Broadcast message router library
      const bRouterOptions = {
        handler,
        thisNode,
        parsePubsubMessage
      }
      const broadcastRouter = new BroadcastRouter(bRouterOptions)

      const msg = {
        detail: {
          topic: globalConfig.DEFAULT_COORDINATION_ROOM
        }
      }
      const result = await broadcastRouter.route(msg)

      assert.equal(result, true)
    })

    it('should return false if message does not match topic', async () => {
      // Mock dependencies
      // sandbox.stub(uut.ipfs.ipfs.pubsub, 'subscribe').resolves()

      // const chanName = 'test'
      const handler = () => {}
      const parsePubsubMessage = async () => {}

      // Instantiate the Broadcast message router library
      const bRouterOptions = {
        handler,
        thisNode,
        parsePubsubMessage
      }
      const broadcastRouter = new BroadcastRouter(bRouterOptions)

      const msg = {
        detail: {
          topic: 'bad-topic'
        }
      }
      const result = await broadcastRouter.route(msg)

      assert.equal(result, false)
    })

    it('should catch and handle errors, and return false', async () => {
      // Force and error
      const handler = () => {}
      const parsePubsubMessage = async () => {
        throw new Error('test error')
      }

      // Instantiate the Broadcast message router library
      const bRouterOptions = {
        handler,
        thisNode,
        parsePubsubMessage
      }
      const broadcastRouter = new BroadcastRouter(bRouterOptions)

      const result = await broadcastRouter.route({})

      assert.equal(result, false)
    })
  })

  describe('#PrivateChannelRouter', () => {
    it('should route a private message and return true', async () => {
      // Mock dependencies
      sandbox.stub(uut.messaging, 'handleIncomingData').resolves(true)
      sandbox.stub(uut, 'handleNewMessage').resolves(true)

      // Instantiate the Broadcast message router library
      const pRouterOptions = {
        thisNode,
        messaging: uut.messaging,
        handleNewMessage: async () => {}
      }
      const privateRouter = new PrivateChannelRouter(pRouterOptions)

      const msg = {
        detail: {
          topic: thisNode.ipfsId
        }
      }

      const result = await privateRouter.route(msg)

      assert.equal(result, true)
    })

    it('should return false if message is off-topic', async () => {
      // Instantiate the Broadcast message router library
      const pRouterOptions = {
        thisNode,
        messaging: uut.messaging,
        handleNewMessage: async () => {}
      }
      const privateRouter = new PrivateChannelRouter(pRouterOptions)

      const msg = {
        detail: {
          topic: 'bad-topic'
        }
      }

      const result = await privateRouter.route(msg)

      assert.equal(result, false)
    })

    it('should return false if message is not a private message', async () => {
      // Instantiate the Broadcast message router library
      const pRouterOptions = {
        thisNode,
        messaging: uut.messaging,
        handleNewMessage: async () => {}
      }
      const privateRouter = new PrivateChannelRouter(pRouterOptions)

      const msg = {
        detail: {
          topic: globalConfig.DEFAULT_COORDINATION_ROOM
        }
      }

      const result = await privateRouter.route(msg)

      assert.equal(result, false)
    })

    it('should catch and handle errors, and return false', async () => {
      sandbox.stub(uut.messaging, 'handleIncomingData').resolves({})

      // Instantiate the Private message router library
      const pRouterOptions = {
        thisNode,
        messaging: uut.messaging,
        handleNewMessage: async () => { throw new Error('test error') }
      }
      const privateRouter = new PrivateChannelRouter(pRouterOptions)

      const result = await privateRouter.route({})

      assert.equal(result, false)
    })
  })

  describe('#subscribeToCoordChannel', () => {
    it('should subscribe to the coordination channel', async () => {
      const inObj = {
        chanName: globalConfig.DEFAULT_COORDINATION_ROOM,
        handler: () => {}
      }

      const result = await uut.subscribeToCoordChannel(inObj)

      assert.equal(result, true)
    })

    it('should catch, report, and throw errors', async () => {
      try {
        // Force an error
        sandbox.stub(uut.ipfs.ipfs.libp2p.services.pubsub, 'subscribe').throws(new Error('test error'))

        await uut.subscribeToCoordChannel()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'test error')
      }
    })
  })
})
