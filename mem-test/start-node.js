/*
  This is an example of how to start a Helia IPFS node with node.js and attach
  the helia-coord library to it.
*/

// Global npm libraries
import SlpWallet from 'minimal-slp-wallet'
import { memoryUsage } from 'node:process'
import fs from 'fs'

// Local libraries
import IpfsCoord from '../../index.js'
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

  setInterval(async function () {
    try {
      const memoryLog = JSON.parse(fs.readFileSync('./memory-log.json'))
      // console.log('memoryLog: ', memoryLog)

      const memory = memoryUsage()

      const now = new Date()
      memory.timestampIso = now.toISOString()
      memory.timestampLocal = now.toLocaleString()
      memory.timestampJs = now.getTime()

      memoryLog.memoryLogs.push(memory)

      await fs.writeFileSync('./memory-log.json', JSON.stringify(memoryLog, null, 2))
      console.log(`Memory logged at ${now.toLocaleString()}`)
    } catch (err) {
      console.error('Error trying to measure memory: ', err)
    }
  }, 60000)
}
start()
