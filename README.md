# Node security design patterns

This project provides an NPM module that enables a variety of security
design patterns in Node.js code.

[![Build Status](https://travis-ci.org/mikesamuel/node-sec-patterns.svg?branch=master)](https://travis-ci.org/mikesamuel/node-sec-patterns)
[![Dependencies Status](https://david-dm.org/mikesamuel/node-sec-patterns/status.svg)](https://david-dm.org/mikesamuel/node-sec-patterns)
[![npm](https://img.shields.io/npm/v/node-sec-patterns.svg)](https://www.npmjs.com/package/node-sec-patterns)

## Goal
Make it easier for project teams to produce code that preserves
important security properties.

This module attempts to further that goal by enabling and encouraging
development practices that make it transparent what code has to
function correctly for a security property hold.

## Glossary

*  **Mutual Suspicion** - Two modules are mutually suspicious when
   they attempt to preserve their security properties without
   trusting that the other module functions correctly.
*  **Security Design Pattern** - Design patterns that make
   it easier to express and preserve correctness properties
   that are relevant to security.
*  **Minter** - A function that produces a value.
*  **Verifier** - A function that verifies that its input has
   a certain property.
*  **Restricted minter/verifier design pattern** - A design
   pattern where we restrict access to a minter to code that
   has been carefully reviewed.  If the review correctly concludes
   that all modules with access to the minter preserve a property,
   then verifying that a value has the property is as simple as
   a runtime type check.
*  **Security Transparency** - When a developer can check whether a
   security property holds without reading the vast majority of the
   project code, then the codebase is transparent with respect to that
   security property.  The first step towards security transparency is
   typically eliminating deep transitive dependencies from the code
   that might cause a failure.

## Getting Started
We assume that the app main file does something like the below
before any malicious code can run:
```js
require('node-sec-patterns').authorize(require('./package.json'))
```

The code below assumes that `package.json` contains the configuration
but it is the call to `authorize` that determines which configuration
is used.

Ideally this would be the first line in the main file.

Library code authors should not call `authorize`.  It should only
be called by the main module that integrates a production system
or by test code that tests a module's function under
various configurations.


## Configuration
If you `authorize`d the package as above, then configuration happens
via a `"mintable"` propery in your `package.json` like the below:

```json
{
  "name": "my-project",
  "...": "...",
  "mintable": {
    "mode": "enforce",
    "grants": {
      "contract-key-foo": [
        "foo",
        "lib/bar.js"
      ],
    }
  }
}
```

That configuration grants module `"foo"` access to the minter for any
mintable types whose contract key is `"contract-key-foo"`.
Minters convey the authority to create values of the mintable type
that pass the corresponding verifier.

If `"mintable": {...}` is not present, then it defaults to
`{ "mode": "permissive", "grants": {} }` so projects that do not
opt-into whitelisting will allow any code access to the minter.

If `"mintable"` is present but `"mode": ...` is not present,
it defaults to `"enforce"`.

If `"mode"` is `"permissive"` then all accesses are allowed.

If `"mode"` is `"report-only"` then all accesses are allowed.


## Defining a Mintable Type
Mintable types are subclasses of `class Mintable` exported by this module.
Mintable types must have a static property that specifies their contract
key.  This property should be const.

A simple way to do this is

```js
const { Mintable } = require('mintable')

class FooContractType extends Mintable {
  constructor () {
    super()
  }
}
Object.defineProperty(
  FooContractType,
  'contractKey',
  {
    value: 'contract-key-foo',
    configurable: false,
    writable: false
  })
```

## Example
If, for example, we wanted to reify the guarantee that a string of
HTML is safe to load into an HTML document in the organization's origin,
we might create a string wrapper like [safe contract types][].

```js
class SafeHtml extends Mintable {
  constructor (stringContent) {
    this.content = '' + stringContent
    Object.freeze(this)
  }
}
Object.defineProperty(
  SafeHtml,
  'contentKey',
  {
    value: 'goog.html.SafeHtml',
    configurable: false,
    writable: false
  })
```

## Creating Mintable values
Instead of using `new` just pass the same arguments to the minter.

```js
// The minter may be fetched once.
const fooMinter = Mintable.minterFor(FooContractType)

const newInstance =
  // instead of (new FooContractType(x, y))
  fooMinter(x, y)
```

## Degrading gracefully
Library code may want to mint a value when it has authority to do so
or degrade gracefully when it does not.

Trying to access `Mintable.minterFor(`*T*`)` when you do not have the
authority to mint values of type *T* will `throw` but you may pass a
fallback function for `Mintable.minterFor` to return when you are not
authorized.  Either way, users of your library who have not
whitelisted it will get a log warning to prompt them to consider
granting authority to your library.

```js
const fooMinter = Mintable.minterFor(
  FooContractType,
  fallbackValueMaker)
```

Values created by the fallback function will not pass the verifier.

## Verifying values
`Object.create` can forge values that pass `instanceof` checks, so
be sure to use the verifier to check whether a value was created
by the minter.

## Workflow - making security critical deep dependencies apparent
A package may allow some modules access to the minter but not others.
This enables workflows like:
1. A developer is using an API that grants special privileges to values
   that pass a mintable type's verifier.
2. They add a third-party dependency that either produces that type
   via a minter or has a dependency that does.
3. The developer adds a unit test which fails because the
   third-party dependency has not been allowed access to the minter.
4. The developer adds a whitelist entry to the package.json for their
   project granting access.
5. Later, they issue a pull request to pull their changes into master,
   and/or when a push master builds a release candidate, the change
   to `package.json` is reviewed with an eye to security, and the
   third-party module is scrutinized as security critical.

This allows a development team, collectively, to reify some security
guarantees in JavaScript objects and ensure that only a small,
checkable core of code can produce those values.

This module provides a mechanism by which:
*  A code reviewer who wants to check creation of a reified security
   guarantee can ignore the project's dependencies' dependencies'
   dependencies, etc.
*  Consumers of a reified security guarantee can efficiently verify
   that an approved creators created the object.
*  Project's can decide on a case-by-case basis which code can
   create which reified security guarantee.
*  A security specialist who wants to monitor changes to that policy
   over time needs to track `package.json` and the main file.

[safe contract types]: https://github.com/google/safe-html-types/blob/master/doc/safehtml-types.md#types
