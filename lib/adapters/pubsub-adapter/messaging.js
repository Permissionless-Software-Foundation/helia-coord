/*
  A library for broadcasting messages over pubsub and managing 'lost messages'.
*/

// Global npm libraries
import { v4 as uid } from 'uuid'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

// Local libraries
import ResendMsg from './resend-msg.js'
import globalConfig from '../../../config/global-config.js'

class Messaging {
  constructor (localConfig = {}) {
    // Dependency Injection
    this.ipfs = localConfig.ipfsAdapter
    if (!this.ipfs) {
      throw new Error(
        'Instance of IPFS adapter required when instantiating Messaging Adapter.'
      )
    }
    this.log = localConfig.log
    if (!this.log) {
      throw new Error(
        'A status log handler function required when instantitating Messaging Adapter'
      )
    }
    this.encryption = localConfig.encryption
    if (!this.encryption) {
      throw new Error(
        'An instance of the encryption Adapter must be passed when instantiating the Messaging Adapter library.'
      )
    }

    // 'node.js' is the assumed working environment.
    this.nodeType = localConfig.nodeType
    if (!this.nodeType) {
      this.nodeType = 'node.js'
    }

    // Encapsulate dependencies
    this.uid = uid
    this.config = globalConfig

    // State
    this.msgQueue = []
    // Cache to store UUIDs of processed messages. Used to prevent duplicate
    // processing.
    this.msgCache = []
    this.MSG_CACHE_SIZE = 30
  }

  // Send a message to a peer
  // The message is added to a queue that will automatically track ACK messages
  // and re-send the message if an ACK message is not received.
  async sendMsg (receiver, payload, thisNode) {
    try {
      // console.log(`sendMsg thisNode: `, thisNode)

      // Generate a message object
      const sender = thisNode.ipfsId
      const inMsgObj = {
        sender,
        receiver,
        payload
      }
      const msgObj = this.generateMsgObj(inMsgObj)

      // Send message
      await this.publishToPubsubChannel(receiver, msgObj)

      // Add the message to the retry queue
      this.addMsgToQueue(msgObj)

      return true
    } catch (err) {
      console.error('Error in messaging.js/sendMsg()')
      throw err
    }
  }

  // Publish an ACK (acknowldge) message. Does not wait for any reply. Just fires
  // and returns.
  async sendAck (data, thisNode) {
    try {
      const ackMsgObj = await this.generateAckMsg(data, thisNode)

      // Send Ack message
      await this.publishToPubsubChannel(data.sender, ackMsgObj)

      return true
    } catch (err) {
      console.error('Error in sendAck()')
      throw err
    }
  }

  // A handler function that is called when a new message is recieved on the
  // pubsub channel for this IPFS node. It does the following:
  // - Decrypts the message.
  // - Sends an ACK message to the sender of the message.
  // - Returns an object containing the message and metadata.
  async handleIncomingData (msg, thisNode) {
    try {
      this.log.statusLog(3, `handleIncomingData() message from ${msg.detail.from.toString()}, sn: ${msg.detail.sequenceNumber}`)

      const thisNodeId = thisNode.ipfsId

      // Get data about the message.
      const from = msg.detail.from.toString()
      const channel = msg.detail.topic

      // Ignore this message if it originated from this IPFS node.
      if (from === thisNodeId) return false

      // Parse the data into a JSON object. It starts as a Buffer that needs
      // to be converted to a string, then parsed to a JSON object.
      let data = uint8ArrayToString(msg.detail.data)
      data = JSON.parse(data)

      // Encrypted messages should have a payload property. If it doesn't, then
      // it's some other kind of message and can be rejected.
      if (!data.payload) {
        return false
      }

      // Decrypt the payload
      const decryptedPayload = await this.encryption.decryptMsg(data.payload, data.sender)
      if (!decryptedPayload) {
        return false
      }
      this.log.statusLog(2, 'decrypted payload:', decryptedPayload)

      // Filter ACK messages from other messages
      if (decryptedPayload.includes('"apiName":"ACK"')) {
        this.log.statusLog(2, `ACK message received for ${data.uuid}`)

        this.delMsgFromQueue(data)

        return false
      } else {
        this.log.statusLog(
          2,
          `Private pubsub message recieved from ${from} on channel ${channel} with message ID ${data.uuid}`
        )
      }

      // Debug logs from an 'about' JSON RPC command.
      if (decryptedPayload.includes('"id"')) {
        const obj = JSON.parse(decryptedPayload)
        // console.log(`debug log obj: ${JSON.stringify(obj, null, 2)}`)

        if (obj.result) {
          // Response
          this.log.statusLog(2, `Message ID ${data.uuid} contains RPC response with ID ${obj.id}`)
        } else {
          // Request
          this.log.statusLog(2, `Message ID ${data.uuid} contains RPC request with ID ${obj.id}`)
        }
      }

      // Send an ACK message
      await this.sendAck(data, thisNode)

      // Ignore message if its already been processed.
      const alreadyProcessed = this._checkIfAlreadyProcessed(data.uuid)
      if (alreadyProcessed) {
        // console.log(`Message ${data.uuid} already processed`)
        this.log.statusLog(2, `Message ${data.uuid} already processed`)
        return false
      }

      // Replace the encrypted data with the decrypted data.
      data.payload = decryptedPayload

      const retObj = { from, channel, data }
      // console.log(
      //   `new pubsub message received: ${JSON.stringify(retObj, null, 2)}`
      // )

      return retObj
    } catch (err) {
      console.error('Error in helia-coord/lib/adpaters/pubsub-adapter/messaging.js/handleIncomingData(): ', err)

      // Do not throw an error. This is a top-level function called by an Interval.
      return false
    }
  }

  // Generate a message object with UUID and timestamp.
  generateMsgObj (inMsgObj = {}) {
    try {
      const { sender, receiver, payload } = inMsgObj

      // Input validation
      if (!sender) {
        throw new Error('Sender required when calling generateMsgObj()')
      }
      if (!receiver) {
        throw new Error('Receiver required when calling generateMsgObj()')
      }
      if (!payload) {
        throw new Error('Payload required when calling generateMsgObj()')
      }

      const uuid = this.uid()

      const now = new Date()
      const timestamp = now.toISOString()

      const outMsgObj = {
        timestamp,
        uuid,
        sender,
        receiver,
        payload
      }

      return outMsgObj
    } catch (err) {
      console.log('Error in generateMsgObj()')
      throw err
    }
  }

  // Generate an ACK (acknowledge) message.
  async generateAckMsg (data, thisNode) {
    try {
      // console.log('thisNode: ', thisNode)

      // The sender of the original messages is the receiver of the ACK message.
      const receiver = data.sender
      const uuid = data.uuid

      const ackMsg = {
        apiName: 'ACK'
      }

      const peerData = thisNode.peerData.filter(x => x.from === receiver)

      // 3/24/24 CT - Debugging issue with passing data between ipfs-bch-wallet
      // -service and -consumer.
      if (!peerData || !peerData[0].data) {
        console.log(`peerData[0]: ${JSON.stringify(peerData[0])}`)
        throw new Error('Required encryption information for peer is not available.')
      }

      // Encrypt the string with the peers public key.
      const payload = await this.encryption.encryptMsg(
        peerData[0],
        JSON.stringify(ackMsg)
      )

      // Include the pubkey in the message, to help with debugging 'Bad MAC' errors.
      const pubKey = peerData[0].data.encryptPubKey

      const sender = thisNode.ipfsId

      const inMsgObj = {
        sender,
        receiver,
        pubKey,
        payload
      }

      const outMsgObj = this.generateMsgObj(inMsgObj)

      // Replace the message UUID with the UUID from the original message.
      outMsgObj.uuid = uuid

      this.log.statusLog(
        2,
        `Sending ACK message for ID ${uuid}`
      )

      return outMsgObj
    } catch (err) {
      console.error('Error in generateAckMsg()')
      throw err
    }
  }

  // Converts an input string to a Buffer and then broadcasts it to the given
  // pubsub room.
  async publishToPubsubChannel (chanName, msgObj) {
    try {
      const msgBuf = Buffer.from(JSON.stringify(msgObj))

      // Publish the message to the pubsub channel.
      // await this.ipfs.ipfs.pubsub.publish(chanName, msgBuf)
      await this.ipfs.ipfs.libp2p.services.pubsub.publish(chanName, msgBuf)

      // console.log('msgObj: ', msgObj)

      // Used for debugging.
      if (msgObj.uuid) {
        this.log.statusLog(
          2,
          `New message published to private channel ${chanName} with ID ${msgObj.uuid}`
        )
      } else {
        this.log.statusLog(
          2,
          `New announcement message published to broadcast channel ${chanName}`
        )
      }

      return true
    } catch (err) {
      console.error('Error in publishToPubsubChannel()')
      throw err
    }
  }

  // Checks the UUID to see if the message has already been processed. Returns
  // true if the UUID exists in the list of processed messages.
  _checkIfAlreadyProcessed (uuid) {
    // Check if the hash is in the array of already processed message.
    const alreadyProcessed = this.msgCache.includes(uuid)

    // Update the msgCache if this is a new message.
    if (!alreadyProcessed) {
      // Add the uuid to the array.
      this.msgCache.push(uuid)

      // If the array is at its max size, then remove the oldest element.
      if (this.msgCache.length > this.MSG_CACHE_SIZE) {
        this.msgCache.shift()
      }
    }

    return alreadyProcessed
  }

  // Stops the Interval Timer and deletes a message from the queue when an
  // ACK message is received.
  delMsgFromQueue (msgObj) {
    // Loop through the message queue
    for (let i = 0; i < this.msgQueue.length; i++) {
      const thisMsg = this.msgQueue[i]

      // Find the matching entry.
      if (msgObj.uuid === thisMsg.uuid) {
        // console.log(`thisMsg: `, thisMsg)

        // Stop the Interval
        try {
          clearInterval(thisMsg.intervalHandle)
        // console.log('Interval stopped')
        } catch (err) { /* exit quietly */ }

        // Delete the entry from the msgQueue array.
        this.msgQueue.splice(i, 1)
        break
      }
    }

    return true
  }

  // Adds a message object to the message queue. Starts an interval timer that
  // will repeat the message periodically until an ACK message is received.
  addMsgToQueue (msgObj = {}) {
    try {
      msgObj.retryCnt = 1

      const resendMsg = new ResendMsg({ msgObj, msgLib: this })

      // Start interval for repeating message
      // const intervalHandle = setInterval(function () {
      //   _this.resendMsg(msgObj)
      // }, TIME_BETWEEN_RETRIES)

      const intervalHandle = setInterval(resendMsg.resend, this.config.TIME_BETWEEN_RETRIES)

      // Add interval handle to message object.
      msgObj.intervalHandle = intervalHandle

      // Add message object to the queue.
      this.msgQueue.push(msgObj)

      return msgObj
    } catch (err) {
      console.error('Error in addMsgToQueue')
      throw err
    }
  }
}

// module.exports = Messaging
export default Messaging
