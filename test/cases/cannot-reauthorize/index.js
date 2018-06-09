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

// a factory that produces dummy values.
function fallback (...atv) {
  // this function body left intentionally blank
}
const myMinter = require.keys.unbox(
  Mintable.minterFor(MyMintable),
  () => true,
  fallback)
if (fallback === myMinter) {
  console.log('Retrying with substitute')
} else {
  console.log('Got My minter')
}

const myInstance = myMinter()
console.log(`Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`Verified My ${myVerifier(myInstance)}`)
