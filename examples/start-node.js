/*
  This is an example of how to start a Helia IPFS node with node.js and attach
  the helia-coord library to it.
*/

// Global npm libraries
import SlpWallet from 'minimal-slp-wallet'

// Local libraries
import IpfsCoord from '../index.js'
import CreateHeliaNode from './create-helia-node.js'

async function start () {
  // Create an instance of bch-js and IPFS.
  const wallet = new SlpWallet()
  await wallet.walletInfoPromise

  const createHeliaNode = new CreateHeliaNode()
  const ipfs = await createHeliaNode.start()

  // Pass bch-js and IPFS to ipfs-coord when instantiating it.
  const ipfsCoord = new IpfsCoord({
    ipfs,
    wallet,
    type: 'node.js',
    // type: 'browser'
    nodeType: 'external',
    debugLevel: 2
  })

  await ipfsCoord.start()
  console.log('IPFS and the coordination library is ready.')

  // Periodically display peer data.
  setInterval(function() {
    const peerData = ipfsCoord.thisNode.peerData
    console.log('peerData: ', peerData)
  }, 60000 * 2)
}
start()
