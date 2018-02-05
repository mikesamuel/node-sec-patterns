'use strict'

const { Mintable } = require('../../index.js')

/** A sample mintable with contractKey MY */
class MyMintable extends Mintable {}
Object.defineProperty(
  MyMintable,
  'contractKey',
  {
    value: 'MY',
    configurable: false,
    writable: false
  })

module.exports = {
  MyMintable
}
