'use strict'

/**
 * @fileoverview
 * See notes on mintable types in ../README.md
 */

/* eslint no-warning-comments: "off" */

// Our security relies on some of these behaving as expected.
// In the README, we insist on loading early, and take that as given
// below.
const { isArray } = Array
const {
  create, defineProperties, defineProperty,
  getPrototypeOf, freeze, hasOwnProperty
} = Object
const { Error, TypeError, WeakSet } = global
const { apply } = Reflect
const arrayMap = Array.prototype.map
const mapGet = Map.prototype.get
const mapSet = Map.prototype.set
const weakSetAdd = WeakSet.prototype.add
const weakSetHas = WeakSet.prototype.has
const { indexOf, lastIndexOf, substring } = String.prototype

const { dedot, dirname, relpath } = require('module-keys/lib/relpath.js')
const { sep } = require('path')

// Module keys polyfill as per module-keys/babel
require('module-keys/cjs').polyfill(
  module, require, 'node_modules/node-sec-patterns/lib/mintable.js')

const { isPublicKey, publicKeySymbol } = require('module-keys')

/**
 * The path to the directory containing the first loading module
 * which should be the main file that loads us early using the
 * idiom above.
 */
const configRoot = module.parent && module.parent.parent &&
  module.parent.parent.filename
  ? dirname(module.parent.parent.filename)
  : __dirname

/** Maps contract keys to allowed minters. */
let whitelist = null
/**
 * What to do when a violation is detected.
 * One of ('enforce', 'report-only', 'permissive').
 */
let failureMode = 'permissive'

/**
 * Takes a configuration object with "mintableGrants" &| "mintableMode"
 */
function authorize (options) {
  if (whitelist) {
    throw new Error('Cannot re-initialize mintable')
  }

  const {
    mintable: {
      grants = {},
      mode
    } = {}
  } = options

  whitelist = create(null)
  try {
    failureMode = modeFromConfig(options, mode)

    for (const key in grants) {
      if (typeof key === 'string' && apply(hasOwnProperty, grants, [ key ])) {
        const val = grants[key]
        if (isArray(val)) {
          whitelist[key] = freeze(apply(arrayMap, val, [ (ele) => `${ele}` ]))
        }
      }
    }
  } finally {
    freeze(whitelist)
  }
}

function modeFromConfig (options, mode) {
  switch (mode) {
    case 'enforce': case 'report-only': case 'permissive':
      return mode
    case undefined: // eslint-disable-line no-undefined
      // If no configuration is present, we default to permissive
      // and rely on package.json linters to warn about the absence
      // of configuration when there is a non-dev dependency on
      // this module.
      return 'mintable' in options ? 'enforce' : 'permissive'
    default:
  }
  throw new Error(`invalid mintable mode ${mode}`)
}

/**
 * Base type for a type that can be created by a mint and verified by
 * a corresponding verifier.
 *
 * We can't prevent forgery via Object.create, but we can ensure that
 * only outputs of mint pass the corresponding verifier.
 */
class Mintable {
  constructor () {
    // Fail fast when creating an instance that will not pass
    // the verifier.

    // Our security does not rely on this check.
    // We try to catch common cases where an object is created
    // via `new` instead of the mint early so we can guide developers
    // to the mint.

    // Freezing the prototype would be nice, but is not required.
    // If the constructor property has been meddled with we will fail to find
    // the privates since the minter closes over the constructor to call.
    const concreteType = getPrototypeOf(this).constructor
    const privates = privatesPerMintableType.get(concreteType)
    if (!(privates && privates.mayConstruct())) {
      const { name } = concreteType
      throw new Error(
        `Construct instances via ${name}.mint(...), not via new ${name}`)
    }
  }
}

// Given
//   class SubType extends Mintable {}
// make sure that
//   Mintable.minterFor(SubType)
//   Mintable.verifierFor(SubType)
// evaluate to the minter and verifier for the given SubType.
//
// We could enable
//   const o = SubType.mint(...constructorArguments)
//   SubType.verify(o)  // -> true
// by defining the below as getters and using `this` as the concreteType
// but this would not provide a trusted path to the minter or verifier.
defineProperties(
  Mintable,
  {
    minterFor: {
      configurable: false,
      enumerable: true,
      // eslint-disable-next-line func-name-matching
      value: function getMinterFor (concreteType) {
        const allowedAccess = mayAccessMint(concreteType)
        const { mint } = privatesFor(concreteType)
        return require.keys.box(mint, allowedAccess)
      }
    },
    verifierFor: {
      configurable: false,
      enumerable: true,
      // eslint-disable-next-line func-name-matching
      value: function getVerifierFor (concreteType) {
        const { verify } = privatesFor(concreteType)
        return verify
      }
    }
  })

freeze(Mintable)

/** Privates per concrete type. */
const privatesPerMintableType = new WeakMap()

/** Stateful functions related to a particular contract type. */
function privatesFor (concreteType) {
  let privates = privatesPerMintableType.get(concreteType)
  if (!privates) {
    privatesPerMintableType.set(
      concreteType,
      privates = makePrivates(concreteType))
  }
  return privates
}

let hasWarnedAboutUninitializedUse = false
/**
 * Returns a public key predicate that allows access to the minter is disallowed in the current context.
 */
function mayAccessMint (concreteType) {
  if (failureMode === 'permissive') {
    if (!whitelist) {
      // Let users of minters who have not opted into whitelisting
      // know that that is a thing they could do.
      if (!hasWarnedAboutUninitializedUse) {
        // eslint-disable-next-line no-console
        console.warn('mintable: minter accessed before authorization')
      }
      hasWarnedAboutUninitializedUse = true
    }
    return () => true
  }
  const { contractKey } = concreteType

  const grantRecord = keysGranted(contractKey)

  function mayMint (pubKey) {
    let moduleId = dedot(pubKey.moduleIdentifier)
    if (grantRecord && isPublicKey(pubKey) && pubKey()) {
      const { grants, pubKeys } = grantRecord
      if (apply(weakSetHas, pubKeys, pubKey)) {
        // We've seen it before, great!
        return true
      }
      // Otherwise, see if its on the set of grants for which we have
      // yet to resolve keys.
      let relModule = relModuleId(moduleId)
      let onList = false
      do {
        if (arrayHad(grants, relModule)) {
          onList = true;
          break;
        }
        let lastSlash = apply(lastIndexOf, relModule, [ '/' ]);
        if (lastSlash) {
          relModule = apply(substring, relModule, [ 0, lastSlash ]);
        } else {
          break;
        }
      } while (relModule);

      if (onList) {
        let publicKey = null
        // Treat the exported publicKey as the source of truth.
        try {
          // eslint-disable-next-line global-require
          publicKey = require(`${configRoot}${sep}${moduleId}`)[publicKeySymbol]
        } catch (failedToRequire) {
          // deny
        }
        if (publicKey) {
          apply(weakSetAdd, pubKeys, [ publicKey ])
          if (publicKey === pubKey) {
            return true
          }
        }
      }
    }
    const message = `mintable: ${relModuleId(moduleId)} not allowed to mint ${contractKey}`
    console.warn(message) // eslint-disable-line no-console

    return failureMode === 'report-only'
  }

  return mayMint
}

// True iff arr has an element === elt and if so, removes that element.
// Does not preserve order when removing.
function arrayHad (arr, elt) {
  for (let i = 0, len = arr.length; i < len; ++i) {
    if (arr[i] === elt) {
      arr[i] = arr[len - 1]
      --arr.length
      return true
    }
  }
  return false
}

function relModuleId (moduleIdentifier) {
  let i = apply(lastIndexOf, moduleIdentifier, [ 'node_modules/', 0 ]);
  if (i === 0) {
    // node_modules/foo/bar/baz -> "foo/bar/baz"
    return apply(substring, moduleIdentifier, [ i + 13 ]);
  } else {
    return `./${moduleIdentifier}`;
  }
}

// Maps contract keys to { pubKeys: WeakSet<PublicKey>, grants: Array<string> }
// As a public key needs to be looked up, it is moved from grants to pubKeys.
const memoizedGrants = new Map()
const emptyGrants = freeze(Object.assign(
  create(null), { pubKeys: freeze(new WeakSet()), grants: freeze([]) }))

function keysGranted (contractKey) {
  if (whitelist && typeof contractKey === 'string') {
    let granted = apply(mapGet, memoizedGrants, [ contractKey ])
    if (granted) {
      return granted
    }
    if (apply(hasOwnProperty, whitelist, [ contractKey ])) {
      const grants = []
      const grantList = whitelist[contractKey]
      if (isArray(grantList)) {
        for (let i = 0, len = grantList.length; i < len; ++i) {
          if (apply(hasOwnProperty, grantList, [ i ])) {
            grants[grants.length] = `${grantList[i]}`
          }
        }
      }
      granted = { pubKeys: new WeakSet(), grants }
      apply(mapSet, memoizedGrants, [ contractKey, granted ])
      return granted
    }
  }
  return emptyGrants
}

/** Allocate a mint/verifier pair for a concrete type. */
function makePrivates (SubType) {
  const minted = new WeakSet()
  /** True iff o was created by mint. */
  const verify = freeze(
    (val) =>
      // eslint-disable-next-line no-implicit-coercion
      !!(val && typeof val === 'object' && apply(weakSetHas, minted, [ val ])))

  let mintingDepth = 0
  /** Called to create an instance that will pass the verifier. */
  const mint = freeze((...args) => {
    // This allows us to fail fast in the Mintable
    // constructor.  See comments there.
    const mintingDepthBefore = mintingDepth
    // Constructors can be reentrant
    mintingDepth += 1
    if (mintingDepth - mintingDepthBefore !== 1) {
      throw new TypeError('ulp > 1')
    }
    try {
      const newInstance = new SubType(...args)
      if (!(newInstance instanceof SubType)) {
        throw new TypeError(
          `Expected to mint a ${SubType.name} but constructed ${newInstance}`)
      }
      // This is what causes the verifier to pass.
      apply(weakSetAdd, minted, [ newInstance ])
      return newInstance
    } finally {
      mintingDepth = mintingDepthBefore
    }
  })
  const mayConstruct = freeze(() => mintingDepth !== 0)
  return freeze({ mint, verify, minted, mayConstruct })
}

module.exports = freeze({
  Mintable,
  authorize
})

// Pin this module in place, so that require('mintable').Mintable is
// a reliable path to the module that was just initialized.  This
// prevents an attacker from deleting the module, re-requiring it, and
// re-authorizing with their own configuration.
// We wait until the end so that if any other module initialization
// step fails, the module loader can remove it from the module cache.
void ((() => {
  const cacheEntry = require.cache[module.id]
  if (cacheEntry !== module) {
    throw new Error()
  }
  delete require.cache[module.id]
  defineProperty(
    require.cache,
    module.id,
    {
      writable: false,
      configurable: false,
      enumerable: true,
      value: cacheEntry
    })
})())
