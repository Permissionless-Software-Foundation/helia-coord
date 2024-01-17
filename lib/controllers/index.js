/*
  This is a top-level Controllers library. This library loads all other
  controller libraries.
*/

// const TimerControllers = require('./timer-controller')
import TimerControllers from './timer-controller.js'

class Controllers {
  constructor (localConfig = {}) {
    // Dependency Injection
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters required when instantiating Controllers'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of useCases required when instantiating Controllers'
      )
    }

    // Encapsulate dependencies
    this.timer = new TimerControllers(localConfig)
  }
}

export default Controllers
