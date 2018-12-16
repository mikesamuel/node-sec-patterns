const { Mintable, authorize } = require('../../../index.js')

authorize(require('./package.json'))

class MyMintable extends Mintable {}
Object.defineProperty(
  MyMintable,
  'contractKey',
  {
    value: 'CK',
    configurable: false,
    writable: false
  })

// Make sure we're set up to create things the normal way.
const minter = require.moduleKeys.unboxStrict(
  Mintable.minterFor(MyMintable), () => true)
console.log('Got minter')

const instance = minter()
console.log(`Minted ${instance instanceof MyMintable}`)

const verifier = Mintable.verifierFor(MyMintable)
console.log(`Verified ${verifier(instance)}`)

// Check that creation via new logs.
console.log('Trying new')
let newed = null
try {
  newed = new MyMintable()
} catch (exc) {
  console.log(`(new MyMintable) failed with ${exc.toString()}`)
}
console.log(`Verified new ${verifier(newed)}`)

// Check that creation via [[Call]] of constructor doesn't fail
// silently
console.log('Trying MyMintable')
let constructed = null
try {
  constructed = MyMintable()
} catch (exc) {
  console.log(`(MyMintable) failed with ${exc.toString()}`)
}
console.log(`Verified constructed ${verifier(constructed)}`)

// Unfortunately this fails silently.
console.log('Trying Object.create')
const created = Object.create(MyMintable)
console.log(`Verified created ${verifier(created)}`)
