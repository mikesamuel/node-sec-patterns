/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint "no-sync": off, "no-console": off */

const { expect } = require('chai')
const { describe, it } = require('mocha')
const babel = require('babel-core')
const childProcess = require('child_process')
const fileSystem = require('fs')
const path = require('path')

describe('mintable', () => {
  const projectRoot = path.dirname(__dirname)
  const casesDir = path.join(__dirname, 'cases')
  // Create a sibling dir for post processing, so that internal paths work.
  // We run babel over each file.
  const casesPpDir = path.join(__dirname, 'cases-babel-out')
  if (!fileSystem.existsSync(casesPpDir)) {
    fileSystem.mkdirSync(casesPpDir)
  }

  fileSystem.readdirSync(casesDir).forEach((caseName) => {
    const caseInputDir = path.join(casesDir, caseName)
    const caseDir = path.join(casesPpDir, caseName)
    if (!fileSystem.statSync(caseInputDir).isDirectory()) {
      return
    }

    try {
      fileSystem.accessSync(
        path.join(caseInputDir, 'package.json'),
        // eslint-disable-next-line no-bitwise
        fileSystem.constants.R_OK | fileSystem.constants.F_OK)
    } catch (noPackageJson) {
      return
    }

    // Run babel over JS files.
    function processDir (inDir, outDir) {
      if (!fileSystem.existsSync(outDir)) {
        fileSystem.mkdirSync(outDir)
      }
      fileSystem.readdirSync(inDir).forEach((baseName) => {
        const srcFile = path.join(inDir, baseName)
        const destFile = path.join(outDir, baseName)
        if (fileSystem.statSync(srcFile).isDirectory()) {
          processDir(srcFile, destFile)
        } else if (path.extname(baseName) === '.js') {
          const { code } = babel.transformFileSync(
            srcFile, {
              plugins: [ [ 'module-keys/babel', { rootDir: caseInputDir } ] ]
            })
          fileSystem.writeFileSync(destFile, code)
        } else {
          fileSystem.copyFileSync(srcFile, destFile)
        }
      })
    }
    processDir(caseInputDir, caseDir)

    it(caseName, function testCase () {
      // Since we touch the filesystem, these tests take a tad longer.
      // eslint-disable-next-line no-invalid-this, no-magic-numbers, no-inline-comments, line-comment-position
      this.slow(250) // ms
      // eslint-disable-next-line id-blacklist
      const { stdout, stderr, status, signal, error } =
        childProcess.spawnSync(
          process.execPath,
          [ path.join(caseDir, 'index.js') ],
          {
            shell: false,
            cwd: projectRoot,
            encoding: 'utf-8',
            // eslint-disable-next-line no-inline-comments
            timeout: 30000 /* ms */
          })
      function fileContentOrBlank (caseFile) {
        const caseFilePath = path.join(caseDir, caseFile)
        return fileSystem.existsSync(caseFilePath)
          ? fileSystem.readFileSync(caseFilePath, { 'encoding': 'utf-8' })
          : ''
      }

      const expectedStdout = fileContentOrBlank('want-stdout.txt')
      const expectedStderr = fileContentOrBlank('want-stderr.txt')

      if (stdout !== expectedStdout) {
        console.log(stdout)
      }
      if (stderr !== expectedStderr || status) {
        console.error(stderr)
      }

      expect({
        status,
        // eslint-disable-next-line id-blacklist
        error,
        signal,
        stdout,
        stderr
      }).to.deep.equal({
        status: 0,
        // eslint-disable-next-line id-blacklist, no-undefined
        error: undefined,
        signal: null,
        stdout: expectedStdout,
        stderr: expectedStderr
      })
    })
  })
})
