const path = require('path')
const vm = require('vm') // eslint-disable-line id-length

const { Mintable } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')

const script = new vm.Script(
  `
  function main () {
    let myMinter = null
    try {
      myMinter = require.keys.unboxStrict(
          Mintable.minterFor(MyMintable), () => true)
      console.log('B Got My minter')
    } catch (ignored) {
      myMinter = require.keys.unbox(
        Mintable.minterFor(MyMintable), () => true,
        // Substitute a factory for non-verifying values
        (...argv) => Object.create(MyMintable))
    }

    const myInstance = myMinter()
    console.log(\`B Minted My \${myInstance instanceof MyMintable}\`)

    const myVerifier = Mintable.verifierFor(MyMintable)
    console.log(\`B Verified My \${myVerifier(myInstance)}\`)
  }

  main()`,
  {
    filename: path.join(__dirname, 'index.js')
  })

script.runInNewContext({ Mintable, MyMintable, console, require })
