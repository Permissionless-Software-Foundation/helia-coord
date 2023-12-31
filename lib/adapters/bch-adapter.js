/*
  A top level library for Bitcoin Cash (BCH) handling. This library will
  encapsulate a lot of support libraries and contain BCH-specific methods.
*/

class BchAdapter {
  constructor (localConfig) {
    // Dependency Injection
    if (!localConfig.wallet) {
      throw new Error(
        'An instance of minimal-slp-wallet must be passed when instantiating the BCH adapter library.'
      )
    }

    this.bchjs = localConfig.wallet.bchjs
    this.mnemonic = localConfig.wallet.walletInfo.mnemonic
  }

  // Generate a BCH key pair and address. Returns an object with this information,
  // which can be used for payments and e2e encryption.
  // 12-word mnemonic string input is optional. Will generate a new wallet and
  // keypair if not provided. Will use the first address on the SLIP44
  // derivation path of 245 if a 12 word mnemonic is provided.
  async generateBchId () {
    try {
      // root seed buffer
      const rootSeed = await this.bchjs.Mnemonic.toSeed(this.mnemonic)

      const masterHDNode = this.bchjs.HDNode.fromSeed(rootSeed)

      const childNode = masterHDNode.derivePath("m/44'/245'/0'/0/0")

      const outObj = {}

      // Generate the cash and SLP addresses.
      outObj.cashAddress = this.bchjs.HDNode.toCashAddress(childNode)
      outObj.slpAddress = this.bchjs.SLP.Address.toSLPAddress(
        outObj.cashAddress
      )

      // No need to export the private key?
      // outObj.WIF = this.bchjs.HDNode.toWIF(childNode)

      // Export the public key as a hex string. This will be used for e2e
      // encryption.
      const pubKey = this.bchjs.HDNode.toPublicKey(childNode)
      outObj.publicKey = pubKey.toString('hex')

      return outObj
    } catch (err) {
      console.error('Error in bch-lib.js/generateBchId()')
      throw err
    }
  }

  async generatePrivateKey () {
    try {
      // root seed buffer
      const rootSeed = await this.bchjs.Mnemonic.toSeed(this.mnemonic)

      const masterHDNode = this.bchjs.HDNode.fromSeed(rootSeed)

      const childNode = masterHDNode.derivePath("m/44'/245'/0'/0/0")

      const privKey = this.bchjs.HDNode.toWIF(childNode)

      return privKey
    } catch (err) {
      console.error('Error in bch-lib.js/generatePrivateKey()')
      throw err
    }
  }
}

// module.exports = BchAdapter
export default BchAdapter
