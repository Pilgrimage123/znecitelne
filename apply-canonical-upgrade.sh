#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f znecitelne.html ]]; then
  echo "Missing znecitelne.html" >&2
  exit 1
fi

cp znecitelne.html index.html
node build.js
node test.js

echo
echo "Canonical upgrade applied."
echo "Review: git diff -- index.html package.json README.md build.js test.js .github/workflows/quality.yml"
