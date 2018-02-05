const { Mintable, authorize } = require('../../../index.js')
authorize(require('./package.json'))

require('./dodgy-code')

const { MyMintable } = require('../../common/my-mintable')

const myMinter = Mintable.minterFor(MyMintable)
console.log('index: Got My minter')

const myInstance = myMinter()
console.log(`index: Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`index: Verified My ${myVerifier(myInstance)}`)
