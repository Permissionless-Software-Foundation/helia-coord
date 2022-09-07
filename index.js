/*
  A JS npm library for helping IPFS peers coordinate, find a common interest,
  and stay connected around that interest.

  See the specification document in the dev-docs directory.
*/

class IpfsCoord {
  constructor (localConfig = {}) {
    // Input Validation
    if (!localConfig.ipfs) {
      throw new Error(
        'An instance of IPFS must be passed when instantiating the ipfs-coord library.'
      )
    }
    if (!localConfig.wallet) {
      throw new Error(
        'An instance of minimal-slp-wallet must be passed when instantiating the ipfs-coord library.'
      )
    }
    this.type = localConfig.type
    if (!this.type) {
      throw new Error(
        'The type of IPFS node (browser or node.js) must be specified.'
      )
    }
  }
}

export default IpfsCoord
