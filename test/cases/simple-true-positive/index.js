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

const minter = Mintable.minterFor(MyMintable)
console.log('Got minter')

const instance = minter()
console.log(`Minted ${instance instanceof MyMintable}`)

const verifier = Mintable.verifierFor(MyMintable)
console.log(`Verified ${verifier(instance)}`)
