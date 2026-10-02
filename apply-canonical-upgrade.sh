#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f znecitelne.html ]]; then
  echo "Missing znecitelne.html" >&2
  exit 1
fi

if [[ -e index.html ]]; then
  echo "index.html is obsolete and must be removed; znecitelne.html is canonical." >&2
  exit 1
fi

node build.js
node test.js

echo
echo "Canonical application validated."
echo "No secondary index.html entry point is generated."
