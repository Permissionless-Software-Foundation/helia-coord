/*
  Mocked version of the Use Cases library.
*/

class UseCasesMock {
  constructor () {
    this.thisNode = {
      refreshPeerConnections: () => {},
      enforceBlacklist: () => {},
      enforceWhitelist: () => {}
    }
    this.relays = {
      connectToCRs: () => {},
      addRelay: () => {},
      measureRelays: () => {},
      sortRelays: obj => obj,
      removeDuplicates: () => {},
      connectToBootstrapRelays: async () => {}
    }
    this.pubsub = {}
    this.peer = {}
  }
}

export default UseCasesMock
