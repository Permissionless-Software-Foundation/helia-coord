/*
  This class library is used by the messaging.js library to periodically
  resend messages until they are acknowledged.
*/

const RETRY_LIMIT = 3

class ResendMsg {
  constructor (localConfig = {}) {
    this.msgObj = localConfig.msgObj
    this.msgLib = localConfig.msgLib

    // Bind the 'this' object to all subfunctions
    this.resend = this.resend.bind(this)
  }

  // Called by an Interval Timer. This function re-publishes a message to a
  // pubsub channel.
  async resend () {
    try {
      // console.log(`resendMsg() msgObj: ${JSON.stringify(msgObj, null, 2)}`)

      if (!this.msgObj) {
        console.log('ipfs-coord-esm/lib/adapters/pubsub-adapter/resend-msg.js/resend() given empty message object. Can not resend message. Skipping.')
        return 0
      }

      const { retryCnt, intervalHandle, receiver } = this.msgObj

      // Throw an error if the retry count is not an integer.
      const testRetryCnt = parseInt(retryCnt)
      if (isNaN(testRetryCnt)) throw new Error('retryCnt must be an integer')

      if (retryCnt < RETRY_LIMIT) {
        // Increment the retry
        this.msgObj.retryCnt++

        // Send message
        await this.msgLib.publishToPubsubChannel(receiver, this.msgObj)

        return 1
      } else {
        // Retry count exceeded.

        // Disable the interval handler
        clearInterval(intervalHandle)

        return 2
      }
    } catch (err) {
      console.error('Error in resendMsg(): ', err)
      // Do not throw an error. This is a top-level function called by an Interval.
      return 0
    }
  }
}

export default ResendMsg
