import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const canonical = resolve(root, "znecitelne.html");
const entry = resolve(root, "index.html");

if (!existsSync(canonical)) {
  throw new Error("Missing canonical application: znecitelne.html");
}

const html = readFileSync(canonical, "utf8");

const requiredMarkers = [
  'const RULES = "2026.10.01-ai24"',
  "quickMode",
  "fastApprove",
  "processAnalysis",
  "CHANGELOG",
  "startMovieTutorial",
  "./lib/pdf-lib.min.js",
  "./lib/pdf.min.js",
  "./lib/mammoth.browser.min.js",
  "./lib/xlsx.full.min.js",
  "./lib/tesseract.min.js",
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Canonical app is missing required marker: ${marker}`);
  }
}

copyFileSync(canonical, entry);

const output = statSync(entry).size;
const source = statSync(canonical).size;
if (output !== source) {
  throw new Error("Generated entry point differs from canonical application.");
}

console.log(`Built canonical application: ${output} bytes`);
