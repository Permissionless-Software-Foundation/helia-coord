/*
  This Controller library is concerned with timer-based functions that are
  kicked off periodicially. These functions maintain connections and state
  of the IPFS node.
*/

// Local libraries
import Util from '../util/utils.js'

const DEFAULT_COORDINATION_ROOM = 'psf-ipfs-coordination-002'

class TimerControllers {
  constructor (localConfig = {}) {
    // Dependency Injection
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters required when instantiating Timer Controllers'
      )
    }
    this.statusLog = localConfig.statusLog
    if (!this.statusLog) {
      throw new Error(
        'Handler for status logs required when instantiating Timer Controllers'
      )
    }

    // Encapsulate dependencies
    this.util = new Util()
    this.sleep = this.util.sleep

    // state
    this.debugLevel = localConfig.debugLevel
    this.config = localConfig
    this.circuitRelayTimerInterval = 60000
    this.announceTimerInterval = 31000
    this.peerTimerInterval = 2 * 50000
    this.relaySearchInterval = 3 * 60000
    this.checkBlacklistInterval = 30000
    this.listPubsubChannelsInterval = 32000

    // Bind 'this' object to all subfunctions
    this.startTimers = this.startTimers.bind(this)
    this.stopAllTimers = this.stopAllTimers.bind(this)
    // this.monitorBandwidth = this.monitorBandwidth.bind(this)
    this.manageCircuitRelays = this.manageCircuitRelays.bind(this)
    this.manageAnnouncement = this.manageAnnouncement.bind(this)
    this.managePeers = this.managePeers.bind(this)
    this.blacklist = this.blacklist.bind(this)
    this.searchForRelays = this.searchForRelays.bind(this)
  }

  startTimers (thisNode, useCases) {
    const _this = this

    // Periodically maintain the connection to Circuit Relays.
    this.circuitRelayTimerHandle = setInterval(async function () {
      await _this.manageCircuitRelays(thisNode, useCases)
    }, this.circuitRelayTimerInterval) // One Minute

    // Periodically announce this nodes existance to the network.
    this.announceTimerHandle = setInterval(async function () {
      await _this.manageAnnouncement(thisNode, useCases)
    }, this.announceTimerInterval)

    // Periodically maintain the connection to other coordination peers.
    this.peerTimerHandle = setInterval(async function () {
      await _this.managePeers(thisNode, useCases)
    }, this.peerTimerInterval)

    // Periodically try to connect to problematic peers that advertise as
    // potential circuit relays.
    this.relaySearchHandle = setInterval(async function () {
      await _this.searchForRelays(thisNode, useCases)
    }, this.relaySearchInterval)

    // Periodically ensure we are disconnected from blacklisted peers.
    // this.checkBlacklistHandle = setInterval(async function () {
    //   await _this.blacklist(thisNode, useCases)
    // }, this.checkBlacklistInterval)

    this.listPubsubChannelsHandle = setInterval(async function () {
      await _this.listPubsubChannels()
    }, this.listPubsubChannelsInterval)

    // Return handles to the different timers.
    return {
      circuitRelayTimerHandle: this.circuitRelayTimerHandle,
      announceTimerHandle: this.announceTimerHandle,
      peerTimerHandle: this.peerTimerHandle,
      relaySearchHandle: this.relaySearchHandle,
      checkBlacklistHandle: this.checkBlacklistHandle,
      listPubsubChannelsHandle: this.listPubsubChannelsHandle
    }
  }

  // Used mostly for testing. Ensures all timers are stopped.
  async stopAllTimers () {
    clearInterval(this.circuitRelayTimerHandle)
    clearInterval(this.announceTimerHandle)
    clearInterval(this.peerTimerHandle)
    clearInterval(this.relaySearchHandle)
    clearInterval(this.checkBlacklistHandle)
    clearInterval(this.listPubsubChannelsHandle)
  }

  async listPubsubChannels () {
    const ipfs = this.adapters.ipfs.ipfs

    const pubsubChans = ipfs.libp2p.services.pubsub.getTopics()
    // console.log(`subscribed pubsub channels: ${JSON.stringify(pubsubChans, null, 2)}`)
    this.adapters.log.statusLog(1, `subscribed pubsub channels: ${JSON.stringify(pubsubChans, null, 2)}`)

    return true
  }

  // Dev Note: This is not curently used, but code is left because it may be
  // enabled in the future.
  // Monitor the bandwidth being consumed by IPFS peers.
  // async monitorBandwidth (thisNode, useCases) {
  //   try {
  //     const ipfs = this.adapters.ipfs.ipfs

  //     // const bw = await ipfs.stats.bw()
  //     // console.log('bw: ', bw)
  //     for await (const stats of ipfs.stats.bw()) {
  //     // console.log(stats)
  //       this.adapters.log.statusLog(2, 'Bandwidth stats: ', stats)
  //     // this.adapters.log.statusLog(2, `${JSON.stringify(stats, null, 2)}`)
  //     }

  //     const bitswap = await ipfs.stats.bitswap()
  //     this.adapters.log.statusLog(2, 'bitswap stats: ', bitswap)
  //     // this.adapters.log.statusLog(2, `${JSON.stringify(bitswap, null, 2)}`)

  //     return true

  //   } catch (err) {
  //     console.error('Error in timer-controller.js/monitorBandwidth(): ', err)
  //     // this.adapters.log.statusLog(
  //     //   2,
  //     //   'Error in timer-controller.jsmonitorBandwidth(): ',
  //     //   err
  //     // )

  //     // Note: Do not throw an error. This is a top-level function.
  //     return false
  //   }
  // }

  // This function is intended to be called periodically by setInterval().
  // This function finds circuit relays on the network that can be used
  // to relay data to other nodes behind firewalls.
  async manageCircuitRelays (thisNode, useCases) {
    try {
      this.adapters.log.statusLog(3, 'Entering manageCircuitRelays() Controller.')

      // Disable the timer while processing is happening.
      clearInterval(this.circuitRelayTimerHandle)

      // Remove any duplicate entries
      useCases.relays.removeDuplicates(thisNode)

      // Maintain connections to Relays.
      await useCases.relays.connectToCRs(thisNode)

      // Update metrics on Relays.
      await useCases.relays.measureRelays(thisNode)

      const now = new Date()
      this.adapters.log.statusLog(1,
        `Renewed connections to all circuit relays at ${now.toLocaleString()}`
      )

      // Re-enable the timer interval.
      const _this = this
      this.circuitRelayTimerHandle = setInterval(async function () {
        await _this.manageCircuitRelays(thisNode, useCases)
      }, this.circuitRelayTimerInterval)

      // console.log('Exiting manageCircuitRelays() Controller.')

      return true
    } catch (err) {
      console.error(
        'Error in timer-controller.js/manageCircuitRelays(): ',
        err
      )
      // this.adapters.log.statusLog(
      //   2,
      //   'Error in timer-controller.js/manageCircuitRelays(): ',
      //   err
      // )

      // Re-enable the timer interval.
      const _this = this
      this.circuitRelayTimerHandle = setInterval(async function () {
        await _this.manageCircuitRelays(thisNode, useCases)
      }, this.circuitRelayTimerInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  // This function is intended to be called periodically by setInterval().
  // Announce the existance of this node to the network.
  async manageAnnouncement (thisNode, useCases) {
    try {
      // console.log('thisNode: ', thisNode)

      // Disable the timer interval while this function executes.
      clearInterval(this.announceTimerHandle)

      // Get the information needed for the announcement.
      const announceObj = {
        ipfsId: thisNode.ipfsId,
        ipfsMultiaddrs: thisNode.ipfsMultiaddrs,
        type: thisNode.type,
        // orbitdbId: thisNode.orbit.id,

        // TODO: Allow node.js apps to pass a config setting to override this.
        isCircuitRelay: false
      }

      // Generate the announcement message.
      const announceMsgObj = thisNode.schema.announcement(announceObj)
      // console.log(`announceMsgObj: ${JSON.stringify(announceMsgObj, null, 2)}`)

      const announceMsgStr = JSON.stringify(announceMsgObj)

      // Publish the announcement to the pubsub channel.
      await this.adapters.pubsub.messaging.publishToPubsubChannel(
        DEFAULT_COORDINATION_ROOM,
        announceMsgStr
      )

      const now = new Date()
      this.adapters.log.statusLog(
        1,
        `status: Announced self on ${DEFAULT_COORDINATION_ROOM} pubsub channel at ${now.toLocaleString()}`
      )

      // Re-enable the timer interval
      const _this = this
      this.announceTimerHandle = setInterval(async function () {
        await _this.manageAnnouncement(thisNode, useCases)
      }, this.announceTimerInterval)

      return true
    } catch (err) {
      console.error('Error in timer-controller.js/manageAnnouncement(): ', err)
      // this.adapters.log.statusLog(
      //   2,
      //   'Error in timer-controller.js/manageAnnouncement(): ',
      //   err
      // )

      // Re-enable the timer interval
      const _this = this
      this.announceTimerHandle = setInterval(async function () {
        await _this.manageAnnouncement(thisNode, useCases)
      }, this.announceTimerInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  // This function is intended to be called periodically by setInterval().
  // It refreshes the connection to all subnet peers thisNode is trying to track.
  async managePeers (thisNode, useCases) {
    let success = false

    try {
      // Disable the timer while processing is happening.
      clearInterval(this.peerTimerHandle)

      // this.statusLog('managePeers')
      await useCases.thisNode.refreshPeerConnections()

      // console.error('Error in timer-controller.js/manageAnnouncement(): ', err)
      this.adapters.log.statusLog(
        1,
        'Renewed connections to all subnet peers.'
      )

      // Reinstate the timer interval
      const _this = this
      this.peerTimerHandle = setInterval(async function () {
        await _this.managePeers(thisNode, useCases)
      }, this.peerTimerInterval)

      success = true
    } catch (err) {
      console.log('Error in timer-controller.js/managePeers(): ', err)
      // this.adapters.log.statusLog(
      //   2,
      //   'Error in timer-controller.js/managePeers(): ',
      //   err
      // )

      // Reinstate the timer interval
      const _this = this
      this.peerTimerHandle = setInterval(async function () {
        await _this.managePeers(thisNode, useCases)
      }, this.peerTimerInterval)

      // Note: Do not throw an error. This is a top-level function.
      success = false
    }

    return success
  }

  // Actively disconnect from blacklisted peers.
  // TODO: Rename this to whitelist, as it's not a whitelist function.
  async blacklist (thisNode, useCases) {
    let success = false

    try {
      // Disable the timer while processing is happening.
      clearInterval(this.checkBlacklistHandle)

      // this.statusLog('managePeers')
      // await useCases.thisNode.enforceBlacklist()
      await useCases.thisNode.enforceWhitelist()

      this.adapters.log.statusLog(1, 'Finished enforcing whitelist.')

      // Reinstate the timer interval
      const _this = this
      this.checkBlacklistHandle = setInterval(async function () {
        await _this.blacklist(thisNode, useCases)
      }, this.checkBlacklistInterval)

      success = true
    } catch (err) {
      // console.log()
      // this.adapters.log.statusLog('Error in timer-controller.js/blacklist(): ', err)
      //   2,
      //   'Error in timer-controller.js/blacklist(): ',
      //   err
      // )

      // Reinstate the timer interval
      const _this = this
      this.checkBlacklistHandle = setInterval(async function () {
        await _this.blacklist(thisNode, useCases)
      }, this.checkBlacklistInterval)

      // Note: Do not throw an error. This is a top-level function.
      success = false
    }

    return success
  }

  // This method looks for subnet peers that have the isCircuitRelay flag set,
  // but are not in the list of known relays. These represent potential relays
  // that thisNode could not connect to, but it might be able to with another
  // try.
  async searchForRelays (thisNode, useCases) {
    try {
      // console.log('Entering searchForRelays() Controller.')

      // Disable the timer while processing is happening.
      clearInterval(this.relaySearchHandle)

      // Get all the known relays.
      const knownRelays = thisNode.relayData.map(x => x.ipfsId)
      // console.log('knownRelays: ', knownRelays)

      // Get all subnet peers that have their circuit relay flag set.
      let relayPeers = thisNode.peerData.filter(x => x.data.isCircuitRelay)
      relayPeers = relayPeers.map(x => x.from)
      // console.log('relayPeers: ', relayPeers)

      // Diff the two arrays to get relays peers that are not in the relay list.
      const diffRelayPeers = relayPeers.filter(x => !knownRelays.includes(x))
      // console.log('diffRelayPeers: ', diffRelayPeers)

      // Try to connect to each potential relay.
      for (let i = 0; i < diffRelayPeers.length; i++) {
        const thisPeer = diffRelayPeers[i]
        await useCases.relays.addRelay(thisPeer, thisNode)
      }

      // Re-enable the interval timer for this function.
      const _this = this
      this.relaySearchHandle = setInterval(async function () {
        await _this.searchForRelays(thisNode, useCases)
      }, this.relaySearchInterval)

      return true
    } catch (err) {
      console.error('Error in timer-controller.js/searchForRelays(): ', err)
      // this.adapters.log.statusLog(
      //   2,
      //   'Error in timer-controller.js/searchForRelays(): ',
      //   err
      // )

      // Re-enable the interval timer for this function.
      const _this = this
      this.relaySearchHandle = setInterval(async function () {
        await _this.searchForRelays(thisNode, useCases)
      }, this.relaySearchInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }
}

export default TimerControllers
