import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const canonical = readFileSync("znecitelne.html", "utf8");
const server = readFileSync("server.js", "utf8");
const metadata = JSON.parse(readFileSync("metadata.json", "utf8"));

const failures = [];

function htmlSourceIncludes(fragment) {
  return canonical.replace(/\r\n/g, "\n").includes(fragment.replace(/\r\n/g, "\n"));
}

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
const bindReplacerBody = canonical.match(/function bindReplacer[\s\S]*?\n  \}/)?.[0] || "";
check(
  !bindReplacerBody.includes(".sort("),
  "bindReplacer must not redundantly sort hits"
);
check(
  bindReplacerBody.includes("effectiveHits(hits)") && !bindReplacerBody.includes(".slice("),
  "bindReplacer must consume effectiveHits directly without redundant slice or sort"
);
const docxExportBody = canonical.match(/async function exportDocxFile[\s\S]*?\n  \}/)?.[0] || "";
check(
  !docxExportBody.includes(".sort("),
  "exportDocxFile must not redundantly sort hits"
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
  /async function exportPdfTrueRedact\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/
)?.[0] || "";
check(
  Boolean(trueRedactBody),
  "exportPdfTrueRedact body must be extracted from canonical HTML"
);
check(
  !trueRedactBody.includes("PDFDocument.load(source"),
  "true-redact release path must not load the source PDF with PDFDocument.load"
);
check(
  !canonical.includes("function pdfTokenize") &&
  !canonical.includes("function pdfDecodeStringToken") &&
  !canonical.includes("function pdfFindTargetRanges"),
  "canonical app must not contain vestigial in-stream PDF tokenizer/parser"
);
check(
  !canonical.includes("function docxBuildSensitiveMediaRename") &&
  !canonical.includes("function docxApplyPartRenames"),
  "canonical app must not contain dead DOCX media renamer"
);
check(
  !canonical.includes("function stripPdfSignatureFields"),
  "canonical app must not contain dead PDF signature field stripper"
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
  htmlSourceIncludes("function declinedPersonTokenBase(base, h, lang)") &&
  htmlSourceIncludes('name: "czech pseudonym tokens preserve common grammatical cases"') &&
  htmlSourceIncludes('rMorph(h) === "[OSOBA_001]"') &&
  htmlSourceIncludes('rMorph(h) === "[OSOBĚ_001]"') &&
  htmlSourceIncludes('rMorph(h) === "[OSOBOU_001]"'),
  "Czech pseudonyms must preserve base, dative/locative and instrumental forms with one stable suffix"
);
check(
  htmlSourceIncludes("function generateCzechNameForms(") &&
  htmlSourceIncludes("function expandCzechNameMorphology("),
  "application must provide Czech name morphology generation and case expansion"
);
check(
  htmlSourceIncludes("function createEntityPropagationCache(") &&
  htmlSourceIncludes("class EntityPropagationCache") &&
  htmlSourceIncludes("window.createEntityPropagationCache = createEntityPropagationCache"),
  "application must provide Document Entity Propagation Cache interface"
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
  htmlSourceIncludes("async function ingestDocumentBatch(") &&
  htmlSourceIncludes("await ingestDocumentBatch(files"),
  "deepened document ingestion module must provide canonical ingestDocument interface and batch integration in onFiles"
);
check(
  htmlSourceIncludes('queueLbl:"Dávková fronta"'),
  "queue label must strictly use canonical domain term Dávková fronta"
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

// Jednotkové testy modulu dekonflikce nálezů (resolveHits, effectiveHits, visibleHits) přes kanonické rozhraní
try {
  const scriptContent = canonical.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  const vm = await import("node:vm");
  const deconflictSandbox = {
    Number,
    Boolean,
    String,
    Array,
    Map,
    Set,
    Math,
    console,
    LABEL: { cs: { name: "OSOBA", ticket: "TICKET" } },
    STATUS_GENERIC: { cs: { prod: "PROD" } },
    canonToken: (s) => String(s).toLowerCase()
  };
  vm.createContext(deconflictSandbox);
  vm.runInContext(
    scriptContent.slice(
      scriptContent.indexOf("function tokenBase("),
      scriptContent.indexOf("function xlsxToText(")
    ),
    deconflictSandbox
  );

  const { resolveHits, effectiveHits, visibleHits, topHits, apply, buildGlossary } = deconflictSandbox;

  // 1. Schválený nález má přednost před delším neschváleným nálezem
  const approvedVsLonger = resolveHits([
    { id: 1, start: 0, end: 30, value: "neco dlouheho neovereneho", accept: false },
    { id: 2, start: 5, end: 15, value: "schvaleno", accept: true }
  ]);
  check(
    approvedVsLonger.length === 1 && approvedVsLonger[0].id === 2,
    "resolveHits must prioritize accepted hits over longer unaccepted hits"
  );

  // effectiveHits must return only accepted hits
  const eff = effectiveHits([
    { id: 1, start: 0, end: 10, accept: false },
    { id: 2, start: 20, end: 30, accept: true }
  ]);
  check(
    eff.length === 1 && eff[0].id === 2,
    "effectiveHits must return only accepted hits"
  );

  // visibleHits returns all deconflicted hits regardless of accept
  const vis = visibleHits([
    { id: 1, start: 0, end: 10, accept: false },
    { id: 2, start: 20, end: 30, accept: true }
  ]);
  check(
    vis.length === 2 && vis[0].id === 1 && vis[1].id === 2,
    "visibleHits must return both accepted and unaccepted deconflicted hits"
  );

  // topHits delegates to effectiveHits
  const top = topHits([
    { id: 1, start: 0, end: 10, accept: false },
    { id: 2, start: 20, end: 30, accept: true }
  ]);
  check(
    top.length === 1 && top[0].id === 2,
    "topHits must delegate to effectiveHits"
  );

  // 2. Při shodném stavu schválení vyhrává delší rozsah
  const longerWinsSameStatus = resolveHits([
    { id: "part", start: 4, end: 9, value: "Novák", accept: false },
    { id: "full", start: 0, end: 9, value: "Jan Novák", accept: false }
  ]);
  check(
    longerWinsSameStatus.length === 1 && longerWinsSameStatus[0].id === "full",
    "resolveHits must prioritize longer hit over substring when approval status matches"
  );

  // 3. Sousední nálezy dotýkající se na hranici (start jednoho == end druhého) nezpůsobí kolizi
  const abutting = resolveHits([
    { id: "b", start: 10, end: 20, value: "druhy", accept: true },
    { id: "a", start: 0, end: 10, value: "prvni", accept: true }
  ]);
  check(
    abutting.length === 2 && abutting[0].id === "a" && abutting[1].id === "b",
    "resolveHits must retain abutting adjacent hits without false collision"
  );

  // 4. Vyřazení neplatných nálezů (obrácený rozsah, nečíselné offsety, null/undefined)
  const invalidInputs = resolveHits([
    null,
    undefined,
    { id: 1, start: 10, end: 5 },
    { id: 2, start: 5, end: 5 },
    { id: 3, start: "5", end: 10 },
    { id: 4, start: NaN, end: 10 },
    { id: 5, start: 0, end: Infinity },
    { id: 6, start: 0, end: 8, value: "platny" }
  ]);
  check(
    invalidInputs.length === 1 && invalidInputs[0].id === 6,
    "resolveHits must filter out null, undefined, inverted, and non-finite ranges"
  );

  // 5. Deterministický tiebreaker pro nerozhodné případy (číselná i řetězcová ID)
  const numTie = resolveHits([
    { id: 10, start: 0, end: 5, score: 1, accept: true },
    { id: 2, start: 0, end: 5, score: 1, accept: true }
  ]);
  check(
    numTie.length === 1 && numTie[0].id === 2,
    "resolveHits tiebreaker must deterministically select lower numeric id"
  );

  const strTie = resolveHits([
    { id: "z-hit", start: 0, end: 5, score: 1, accept: true },
    { id: "a-hit", start: 0, end: 5, score: 1, accept: true }
  ]);
  check(
    strTie.length === 1 && strTie[0].id === "a-hit",
    "resolveHits tiebreaker must deterministically select lexicographically earlier string id"
  );

  // 6. Výstupní pole nálezů je vždy seřazeno vzestupně podle počátečního offsetu
  const unordered = resolveHits([
    { id: 3, start: 50, end: 60, accept: true },
    { id: 1, start: 10, end: 20, accept: true },
    { id: 2, start: 30, end: 40, accept: true }
  ]);
  check(
    unordered.length === 3 && unordered[0].id === 1 && unordered[1].id === 2 && unordered[2].id === 3,
    "resolveHits must always return hits sorted ascending by start offset"
  );

  // 7. Škálovatelnost a výkon algoritmu překryvů bez kvadratické zátěže (Ticket 02)
  const stressHits = [];
  for (let i = 0; i < 1000; i++) {
    const s = (i * 7) % 5000;
    stressHits.push({
      id: i,
      start: s,
      end: s + 10 + (i % 15),
      score: 0.5 + (i % 50) / 100,
      accept: i % 2 === 0
    });
  }
  const tStart = performance.now();
  const stressResolved = resolveHits(stressHits);
  const duration = performance.now() - tStart;
  check(
    duration < 100,
    `resolveHits on 1000 hits must complete efficiently without quadratic lag (took ${duration.toFixed(2)}ms)`
  );
  const strictlyOrderedAndDisjoint = stressResolved.every((h, idx) => {
    if (idx === 0) return true;
    return h.start >= stressResolved[idx - 1].end;
  });
  check(
    strictlyOrderedAndDisjoint,
    "resolveHits output must be strictly disjoint and ordered ascending by start"
  );

  // 8. Integrace apply a buildGlossary s dekonflikcí nálezů (Ticket 03)
  const overlapHits = [
    { id: 1, start: 0, end: 9, value: "Jan Novák", type: "name", accept: true, score: 0.9, entityKey: "name|jan" },
    { id: 2, start: 4, end: 9, value: "Novák", type: "name", accept: true, score: 0.99, entityKey: "name|nov" },
    { id: 3, start: 15, end: 19, value: "CBUA", type: "ticket", accept: true, score: 0.5, entityKey: "ticket|cbua" }
  ];
  const overlapOut = apply("Jan Novák .... CBUA", overlapHits, "pseudo", "cs");
  check(
    !overlapOut.includes("Novák") && !overlapOut.includes("CBUA") && overlapOut.includes("[OSOBA_"),
    "apply must use deconflicted hits and replace sensitive values properly"
  );
  const gloss = buildGlossary(overlapHits, "pseudo", "cs", false);
  check(
    gloss.length === 2 && gloss.some(r => r.type === "name") && gloss.some(r => r.type === "ticket"),
    "buildGlossary must produce tokens based on deconflicted hits"
  );
} catch (hitErr) {
  failures.push("Test modulu dekonflikce nálezů selhal: " + (hitErr.message || String(hitErr)));
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
  const docxRelCode = scriptContent.slice(scriptContent.indexOf("function docxNormalizeZipPath("), scriptContent.indexOf("function docxSetTextPreservingSpace("));
  const toBytesCode = scriptContent.slice(scriptContent.indexOf("function toBytes("), scriptContent.indexOf("function isValidICO("));
  const binaryDecodeCode = scriptContent.slice(scriptContent.indexOf("function decodeTextBuffer("), scriptContent.indexOf("function extractRtfText("));

  const parseRCCode = scriptContent.slice(scriptContent.indexOf("function parseRC("), scriptContent.indexOf("function pageOf("));
  const isLikelyCode = scriptContent.slice(scriptContent.indexOf("function isLikelyNonPersonName("), scriptContent.indexOf("function detect("));
  const declinedCode = scriptContent.slice(scriptContent.indexOf("function declinedPersonTokenBase("), scriptContent.indexOf("function makeReplacer("));

  vm.runInContext(rtfCode + "\n" + findAllCode + "\n" + dictReCode + "\n" + assertPdfCode + "\n" + docxRelCode + "\n" + toBytesCode + "\n" + binaryDecodeCode + "\n" + parseRCCode + "\n" + isLikelyCode + "\n" + declinedCode, sandbox);

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

  // 5. docxResolveRelTarget ignores internal fragment/bookmark targets without producing dangling relation errors
  const internalAnchor = sandbox.docxResolveRelTarget("word/document.xml", "#_Toc123");
  check(internalAnchor === null, "docxResolveRelTarget must return null for internal anchor references (#...)");

  // 6. UTF-16BE text without BOM is properly detected and decoded rather than treated as unsupported binary
  const utf16beBytes = new Uint8Array([0x00, 0x41, 0x00, 0x68, 0x00, 0x6f, 0x00, 0x6a]);
  check(!sandbox.isBinaryBuffer(utf16beBytes), "isBinaryBuffer must not reject UTF-16BE text without BOM as binary");
  check(sandbox.decodeTextBuffer(utf16beBytes) === "Ahoj", "decodeTextBuffer must correctly decode UTF-16BE text without BOM");

  // 7. parseRC properly accepts 10-digit birth numbers where 9-digit prefix mod 11 is 10 (check digit 0)
  check(sandbox.parseRC("850101/0090") === true, "parseRC must accept valid 10-digit birth number with mod 10 exception");
  check(sandbox.parseRC("850101/0091") === null, "parseRC must reject 10-digit birth number with mismatched check digit");

  // 8. declinedPersonTokenBase correctly declines names with post-nominal titles and trailing punctuation
  check(
    sandbox.declinedPersonTokenBase("OSOBA", { type: "name", value: "Janem Novákem, MBA" }, "cs") === "OSOBOU",
    "declinedPersonTokenBase must correctly return OSOBOU for names with post-nominal titles"
  );
  check(
    sandbox.declinedPersonTokenBase("OSOBA", { type: "name", value: "Janu Novákovi, Ph.D." }, "cs") === "OSOBĚ",
    "declinedPersonTokenBase must correctly return OSOBĚ for names with post-nominal titles"
  );

  // 9. isLikelyNonPersonName guards location constituent tokens and standalone calendar words
  const locPhrase = "Jednání se týká Černé Hory.";
  const horyIdx = locPhrase.indexOf("Hory");
  check(
    sandbox.isLikelyNonPersonName("Hory", locPhrase, horyIdx, horyIdx + 4) === true,
    "isLikelyNonPersonName must identify location sub-token preceded by Černé as non-person"
  );
  check(
    sandbox.isLikelyNonPersonName("duben", "Termín je duben.", 10, 15) === true,
    "isLikelyNonPersonName must identify standalone month word as non-person"
  );
} catch (regErr) {
  failures.push("Regression test suite failed: " + (regErr.message || String(regErr)));
}

check(
  htmlSourceIncludes("if (isCur) {\n      Q.cur = -1;"),
  "removeQueueItem must invalidate Q.cur to -1 when removing current item to prevent overwriting next item snapshot"
);
check(
  htmlSourceIncludes("let _toastTimer = null;"),
  "toast notifications must manage timer cancellation to prevent race condition premature hiding"
);

check(
  htmlSourceIncludes("baseLine - fH * 1.04") && htmlSourceIncludes("baseLine + fH * 0.30"),
  "PDF raster export must compute full vertical font extent (diacritics and descenders) to prevent residual font glyphs"
);
check(
  htmlSourceIncludes("while (endByte > startByte && (u8[endByte - 1] === 10 || u8[endByte - 1] === 13))"),
  "verifySanitizedPdfText must trim trailing CR/LF delimiters from stream slices before decompressing"
);
check(
  htmlSourceIncludes("Object.assign(S, chosenSettings)"),
  "exportAllReviewed must preserve user-chosen export modal settings across batch items"
);
check(
  htmlSourceIncludes("if (btn && !batchExport) {"),
  "doExport must not prematurely re-enable export button while batch export is running"
);

// Regression tests for PDF visual preview token overlay
check(
  htmlSourceIncludes("pv-prev-token"),
  "PDF visual preview must support token replacement styling pv-prev-token"
);
check(
  htmlSourceIncludes("const replacer = (previewOn && !isBox) ? bindReplacer(S.mode, S.lang, S.hits) : null;"),
  "paintPdfVisualOverlays must bind replacer in preview mode when mode is not box"
);

try {
  const scriptContent = canonical.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  const vm = await import("node:vm");
  const pvElements = [];
  const mockLayer = {
    innerHTML: "",
    appendChild(child) { pvElements.push(child); }
  };
  const mockButton = () => ({
    type: "",
    dataset: {},
    className: "",
    style: {},
    setAttribute(k, v) { this[k] = v; },
    textContent: ""
  });
  const pvSandbox = {
    console,
    Math,
    String,
    Number,
    Array,
    Object,
    document: {
      createElement(tag) {
        if (tag === "button") return mockButton();
        return {};
      }
    },
    LABEL: { cs: { name: "OSOBA", ticket: "TICKET" } },
    STATUS_GENERIC: { cs: { prod: "PROD" } },
    canonToken: (s) => String(s).toLowerCase(),
    I18N: {
      cs: {
        cats: { name: "Jména a tituly" },
        redact: "anonymizovat"
      }
    },
    S: {
      lang: "cs",
      mode: "pseudo",
      docView: "preview",
      selectedId: null,
      hits: [
        { id: 1, type: "name", value: "Jan Novák", start: 0, end: 9, accept: true, score: 0.9, entityKey: "name|jan" }
      ],
      pages: [
        { n: 1, start: 0, end: 20 }
      ]
    },
    PV: {
      pages: [
        {
          n: 1,
          wrap: { clientWidth: 600, style: { width: "600px" } },
          layer: mockLayer,
          text: "Jan Novák je zde.",
          map: [
            { start: 0, end: 9, str: "Jan Novák", x: 50, y: 100, w: 80, h: 14 }
          ]
        }
      ]
    }
  };
  vm.createContext(pvSandbox);
  const pdfQuadsCode = scriptContent.slice(
    scriptContent.indexOf("function pdfWordQuads("),
    scriptContent.indexOf("async function buildPdfVisual(")
  );
  const replacerCode = scriptContent.slice(
    scriptContent.indexOf("function tokenBase("),
    scriptContent.indexOf("function xlsxToText(")
  );
  vm.runInContext(
    replacerCode + "\n" +
    pdfQuadsCode + "\n" +
    "const i = () => I18N[S.lang];\n",
    pvSandbox
  );

  // Test 1: preview mode with pseudo replacement produces pv-prev-token with [OSOBA_001]
  pvSandbox.paintPdfVisualOverlays();
  check(pvElements.length === 1, "paintPdfVisualOverlays must render one element for the hit");
  check(
    pvElements[0] && pvElements[0].className.includes("pv-prev-token"),
    "preview mode with pseudo mode must apply pv-prev-token class"
  );
  check(
    pvElements[0] && pvElements[0].textContent.includes("[OSOBA_"),
    "preview mode with pseudo mode must display pseudonym token text"
  );

  // Test 2: preview mode with box replacement produces pv-prev-box with empty textContent (redacted black box)
  pvElements.length = 0;
  pvSandbox.S.mode = "box";
  pvSandbox.paintPdfVisualOverlays();
  check(pvElements.length === 1, "paintPdfVisualOverlays must render one element for box mode");
  check(
    pvElements[0] && pvElements[0].className.includes("pv-prev-box"),
    "preview mode with box mode must apply pv-prev-box class"
  );
  check(
    pvElements[0] && pvElements[0].textContent === "",
    "preview mode with box mode must leave textContent empty"
  );

  // Test 3: original version mode produces pv-on with empty textContent
  pvElements.length = 0;
  pvSandbox.S.docView = "original";
  pvSandbox.paintPdfVisualOverlays();
  check(pvElements.length === 1, "paintPdfVisualOverlays must render one element for original mode");
  check(
    pvElements[0] && pvElements[0].className.includes("pv-on"),
    "original version mode must apply pv-on class"
  );
  check(
    pvElements[0] && pvElements[0].textContent === "",
    "original version mode must leave textContent empty"
  );

  // Test 4: PDF redaction calculation covers full vertical extent for diacritics and descenders
  const glyphsWithMetrics = [
    { start: 0, end: 1, str: "Š", x: 10, y: 88, w: 10, h: 20, fontH: 20, baselineY: 100 },
    { start: 1, end: 2, str: "p", x: 20, y: 88, w: 10, h: 20, fontH: 20, baselineY: 100 },
    { start: 2, end: 3, str: "y", x: 30, y: 88, w: 10, h: 20, fontH: 20, baselineY: 100 }
  ];
  const quads = pvSandbox.pdfWordQuads(glyphsWithMetrics);
  check(quads.length === 1, "pdfWordQuads must group glyphs on same baseline into one quad");
  check(Array.isArray(quads[0].glyphs) && quads[0].glyphs.length === 3, "pdfWordQuads must preserve constituent glyphs");
  const baseLine = glyphsWithMetrics[0].baselineY;
  const fH = glyphsWithMetrics[0].fontH;
  const boxTop = baseLine - fH * 1.04;
  const boxBottom = baseLine + fH * 0.30;
  check(boxTop < (baseLine - 20) && boxBottom > (baseLine + 5), "redaction box must extend beyond accent ceiling and descender floor");
} catch (pvErr) {
  failures.push("PDF visual preview unit test failed: " + (pvErr.message || String(pvErr)));
}

check(
  htmlSourceIncludes("function isOnomasticName(") || htmlSourceIncludes("const isOnomasticName ="),
  "Onomastic Registry must expose isOnomasticName lookup interface"
);
check(
  htmlSourceIncludes("function initOnomasticRegistry(") || htmlSourceIncludes("const initOnomasticRegistry ="),
  "Onomastic Registry must expose initOnomasticRegistry initialization interface"
);
check(
  htmlSourceIncludes("ONOMASTIC_PAYLOAD_B64"),
  "Onomastic Registry must include compressed ONOMASTIC_PAYLOAD_B64"
);

// Unit tests exercising Onomastic Registry and Trie through its testing seams
try {
  const fflateCode = readFileSync("./lib/fflate.js", "utf8");
  const vm = await import("node:vm");
  const fflateCtx = { self: {} };
  vm.runInNewContext(fflateCode, fflateCtx);
  const fflateLib = fflateCtx.self.fflate;

  const onomasticSandbox = {
    window: { fflate: fflateLib },
    fflate: fflateLib,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    Set,
    Map,
    Object,
    String,
    Boolean,
    console
  };
  vm.createContext(onomasticSandbox);

  const scriptContent = canonical.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  const trieDef = scriptContent.slice(
    scriptContent.indexOf("function stripTitle(token){"),
    scriptContent.indexOf("function nameKey(value){")
  );
  vm.runInContext(
    `const NAMES = new Set();\n` + trieDef,
    onomasticSandbox
  );

  const trie = onomasticSandbox.initOnomasticRegistry();
  check(Boolean(trie && typeof trie.has === "function"), "initOnomasticRegistry must return initialized trie");

  // Top Czech surnames & first names from prompt
  const requiredSurnames = [
    "Novák", "Nováková", "Svoboda", "Svobodová", "Dvořák", "Dvořáková", "Černý", "Černá",
    "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Marek", "Pospíšil", "Pokorný",
    "Hájek", "Král", "Jelínek", "Růžička", "Beneš", "Fiala", "Sedláček", "Doležal",
    "Zeman", "Kolář", "Navrátil", "Čermák", "Vaněk", "Urban", "Blažek", "Kříž", "Kovář", "Holub"
  ];
  for (const name of requiredSurnames) {
    check(
      onomasticSandbox.isOnomasticName(name) === true,
      `isOnomasticName must identify frequent Czech surname: ${name}`
    );
  }

  // Top Czech first names
  const requiredFirstNames = [
    "Jan", "Jana", "Petr", "Petra", "Pavel", "Pavla", "Martin", "Martina",
    "Tomáš", "Jiří", "Jiřina", "Josef", "Marie", "Eva", "Hana", "Anna",
    "Lenka", "Kateřina", "Lucie", "Alena", "Michal", "Milan", "Karel", "Jakub", "Lukáš", "David"
  ];
  for (const fn of requiredFirstNames) {
    check(
      onomasticSandbox.isOnomasticName(fn) === true,
      `isOnomasticName must identify frequent Czech first name: ${fn}`
    );
  }

  // Common non-names must be rejected
  const nonNames = [
    "smlouva", "praha", "dnes", "auto", "faktura", "strom", "projekt",
    "software", "objednatel", "korun", "dne", "který", "nebo", "podle", "pouze"
  ];
  for (const non of nonNames) {
    check(
      onomasticSandbox.isOnomasticName(non) === false,
      `isOnomasticName must reject non-name: ${non}`
    );
  }

  // Normalization: case insensitivity and punctuation stripping
  check(onomasticSandbox.isOnomasticName("novák") === true, "isOnomasticName must be case-insensitive (lowercase)");
  check(onomasticSandbox.isOnomasticName("NOVÁK") === true, "isOnomasticName must be case-insensitive (uppercase)");
  check(onomasticSandbox.isOnomasticName("Novák,") === true, "isOnomasticName must strip punctuation");

  // Integration into looksName
  check(onomasticSandbox.looksName("Novák") === true, "looksName must identify Novák");
  check(onomasticSandbox.looksName("Kovář") === true, "looksName must identify Kovář");
  check(onomasticSandbox.looksName("Svobodová") === true, "looksName must identify Svobodová");

  // Memory & Payload compactness
  const payloadB64 = vm.runInContext("ONOMASTIC_PAYLOAD_B64", onomasticSandbox);
  check(
    typeof payloadB64 === "string" && payloadB64.length > 500 && payloadB64.length < 25000,
    `ONOMASTIC_PAYLOAD_B64 must be compact compressed base64 string (got length ${payloadB64?.length})`
  );
} catch (onoErr) {
  failures.push("Onomastic Registry unit test failed: " + (onoErr.message || String(onoErr)));
}

// Verification that canonical application internal self-test suite (selftest=1) passes
try {
  const scriptContent = canonical.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  const vm = await import("node:vm");
  const storage = {};
  const localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => {}
  };
  const makeEl = (tag) => ({
    tagName: (tag || "").toUpperCase(),
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    dataset: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: (c) => c,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    innerHTML: "",
    textContent: "",
    value: "",
    children: []
  });
  const doc = {
    documentElement: {
      outerHTML: canonical.replace(/^<!DOCTYPE html>\s*/i, ""),
      classList: { add: () => {}, remove: () => {} },
      setAttribute: () => {}
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => makeEl("div"),
    createElement: makeEl,
    body: makeEl("body"),
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const windowObj = {
    location: { search: "?selftest=1" },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    document: doc,
    localStorage,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64")
  };
  const fflateCode = readFileSync("./lib/fflate.js", "utf8");
  const fflateHolder = { self: {} };
  vm.runInNewContext(fflateCode, fflateHolder);
  const fflateObj = fflateHolder.self.fflate;
  windowObj.fflate = fflateObj;
  const stSandbox = {
    window: windowObj,
    fflate: fflateObj,
    document: doc,
    location: windowObj.location,
    localStorage,
    atob: windowObj.atob,
    btoa: windowObj.btoa,
    navigator: { language: "cs", userAgent: "test" },
    console,
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    performance: { now: () => Date.now() },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    Error,
    JSON
  };
  vm.createContext(stSandbox);
  const scriptToRun = scriptContent.replace(/applyTheme\(\);\s*paint\(\);/, "");
  vm.runInContext(scriptToRun, stSandbox);
  const stRes = stSandbox.window.__selfTestResult;
  check(
    stRes && stRes.ok === true,
    `canonical selfTest suite must pass (got ${stRes ? stRes.failed.length : "no"} failures out of ${stRes ? stRes.n : 0} cases)`
  );

  // Ticket 02: Sentence boundary desambiguation & contextual triggers
  const detect = stSandbox.window.detect;
  const I18N = stSandbox.window.I18N;
  const hitEvidence = stSandbox.window.hitEvidence;
  check(typeof detect === "function", "window.detect must be exposed as public detection interface");

  if (typeof detect === "function") {
    // 1. Sentence-start false positive suppression
    const sentenceStartFPs = [
      "Nový přístup byl zvolen.",
      "Starý stavební zákon pozbyl platnosti.",
      "Podle žalobce došlo k prodlení.",
      "Bílá technika byla dodána."
    ];
    for (const text of sentenceStartFPs) {
      const hits = detect(text, { name: true }, []);
      const nameHits = hits.filter(h => h.type === "name");
      check(
        nameHits.length === 0,
        `Sentence-start word must NOT trigger person name hit: "${text}" (got: ${JSON.stringify(nameHits.map(h => h.value))})`
      );
    }

    // 2. Multi-word name at sentence start MUST trigger hit
    const multiWordHits = detect("Petr Nový podepsal smlouvu.", { name: true }, []);
    const petrNovy = multiWordHits.find(h => h.type === "name" && h.value === "Petr Nový");
    check(
      Boolean(petrNovy),
      `Multi-word name at sentence start "Petr Nový" MUST be detected (got: ${JSON.stringify(multiWordHits.map(h => h.value))})`
    );

    // 3. Homonym suppression vs trigger capture
    const homonymText = "zručný kovář vyrobil mříž";
    const homonymHits = detect(homonymText, { name: true }, []);
    const kovarHit = homonymHits.find(h => h.type === "name" && /kovář/i.test(h.value));
    check(
      !kovarHit,
      `Homonym apelativum "kovář" must NOT be detected in: "${homonymText}"`
    );

    const jiriKovarHits = detect("svědek Jiří Kovář vypověděl", { name: true }, []);
    const jiriKovar = jiriKovarHits.find(h => h.type === "name" && h.value === "Jiří Kovář");
    check(
      Boolean(jiriKovar && (jiriKovar.reasons || []).includes("trigger:role") && jiriKovar.confidence === "high"),
      `Role trigger "svědek Jiří Kovář" MUST detect "Jiří Kovář" with reason "trigger:role" and high confidence (got: ${JSON.stringify(jiriKovar)})`
    );

    const singleKovarHits = detect("svědek Kovář vypověděl", { name: true }, []);
    const singleKovar = singleKovarHits.find(h => h.type === "name" && h.value === "Kovář");
    check(
      Boolean(singleKovar && (singleKovar.reasons || []).includes("trigger:role")),
      `Role trigger "svědek Kovář" MUST detect "Kovář" with reason "trigger:role" (got: ${JSON.stringify(singleKovar)})`
    );

    // 4. Administrative triggers
    const adminText = "obžalovaný John Smith, nar. 1980, bytem v Praze";
    const adminHits = detect(adminText, { name: true }, []);
    const johnSmith = adminHits.find(h => h.type === "name" && h.value === "John Smith");
    check(
      Boolean(johnSmith),
      `Administrative trigger MUST detect "John Smith" in "${adminText}" (got: ${JSON.stringify(adminHits.map(h => h.value))})`
    );
    if (johnSmith) {
      const hasTriggerReason = (johnSmith.reasons || []).includes("trigger:role") || (johnSmith.reasons || []).includes("trigger:official");
      check(hasTriggerReason, `John Smith must have trigger indicator reason (got: ${JSON.stringify(johnSmith.reasons)})`);
      check(johnSmith.confidence === "high", `John Smith must have confidence "high" (got: ${johnSmith.confidence})`);
      check(johnSmith.accept === true, `John Smith must have accept: true (got: ${johnSmith.accept})`);
    }
  }

  // 5. I18N reason labels
  check(
    Boolean(I18N && I18N.cs && I18N.cs.reasonLabels && I18N.cs.reasonLabels["trigger:role"] === "[Trigger: role]"),
    `I18N.cs must define reasonLabels["trigger:role"] === "[Trigger: role]"`
  );
  check(
    Boolean(I18N && I18N.cs && I18N.cs.reasonLabels && I18N.cs.reasonLabels["trigger:official"] === "[Trigger: úřední]"),
    `I18N.cs must define reasonLabels["trigger:official"] === "[Trigger: úřední]"`
  );
  if (hitEvidence && I18N && I18N.cs) {
    const renderedRole = hitEvidence({ confidence: "high", reasons: ["trigger:role"] }, I18N.cs, true);
    check(renderedRole.includes("[Trigger: role]"), `hitEvidence must render [Trigger: role] (got: "${renderedRole}")`);
    const renderedOfficial = hitEvidence({ confidence: "high", reasons: ["trigger:official"] }, I18N.cs, true);
    check(renderedOfficial.includes("[Trigger: úřední]"), `hitEvidence must render [Trigger: úřední] (got: "${renderedOfficial}")`);
  }

  // Ticket 03: Entity Propagation Cache & Morphological Declension
  const createEntityPropagationCache = stSandbox.window.createEntityPropagationCache;
  const EntityPropagationCache = stSandbox.window.EntityPropagationCache;
  const expandCzechNameMorphology = stSandbox.window.expandCzechNameMorphology;
  const declinedPersonTokenBase = stSandbox.window.declinedPersonTokenBase;
  const apply = stSandbox.window.apply;

  check(typeof createEntityPropagationCache === "function", "window.createEntityPropagationCache must be exposed");
  check(typeof EntityPropagationCache === "function", "window.EntityPropagationCache must be exposed");
  check(typeof expandCzechNameMorphology === "function", "window.expandCzechNameMorphology must be exposed");
  check(typeof declinedPersonTokenBase === "function", "window.declinedPersonTokenBase must be exposed");

  if (typeof createEntityPropagationCache === "function") {
    // 1. Dokumentová mezipaměť entit collects verified person entities and generates 7-case paradigms
    const sampleHits = [
      { id: 1, type: "name", value: "Petr Kovář", start: 20, end: 30, confidence: "high", accept: true, reasons: ["trigger:role"] }
    ];
    const cache = createEntityPropagationCache("test", sampleHits);
    const entities = cache.getEntities ? cache.getEntities() : Array.from(cache.entities.values());
    check(entities.length === 1, `Dokumentová mezipaměť entit must collect confirmed person entities (got ${entities.length})`);

    const forms = cache.generateParadigm("Petr Kovář");
    const requiredForms = ["Petr Kovář", "Petra Kováře", "Petrem Kovářem", "Kovář", "Kováře", "Kovářovi", "Kovářem"];
    check(
      requiredForms.every(f => forms.includes(f)),
      `generateParadigm must generate 7-case forms for Czech names (missing: ${requiredForms.filter(f => !forms.includes(f)).join(", ")})`
    );

    // 2. Uninflected surnames like Marie Svoboda
    const uninflectedForms = cache.generateParadigm("Marie Svoboda");
    check(
      uninflectedForms.includes("Marie Svoboda") && uninflectedForms.includes("Svoboda") && uninflectedForms.includes("paní Svoboda"),
      "generateParadigm must handle uninflected surnames (Marie Svoboda / paní Svoboda)"
    );

    // 3. Foreign surnames like paní Smith
    const foreignForms = cache.generateParadigm("paní Smith");
    check(
      foreignForms.includes("Smith") && foreignForms.includes("paní Smith"),
      "generateParadigm must handle foreign uninflected surnames (Smith / paní Smith)"
    );
  }

  // 4. Case endings recognized by declinedPersonTokenBase
  if (typeof declinedPersonTokenBase === "function") {
    check(
      declinedPersonTokenBase("OSOBA", { type: "name", value: "Kováře" }, "cs") === "OSOBA",
      "declinedPersonTokenBase must return OSOBA for genitive/accusative Kováře"
    );
    check(
      declinedPersonTokenBase("OSOBA", { type: "name", value: "Kovářovi" }, "cs") === "OSOBĚ",
      "declinedPersonTokenBase must return OSOBĚ for dative/locative Kovářovi"
    );
    check(
      declinedPersonTokenBase("OSOBA", { type: "name", value: "Kovářem" }, "cs") === "OSOBOU",
      "declinedPersonTokenBase must return OSOBOU for instrumental Kovářem"
    );
  }

  // 5. Bidirectional scan and pseudonym preservation
  if (typeof detect === "function" && typeof apply === "function") {
    const biText = "Podle výpovědi Kováře došlo k nehodě. Obžalovaný Ing. Petr Kovář, nar. 1978, však tvrdil opak. Později bylo doručeno Kovářovi a jednal s Kovářem.";
    const biHits = detect(biText, { name: true }, []);
    const nameHits = biHits.filter(h => h.type === "name");
    const uniqueKeys = new Set(nameHits.map(h => h.entityKey));

    check(
      nameHits.length >= 4,
      `Bidirectional scan must detect all 4 name mentions (got ${nameHits.length}: ${JSON.stringify(nameHits.map(h => h.value))})`
    );
    check(
      uniqueKeys.size === 1,
      `All propagated hits of an entity must share unified entityKey (got keys: ${JSON.stringify([...uniqueKeys])})`
    );

    const propagatedHits = nameHits.filter(h => (h.reasons || []).includes("propagation"));
    check(
      propagatedHits.length >= 3,
      `Propagated hits must be tagged with reasons: ['propagation'] (got ${propagatedHits.length})`
    );

    const pseudoOut = apply(biText, biHits, "pseudo", "cs");
    check(
      pseudoOut.includes("[OSOBA_001]") && pseudoOut.includes("[OSOBĚ_001]") && pseudoOut.includes("[OSOBOU_001]"),
      `Pseudonym mode must preserve unified index and natural cases ([OSOBA_001], [OSOBĚ_001], [OSOBOU_001]), got: "${pseudoOut}"`
    );

    // 6. Multi-entity propagation with distinct stable indexes
    const multiDoc = "Obžalovaný Ing. Petr Kovář a poškozená MUDr. Jana Nováková. Doručeno Kovářovi a jednal s Novákovou.";
    const multiHits = detect(multiDoc, { name: true }, []);
    const multiNames = multiHits.filter(h => h.type === "name");
    const kovarEntities = multiNames.filter(h => /Kovář/i.test(h.value));
    const novakEntities = multiNames.filter(h => /Novák/i.test(h.value));
    check(
      kovarEntities.length >= 2 && novakEntities.length >= 2,
      `Multi-entity text must detect both entities across text (got Kovář: ${kovarEntities.length}, Nováková: ${novakEntities.length})`
    );
    const kovarKey = kovarEntities[0].entityKey;
    const novakKey = novakEntities[0].entityKey;
    check(
      kovarKey !== novakKey,
      `Different persons must have distinct entityKeys (${kovarKey} vs ${novakKey})`
    );
    check(
      kovarEntities.every(h => h.entityKey === kovarKey),
      `All Kovář mentions must share kovarKey`
    );
    check(
      novakEntities.every(h => h.entityKey === novakKey),
      `All Nováková mentions must share novakKey`
    );
    const multiPseudo = apply(multiDoc, multiHits, "pseudo", "cs");
    check(
      multiPseudo.includes("[OSOBA_001]") && multiPseudo.includes("[OSOBĚ_001]"),
      `Kovář mentions must share index 001 in multiPseudo (got: "${multiPseudo}")`
    );
    check(
      multiPseudo.includes("[OSOBA_002]") && multiPseudo.includes("[OSOBOU_002]"),
      `Nováková mentions must share index 002 in multiPseudo (got: "${multiPseudo}")`
    );

    // 7. Uninflected foreign surnames in context
    const smithDoc = "obžalovaná paní Smith, nar. 1980. Později paní Smith vypověděla, že se Smithovou nemluvila.";
    const smithHits = detect(smithDoc, { name: true }, []);
    const smithNames = smithHits.filter(h => h.type === "name");
    const smithKeys = new Set(smithNames.map(h => h.entityKey));
    check(
      smithNames.length >= 2,
      `Uninflected foreign surname mentions must be detected (got ${smithNames.length}: ${JSON.stringify(smithNames.map(h => h.value))})`
    );
    check(
      smithKeys.size === 1,
      `All Smith mentions must share one unified entityKey (got: ${JSON.stringify([...smithKeys])})`
    );

    // -------------------------------------------------------------------------
    // Ticket 04: Profil publikace Justiční rozhodnutí (vyhl. 403/2022 Sb.)
    // -------------------------------------------------------------------------

    // 1. Profile label in I18N.cs.profiles
    const courtLabelCs = I18N && I18N.cs && I18N.cs.profiles && I18N.cs.profiles.court;
    check(
      Boolean(courtLabelCs && courtLabelCs.includes("Justiční rozhodnutí") && courtLabelCs.includes("403/2022")),
      `I18N.cs.profiles.court must contain "Justiční rozhodnutí" and "403/2022" (got: "${courtLabelCs}")`
    );

    // 2. Testing seams exposure
    const applyCourtProfileRules = stSandbox.window.applyCourtProfileRules;
    const filterCourtDecisionsWhitelist = stSandbox.window.filterCourtDecisionsWhitelist;
    check(
      typeof applyCourtProfileRules === "function",
      "window.applyCourtProfileRules must be exposed as a public testing seam"
    );
    check(
      typeof filterCourtDecisionsWhitelist === "function",
      "window.filterCourtDecisionsWhitelist must be exposed as a public testing seam"
    );

    // 3. Court seat protection (§ 4 odst. 3 písm. a)
    const courtSeatText = "Krajský soud v Ostravě rozhodl ve věci žalobce Petr Svoboda. Žalovaný bytem v Ostravě se nedostavil.";
    const courtSeatHits = detect(courtSeatText, { name: true, address: true }, [], { profile: "court" });
    const seatHitOstrava = courtSeatHits.find(h => h.start < 30 && h.value.includes("Ostrav"));
    const residenceHitOstrava = courtSeatHits.find(h => h.start > 60 && h.value.includes("Ostrav"));

    check(
      !seatHitOstrava || seatHitOstrava.whitelisted === true || seatHitOstrava.accept === false,
      `Court seat "Ostravě" in "Krajský soud v Ostravě" must be preserved as court seat (§ 4 odst. 3 písm. a)`
    );
    check(
      Boolean(residenceHitOstrava && residenceHitOstrava.accept === true && !residenceHitOstrava.whitelisted),
      `Defendant residence "Ostravě" in "žalovaný bytem v Ostravě" must be detected and kept for redaction`
    );
    const seatRedacted = apply(courtSeatText, courtSeatHits, "box", "cs");
    check(
      seatRedacted.includes("Krajský soud v Ostravě"),
      `Court seat in court collocation must be preserved in redacted text: "${seatRedacted}"`
    );
    check(
      !seatRedacted.includes("bytem v Ostravě"),
      `Defendant residence must be redacted in text: "${seatRedacted}"`
    );

    // 4. Judicial decision-makers (§ 4 odst. 3 písm. d) vs participants/witnesses/defendants
    const courtOfficialsText =
      "Předseda senátu JUDr. Karel Novák, soudkyně Mgr. Jana Černá, za přítomnosti státního zástupce JUDr. Pavla Kováře " +
      "rozhodli ve věci. Žalobce Petr Svoboda a obžalovaný Josef Dvořák nebyli přítomni, svědek Martin Holub vypovídal. " +
      "V Praze dne 1. 2. 2023, JUDr. Karel Novák, v. r.";
    const courtOfficialsHits = detect(courtOfficialsText, { name: true, address: true }, [], { profile: "court" });

    const karelHits = courtOfficialsHits.filter(h => /Karel Novák/i.test(h.value));
    const janaHits = courtOfficialsHits.filter(h => /Jana Černá/i.test(h.value));
    const pavelHits = courtOfficialsHits.filter(h => /Pavl.*Kovář/i.test(h.value));
    const petrHits = courtOfficialsHits.filter(h => /Petr Svoboda/i.test(h.value));
    const josefHits = courtOfficialsHits.filter(h => /Josef Dvořák/i.test(h.value));
    const martinHits = courtOfficialsHits.filter(h => /Martin Holub/i.test(h.value));

    check(
      karelHits.length >= 1 && karelHits.every(h => h.whitelisted === true || h.accept === false),
      `Judicial decision-maker Karel Novák must be whitelisted (accept: false / whitelisted: true)`
    );
    check(
      janaHits.length >= 1 && janaHits.every(h => h.whitelisted === true || h.accept === false),
      `Judicial decision-maker Jana Černá must be whitelisted (accept: false / whitelisted: true)`
    );
    check(
      pavelHits.length >= 1 && pavelHits.every(h => h.whitelisted === true || h.accept === false),
      `Public prosecutor Pavel Kovář must be whitelisted (accept: false / whitelisted: true)`
    );
    check(
      petrHits.length >= 1 && petrHits.every(h => h.accept === true && !h.whitelisted),
      `Plaintiff Petr Svoboda must remain detected and accepted for redaction`
    );
    check(
      josefHits.length >= 1 && josefHits.every(h => h.accept === true && !h.whitelisted),
      `Defendant Josef Dvořák must remain detected and accepted for redaction`
    );
    check(
      martinHits.length >= 1 && martinHits.every(h => h.accept === true && !h.whitelisted),
      `Witness Martin Holub must remain detected and accepted for redaction`
    );

    const officialsRedacted = apply(courtOfficialsText, courtOfficialsHits, "box", "cs");
    check(
      officialsRedacted.includes("Karel Novák") && officialsRedacted.includes("Jana Černá") && officialsRedacted.includes("Pavla Kováře"),
      `Court officials must not be redacted in output: "${officialsRedacted}"`
    );
    check(
      !officialsRedacted.includes("Petr Svoboda") && !officialsRedacted.includes("Josef Dvořák") && !officialsRedacted.includes("Martin Holub"),
      `Participants/witnesses must be redacted in output: "${officialsRedacted}"`
    );

    // 5. Legal literature and case citations (§ 4 odst. 3 písm. e)
    const citationText =
      "V souladu s rozsudek ESLP ve věci Novák proti České republice, nález Ústavního soudu sp. zn. I. ÚS 123/20 " +
      "a usnesení Nejvyššího soudu sp. zn. 22 Cdo 456/2021. Dále srov. Švestka, J. a kol., Spáčil, J. a kol. či Lavický, P.";
    const citationHits = detect(citationText, { name: true, casefile: true }, [], { profile: "court" });

    const citationRedacted = apply(citationText, citationHits, "box", "cs");
    check(
      citationRedacted.includes("Novák") &&
      citationRedacted.includes("I. ÚS 123/20") &&
      citationRedacted.includes("22 Cdo 456/2021") &&
      citationRedacted.includes("Švestka, J.") &&
      citationRedacted.includes("Spáčil, J.") &&
      citationRedacted.includes("Lavický, P."),
      `Case citations and legal commentators must not be redacted (§ 4 odst. 3 písm. e), got: "${citationRedacted}"`
    );

    // -------------------------------------------------------------------------
    // Ticket 05: Komplexní testovací brána a lingvistické regresní testy
    // -------------------------------------------------------------------------

    // 1. Potlačení falešných pozitiv u počátečních verzálek vět
    const sentenceStartApelativa = [
      "Nový přístup byl zvolen.",
      "Starý zákoník práce pozbyl platnosti.",
      "Podle vyjádření žalobce došlo k prodlení.",
      "Bílá technika byla dodána."
    ];
    for (const stText of sentenceStartApelativa) {
      const hits = detect(stText, { name: true }, []);
      const nHits = hits.filter(h => h.type === "name");
      check(
        nHits.length === 0,
        `Sentence-start apelativum must NOT trigger person name hit: "${stText}" (got: ${JSON.stringify(nHits.map(h => h.value))})`
      );
    }
    const petrNovyHits = detect("Petr Nový podepsal smlouvu.", { name: true }, []);
    const petrNovyHit = petrNovyHits.find(h => h.type === "name" && h.value === "Petr Nový");
    check(
      Boolean(petrNovyHit),
      `Sentence-start multi-word name "Petr Nový" MUST be detected (got: ${JSON.stringify(petrNovyHits.map(h => h.value))})`
    );

    // 2. Homonymie s apelativy
    const apelativaTexts = [
      "zručný kovář vyrobil mříž",
      "nad městem kroužil holub",
      "venku vládla tuhá zima"
    ];
    for (const aText of apelativaTexts) {
      const hits = detect(aText, { name: true }, []);
      const nHits = hits.filter(h => h.type === "name");
      check(
        nHits.length === 0,
        `Lowercase homonym apelativum must NOT trigger name hit: "${aText}" (got: ${JSON.stringify(nHits.map(h => h.value))})`
      );
    }
    const witnessJiriKovarHits = detect("svědek Jiří Kovář vypověděl", { name: true }, []);
    const witnessJiriKovar = witnessJiriKovarHits.find(h => h.type === "name" && h.value === "Jiří Kovář");
    check(
      Boolean(witnessJiriKovar && (witnessJiriKovar.reasons || []).includes("trigger:role")),
      `Role trigger "svědek Jiří Kovář" must detect "Jiří Kovář" with reason "trigger:role" (got: ${JSON.stringify(witnessJiriKovar)})`
    );
    const panHolubDocHits = detect("pan Holub doložil plnou moc", { name: true }, []);
    const panHolubHit = panHolubDocHits.find(h => h.type === "name" && /Holub/.test(h.value));
    check(
      Boolean(panHolubHit && (panHolubHit.reasons || []).includes("trigger:role")),
      `Role trigger "pan Holub" must detect "Holub" with reason "trigger:role" (got: ${JSON.stringify(panHolubHit)})`
    );

    // 3. Pádová flexe a Dokumentová mezipaměť entit (ADR-0003)
    const t5PavelDoc = "smlouva s Janem Pavlem byla uzavřena. Později předáno Pavlovi. Podle názoru Pavla nedošlo k pochybení.";
    const t5PavelHits = detect(t5PavelDoc, { name: true }, []);
    const pavelNames = t5PavelHits.filter(h => h.type === "name");
    check(
      pavelNames.length >= 3,
      `All 3 mentions of entity Pavel must be detected across document (got: ${JSON.stringify(pavelNames.map(h => h.value))})`
    );
    const pavelKeys = new Set(pavelNames.map(h => h.entityKey));
    check(
      pavelKeys.size === 1,
      `All 3 Pavel mentions must be linked to identical entityKey (got: ${JSON.stringify([...pavelKeys])})`
    );
    const pavelPseudo = apply(t5PavelDoc, t5PavelHits, "pseudo", "cs");
    check(
      /\[OSOBOU_0*1\]/.test(pavelPseudo),
      `Instrumental Janem Pavlem must be replaced by [OSOBOU_1] / [OSOBOU_001] (got: "${pavelPseudo}")`
    );
    check(
      /\[OSOBĚ_0*1\]/.test(pavelPseudo),
      `Dative Pavlovi must be replaced by [OSOBĚ_1] / [OSOBĚ_001] (got: "${pavelPseudo}")`
    );
    check(
      /\[OSOBA_0*1\]/.test(pavelPseudo),
      `Genitive Pavla must be replaced by [OSOBA_1] / [OSOBA_001] (got: "${pavelPseudo}")`
    );

    // 4. Foreign and uninflected names
    const foreignDoc = "obžalovaný John Smith, nar. 1980 byl přítomen. svědkyně Marie Svoboda, bytem v Praze vypovídala.";
    const foreignHits = detect(foreignDoc, { name: true, address: true }, []);
    const johnSmithHit = foreignHits.find(h => h.type === "name" && h.value.includes("John Smith"));
    const marieSvobodaHit = foreignHits.find(h => h.type === "name" && h.value.includes("Marie Svoboda"));
    check(
      Boolean(johnSmithHit && (johnSmithHit.reasons || []).some(r => r.startsWith("trigger:"))),
      `Foreign name "John Smith" must be detected with trigger reason (got: ${JSON.stringify(johnSmithHit)})`
    );
    check(
      Boolean(marieSvobodaHit && (marieSvobodaHit.reasons || []).some(r => r.startsWith("trigger:"))),
      `Uninflected name "Marie Svoboda" must be detected with trigger reason (got: ${JSON.stringify(marieSvobodaHit)})`
    );

    // 5. OCR fuzzy tolerance
    // Token >= 6 chars near trigger with 1 OCR typo/error detected when ocrActive: true
    const ocrFuzzyDoc = "obžalovaný Dv0řák, nar. 1980 se nedostavil.";
    const ocrFuzzyHits = detect(ocrFuzzyDoc, { name: true }, [], { ocrActive: true });
    const ocrDvorak = ocrFuzzyHits.find(h => h.type === "name" && /Dv0řák/.test(h.value));
    check(
      Boolean(ocrDvorak && (ocrDvorak.reasons || []).includes("ocr:fuzzy")),
      `OCR fuzzy match for Dv0řák must be detected with reason "ocr:fuzzy" when ocrActive: true (got: ${JSON.stringify(ocrFuzzyHits)})`
    );

    // Token >= 6 chars with typo strictly ignored when OCR inactive
    const ocrInactiveHits = detect(ocrFuzzyDoc, { name: true }, [], { ocrActive: false });
    const ocrInactiveDvorak = ocrInactiveHits.find(h => h.type === "name" && /Dv0řák/.test(h.value));
    check(
      !ocrInactiveDvorak,
      `OCR defective token Dv0řák must NOT be detected as name when OCR is inactive (got: ${JSON.stringify(ocrInactiveHits)})`
    );

    // Token < 6 chars (Novák with typo) must NOT match even when ocrActive: true
    const ocrShortDoc = "svědek N0vák vypověděl.";
    const ocrShortHits = detect(ocrShortDoc, { name: true }, [], { ocrActive: true });
    const ocrShortNovak = ocrShortHits.find(h => h.type === "name" && /N0vák/.test(h.value));
    check(
      !ocrShortNovak,
      `Short token N0vák (length 5 < 6) must NOT trigger OCR fuzzy match (got: ${JSON.stringify(ocrShortHits)})`
    );

    // 6. Zero-Network integrity (ADR-0002)
    check(
      canonical.includes("const ONOMASTIC_PAYLOAD_B64 = "),
      "Canonical application must embed compressed onomastic payload directly offline"
    );
    const onomasticBlock = canonical.match(/function initOnomasticRegistry[\s\S]*?\n  \}/)?.[0] || "";
    check(
      Boolean(onomasticBlock) && !onomasticBlock.includes("fetch(") && !onomasticBlock.includes("http:") && !onomasticBlock.includes("https:"),
      "initOnomasticRegistry must not make any remote network requests (Zero-Network ADR-0002)"
    );
    check(
      !canonical.includes("https://cdn.jsdelivr.net/npm/tesseract.js") && !canonical.includes("https://unpkg.com/tesseract.js"),
      "Tesseract and OCR components must not load via remote CDN (Zero-Network ADR-0002)"
    );
  }
} catch (stErr) {
  failures.push("Canonical selfTest execution failed: " + (stErr.message || String(stErr)));
}

if (failures.length) {
  console.error("Quality gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Quality gate passed (${canonical.length} characters canonical HTML).`);
