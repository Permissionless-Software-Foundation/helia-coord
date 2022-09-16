/*
  This library routes incoming pubsub messages to the appropriate handler.
*/

// This class routes 'normal' messages, which are broadcast message.
class BroadcastRouter {
  constructor (localConfig = {}) {
    this.handler = localConfig.handler
    this.thisNode = localConfig.thisNode
    this.parsePubsubMessage = localConfig.parsePubsubMessage

    this.route = this.route.bind(this)
  }

  async route (msg) {
    try {
      await this.parsePubsubMessage(msg, this.handler, this.thisNode)

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
      if (msgObj) { await this.handleNewMessage(msgObj, this.thisNode) }

      return true
    } catch (err) {
      console.error('Error trying to route private pubsub message: ', err)
      // Do not throw an error. This is a top-level handler.

      return false
    }
  }
}

export { BroadcastRouter, PrivateChannelRouter }
