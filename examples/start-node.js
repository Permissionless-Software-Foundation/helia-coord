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
  try {
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
  } catch(err) {
    console.error('Error in start(): ', err)
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', { reason, promise})

  if(reason instanceof AbortError || reason.code === 'ABORT_ERR') {
    console.error('AbortError encountered, not restarting the application.')
  } else {
    console.error('Critical error encountered, restarting the application...')
    process.exit(1)
  }
})

start()
