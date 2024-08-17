/*
  Unit tests for the pubsub/messaging.js library.
*/

// npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import SlpWallet from 'minimal-slp-wallet'
import cloneDeep from 'lodash.clonedeep'

// local libraries
import Messaging from '../../../../lib/adapters/pubsub-adapter/messaging.js'
import ipfsLib from '../../../mocks/ipfs-mock.js'
import IPFSAdapter from '../../../../lib/adapters/ipfs-adapter.js'
import EncryptionAdapter from '../../../../lib/adapters/encryption-adapter.js'
import BchAdapter from '../../../../lib/adapters/bch-adapter.js'
import thisNode from '../../../mocks/thisnode-mocks.js'
import ResendMsg from '../../../../lib/adapters/pubsub-adapter/resend-msg.js'

describe('#messaging-adapter', () => {
  let sandbox
  let uut
  let ipfs, ipfsAdapter

  const log = {
    statusLog: () => {}
  }

  beforeEach(async () => {
    // Restore the sandbox before each test.
    sandbox = sinon.createSandbox()

    // Instantiate the IPFS adapter
    ipfs = cloneDeep(ipfsLib)
    ipfsAdapter = new IPFSAdapter({ ipfs, log })

    // Instantiate the Encryption adapater
    const wallet = new SlpWallet()
    await wallet.walletInfoPromise
    const bch = new BchAdapter({ wallet })

    const encryption = new EncryptionAdapter({ bch, log })

    // Instantiate the library under test. Must instantiate dependencies first.
    uut = new Messaging({ ipfsAdapter, log, encryption })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if IPFS adapter not specified', () => {
      try {
        uut = new Messaging()

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of IPFS adapter required when instantiating Messaging Adapter.'
        )
      }
    })

    it('should throw an error if log adapter not specified', () => {
      try {
        uut = new Messaging({ ipfsAdapter })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'A status log handler function required when instantitating Messaging Adapter'
        )
      }
    })

    it('should throw an error if log adapter not specified', () => {
      try {
        uut = new Messaging({ ipfsAdapter, log })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'An instance of the encryption Adapter must be passed when instantiating the Messaging Adapter library.'
        )
      }
    })
  })

  describe('#generateMsgObj', () => {
    it('should throw error if sender is not specified', () => {
      try {
        uut.generateMsgObj()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.equal(err.message, 'Sender required when calling generateMsgObj()')
      }
    })

    it('should throw error if Receiver is not specified', () => {
      try {
        const inObj = {
          sender: 'fake-sender'
        }

        uut.generateMsgObj(inObj)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.equal(err.message, 'Receiver required when calling generateMsgObj()')
      }
    })

    it('should throw error if payload is not specified', () => {
      try {
        const inObj = {
          sender: 'fake-sender',
          receiver: 'fake-receiver'
        }

        uut.generateMsgObj(inObj)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.equal(err.message, 'Payload required when calling generateMsgObj()')
      }
    })

    it('should generate a message object', () => {
      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }

      const result = uut.generateMsgObj(inObj)
      // console.log(result)

      assert.property(result, 'timestamp')
      assert.property(result, 'uuid')
      assert.property(result, 'sender')
      assert.property(result, 'receiver')
      assert.property(result, 'payload')
    })
  })

  describe('#generateAckMsg', () => {
    it('should generate an ACK message', async () => {
      const ipfsId = '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa'
      const data = {
        sender: ipfsId,
        uuid: 'fake-uuid'
      }

      thisNode.peerData.push({ from: ipfsId })

      const result = await uut.generateAckMsg(data, thisNode)
      // console.log(result)

      assert.property(result, 'timestamp')
      assert.property(result, 'uuid')
      assert.property(result, 'sender')
      assert.property(result, 'receiver')
      assert.property(result, 'payload')
    })
  })

  it('should catch and throw errors', async () => {
    try {
      await uut.generateAckMsg()

      assert.fail('Unexpected code path')
    } catch (err) {
      console.log(err)
      assert.include(err.message, 'Cannot read')
    }
  })

  describe('#publishToPubsubChannel', () => {
    it('should publish a message to a pubsub channel', async () => {
      const chanName = 'fake-chanName'

      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }
      const msgObj = uut.generateMsgObj(inObj)

      const result = await uut.publishToPubsubChannel(chanName, msgObj)

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should announce itself on the announcement pubsub channel', async () => {
      const chanName = 'fake-chanName'

      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }
      const msgObj = uut.generateMsgObj(inObj)
      delete msgObj.uuid

      const result = await uut.publishToPubsubChannel(chanName, msgObj)

      // assert.equal(true, true, 'Not throwing an error is a pass')
      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Force an error
        sandbox
          .stub(uut.ipfs.ipfs.pubsub, 'publish')
          .rejects(new Error('test error'))

        await uut.publishToPubsubChannel()

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'The first argument')
      }
    })
  })

  describe('#_checkIfAlreadyProcessed', () => {
    it('should return true if UUID is already in cache', () => {
      const uuid = 'fake-uuid'

      // Force uuid to be in cache
      uut.msgCache.push(uuid)

      const result = uut._checkIfAlreadyProcessed(uuid)

      assert.equal(result, true)
    })

    it('should return false and add uuid to cache', () => {
      const uuid = 'fake-uuid'

      const result = uut._checkIfAlreadyProcessed(uuid)

      assert.equal(result, false)

      assert.equal(uut.msgCache.includes(uuid), true)
    })

    it('should shift out the oldest element if the cache is full', () => {
      const uuid = 'fake-uuid'

      // Force code path for this test.
      uut.MSG_CACHE_SIZE = 0

      const result = uut._checkIfAlreadyProcessed(uuid)

      assert.equal(result, false)
    })
  })

  describe('#resendMsg', () => {
    it('should resend message', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'publishToPubsubChannel').resolves()

      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }
      const msgObj = uut.generateMsgObj(inObj)
      msgObj.retryCnt = 0

      const resendMsg = new ResendMsg({ msgObj, msgLib: uut })

      const result = await resendMsg.resend()

      assert.equal(result, 1)
    })

    it('should clear the Interval if retry count has been exceeded', async () => {
      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }
      const msgObj = uut.generateMsgObj(inObj)
      msgObj.retryCnt = 4

      const resendMsg = new ResendMsg({ msgObj, msgLib: uut })

      const result = await resendMsg.resend()

      assert.equal(result, 2)
    })

    it('should return 0 on error', async () => {
      // const result = await uut.resendMsg()
      const resendMsg = new ResendMsg({ msgObj: {}, msgLib: {} })

      const result = await resendMsg.resend()

      assert.equal(result, 0)
    })
  })

  describe('#addMsgToQueue', () => {
    it('should add a message to the queue', () => {
      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }
      const msgObj = uut.generateMsgObj(inObj)

      const result = uut.addMsgToQueue(msgObj)
      // console.log(result)

      clearInterval(result.intervalHandle)

      assert.property(result, 'timestamp')
      assert.property(result, 'uuid')
      assert.property(result, 'sender')
      assert.property(result, 'receiver')
      assert.property(result, 'payload')
      assert.property(result, 'intervalHandle')
      assert.property(result, 'retryCnt')
    })

    it('should catch and throw errors', async () => {
      const msgObj = {}

      try {
        // Force an error
        sandbox.stub(uut.msgQueue, 'push').throws(new Error('test error'))

        await uut.addMsgToQueue(msgObj)

        assert.fail('Unexpected code path')
      } catch (err) {
        clearInterval(msgObj.intervalHandle)

        // console.log('err: ', err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#delMsgFromQueue', () => {
    it('should delete a message from the queue', () => {
      const inObj = {
        sender: 'fake-sender',
        receiver: 'fake-receiver',
        payload: 'fake-payload'
      }
      const msgObj = uut.generateMsgObj(inObj)

      // Force the object to be in the queue
      uut.msgQueue.push(msgObj)

      const result = uut.delMsgFromQueue(msgObj)

      assert.equal(result, true)
    })
  })

  describe('#sendMsg', () => {
    it('should send a message to an IPFS peer', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'generateMsgObj').returns({ key: 'value' })
      sandbox.stub(uut, 'publishToPubsubChannel').resolves()
      sandbox.stub(uut, 'addMsgToQueue').returns()

      const receiver = 'fake-receiver'
      const payload = 'fake-payload'

      const result = await uut.sendMsg(receiver, payload, thisNode)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Force an error
        sandbox.stub(uut, 'generateMsgObj').throws(new Error('test error'))

        const receiver = 'fake-receiver'
        const payload = 'fake-payload'

        await uut.sendMsg(receiver, payload, thisNode)

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#sendAck', () => {
    it('should send an ACK message', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'publishToPubsubChannel').resolves()

      const ipfsId = '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa'
      const data = {
        sender: ipfsId,
        uuid: 'fake-uuid'
      }

      const result = await uut.sendAck(data, thisNode)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Force an error
        sandbox.stub(uut, 'generateAckMsg').throws(new Error('test error'))

        const ipfsId = '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa'
        const data = {
          sender: ipfsId,
          uuid: 'fake-uuid'
        }

        await uut.sendAck(data, thisNode)

        assert.fail('Unexpected code path')
      } catch (err) {
        // console.log('err: ', err)
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#handleIncomingData', () => {
    it('should handle an incoming message', async () => {
      // Mock dependencies
      // sandbox.stub(uut.encryption,'decryptMsg').resolves()
      uut.encryption.decryptMsg = (x) => JSON.stringify({ a: 'b' })
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      console.log(result)

      assert.property(result, 'from')
      assert.property(result, 'channel')
      assert.property(result, 'data')
    })

    it('should return false for incoming ACK message', async () => {
      // Mock dependencies
      sandbox.stub(uut.encryption, 'decryptMsg').resolves(JSON.stringify({ apiName: 'ACK' }))
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)
      sandbox.stub(uut, 'delMsgFromQueue').returns()

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325431333a33303a35372e3936315a222c2275756964223a2238396264393261362d653363332d343364662d396266372d666334323334376434663435222c2273656e646572223a22313244334b6f6f5750704258686841656f435a43477551334b52347877487a7a767450353766367a4c6d6f3850375a46424a4645222c227265636569766572223a22313244334b6f6f574c767a6b426f347646625a627739576b4e6d4b6a686f35636e534e615957663770463470447658487477416f222c227061796c6f6164223a223034376539383538393661643735326135376264623338303563353537626336373862323434663934323436386636303235333232623330356631363665633463653033313630636662313661383735396338386436373739653466386435643632333035306132363630303465306535306163613462346132333732363665643032303931386332313831346235366365366136386633336362616233303863393663356330643131653537616233366438316664303063666264333035373537363762393331613734376436663133393939353464373666393336623461353336386234353933643535613862383561363365613662343030383736636361356663386334383834353934623764356133643130623161363036396162336430227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      console.log(result)

      assert.equal(result, false)
    })

    it('should return false for already processed message', async () => {
      // Mock dependencies
      // sandbox.stub(uut.encryption,'decryptMsg').resolves()
      uut.encryption.decryptMsg = (x) => JSON.stringify(x)
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(true)
      sandbox.stub(uut, 'delMsgFromQueue').returns()

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      // console.log(result)

      assert.equal(result, false)
    })

    it('should return false on error', async () => {
      const result = await uut.handleIncomingData()

      assert.equal(result, false)
    })

    it('should report debug REQUESTS from an about RPC call', async () => {
      // Force desired code path
      uut.encryption.decryptMsg = (x) => JSON.stringify({
        id: 123
      })
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      // console.log(result)

      assert.include(result.data.payload, '123')
    })

    it('should report debug RESPONSE from an about RPC call', async () => {
      // Force desired code path
      uut.encryption.decryptMsg = (x) => JSON.stringify({
        id: 123,
        result: true
      })
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      // console.log(result)

      assert.include(result.data.payload, '123')
    })

    it('should return false if message originated from this node', async () => {
      // Force desired code path
      uut.encryption.decryptMsg = (x) => JSON.stringify({
        id: 123
      })
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: thisNode.ipfsId,
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      // console.log(result)

      assert.equal(result, false)
    })

    it('should return false if message does not have a payload to decrypt', async () => {
      // Force desired code path
      uut.encryption.decryptMsg = (x) => JSON.stringify({
        id: 123
      })
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('227b5c226170694e616d655c223a5c22697066732d636f6f72642d616e6e6f756e63655c222c5c2261706956657273696f6e5c223a5c22312e332e325c222c5c22617069496e666f5c223a5c22596f752073686f756c642070757420616e20495046532068617368206f72207765622055524c206865726520746f20796f757220646f63756d656e746174696f6e2e5c222c5c2262726f616463617374656441745c223a5c22323032332d31302d32325431323a34393a30392e3238325a5c222c5c226970667349645c223a5c22313244334b6f6f574b534334756b4c5a4b5370694d366a5671553264575a34387a5271663973524b477977324c6e7531334857485c222c5c22747970655c223a5c226e6f64652e6a735c222c5c22697066734d756c746961646472735c223a5b5c222f6970342f3132372e302e302e312f7463702f343030312f7032702f313244334b6f6f574b534334756b4c5a4b5370694d366a5671553264575a34387a5271663973524b477977324c6e7531334857485c222c5c222f6970342f3132372e302e302e312f7463702f343030332f7032702f313244334b6f6f574b534334756b4c5a4b5370694d366a5671553264575a34387a5271663973524b477977324c6e7531334857485c222c5c222f6970342f3132372e302e302e312f7564702f343030312f717569632f7032702f313244334b6f6f574b534334756b4c5a4b5370694d366a5671553264575a34387a5271663973524b477977324c6e7531334857485c222c5c222f6970342f3137332e3234312e3137312e3135312f7564702f313032342f717569632f7032702f313244334b6f6f574b534334756b4c5a4b5370694d366a5671553264575a34387a5271663973524b477977324c6e7531334857485c225d2c5c226f7262697464625c223a5c225c222c5c226369726375697452656c6179735c223a5b5d2c5c2269734369726375697452656c61795c223a66616c73652c5c226369726375697452656c6179496e666f5c223a7b7d2c5c2263727970746f4164647265737365735c223a5b7b5c22626c6f636b636861696e5c223a5c224243485c222c5c22747970655c223a5c2263617368416464725c222c5c22616464726573735c223a5c22626974636f696e636173683a717279786d7238736464327a76686578746436746d65756777707063713232716e71687379727274656a5c227d2c7b5c22626c6f636b636861696e5c223a5c224243485c222c5c22747970655c223a5c22736c70416464725c222c5c22616464726573735c223a5c2273696d706c656c65646765723a717279786d7238736464327a76686578746436746d65756777707063713232716e716d7430636b7438765c227d5d2c5c22656e63727970745075624b65795c223a5c223033373735653432613763386132643664393630646437623430326533626532623335326234663865633537303566303263303261636461613236623334323236395c222c5c226a736f6e4c645c223a7b5c2240636f6e746578745c223a5c2268747470733a2f2f736368656d612e6f72672f5c222c5c2240747970655c223a5c225765624150495c222c5c226e616d655c223a5c226263682d77616c6c65742d736572766963652d7064782d7573615c222c5c2276657273696f6e5c223a5c22322e302e305c222c5c2270726f746f636f6c5c223a5c226263682d77616c6c65745c222c5c226465736372697074696f6e5c223a5c224950465320736572766963652070726f766964696e672042434820626c6f636b636861696e20616363657373206e656564656420627920612077616c6c65742e5c222c5c22646f63756d656e746174696f6e5c223a5c2268747470733a2f2f697066732d6263682d77616c6c65742d736572766963652e66756c6c737461636b2e636173682f5c222c5c2270726f76696465725c223a7b5c2240747970655c223a5c224f7267616e697a6174696f6e5c222c5c226e616d655c223a5c225065726d697373696f6e6c65737320536f66747761726520466f756e646174696f6e5c222c5c2275726c5c223a5c2268747470733a2f2f5053466f756e646174696f6e2e636173685c227d2c5c226964656e7469666965725c223a5c22313244334b6f6f574b534334756b4c5a4b5370694d366a5671553264575a34387a5271663973524b477977324c6e7531334857485c227d7d22', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      // console.log(result)

      assert.equal(result, false)
    })

    it('should return false if message can not be decrypted', async () => {
      // Mock dependencies
      sandbox.stub(uut, 'sendAck').resolves()
      sandbox.stub(uut, '_checkIfAlreadyProcessed').returns(false)

      // Force desired code path.
      sandbox.stub(uut.encryption, 'decryptMsg').resolves(false)

      uut.nodeType = 'external'

      const msg = {
        detail: {
          from: '12D3KooWHS5A6Ey4V8fLWD64jpPn2EKi4r4btGN6FfkNgMTnfqVa',
          topic: '12D3KooWE6tkdArVpCHG9QN61G1cE7eCq2Q7i4bNx6CJFTDprk9f',
          data: Buffer.from('7b2274696d657374616d70223a22323032332d31302d32325430303a31343a32332e3933355a222c2275756964223a2265366135383935312d396565352d343966302d383037652d373937316365396236643138222c2273656e646572223a22313244334b6f6f57477367485779444c4b7556345a5366524a667378514a6a373772787833693850783371584b48734c4e376132222c227265636569766572223a22313244334b6f6f574e6861714e6a7335717265684a553532657579454461337862375571524e5145576671714258736876714156222c227061796c6f6164223a223034376137666133623732666262356365623236313531636261343566316566636536613863353032353435373130376331313664616362336265633866326434666465633564636462643135613931633038646436656264353037353132643062353862636436316530396563313934366234623535373032633833383733336439616332316166616265303466326534616535393137356464303562653161343832643332646239646563396566383763666663613233653161383766393233393736363836396466396166376238656438626136613736396665373563626563613436623236363536643836386231396638376636353034666632613332333735313738616332623239313833646638386230396435393934366236616636227d', 'hex')
        }
      }

      const result = await uut.handleIncomingData(msg, thisNode)
      // console.log(result)

      assert.equal(result, false)
    })
  })
})
