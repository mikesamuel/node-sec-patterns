const { Mintable, authorize } = require('../../../index')

authorize(require('./package.json'))

const { MyMintable } = require('../../common/my-mintable')

require('@scoped/reviewed')
require('@scoped/unreviewed')
require('unscoped-reviewed')
require('unscoped-unreviewed')

console.log('In ./index')
try {
  Mintable.minterFor(MyMintable)
  console.log('pass')
} catch (exc) {
  console.log(exc.message)
}
