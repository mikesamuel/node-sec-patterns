const { Mintable, authorize } = require('../../../index.js')

authorize(require('./package.json'))

console.log('Finished authorize')

const { MTA, MTB } = require('types')

for (const Type of [ MTA, MTB, MTA ]) {
  console.group(`${Type.contractKey}`)
  try {
    let minter = null
    try {
      minter = require.keys.unboxStrict(Mintable.minterFor(Type), () => true)
      console.log('Got minter')
    } catch (exc) {
      console.log('Denied access to minter')
      continue
    }

    const instance = minter()
    console.log(`Minted ${instance instanceof Type}`)

    const verifier = Mintable.verifierFor(Type)
    console.log(`Verified ${verifier(instance)}`)
  } finally {
    console.groupEnd()
  }
}

console.group('index require foo')
require('foo')
console.groupEnd()

console.group('index require @bar/Bar')
require('@bar/Bar')
console.groupEnd()

console.group('index require baz')
require('baz')
console.groupEnd()
