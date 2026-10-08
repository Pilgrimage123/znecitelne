import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const canonical = readFileSync("znecitelne.html", "utf8");
const server = readFileSync("server.js", "utf8");
const metadata = JSON.parse(readFileSync("metadata.json", "utf8"));

const failures = [];

function htmlSourceIncludes(fragment) { return canonical.includes(fragment); }

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(canonical.startsWith("<!DOCTYPE html>"), "canonical app must be a complete HTML document");
check(canonical.includes('lang="cs"'), "canonical app must declare Czech as the base language");
check(canonical.includes("const CHANGELOG = ["), "canonical app must expose its changelog");
check(canonical.includes("const RULES = "), "canonical app must declare its detector ruleset");
check(canonical.includes("quickMode"), "Quick mode must remain present");
check(canonical.includes("fastApprove"), "Fast-approve mode must remain present");
check(canonical.includes("processAnalysis"), "Process analysis must remain present");
check(canonical.includes("startMovieTutorial"), "Movie tutorial must remain present");
check(
  (canonical.match(/function visibleHits\s*\(/g) || []).length === 1,
  "visibleHits must have exactly one canonical implementation"
);
check(
  (canonical.match(/function resolveHits\s*\(/g) || []).length === 1,
  "resolveHits must have exactly one canonical implementation"
);
check(
  (canonical.match(/function effectiveHits\s*\(/g) || []).length === 1,
  "effectiveHits must have exactly one canonical implementation"
);
check(
  canonical.includes("function topHits(hits){") && canonical.includes("return effectiveHits(hits);"),
  "topHits must use the canonical effective-hit resolver"
);
check(
  htmlSourceIncludes("function assertSecurePdfBytes(bytes)"),
  "PDF exports must have a security preflight"
);
check(
  htmlSourceIncludes('"/AcroForm"') &&
  htmlSourceIncludes('"/Sig"') &&
  htmlSourceIncludes('"/EmbeddedFiles"') &&
  htmlSourceIncludes('"/JavaScript"'),
  "PDF security preflight must reject form/signature/embedded-code surfaces"
);
check(
  htmlSourceIncludes("expected one %%EOF"),
  "PDF security preflight must reject multiple PDF revisions"
);
check(
  htmlSourceIncludes("async function exportPdfTrueRedact") &&
  htmlSourceIncludes("const bytes = await exportPdfRaster(source, hits, title, mode, lang);"),
  "true-redact release path must fail closed to isolated raster export"
);
const trueRedactBody = canonical.match(
  /async function exportPdfTrueRedact[\s\S]*?\n  \\}\n  async function exportPdfRaster/
)?.[0] || "";
check(
  !trueRedactBody.includes("PDFDocument.load(source"),
  "true-redact release path must not load the source PDF with PDFDocument.load"
);

check(
  htmlSourceIncludes("function pdfWordQuads(glyphs)"),
  "PDF redaction must calculate exact word quads with vertical inset to protect adjacent lines"
);
check(
  htmlSourceIncludes("function getRedactionDiff(") && htmlSourceIncludes("diffRemovedTitle"),
  "application must provide text comparison diff before/after redaction with removed words for approval"
);
check(
  htmlSourceIncludes("function generateCzechNameForms(") &&
  htmlSourceIncludes("function expandCzechNameMorphology("),
  "application must provide Czech name morphology generation and case expansion"
);
check(
  htmlSourceIncludes("function verifySanitizedPdfText("),
  "PDF export must verify sanitized text layer with zero leaked sensitive words"
);
check(
  htmlSourceIncludes("function decodeTextBuffer(") &&
  htmlSourceIncludes("windows-1250"),
  "application must decode non-UTF-8 Czech texts in Windows-1250"
);
check(
  htmlSourceIncludes("function isBinaryBuffer("),
  "application must guard against raw binary buffers"
);
check(
  htmlSourceIncludes("function extractRtfText("),
  "application must support RTF text extraction"
);
check(
  htmlSourceIncludes("function removeQueueItem("),
  "queue must allow removing items"
);
check(
  htmlSourceIncludes("function collectFilesFromDataTransfer("),
  "application must support recursive directory drag and drop"
);
check(
  htmlSourceIncludes("function handleImageFile("),
  "application must support image files with OCR"
);
check(
  htmlSourceIncludes("document.body.classList.remove(\"pdf-visual-on\")"),
  "clearPdfVisual must remove pdf-visual-on from document.body"
);
check(
  htmlSourceIncludes("isIgnoredSystemFile"),
  "directory file collection must filter out temporary lock and OS metadata files"
);
check(
  htmlSourceIncludes("utf-16le"),
  "text decoding must support UTF-16 LE"
);
check(
  htmlSourceIncludes("errFileTooLarge"),
  "file loader must guard against oversized files"
);
check(
  htmlSourceIncludes('id="residual"') && !htmlSourceIncludes('$("residual").className ='),
  "residual element must exist in markup and be guarded against null references in paintReview"
);
check(
  htmlSourceIncludes("e.target instanceof Element && (e.target.id === \"drop\" || e.target.closest(\"#drop\"))"),
  "window drop listener must guard e.target against non-Element targets"
);
check(
  htmlSourceIncludes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
  htmlSourceIncludes("application/vnd.oasis.opendocument.text"),
  "file loader must support DOCX and ODT MIME types"
);
check(
  htmlSourceIncludes("async function getOcrWorker()"),
  "PDF text extractor must lazily initialize OCR worker only when needed"
);
check(
  htmlSourceIncludes("async function ingestDocument(") &&
  htmlSourceIncludes("function applyDocumentToState(") &&
  htmlSourceIncludes("class DocumentIngestionError") &&
  htmlSourceIncludes("async function ingestDocumentBatch("),
  "deepened document ingestion module must provide canonical ingestDocument interface and structured errors"
);
check(
  htmlSourceIncludes('pdfaFontWarn:"Nevložené fonty') &&
  htmlSourceIncludes('pdfaFontWarn:"Unembedded fonts'),
  "PDF/A font warning localization must exist in both Czech and English"
);
check(
  htmlSourceIncludes("\\ldblquote\\b ?") && htmlSourceIncludes("\\par\\b ?"),
  "RTF extraction must discard trailing control word delimiter spaces"
);
check(
  htmlSourceIncludes("document.onkeydown = (e) =>"),
  "movie navigation keys must be isolated via document.onkeydown"
);

check(
  server.includes("if (path.extname(req.path))"),
  "server must not return the SPA shell for missing file-like assets"
);
check(
  metadata.capabilities?.length === 0,
  "metadata must not declare undeclared capabilities"
);
check(
  !canonical.includes("https://cdn.jsdelivr.net/npm/pdfjs-dist"),
  "PDF.js worker must not silently fall back to a CDN"
);
check(canonical.includes("./lib/"), "Browser libraries must have a local/offline path");
check(!existsSync("index.html"), "obsolete index.html must not exist");

for (const asset of [
  "./lib/fontkit.umd.min.js",
  "./lib/pdf-lib.min.js",
  "./lib/pdf.min.js",
  "./lib/pdf.worker.min.js",
  "./lib/mammoth.browser.min.js",
  "./lib/xlsx.full.min.js",
  "./lib/fflate.js",
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
]) {
  check(canonical.includes(asset), `missing local library reference: ${asset}`);
  check(
    existsSync(resolve(".", asset)),
    `missing local runtime asset: ${asset}`
  );
}

check(
  !/const candidates = \["index\\.html"/.test(canonical),
  "HTML self-export must not prefer obsolete index.html"
);

// Unit tests exercising deepened Document Ingestion module through its seam
try {
  const scriptContent = canonical.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  const vm = await import("node:vm");
  const sandbox = {
    TextDecoder,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    console,
    Math,
    String,
    Number,
    Object,
    Error,
    window: {},
    document: {},
    S: { lang: "cs", ocrEnabled: false },
    sha256: async () => "mockhash"
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `
    function toBytes(buf){
      if (!buf) return new Uint8Array(0);
      if (buf instanceof Uint8Array) return buf;
      if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
      if (ArrayBuffer.isView(buf)) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      return new Uint8Array(0);
    }
    ` +
    scriptContent.slice(
      scriptContent.indexOf("const IngestErrorCode ="),
      scriptContent.indexOf("function extractOdtText(")
    ) +
    scriptContent.slice(
      scriptContent.indexOf("function isImageFile("),
      scriptContent.indexOf("const Q = { items:")
    ),
    sandbox
  );

  // 1. Structured domain error on empty document
  let caught = null;
  try {
    await sandbox.ingestDocument({ name: "empty.txt", buffer: new ArrayBuffer(0) });
  } catch (e) {
    caught = e;
  }
  check(caught && caught.code === "errFileEmpty", "ingestDocument must throw errFileEmpty on empty buffer");

  // 2. Structured domain error on legacy .doc
  caught = null;
  try {
    await sandbox.ingestDocument({ name: "stary.doc", buffer: new Uint8Array([1, 2, 3]).buffer });
  } catch (e) {
    caught = e;
  }
  check(caught && caught.code === "errDocOld", "ingestDocument must throw errDocOld on legacy .doc");

  // 3. Structured domain error on raw binary
  caught = null;
  try {
    const binaryBytes = new Uint8Array([0x41, 0x42, 0x00, 0x43]);
    await sandbox.ingestDocument({ name: "unknown.bin", buffer: binaryBytes.buffer });
  } catch (e) {
    caught = e;
  }
  check(caught && caught.code === "errFileBinary", "ingestDocument must throw errFileBinary on binary buffer");

  // 4. Valid document extraction produces canonical immutable Dokument
  const sampleText = "Dobrý den, anonymizace dokumentu.";
  const sampleBuf = new TextEncoder().encode(sampleText).buffer;
  const doc = await sandbox.ingestDocument({ name: "smlouva.txt", buffer: sampleBuf });
  check(doc && doc.text === sampleText, "ingestDocument must extract clean normalized text");
  check(doc && doc.kind === "text", "ingestDocument must identify text kind");
  check(doc && Array.isArray(doc.pages) && doc.pages.length === 1, "ingestDocument must guarantee uniform pages array");
  check(doc && Array.isArray(doc.cellMap) && doc.cellMap.length === 0, "ingestDocument must guarantee uniform cellMap array");
  check(doc && doc.hashIn === "mockhash", "ingestDocument must guarantee computed hashIn");
  check(Object.isFrozen(doc), "ingestDocument must return an immutable frozen Dokument");

  // 5. Batch ingestion reports per-item results without halting on failure
  const batch = await sandbox.ingestDocumentBatch([
    { name: "valid.txt", buffer: sampleBuf },
    { name: "invalid.doc", buffer: new Uint8Array([1, 2]).buffer }
  ]);
  check(batch.length === 2, "ingestDocumentBatch must return result for each input");
  check(batch[0].ok && batch[0].doc.text === sampleText, "ingestDocumentBatch must succeed on valid item");
  check(!batch[1].ok && batch[1].error.code === "errDocOld", "ingestDocumentBatch must capture error for invalid item");
} catch (testErr) {
  failures.push("Document ingestion unit test failed: " + (testErr.message || String(testErr)));
}

// Regression tests for proactive bug fixes
try {
  const scriptContent = canonical.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  const vm = await import("node:vm");
  const sandbox = {
    TextDecoder,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    console,
    Math,
    String,
    Number,
    Object,
    Error,
    RegExp,
    window: {},
    document: {}
  };
  vm.createContext(sandbox);

  const rtfCode = scriptContent.slice(scriptContent.indexOf("function extractRtfText("), scriptContent.indexOf("function extractOdtText("));
  const findAllCode = scriptContent.slice(scriptContent.indexOf("function findAll("), scriptContent.indexOf("function scoreHit("));
  const dictReCode = scriptContent.slice(scriptContent.indexOf("function dictRe("), scriptContent.indexOf("const URL_TOKEN_RE ="));
  const assertPdfCode = scriptContent.slice(scriptContent.indexOf("function assertSecurePdfBytes("), scriptContent.indexOf("async function exportPdfTrueRedact("));

  vm.runInContext(rtfCode + "\n" + findAllCode + "\n" + dictReCode + "\n" + assertPdfCode, sandbox);

  // 1. RTF extraction preserves file paths with escaped backslashes
  const rtfPath = sandbox.extractRtfText("{\\rtf1 C:\\\\temp\\\\file.txt}");
  check(rtfPath === "C:\\temp\\file.txt", "extractRtfText must preserve literal backslashes and path segments in RTF");

  // 2. findAll tracks exact capture group start offset even when token matches prefix label
  const hits = sandbox.findAll("secret: secret", /(?:secret)\s*[:=]\s*(\S+)/i, "credential", null, 1);
  check(hits.length === 1 && hits[0].start === 8 && hits[0].value === "secret", "findAll must use exact capture group offset instead of matching prefix label");

  // 3. dictRe maintains word boundaries for multi-word phrases
  const multiRe = sandbox.dictRe("Projekt Atlas");
  check(!multiRe.test("MůjProjekt Atlas") && multiRe.test("Projekt Atlas"), "dictRe must enforce word boundaries on multi-word phrases");

  // 4. assertSecurePdfBytes detects hex-encoded names
  let caughtHex = false;
  try {
    sandbox.assertSecurePdfBytes(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n/#41croForm <<>>\nendobj\n%%EOF"));
  } catch (_) {
    caughtHex = true;
  }
  check(caughtHex, "assertSecurePdfBytes must reject hex-encoded forbidden names");
} catch (regErr) {
  failures.push("Regression test suite failed: " + (regErr.message || String(regErr)));
}

if (failures.length) {
  console.error("Quality gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Quality gate passed (${canonical.length} characters canonical HTML).`);
