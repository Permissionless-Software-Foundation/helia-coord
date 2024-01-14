/*
  An entity representing a pubsub channel.

  A pubsub channel entity is defined by the following piece of information:
  - chanName - A string representing the name of the pubsub channel.
  - handler - A handler function that is called when data is recieved on the channel.
*/

class PubsubEntity {
  constructor (localConfig = {}) {
    this.chanName = localConfig.chanName
    if (!this.chanName) {
      throw new Error('chanName required when creating a pubsub entity')
    }

    this.handler = localConfig.handler
    if (!this.handler) {
      throw new Error('handler required when creating a pubsub entity')
    }
  }
}

export default PubsubEntity
