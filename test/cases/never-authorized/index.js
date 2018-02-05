const { Mintable } = require('../../../index.js')

/* Intentionally skipping this step
  authorize(require('./package.json'))
*/

class MyMintable extends Mintable {}
Object.defineProperty(
  MyMintable,
  'contractKey',
  {
    value: 'MY',
    configurable: false,
    writable: false
  })

const myMinter = Mintable.minterFor(MyMintable)
console.log('Got My minter')

const myInstance = myMinter()
console.log(`Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`Verified My ${myVerifier(myInstance)}`)
