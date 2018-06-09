const { Mintable, authorize } = require('../../../index.js')

authorize(require('./package.json'))

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
  deniedMinter = require.keys.unboxStrict(
    Mintable.minterFor(DeniedMintable), () => true)
  console.log('Got Denied minter')
} catch (ignored) {
  deniedMinter = require.keys.unbox(
    Mintable.minterFor(DeniedMintable), () => true,
    // Substitute a factory for non-verifying values
    (...argv) => Object.create(DeniedMintable))
}

const deniedInstance = deniedMinter()
console.log(`Minted Denied ${deniedInstance instanceof DeniedMintable}`)

const deniedVerifier = Mintable.verifierFor(DeniedMintable)
console.log(`Verified Denied ${deniedVerifier(deniedInstance)}`)
