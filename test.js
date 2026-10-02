import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const canonical = readFileSync("znecitelne.html", "utf8");

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(canonical.startsWith("<!DOCTYPE html>"), "canonical app must be a complete HTML document");
check(canonical.includes('lang="cs"'), "canonical app must declare Czech as the base language");
check(canonical.includes("const CHANGELOG = ["), "canonical app must expose its changelog");
check(canonical.includes("const RULES = "), "canonical app must declare its detector ruleset");
check(canonical.includes("quickMode"), "Quick mode must remain present");
check(canonical.includes("fastApprove"), "Fast-Approve mode must remain present");
check(canonical.includes("processAnalysis"), "Process analysis must remain present");
check(canonical.includes("startMovieTutorial"), "Movie tutorial must remain present");
check(canonical.includes("./lib/"), "Browser libraries must have a local/offline path");
check(!existsSync("index.html"), "obsolete index.html must not exist");

for (const asset of [
  "./lib/fontkit.umd.min.js",
  "./lib/pdf-lib.min.js",
  "./lib/pdf.min.js",
  "./lib/mammoth.browser.min.js",
  "./lib/xlsx.full.min.js",
  "./lib/fflate.js",
  "./lib/tesseract.min.js",
  "./lib/pdf.worker.min.js",
]) {
  check(canonical.includes(asset), `missing local library reference: ${asset}`);
  check(
    existsSync(resolve(".", asset)),
    `missing local runtime asset: ${asset}`
  );
}

check(
  !/const candidates = ["index\\.html"/.test(canonical),
  "HTML self-export must not prefer obsolete index.html"
);

check(
  !canonical.includes("cp znecitelne.html index.html"),
  "canonical application must not describe index.html generation"
);

check(
  !canonical.includes("https://cdn.jsdelivr.net/npm/pdfjs-dist"),
  "PDF.js must not silently depend on jsDelivr"
);

check(
  !canonical.includes("cdnjs.cloudflare.com"),
  "browser runtime must not silently depend on CDN assets"
);

if (failures.length) {
  console.error("Quality gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Quality gate passed (${canonical.length} characters canonical HTML).`);
