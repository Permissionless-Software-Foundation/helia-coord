/*
  This library routes incoming pubsub messages to the appropriate handler.
*/

// Global npm libraries
import RetryQueue from '@chris.troutner/retry-queue'

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

    // Bind 'this' object to all subfunctions.
    this.route = this.route.bind(this)
  }

  async route (msg) {
    try {
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

    this.route = this.route.bind(this)
  }

  async route (msg) {
    try {
      const msgObj = await this.messaging.handleIncomingData(msg, this.thisNode)

      // If msgObj is false, then ignore it. Typically indicates an already
      // processed message.
      if (msgObj) {
        console.log('handleNewMessage() being called with this msgObj: ', msgObj)
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
