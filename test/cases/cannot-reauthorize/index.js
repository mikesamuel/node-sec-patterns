const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')

authorize(require('./package.json'))

try {
  authorize({
    mintable: {
      grants: {
        MY: [ './index.js' ]
      }
    }
  })
  console.log('reauthorized')
} catch (ignored) {
  console.log('reauthorization failed')
}

let myMinter = null
try {
  myMinter = Mintable.minterFor(MyMintable)
  console.log('Got My minter')
} catch (ignored) {
  console.log('Retrying with substitute')
  myMinter = Mintable.minterFor(
    MyMintable,
    // Substitute a factory that produces dummy values.
    (...argv) => ({}))
}

const myInstance = myMinter()
console.log(`Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`Verified My ${myVerifier(myInstance)}`)
