/*
  This app converts the memory-log.json file to a CSV file that can be imported
  into a spreadsheet for further analysis.
*/

import fs from 'fs'

async function jsonToCsv () {
  try {
    const log = JSON.parse(fs.readFileSync('./memory-log.json'))
    const memoryLogs = log.memoryLogs

    let outStr = 'timestampIso,timestampJs,heapTotal (MB),heapUsed (MB),external (MB),arrayBuffers (MB),rss (MB)\n'

    for (let i = 0; i < memoryLogs.length; i++) {
      const thisLog = memoryLogs[i]

      outStr += `${thisLog.timestampIso},${thisLog.timestampJs},${thisLog.heapTotal / 1000000},${thisLog.heapUsed / 1000000},${thisLog.external / 1000000},${thisLog.arrayBuffers / 1000000},${thisLog.rss / 1000000}\n`
    }

    await fs.writeFileSync('./memory-log.csv', outStr)
    console.log('JSON memory log converted to CSV file.')
  } catch (err) {
    console.error('Error in jsonToCsv(): ', err)
  }
}

jsonToCsv()
