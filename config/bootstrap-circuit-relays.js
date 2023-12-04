/*
  This library contains known circuit relays that new IPFS nodes can use to
  bootstrap themselves into the network and join the pubsub network.
*/
/* eslint camelcase: 0 */

const BOOTSTRAP_BROWSER_CRs = [
  // {
  //   // Based in USA, east coast.
  //   name: 'bchd.nl',
  //   multiaddr: '/dns4/bchd.nl/tcp/443/wss/p2p/12D3KooWRBhwfeP2Y9CDkFRBAZ1pmxUadH36TKuk3KtKm5XXP8mA',
  //   connected: false,
  //   ipfsId: '12D3KooWRBhwfeP2Y9CDkFRBAZ1pmxUadH36TKuk3KtKm5XXP8mA',
  //   isBootstrap: true
  // },
  // {
  //   name: 'ipfs-cr.fullstackslp.nl',
  //   multiaddr: '/dns4/ipfs-cr.fullstackslp.nl/tcp/443/wss/p2p/12D3KooWJyc54njjeZGbLew4D8u1ghrmZTTPyh3QpBF7dxtd3zGY',
  //   connected: false,
  //   ipfsId: '12D3KooWJyc54njjeZGbLew4D8u1ghrmZTTPyh3QpBF7dxtd3zGY',
  //   isBootstrap: true
  // }
]

const BOOTSTRAP_NODE_CRs = [
  // {
  //   name: 'psf1.tokentiger.com',
  //   multiaddr: '/ip4/137.184.93.145/tcp/8001/p2p/12D3KooWGMEKkdJfyZbwdH9EafZbRTtMn7FnhWPrE4MhRty2763g',
  //   connected: false,
  //   ipfsId: '12D3KooWGMEKkdJfyZbwdH9EafZbRTtMn7FnhWPrE4MhRty2763g',
  //   isBootstrap: true
  // },
  // {
  //   name: 'cr1.psfoundatoin.info',
  //   multiaddr: '/ip4/78.46.129.7/tcp/4001/p2p/12D3KooWFQ11GQ5NubsJGhYZ4X3wrAGimLevxfm6HPExCrMYhpSL',
  //   connected: false,
  //   ipfsId: '12D3KooWFQ11GQ5NubsJGhYZ4X3wrAGimLevxfm6HPExCrMYhpSL',
  //   isBootstrap: true
  // }
]

const bootstrapCircuitRelays = {
  browser: BOOTSTRAP_BROWSER_CRs,
  node: BOOTSTRAP_NODE_CRs
}

// module.exports = bootstrapCircuitRelays
export default bootstrapCircuitRelays
