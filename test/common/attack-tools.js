'use strict'

/* eslint "no-console": off */

/**
 * Can be used to attack intrinsics.
 *
 * Executes action in a context where obj[key] = replacement and
 * cleans up after itself.
 */
function temporarilyReplace (obj, key, replacement, action) {
  console.log(`Monkeypatching ${key}`)
  const original = obj[key]
  const originallyHad = Object.hasOwnProperty.call(obj, key)
  try {
    obj[key] = replacement
  } catch (ignored) {
    // Reporting the error can help diagnosis but makes the log output
    // differ on different Node versions.
  }
  try {
    return action()
  } finally {
    console.log(`Monkeyunpatching ${key}`)
    try {
      if (originallyHad) {
        obj[key] = original
      } else {
        delete obj[key]
      }
    } catch (ignored) {
      // Reporting the error can help diagnosis but makes the log output
      // differ on different Node versions.
    }
  }
}

module.exports = {
  temporarilyReplace
}
