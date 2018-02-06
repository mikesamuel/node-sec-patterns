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
  } catch (exc) {
    console.log(`Monkeypatch failed: ${exc.toString()}`)
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
    } catch (exc) {
      console.log(`Monkey unpatch failed: ${exc.toString()}`)
    }
  }
}

module.exports = {
  temporarilyReplace
}
