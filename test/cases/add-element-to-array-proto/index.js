const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')
const { temporarilyReplace } = require('../../common/attack-tools')

authorize(require('./package.json'))

// Make the grants array look like it has an entry at element 0
temporarilyReplace(Array.prototype, 0, () => 'index.js', () => {
  try {
    require.keys.unboxStrict(Mintable.minterFor(MyMintable), () => true)
    console.log('Got My minter')
  } catch (ignored) {
    console.log('Denied My minter')
  }
})
