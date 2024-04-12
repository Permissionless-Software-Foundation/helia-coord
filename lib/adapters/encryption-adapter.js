/*
  A library for end-to-end encryption (e2ee). This will largely be a wrapper
  for existing encryption libraries.
*/

import BchEncrypt from 'bch-encrypt-lib'

class EncryptionAdapter {
  constructor (localConfig = {}) {
    // Dependency injection
    this.bch = localConfig.bch
    if (!this.bch) {
      throw new Error(
        'Must pass in an instance of bch Adapter when instantiating the encryption Adapter library.'
      )
    }
    this.log = localConfig.log
    if (!this.log) {
      throw new Error(
        'Must pass in an instance of log Adapter when instantiating the encryption Adapter library.'
      )
    }

    // Encapsulate dependencies
    this.bchjs = this.bch.bchjs // Copy of bch-js
    this.bchEncrypt = new BchEncrypt({ bchjs: this.bchjs })
  }

  // Decrypt incoming messages on the pubsub channel for this node.
  async decryptMsg (msg, sender) {
    try {
      // console.log('decryptMsg msg: ', msg)

      const privKey = await this.bch.generatePrivateKey()
      // console.log(`privKey: ${privKey}`)

      const decryptedHexStr = await this.bchEncrypt.encryption.decryptFile(
        privKey,
        msg
      )
      // console.log(`decryptedHexStr ${decryptedHexStr}`)

      const decryptedBuff = Buffer.from(decryptedHexStr, 'hex')

      const decryptedStr = decryptedBuff.toString()
      // console.log(`decryptedStr: ${decryptedStr}`)

      return decryptedStr
    } catch (err) {
      // Exit quietly if the issue is a 'Bad MAC'. This seems to be a startup
      // issue.
      if (err.message.includes('Bad MAC')) {
        this.log.statusLog(
          2,
          `Bad MAC. Could not decrypt message. Peer ${sender} may have stale encryption data for this node.`
        )

        return false
      }

      console.error('Error in decryptMsg()')
      throw err
    }
  }

  // Returns an encrypted hexidecimal string derived from an input message
  // (string), encrypted with the public key of a peer.
  async encryptMsg (peer, msg) {
    try {
      // console.log('peer: ', peer)

      if (!peer || !peer.data) {
        throw new Error('Peer public key is not available yet.')
      }

      const pubKey = peer.data.encryptPubKey
      // console.log('msg to encrypt: ', msg)
      // console.log(`Encrypting with public key: ${pubKey}`)

      const msgBuf = Buffer.from(msg, 'utf8').toString('hex')

      const encryptedHexStr = await this.bchEncrypt.encryption.encryptFile(
        pubKey,
        msgBuf
      )

      return encryptedHexStr
    } catch (err) {
      console.error('Error in encryption.js/encryptMsg()')
      throw err
    }
  }
}

// module.exports = EncryptionAdapter
export default EncryptionAdapter
