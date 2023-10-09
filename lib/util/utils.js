/*
  This utility library contains common functions that are used throughout
  the program.
*/

class Util {
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default Util
