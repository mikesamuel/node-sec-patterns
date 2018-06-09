'use strict'

// Delete all trace from the module cache
void ([ '../../../index.js', '../../../lib/mintable.js' ].forEach((path) => {
  const absPath = require.resolve(path)
  if (!(absPath in require.cache)) {
    throw new Error(`${absPath} uncached`)
  }
  try {
    delete require.cache[absPath]
  } catch (ignored) {
    // Don't dump the error since it includes absolute path info
    console.error(`Failed to delete cache entry for ${path}`)
  }
}))

const { Mintable, authorize } = require('../../../index.js')

try {
  authorize({})
} catch (exc) {
  console.error(exc.toString())
}

const { MyMintable } = require('../../common/my-mintable')

let myMinter = null
try {
  myMinter = require.keys.unboxStrict(Mintable.minterFor(MyMintable), () => true)
  console.log('dodgy-code: Got My minter')
} catch (ignored) {
  myMinter = () => Object.create(MyMintable)
}

const myInstance = myMinter()
console.log(`dodgy-code: Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`dodgy-code: Verified My ${myVerifier(myInstance)}`)
