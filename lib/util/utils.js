/*
  This utility library contains common functions that are used throughout
  the program.
*/

// Global npm libraries
import { multiaddr } from '@multiformats/multiaddr'

class Util {
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // This function takes an array of multiaddrs as input, and returns an array
  // filtered to remove any local network IP addresses.
  filterMultiaddrs (multiaddrs) {
    // console.log('filterMultiaddrs() input: ', multiaddrs)
    try {
      const filteredMultiaddrs = multiaddrs.filter((x) => {
        if (x.includes('127.0.0.1')) return false
        if (x.includes('udp')) return false
        if (x.includes('quic')) return false
        if (x.includes('p2p-circuit')) return false
        if (x.includes('192.168.')) return false
        if (x.includes('172.1') || x.includes('172.2') || x.includes('172.3')) return false
        if (x.includes('/10.')) return false
        return true
      })

      return filteredMultiaddrs
    } catch (err) {
      console.error('Error in util.js/filterMultiaddrs()')
      throw err
    }
  }

  // Parse a comma-delimited list of multiaddrs, as supplied by the operator
  // through the ANNOUNCE_MULTIADDRS environment variable. Nodes behind a
  // NAT/firewall, or behind a proxy such as a wireguard tunnel, can not have
  // their public address auto-detected, so the operator lists the addresses
  // that should be added to the announcement object.
  //
  // Returns an empty array when the value is unset or blank, so existing
  // deployments are unaffected.
  //
  // Throws on a malformed entry. A bad multiaddr would otherwise be published
  // to the network and silently fail to connect, long after startup.
  parseMultiaddrList (envValue) {
    if (!envValue || !envValue.trim()) return []

    const entries = envValue
      .split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)

    for (const entry of entries) {
      try {
        multiaddr(entry)
      } catch (err) {
        throw new Error(
          `Invalid multiaddr in ANNOUNCE_MULTIADDRS: '${entry}'. Each entry must be a full multiaddr, e.g. /ip4/1.2.3.4/tcp/4001/p2p/12D3KooW...`
        )
      }
    }

    return entries
  }
}

export default Util
