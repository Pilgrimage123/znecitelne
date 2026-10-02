import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const canonical = resolve(root, "znecitelne.html");

if (!existsSync(canonical)) {
  throw new Error("Missing canonical application: znecitelne.html");
}

const html = readFileSync(canonical, "utf8");
const requiredMarkers = [
  'const RULES = "2026.10.02-ai27"',
  "quickMode",
  "fastApprove",
  "processAnalysis",
  "CHANGELOG",
  "startMovieTutorial",
  "./lib/pdf-lib.min.js",
  "./lib/pdf.min.js",
  "./lib/pdf.worker.min.js",
  "./lib/mammoth.browser.min.js",
  "./lib/xlsx.full.min.js",
  "./lib/tesseract.min.js",
  "./lib/tesseract/worker.min.js",
  "./lib/tesseract/core/tesseract-core.wasm.js",
  "./lib/tesseract/core/tesseract-core-simd.wasm.js",
  "./lib/tesseract/core/tesseract-core-lstm.wasm.js",
  "./lib/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "./lib/tesseract/core/tesseract-core.wasm",
  "./lib/tesseract/core/tesseract-core-simd.wasm",
  "./lib/tesseract/core/tesseract-core-lstm.wasm",
  "./lib/tesseract/core/tesseract-core-simd-lstm.wasm",
  "./lib/tesseract/lang/ces.traineddata.gz",
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Canonical app is missing required marker: ${marker}`);
  }
}

const requiredAssets = [
  "lib/fontkit.umd.min.js",
  "lib/pdf-lib.min.js",
  "lib/pdf.min.js",
  "lib/pdf.worker.min.js",
  "lib/mammoth.browser.min.js",
  "lib/xlsx.full.min.js",
  "lib/fflate.js",
  "lib/tesseract.min.js",
  "lib/tesseract/worker.min.js",
  "lib/tesseract/core/tesseract-core.wasm.js",
  "lib/tesseract/core/tesseract-core-simd.wasm.js",
  "lib/tesseract/core/tesseract-core-lstm.wasm.js",
  "lib/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "lib/tesseract/core/tesseract-core.wasm",
  "lib/tesseract/core/tesseract-core-simd.wasm",
  "lib/tesseract/core/tesseract-core-lstm.wasm",
  "lib/tesseract/core/tesseract-core-simd-lstm.wasm",
  "lib/tesseract/lang/ces.traineddata.gz",
];

for (const relative of requiredAssets) {
  if (!existsSync(resolve(root, relative))) {
    throw new Error(`Missing runtime asset: ${relative}`);
  }
}

if (existsSync(resolve(root, "index.html"))) {
  throw new Error(
    "index.html is obsolete. znecitelne.html is the only canonical application."
  );
}

console.log(`Canonical application validated: ${html.length} characters`);
