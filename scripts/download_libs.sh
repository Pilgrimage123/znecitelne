#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB="${ROOT}/lib"
OCR="${LIB}/tesseract"
CORE="${OCR}/core"
LANG="${OCR}/lang"

mkdir -p "${LIB}" "${OCR}" "${CORE}" "${LANG}"

download() {
  local url="$1" dest="$2"
  echo "GET ${url}"
  curl --fail --location --retry 3 --retry-all-errors --silent --show-error --output "${dest}.tmp" "${url}"
  mv "${dest}.tmp" "${dest}"
}

download "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js" "${LIB}/fontkit.umd.min.js"
download "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js" "${LIB}/pdf-lib.min.js"
download "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js" "${LIB}/pdf.min.js"
download "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js" "${LIB}/pdf.worker.min.js"
download "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js" "${LIB}/mammoth.browser.min.js"
download "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" "${LIB}/xlsx.full.min.js"
download "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js" "${LIB}/fflate.js"
download "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js" "${LIB}/tesseract.min.js"
download "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js" "${OCR}/worker.min.js"

for f in tesseract-core.wasm.js tesseract-core-simd.wasm.js tesseract-core-lstm.wasm.js tesseract-core-simd-lstm.wasm.js; do
  download "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/${f}" "${CORE}/${f}"
done

for f in tesseract-core.wasm tesseract-core-simd.wasm tesseract-core-lstm.wasm tesseract-core-simd-lstm.wasm; do
  download "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/${f}" "${CORE}/${f}"
done

download "https://tessdata.projectnaptha.com/4.0.0/ces.traineddata.gz" "${LANG}/ces.traineddata.gz"

echo "Offline browser assets downloaded to ${LIB}"
