/*
  This library routes incoming pubsub messages to the appropriate handler.
*/

// Global npm libraries
import RetryQueue from '@chris.troutner/retry-queue'

// Local libraries
import globalConfig from '../../../config/global-config.js'

// This class routes 'normal' messages, which are broadcast message.
class BroadcastRouter {
  constructor (localConfig = {}) {
    this.handler = localConfig.handler
    this.thisNode = localConfig.thisNode
    this.parsePubsubMessage = localConfig.parsePubsubMessage

    // Encapsulate dependencies
    const options = {
      concurrency: 5,
      attempts: 0,
      retryPeriod: 1000
    }
    this.retryQueue = new RetryQueue(options)
    this.config = globalConfig

    // Bind 'this' object to all subfunctions.
    this.route = this.route.bind(this)
  }

  async route (msg) {
    try {
      // Automatically exit if message is a private message
      // TODO: Allow the user to load a list is other pubsub channels to localConfig?
      // 10/27/23 libp2p@v0.45.16: pubsub messages from other topics trigger
      // this event handler even though they shouldn't. This filters out all
      // pubsub messages that not within the scope of this pubsub topic.
      if (msg.detail.topic !== this.config.DEFAULT_COORDINATION_ROOM &&
        msg.detail.topic !== this.config.BCH_COINJOIN_ROOM) {
        return false
      }

      const inObj = {
        msg,
        handler: this.handler,
        thisNode: this.thisNode
      }

      // This route function is triggered asynchronously by any new message
      // arriving on the pubsub channel. Often within milliseconds from duplicate
      // messages. The queue is used to process each message synchronously, so
      // that debugging and reasoning about the code paths is easier. Also so
      // that duplicate messages can be rejected and extra processing power is
      // not spent on them.
      await this.retryQueue.addToQueue(this.parsePubsubMessage, inObj)

      return true
    } catch (err) {
      console.error('Error trying to route broadcast pubsub message: ', err)
      // Do not throw an error. This is a top-level handler.

      return false
    }
  }
}

// This class routes 'private' messages sent on this nodes private, encrypted
// pubsub channel, which is used for direct communication.
class PrivateChannelRouter {
  constructor (localConfig = {}) {
    this.messaging = localConfig.messaging
    this.thisNode = localConfig.thisNode
    this.handleNewMessage = localConfig.handleNewMessage

    // Encapsuale dependencies
    this.config = globalConfig

    // Bind 'this' object to all subfunctions
    this.route = this.route.bind(this)
  }

  async route (msg) {
    try {
      // 10/27/23 libp2p@v0.45.16: pubsub messages from other topics trigger
      // this event handler even though they shouldn't. This filters out all
      // pubsub messages that not within the scope of this pubsub topic.
      // Automatically exit if message is NOT a private message
      if (msg.detail.topic === this.config.DEFAULT_COORDINATION_ROOM ||
        msg.detail.topic === this.config.BCH_COINJOIN_ROOM) {
        return false
      }
      // Automatically exit if the pubsub channel is not the private channel for
      // this node.
      // Note: The pubsub topic based on this nodes IPFS ID is used for
      // receiving ONLY. Any pubsub topics for other IPFS IDs can be ignored,
      // as they are used for sending ONLY.
      const thisNodeId = this.thisNode.ipfsId
      if (msg.detail.topic !== thisNodeId) return false

      const msgObj = await this.messaging.handleIncomingData(msg, this.thisNode)

      // If msgObj is false, then ignore it. Typically indicates an already
      // processed message.
      if (msgObj) {
        // console.log('handleNewMessage() being called with this msgObj: ', msgObj)
        await this.handleNewMessage(msgObj, this.thisNode)
      }

      return true
    } catch (err) {
      console.error('Error trying to route private pubsub message: ', err)
      // Do not throw an error. This is a top-level handler.

      return false
    }
  }
}

export { BroadcastRouter, PrivateChannelRouter }
