#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f znecitelne.html ]]; then
  echo "Missing znecitelne.html" >&2
  exit 1
fi

if [[ -f index.html ]]; then
  echo "Obsolete index.html detected. Remove it before applying the canonical upgrade." >&2
  exit 1
fi

node build.js
node test.js

echo
echo "Canonical upgrade validated."
echo "Canonical application: znecitelne.html"
echo "Review: git diff -- znecitelne.html package.json README.md build.js test.js .github/workflows/quality.yml"
