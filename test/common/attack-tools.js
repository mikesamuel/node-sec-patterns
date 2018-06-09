'use strict'

/* eslint "no-console": off */

const { apply } = Reflect
const { defineProperty, hasOwnProperty } = Object

/**
 * Can be used to attack intrinsics.
 *
 * Executes action in a context where obj[key] = replacement(description, original, thisValue, args) and
 * cleans up after itself.
 */
function temporarilyReplace (obj, key, replacement, action) {
  const name = (obj && (obj.name || obj.constructor.name)) || ''
  const description = name ? `${name}.${key}` : key
  console.log(`Monkeypatching ${description}`)
  const original = obj[key]
  const originallyHad = apply(hasOwnProperty, obj, [ key ])
  try {
    if (originallyHad) {
      delete obj[key]
    }
    defineProperty(
      obj,
      key,
      {
        get () {
          return replacement(description, original, this)
        },
        set (x) {
          throw new Error(`Trying to set ${description}`)
        },
        enumerable: true,
        configurable: true
      })
  } catch (ignored) {
    // Reporting the error can help diagnosis but makes the log output
    // differ on different Node versions.
  }
  try {
    return action()
  } finally {
    console.log(`Monkeyunpatching ${description}`)
    try {
      delete obj[key]
      if (originallyHad) {
        obj[key] = original
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
