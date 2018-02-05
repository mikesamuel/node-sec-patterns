const { Mintable, authorize } = require('../../../index.js')

authorize(require('./package.json'))

class OkMintable extends Mintable {}
Object.defineProperty(
  OkMintable,
  'contractKey',
  {
    value: 'OK',
    configurable: false,
    writable: false
  })

const okMinter = Mintable.minterFor(OkMintable)
console.log('Got Ok minter')

const okInstance = okMinter()
console.log(`Minted Ok ${okInstance instanceof OkMintable}`)

const okVerifier = Mintable.verifierFor(OkMintable)
console.log(`Verified Ok ${okVerifier(okInstance)}`)

class DeniedMintable extends Mintable {}
Object.defineProperty(
  DeniedMintable,
  'contractKey',
  {
    value: 'DENIED',
    configurable: false,
    writable: false
  })

let deniedMinter = null
try {
  deniedMinter = Mintable.minterFor(DeniedMintable)
  console.log('Got Denied minter')
} catch (ignored) {
  deniedMinter = Mintable.minterFor(
    DeniedMintable,
    // Substitute a factory for non-verifying values
    (...argv) => Object.create(DeniedMintable))
}

const deniedInstance = deniedMinter()
console.log(`Minted Denied ${deniedInstance instanceof DeniedMintable}`)

const deniedVerifier = Mintable.verifierFor(DeniedMintable)
console.log(`Verified Denied ${deniedVerifier(deniedInstance)}`)
