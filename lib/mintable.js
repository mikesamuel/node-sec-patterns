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
const { dirname, relative } = require('path')
const { apply } = Function.prototype
const arrayMap = Array.prototype.map
const regExprExec = RegExp.prototype.exec
const stringReplace = String.prototype.replace
const stringSplit = String.prototype.split
const weakSetHas = WeakSet.prototype.has
const weakSetAdd = WeakSet.prototype.add

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
      if (typeof key === 'string' && hasOwnProperty.call(grants, key)) {
        const val = grants[key]
        if (isArray(val)) {
          whitelist[key] = freeze(arrayMap.call(val, (ele) => `${ele}`))
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
      value: function getMinterFor (concreteType, substitute) {
        const [ ok, message ] = callerMayAccessMint(concreteType)

        if (!ok) {
          console.warn(message) // eslint-disable-line no-console

          if (failureMode === 'report-only') {
            // fallthrough to below
          } else if (typeof substitute === 'function') {
            // The caller has passed in a substitute to use if
            // access is denied.
            return substitute
          } else {
            throw new Error(message)
          }
        }

        const { mint } = privatesFor(concreteType)
        return mint
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

// The following functions have to function correctly for verifiers to
// properly only verify proper outputs of a minter.
//
// We can rely on calls to local definitions resolving correctly but not
// member methods, so everywhere we access a method defined on a prototype,
// we instead use the reflective call operator.
// For this to work, we assume two things:
// 1. That all closely held objects are in the current realm which is
//    true by construction.
// 2. That we have a reliable path to Function.prototype.call.
//
// The latter may not be true if Function.prototype were monkeypatched
// after module load.  Unfortunately, even if we froze
// Function.prototype.call, we would still have to deal with an own "call"
// property added to methods that we close-over at the top of this module.
//
// Instead we lock down Function.prototype.{apply,call} and use double
// reflection.
//
// We also need to lock down RegExp and String to some degree.  Many of
// the methods defined on String like split delegate to methods on RegExp
// and vice-versa.
// We don't prevent all monkey patching, but we do prevent modification of
// intrinsic methods.
void ((() => {
  const getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors
    ? Object.getOwnPropertyDescriptors
    // Minimal polyfill for node@6
    : (obj) => {
      const out = Object.create(null)
      Object.getOwnPropertyNames(obj).forEach(
        (name) => {
          out[name] = Object.getOwnPropertyDescriptor(obj, name)
        })
      return out
    }
  [ Function, RegExp, String ].forEach((builtin) => {
    const proto = builtin.prototype
    const descriptors = getOwnPropertyDescriptors(proto)
    for (const propertyName in descriptors) {
      if (!Object.hasOwnProperty.call(descriptors, propertyName)) {
        continue
      }
      const descriptor = descriptors[propertyName]
      if (descriptor.configurable) {
        descriptor.configurable = false
        if ('writable' in descriptor) {
          descriptor.writable = false
        }
      } else if (descriptor.writable) {
        throw new Error(
          `Cannot lock down ${builtin.name}.prototype.${propertyName}`)
      }
    }
    defineProperties(proto, descriptors)
  })
})())
/** A reliable way to call an external method */
function callExt (method, thisValue, ...args) {
  return apply.call(method, thisValue, args)
}

// We further establish a trusted path to regexp methods by freezing
// the ones we use internally.
const STACK_TRACE_INTROSPECT_RE = freeze(/\r?\n {4}at /)
const MODULE_PATH_RE = freeze(/^[^(]*\((.*?):\d+:\d+\)$/)
const EXTERNAL_MODULE_RE = freeze(
  /^node_modules[/\\](?:(@[^/\\]+)[/\\])?([^/\\]+)/)
const ALL_BACKSLASH_RE = /[\\]/g

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
 * True if access to the minter is disallowed in the current context.
 */
function callerMayAccessMint (concreteType) {
  // We use .call here instead of calling methods directly to make
  // us resistant to monkey patching.
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
    return [ true, null ]
  }
  const { contractKey } = concreteType
  const relModule = getCallerModuleName()

  if (isGranted(contractKey, relModule)) {
    return [ true, null ]
  }
  const message = `mintable: ${relModule} not allowed to mint ${contractKey}`
  return [ false, message ]
}

function getCallerModuleName () {
  // TODO: should we temporarily downgrade Errors.stackTraceLimit to 3
  // to make this more efficient?
  // TODO: test with Errors.stackTraceLimit < 2, and '' in grants.
  let stack = null
  try {
    // Reliably produce an Error with a stack and with a message
    // that is not attacker controlled.
    void ((null).x)
  } catch (typeError) {
    // Manufacture a stack trace with a known message
    stack = callExt(stringSplit, typeError.stack, STACK_TRACE_INTROSPECT_RE)
  }

  // 0: message, 1: this method, 2: callerMayAccessMint,
  // 3: getter for minter, 4: caller
  const [ , , , , callerStackEntry ] = stack
  const relModule = callExt(
    stringReplace,
    relative(
      configRoot,
      // An attacker might use a function name with parentheses to
      // create an ambiguity here, but that should fail safe.
      // They could insert more cruft before the path, but that would
      // not allow them to match a whitelist entry without parentheses.
      callExt(regExprExec, MODULE_PATH_RE, callerStackEntry)[1]),
    // Normalize '\\' to '/' on Windows?
    ALL_BACKSLASH_RE, '/')
  // If there is a node_modules path at the start, strip off
  // everything past [@scope/][modulename] since the internal
  // source structure is an implementation detail.
  const externalModuleMatch = callExt(
    regExprExec, EXTERNAL_MODULE_RE, relModule)
  if (externalModuleMatch) {
    const [ , scope, name ] = externalModuleMatch
    return scope ? `${scope}/${name}` : name
  }
  return relModule[0] !== '/' && relModule[0] !== '.'
    ? `./${relModule}`
    : relModule
}

function isGranted (contractKey, relModule) {
  let grants = null
  if (whitelist && typeof contractKey === 'string' &&
      callExt(hasOwnProperty, whitelist, contractKey)) {
    grants = whitelist[contractKey]
  }
  if (isArray(grants)) {
    for (let i = 0, len = grants.length; i < len; ++i) {
      if (relModule === grants[i] && callExt(hasOwnProperty, grants, i)) {
        // Passed
        return true
      }
    }
  }
  return false
}

/** Allocate a mint/verifier pair for a concrete type. */
function makePrivates (SubType) {
  const minted = new WeakSet()
  /** True iff o was created by mint. */
  const verify = freeze(
    (val) =>
      // eslint-disable-next-line no-implicit-coercion
      !!(val && typeof val === 'object' && callExt(weakSetHas, minted, val)))

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
      callExt(weakSetAdd, minted, newInstance)
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
