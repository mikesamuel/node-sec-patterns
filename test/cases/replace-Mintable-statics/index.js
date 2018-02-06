'use strict'

const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')

authorize(require('./package.json'))

try {
  Mintable.verifierFor = () => () => true
  console.log('Replaced verifierFor')
} catch (exc) {
  console.log('Failed to replace verifierFor')
}

const forgery = Object.create(MyMintable)

console.log('verified forgery ' + Mintable.verifierFor(MyMintable)(forgery))
