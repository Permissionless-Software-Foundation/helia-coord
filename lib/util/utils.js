/*
  This utility library contains common functions that are used throughout
  the program.
*/

class Util {
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // This function takes an array of multiaddrs as input, and returns an array
  // filtered to remove any local network IP addresses.
  filterMultiaddrs (multiaddrs) {
    console.log('filterMultiaddrs() input: ', multiaddrs)
    try {
      const filteredMultiaddrs = multiaddrs.filter((x) => {
        if (x.includes('127.0.0.1')) return false
        if (x.includes('udp')) return false
        if (x.includes('quic')) return false
        if (x.includes('p2p-circuit')) return false
        if (x.includes('192.168.')) return false
        if (x.includes('172.1')) return false
        if (x.includes('/10.')) return false
        return true
      })

      return filteredMultiaddrs
    } catch (err) {
      console.error('Error in util.js/filterMultiaddrs()')
      throw err
    }
  }
}

export default Util
