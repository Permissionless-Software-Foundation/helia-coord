/*
  Config file for storing global configuration settings.
*/

const config = {
  DEFAULT_COORDINATION_ROOM: 'psf-ipfs-coordination-003',
  BCH_COINJOIN_ROOM: 'bch-coinjoin-001',

  // Time between retrying private messages to a peer.
  TIME_BETWEEN_RETRIES: 5000,

  // Maximum amount of time in milliseconds to wait for a peer to respond to
  // an /about query, which is used to measure latency between peers.
  MAX_LATENCY: 20000
}

export default config
