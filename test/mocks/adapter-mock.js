/*
  A mocked version of the adapters library.
*/

class AdaptersMock {
  constructor () {
    this.ipfs = {
      ipfsPeerId: 'fake-id',
      ipfsMultiaddrs: ['addr1', 'addr2'],
      ipfs: {
        pubsub: {
          subscribe: () => {},
          ls: async () => {}
        },
        libp2p: {
          getMultiaddrs: () => [],
          dial: async () => {},
          getPeers: async () => [],
          services: {
            pubsub: {
              publish: async () => {},
              subscribe: async () => {},
              subscriptions: [],
              getTopics: () => [],
              addEventListener: () => {}
            }
          },
          getConnections: async () => {}
        }
      },
      getPeers: () => {
      },
      connectToPeer: () => {
        return {
          status: true,
          details: null
        }
      },
      disconnectFromPeer: () => {
      },
      disconnectFromMultiaddr: () => {
      }
    }

    this.bchjs = {}

    this.type = 'node.js'

    this.bch = {
      generateBchId: () => {
        return {
          cashAddress: 'cashAddress',
          slpAddress: 'slpAddress',
          publicKey: 'public-key'
        }
      },
      bchjs: {
        Util: {
          sleep: () => {
          }
        }
      }
    }

    this.pubsub = {
      subscribeToPubsubChannel: () => {
      },
      subscribeToCoordChannel: async () => {},
      subscribeToPeerChannel: async () => {},
      unsubscribeFromChannel: async () => {},
      unsubscribeFromCoordChannel: async () => {},
      cleanup: async () => {},
      publishToPubsubChannel: () => {
      },
      messaging: {
        publishToPubsubChannel: () => {
        },
        generateMsgObj: () => {
        },
        generateAckMsg: () => {
        },
        sendMsg: () => {
        },
        sendAck: () => {
        },
        handleIncomingData: () => {
        },
        _checkIfAlreadyProcessed: () => {
        },
        delMsgFromQueue: () => {
        },
        addMsgToQueue: () => {
        },
        resendMsg: () => {
        },
        waitForAck: () => {
        }
      },
      about: {
        queryAbout: () => {
        }
      },
      injectMetricsHandler: () => {}
    }

    this.encryption = {
      encryptMsg: () => {
      }
    }

    this.orbit = {
      createRcvDb: () => {
        return { id: 'fake-orbit-id' }
      },
      connectToPeerDb: () => {
      }
    }

    this.log = {
      statusLog: () => {
      }
    }

    this.gist = {
      getCRList: async () => {},
      getCRList2: async () => {}
    }
  }
}

// module.exports = AdaptersMock
export default AdaptersMock
