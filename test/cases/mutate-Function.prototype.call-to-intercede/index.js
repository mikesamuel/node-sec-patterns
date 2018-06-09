/* eslint array-element-newline: "off" */

'use strict'

const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')
const { temporarilyReplace } = require('../../common/attack-tools')
const { apply } = Reflect

authorize(require('./package.json'))

const intercepted = []

function gotcha (description, original, thisValue) {
  intercepted[intercepted.length] = description
  return function wrapper (...args) {
    return apply(original, this, args) // eslint-disable-line no-invalid-this
  }
}

// Just test that nothing happens where we could intercept.
function replaceAll (replacements, index, action) {
  if (index < replacements.length) {
    const [ obj, key ] = replacements[index]
    temporarilyReplace(
      obj, key, gotcha,
      () => {
        replaceAll(replacements, index + 1, action)
      })
  } else {
    action()
  }
}

replaceAll(
  [
    [ Array, 'isArray' ],
    [ Object, 'create' ],
    [ Object, 'defineProperties' ],
    [ Object, 'defineProperty' ],
    [ Object, 'getPrototypeOf' ],
    [ Object, 'keys' ],
    [ Object, 'freeze' ],
    [ Object.prototype, 'hasOwnProperty' ],
    [ global, 'Map' ],
    [ global, 'Set' ],
    [ global, 'WeakMap' ],
    [ global, 'WeakSet' ],
    [ Array.prototype, 'indexOf' ],
    [ Array.prototype, 'map' ],
    [ Array.prototype, 'forEach' ],
    [ Array.prototype, 'slice' ],
    [ Function.prototype, 'apply' ],
    // [ Function.prototype, 'call' ],
    [ Reflect, 'apply' ],
    [ RegExp.prototype, 'exec' ],
    [ RegExp.prototype, 'test' ],
    [ String.prototype, 'charAt' ],
    [ String.prototype, 'charCodeAt' ],
    [ String.prototype, 'indexOf' ],
    [ String.prototype, 'match' ],
    [ String.prototype, 'replace' ],
    [ String.prototype, 'split' ],
    [ String.prototype, 'toLowerCase' ],
    [ WeakSet.prototype, 'has' ],
    [ WeakSet.prototype, 'add' ]
  ],
  0,
  () => {
    try {
      require.keys.unboxStrict(
        Mintable.minterFor(MyMintable), () => true)
      console.log('Got My minter')
    } catch (ignored) {
      console.log('Denied My minter')
    }
    Mintable.verifierFor(MyMintable)(null)
  })

if (intercepted.length) {
  // Fail loudly.
  throw new Error(intercepted.join('\n'))
}
