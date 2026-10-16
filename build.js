import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const templatePath = resolve(root, "src/template.html");
const canonical = resolve(root, "znecitelne.html");

if (!existsSync(templatePath)) {
  throw new Error("Missing HTML template: src/template.html");
}

const requiredModules = [
  "src/core/rules.js",
  "src/core/i18n.js",
  "src/core/onomastic.js",
  "src/core/morphology.js",
  "src/core/propagation.js",
  "src/core/detector.js",
  "src/formats/rtf.js",
  "src/formats/odt.js",
  "src/formats/xlsx.js",
  "src/formats/docx.js",
  "src/formats/pdf.js",
  "src/formats/ingest.js",
  "src/crypto/session.js",
  "src/worker/worker.js",
  "src/ui/movie.js",
  "src/ui/app.js"
];

for (const mod of requiredModules) {
  if (!existsSync(resolve(root, mod))) {
    throw new Error(`Missing source module: ${mod}`);
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

// 1. Sestavení distribučního balíčku z ES modulů (ADR-0009)
const bundleModules = [
  "src/core/rules.js",
  "src/core/i18n.js",
  "src/core/onomastic.js",
  "src/core/morphology.js",
  "src/core/propagation.js",
  "src/core/detector.js",
  "src/formats/rtf.js",
  "src/formats/odt.js",
  "src/formats/xlsx.js",
  "src/formats/docx.js",
  "src/formats/pdf.js",
  "src/formats/ingest.js",
  "src/crypto/session.js",
  "src/ui/movie.js",
  "src/ui/app.js"
];

function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*export\s*\{[\s\S]*?\}(?:\s*from\s*['"][^'"]+['"])?;?\s*$/gm, "")
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+async\s+function\s+/gm, "async function ")
    .replace(/^\s*export\s+function\s+/gm, "function ")
    .replace(/^\s*export\s+class\s+/gm, "class ")
    .replace(/^\s*export\s+const\s+/gm, "const ")
    .replace(/^\s*export\s+let\s+/gm, "let ")
    .replace(/^\s*export\s+var\s+/gm, "var ");
}

const bundledCode = bundleModules.map(modPath => {
  const content = readFileSync(resolve(root, modPath), "utf8");
  return `// --- Module: ${modPath} ---\n` + stripModuleSyntax(content).trim();
}).join("\n\n");

const template = readFileSync(templatePath, "utf8");
if (!template.includes("/* APP_BUNDLE */")) {
  throw new Error("Missing /* APP_BUNDLE */ placeholder in src/template.html");
}

const generatedHtml = template.replace("/* APP_BUNDLE */", bundledCode);
writeFileSync(canonical, generatedHtml, "utf8");

// 2. Validační kontroly vygenerovaného kanonického souboru
const requiredMarkers = [
  'const RULES = "',
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
  "Content-Security-Policy",
  "./lib/tesseract/lang/ces.traineddata.gz",
];

for (const marker of requiredMarkers) {
  if (!generatedHtml.includes(marker)) {
    throw new Error(`Canonical app is missing required marker: ${marker}`);
  }
}

console.log(`Canonical application built & validated: ${generatedHtml.length} characters`);
