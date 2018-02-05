#!/bin/bash

set -e

[ -n "$TMPDIR" ]
[ -d "$TMPDIR" ]

export PROJECT_NAME=$(node -e 'console.log(require("./package.json").name)')
export TMP_WORKSPACE="$TMPDIR"/"$PROJECT_NAME"-test-workspace

rm -rf "$TMP_WORKSPACE"
mkdir -p "$TMP_WORKSPACE"/package

# Repack, and check the contents
export TARBALL="$(npm pack)"

echo PACKAGE CONTENTS:
tar tfz "$TARBALL"

read -p 'Does the package contents look ok? (yes|no) ' PACKED_OK

echo "$PACKED_OK" | egrep -qi '^y'


# Test that it installs and tests run in isolation
cp "$TARBALL" "$TMP_WORKSPACE"/
cp -r test/ "$TMP_WORKSPACE"/package/test/
pushd "$TMP_WORKSPACE"
  tar xfz "$TARBALL" && (
    pushd "$TMP_WORKSPACE"/package
      npm install \
      && npm test \
      && nom run-script lint
    popd >& /dev/null
  )
popd >& /dev/null

rm "$TARBALL"


echo '
1. Figure out what kind of release it is:
*  patch
*  minor
*  major

Assuming it is in `$NPM_VERSION_BUMP`:
$ npm version "$NPM_VERSION_BUMP"


2. Get a 2FA nonce from the Google Authenticator app.
Assuming it is in `$OTP`:
$ npm publish --otp "$OTP"


3. Push the release label to GitHub.
$ git push origin master
'
