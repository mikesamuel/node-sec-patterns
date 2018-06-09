'use strict'

const { Mintable, authorize } = require('../../../index.js')

authorize(require('./package.json'))

const { MyMintable } = require('../../common/my-mintable')
const { temporarilyReplace } = require('../../common/attack-tools')

const forgery = Object.create(MyMintable)

temporarilyReplace(
  WeakSet.prototype, 'has', () => (x) => true,
  () => {
    temporarilyReplace(
      Set.prototype, 'has', () => (x) => true,
      () => {
        const verifier = Mintable.verifierFor(MyMintable)
        console.log(`verified ${verifier(forgery)}`)
      })
  })
