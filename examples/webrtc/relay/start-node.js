/*
  1. Starts node.
  2. Waits to connect to Circuit Relay.
  3. Connects to remote node.
*/

// Global npm libraries
import SlpWallet from 'minimal-slp-wallet'
import { WebRTC } from '@multiformats/multiaddr-matcher'
import { multiaddr } from '@multiformats/multiaddr'
import delay from 'delay'

// Local libraries
// import IpfsCoord from '../index.js'
import CreateHeliaNode from './create-helia-node.js'

const relayMA = '/ip4/5.78.70.29/tcp/4001/p2p/12D3KooWNbQrdvEpzKuZ6rxkAF9vBH56HeGJ9drmrF9bhBJBa2Nq'
// const remoteMa = '12D3KooWDaKkuwzCNEWUEfjYSh7SCjqpEdx7PW4pAD5P5CFZQmqW'

async function start () {
  try {
    // Create an instance of bch-js and IPFS.
    const wallet = new SlpWallet()
    await wallet.walletInfoPromise

    const createHeliaNode = new CreateHeliaNode()
    const thisNode = await createHeliaNode.start()

    await thisNode.libp2p.dial(multiaddr(relayMA), {
      signal: AbortSignal.timeout(10000)
    })

    console.log('Connected to relay.')

    let webRTCMultiaddr

    // wait for the listener to make a reservation on the relay
    while (true) {
      webRTCMultiaddr = thisNode.libp2p.getMultiaddrs().find(ma => WebRTC.matches(ma))
      // const mas = thisNode.libp2p.getMultiaddrs()
      // console.log('Multiaddrs: ', mas)

      if (webRTCMultiaddr != null) {
        break
      }

      // try again later
      const now = new Date()
      console.log('Waiting for reservation...', now.toISOString())
      await delay(1000)
    }
    console.log('WebRTC multiaddr: ', webRTCMultiaddr)

    // Pass bch-js and IPFS to ipfs-coord when instantiating it.
    // const ipfsCoord = new IpfsCoord({
    //   ipfs,
    //   wallet,
    //   type: 'node.js',
    //   // type: 'browser'
    //   nodeType: 'external',
    //   debugLevel: 2
    // })

    // await ipfsCoord.start()
    // console.log('IPFS and the coordination library is ready.')
  } catch (err) {
    console.error('Error in start(): ', err)
  }
}

start()
