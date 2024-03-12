/*
  This adapter library is concerned with interfacing with the GitHub Gist API.
  It's used to download a more easily maintained list of Circuit Relays
  operated by members of the PSF.
*/

import axios from 'axios'

class Gist {
  constructor (localConfig = {}) {
    this.axios = axios
  }

  // Retrieve a JSON file from a GitHub Gist
  async getCRList () {
    try {
      // Public CRs
      // https://gist.github.com/christroutner/048ea1a4b635a055c6bb63d48c373806
      const gistUrl =
        'https://api.github.com/gists/3d8a8d7ec3c5ba057f79270dc1126269'

      // Retrieve the gist from github.com.
      const result = await this.axios.get(gistUrl)
      // console.log('result.data: ', result.data)

      // Get the current content of the gist.
      const content = result.data.files['psf-helia-public-circuit-relays.json'].content
      // console.log('content: ', content)

      // Parse the JSON string into an Object.
      const object = JSON.parse(content)
      // console.log('object: ', object)

      // Keep the linter happy.
      const nullFunc = () => {}
      nullFunc(object)

      // return object
      return object
      // return {
      //   browser: [],
      //   node: []
      // }
    } catch (err) {
      console.error('Error attempting to download GitHub Gist of alternative servers.')
      throw err
    }
  }

  // Retrieve a JSON file from bootstrap.psfoundation.info
  async getCRList2 () {
    try {
      // Public CRs
      // https://gist.github.com/christroutner/048ea1a4b635a055c6bb63d48c373806
      const gistUrl =
        'https://bootstrap.psfoundation.info/bootstrap.json'

      // Retrieve the gist from github.com.
      const result = await this.axios.get(gistUrl)
      console.log('result.data: ', result.data)

      // Get the current content of the gist.
      const content = result.data
      // console.log('content: ', content)

      // Parse the JSON string into an Object.
      // const object = JSON.parse(content)
      const object = content
      // console.log('object: ', object)

      // Keep the linter happy.
      const nullFunc = () => {}
      nullFunc(object)

      // return object
      return object
      // return {
      //   browser: [],
      //   node: []
      // }
    } catch (err) {
      console.error('Error attempting to download GitHub Gist of alternative servers.')
      throw err
    }
  }
}

export default Gist
