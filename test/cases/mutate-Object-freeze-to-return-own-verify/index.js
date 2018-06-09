const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')
const { temporarilyReplace } = require('../../common/attack-tools')

authorize(require('./package.json'))

temporarilyReplace(
  Object, 'freeze',
  () => (obj) => {
    if (typeof obj === 'function' && obj.length === 1) {
      return () => true
    }
    return obj
  },
  () => {
    try {
      require.keys.unboxStrict(Mintable.minterFor(MyMintable), () => true)
      console.log('Got My minter')
    } catch (ignored) {
      console.log('Denied My minter')
    }

    const verified = Mintable.verifierFor(MyMintable)(null)
    console.log(`Verified=${verified}`)
  })
