/*
  A mocked instance of ipfs, for use in unit tests.

*/
const ipfs = {
  id: () => {
    return {
      id: 'myID',
      addresses: ['addr1', 'addr2']
    }
  },
  swarm: {
    connect: async () => {},
    peers: async () => {
      return []
    },
    disconnect: async () => {}
  },
  pubsub: {
    subscribe: async () => {},
    publish: async () => {}
  },
  config: {
    set: () => {},
    get: () => {},
    getAll: () => {}
  },
  libp2p: {
    peerId: {
      toString: () => 'fake-peerId'
    },
    getMultiaddrs: () => ['a', 'b'],
    dial: async () => {},
    getPeers: async () => ['a', 'b'],
    services: {
      pubsub: {
        publish: async () => {},
        subscribe: async () => {},
        unsubscribe: async () => {},
        subscriptions: [],
        addEventListener: () => {},
        removeEventListener: () => {}
      }
    }
  }
}

// module.exports = ipfs
export default ipfs
