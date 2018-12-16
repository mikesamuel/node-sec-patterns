const { Mintable, authorize } = require('../../../index.js')

authorize(require('./package.json'))

class MyMintable extends Mintable {}
Object.defineProperty(
  MyMintable,
  'contractKey',
  {
    value: 'MY',
    configurable: false,
    writable: false
  })

const myMinter = require.moduleKeys.unboxStrict(
  Mintable.minterFor(MyMintable), () => true)
console.log('Got My minter')

const myInstance = myMinter()
console.log(`Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`Verified My ${myVerifier(myInstance)}`)
