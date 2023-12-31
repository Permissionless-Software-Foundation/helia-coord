/*
  This example shows how to start an IPFS node, using ipfs-coord, with the
  IPFS node running as an external node that can be controlled via the
  ipfs-http-client library.

  Designed to use IPFS running in this Docker container:
  https://github.com/christroutner/docker-ipfs
*/

// const IPFS = require('@chris.troutner/ipfs')
import { create } from 'ipfs-http-client'
// const IPFS = require('/home/trout/work/personal/js-ipfs/packages/ipfs')
// const BCHJS = require('@psf/bch-js')
import SlpWallet from 'minimal-slp-wallet'
// const IpfsCoord = require('ipfs-coord')
import IpfsCoord from '../index.js'
import http from 'http'

// Configuration for external IPFS node.
const ipfsOptions = {
  protocol: 'http',
  host: 'localhost',
  port: 5001,
  agent: http.Agent({ keepAlive: true, maxSockets: 100 })
}

async function start () {
  // Create an instance of bch-js and IPFS.
  // const bchjs = new BCHJS()
  const wallet = new SlpWallet()
  await wallet.walletInfoPromise
  const ipfs = await create(ipfsOptions)

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

  // Used for debugging
  // setTimeout(async function () {
  //   const thisNode = ipfsCoord.thisNode
  //   console.log('\nthisNode: ', thisNode)
  //   // console.log(
  //   //   `thisNode.peerData: ${JSON.stringify(thisNode.peerData, null, 2)}`
  //   // )
  // }, 20000)
}
start()
