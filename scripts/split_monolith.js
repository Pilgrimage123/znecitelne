import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync("znecitelne.html", "utf8");

mkdirSync("src/core", { recursive: true });
mkdirSync("src/formats", { recursive: true });
mkdirSync("src/crypto", { recursive: true });
mkdirSync("src/worker", { recursive: true });
mkdirSync("src/ui", { recursive: true });

function extractSnippet(startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) throw new Error("Start marker not found: " + startMarker);
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx === -1) throw new Error("End marker not found: " + endMarker);
  return html.slice(startIdx, endIdx);
}

console.log("Splitting znecitelne.html into ES modules...");

// 1. Onomastic
const onomasticSnippet = extractSnippet("function stripTitle(token){", "  function stemNamePart(token){");
const onomasticCode = `import { NAMES } from "./rules.js";

` + onomasticSnippet
  .replace(/function stripTitle/g, "export function stripTitle")
  .replace(/const ONOMASTIC_PAYLOAD_B64/g, "export const ONOMASTIC_PAYLOAD_B64")
  .replace(/function createOnomasticTrie/g, "export function createOnomasticTrie")
  .replace(/function initOnomasticRegistry/g, "export function initOnomasticRegistry")
  .replace(/function isOnomasticName/g, "export function isOnomasticName");

writeFileSync("src/core/onomastic.js", onomasticCode, "utf8");
console.log("-> src/core/onomastic.js");

// 2. Morphology
const morphChunk1 = extractSnippet("function stemNamePart(token){", "  class EntityPropagationCache {");
const morphChunk2 = extractSnippet("  function isLikelyNonPersonName(value, src, start, end, reasons){", "  function detect(text, enabled, secrets, options){");
const morphChunk3 = extractSnippet("  function declinedPersonTokenBase(base, h, lang){", "  function makeReplacer(mode, lang){");

const morphologyCode = `import { NAMES, FIRST_NAMES, TITLES, PUBLIC } from "./rules.js";
import { stripTitle, isOnomasticName, initOnomasticRegistry } from "./onomastic.js";

` + (morphChunk1 + "\n" + morphChunk2 + "\n" + morphChunk3)
  .replace(/const RE_AGENDA_APELATIVA =/g, "export const RE_AGENDA_APELATIVA =")
  .replace(/const RE_PAST_L_PARTICIPLE =/g, "export const RE_PAST_L_PARTICIPLE =")
  .replace(/const RE_PASSIVE_PARTICIPLE =/g, "export const RE_PASSIVE_PARTICIPLE =")
  .replace(/const ADMIN_VERB_STEMS =/g, "export const ADMIN_VERB_STEMS =")
  .replace(/const RE_CZECH_SURNAMES =/g, "export const RE_CZECH_SURNAMES =")
  .replace(/const ROLE_WORDS_SET =/g, "export const ROLE_WORDS_SET =")
  .replace(/function stemNamePart/g, "export function stemNamePart")
  .replace(/function isCzechVerbOrParticiple/g, "export function isCzechVerbOrParticiple")
  .replace(/function looksName/g, "export function looksName")
  .replace(/function nameKey/g, "export function nameKey")
  .replace(/function canonToken/g, "export function canonToken")
  .replace(/function systemCore/g, "export function systemCore")
  .replace(/function accountKey/g, "export function accountKey")
  .replace(/function nameInitial/g, "export function nameInitial")
  .replace(/function clusterNameKeys/g, "export function clusterNameKeys")
  .replace(/function declineCzechFirstName/g, "export function declineCzechFirstName")
  .replace(/function declineCzechSurname/g, "export function declineCzechSurname")
  .replace(/function generateCzechNameForms/g, "export function generateCzechNameForms")
  .replace(/function isLikelyNonPersonName/g, "export function isLikelyNonPersonName")
  .replace(/function isSentenceStart/g, "export function isSentenceStart")
  .replace(/function declinedPersonTokenBase/g, "export function declinedPersonTokenBase");

writeFileSync("src/core/morphology.js", morphologyCode, "utf8");
console.log("-> src/core/morphology.js");

// 3. Propagation
const propagationSnippet = extractSnippet("class EntityPropagationCache {", "  function isPublic(text){");
const propagationCode = `import {
  stemNamePart, looksName, nameKey, declineCzechSurname, generateCzechNameForms,
  isLikelyNonPersonName, isCzechVerbOrParticiple, RE_AGENDA_APELATIVA, ROLE_WORDS_SET
} from "./morphology.js";
import { stripTitle, isOnomasticName } from "./onomastic.js";
import { FIRST_NAMES, TITLES, NAMES } from "./rules.js";

export ` + propagationSnippet
  .replace(/function createEntityPropagationCache/g, "export function createEntityPropagationCache")
  .replace(/function expandCzechNameMorphology/g, "export function expandCzechNameMorphology")
  .replace(/function alignDictEntity/g, "export function alignDictEntity");

writeFileSync("src/core/propagation.js", propagationCode, "utf8");
console.log("-> src/core/propagation.js");

// 4. Detector
const valHelpers = extractSnippet("function digits(s){", "  function stripTitle(token){");
const detectPrep = extractSnippet("function isPublic(text){", "  function isLikelyNonPersonName(value, src, start, end, reasons){");
const detectCore = extractSnippet("function detect(text, enabled, secrets, options){", "  function declinedPersonTokenBase(base, h, lang){");
const replacerCore = extractSnippet("function makeReplacer(mode, lang){", "  function xlsxToText(wb){");

const detectorCode = `import { PII_KEYS, ORG_KEYS, KEYS, RULES, LABEL, TICKET_STOP, STATUS_GENERIC, PUBLIC, FIRST_NAMES, TITLES, NAMES } from "./rules.js";
import { stripTitle, isOnomasticName, initOnomasticRegistry } from "./onomastic.js";
import {
  stemNamePart, isCzechVerbOrParticiple, looksName, nameKey, canonToken,
  systemCore, accountKey, nameInitial, clusterNameKeys, isLikelyNonPersonName,
  isSentenceStart, declinedPersonTokenBase, RE_AGENDA_APELATIVA, ROLE_WORDS_SET,
  RE_CZECH_SURNAMES
} from "./morphology.js";
import { createEntityPropagationCache, expandCzechNameMorphology, alignDictEntity } from "./propagation.js";

` + (valHelpers + "\n" + detectPrep + "\n" + detectCore + "\n" + replacerCore)
  .replace(/function pageOf\(start\)\{([\s\S]*?)return S\.pages\[S\.pages\.length-1\]\.n;\s*\}/g, "function pageOf(start, pagesList){\n    const pList = pagesList || ((typeof globalThis !== 'undefined' && globalThis.S && globalThis.S.pages) || (typeof S !== 'undefined' && S.pages) || []);\n    if (!pList || !pList.length) return 1;\n    for (const p of pList) if (start >= p.start && start < p.end) return p.n;\n    return pList[pList.length-1].n;\n  }")
  .replace(/function projectPrefixes\(\)\{([\s\S]*?)parseDict\(S\.projects\)/g, "function projectPrefixes(dictRaw){\n    const dict = dictRaw != null ? dictRaw : ((typeof globalThis !== 'undefined' && globalThis.S && globalThis.S.projects) || (typeof S !== 'undefined' && S.projects) || '');\n    const set = new Set();\n    parseDict(dict)")
  .replace(/const sus = S\.suspicion \|\| "medium";/g, 'const sState = (typeof globalThis !== "undefined" && globalThis.S) || (typeof S !== "undefined" ? S : null) || {};\n    const sus = (options && options.suspicion) || sState.suspicion || "medium";')
  .replace(/const isOcr = Boolean\(\(options && \(options\.ocrActive \|\| options\.ocr\)\) \|\| S\.ocrActive\);/g, 'const isOcr = Boolean((options && (options.ocrActive || options.ocr)) || sState.ocrActive);')
  .replace(/dictPush\(S\.systems, "system"\);/g, 'dictPush((options && options.systems != null) ? options.systems : (sState.systems || ""), "system");')
  .replace(/parseDict\(S\.systems\)/g, 'parseDict((options && options.systems != null) ? options.systems : (sState.systems || ""))')
  .replace(/dictPush\(S\.projects, "project"\);/g, 'dictPush((options && options.projects != null) ? options.projects : (sState.projects || ""), "project");')
  .replace(/dictPush\(S\.orgs, "orgunit"\);/g, 'dictPush((options && options.orgs != null) ? options.orgs : (sState.orgs || ""), "orgunit");')
  .replace(/parseDict\(S\.systems\+"\\n"\+S\.projects\)/g, 'parseDict(((options && options.systems != null) ? options.systems : (sState.systems || "")) + "\\n" + ((options && options.projects != null) ? options.projects : (sState.projects || "")))')
  .replace(/const prof = \(options && options\.profile\) \|\| S\.profile;/g, 'const prof = (options && options.profile) || sState.profile || "publicai";')
  .replace(/function digits/g, "export function digits")
  .replace(/function parseRC/g, "export function parseRC")
  .replace(/function pageOf/g, "export function pageOf")
  .replace(/function toBytes/g, "export function toBytes")
  .replace(/function isValidICO/g, "export function isValidICO")
  .replace(/function isValidDIC/g, "export function isValidDIC")
  .replace(/function ibanOk/g, "export function ibanOk")
  .replace(/const IBAN_LEN/g, "export const IBAN_LEN")
  .replace(/const SWIFT_CC/g, "export const SWIFT_CC")
  .replace(/function ibanForeignOk/g, "export function ibanForeignOk")
  .replace(/function isPublic/g, "export function isPublic")
  .replace(/function tokenizeCtx/g, "export function tokenizeCtx")
  .replace(/function ctxSlice/g, "export function ctxSlice")
  .replace(/function matchNeedles/g, "export function matchNeedles")
  .replace(/function ctxHas/g, "export function ctxHas")
  .replace(/function ctxWhich/g, "export function ctxWhich")
  .replace(/function isContractDateCtx/g, "export function isContractDateCtx")
  .replace(/function makeWork/g, "export function makeWork")
  .replace(/function mapSpan/g, "export function mapSpan")
  .replace(/function parseDict/g, "export function parseDict")
  .replace(/function dictRe/g, "export function dictRe")
  .replace(/function urlSpans/g, "export function urlSpans")
  .replace(/function spanInUrl/g, "export function spanInUrl")
  .replace(/function trimUrlValue/g, "export function trimUrlValue")
  .replace(/function trimHitValue/g, "export function trimHitValue")
  .replace(/function findAll/g, "export function findAll")
  .replace(/function scoreHit/g, "export function scoreHit")
  .replace(/function finalizeHit/g, "export function finalizeHit")
  .replace(/function projectPrefixes/g, "export function projectPrefixes")
  .replace(/function detect\(/g, "export function detect(")
  .replace(/function applyCourtProfileRules/g, "export function applyCourtProfileRules")
  .replace(/function filterCourtDecisionsWhitelist/g, "export function filterCourtDecisionsWhitelist")
  .replace(/function tokenBase/g, "export function tokenBase")
  .replace(/function nextSuffix/g, "export function nextSuffix")
  .replace(/function makeReplacer/g, "export function makeReplacer")
  .replace(/function bindReplacer/g, "export function bindReplacer")
  .replace(/function buildGlossary/g, "export function buildGlossary")
  .replace(/function resolveHits/g, "export function resolveHits")
  .replace(/function effectiveHits/g, "export function effectiveHits")
  .replace(/function visibleHits/g, "export function visibleHits")
  .replace(/function topHits/g, "export function topHits")
  .replace(/function apply\(/g, "export function apply(");

writeFileSync("src/core/detector.js", detectorCode, "utf8");
console.log("-> src/core/detector.js");

// 5. XLSX
const xlsxSnippet1 = extractSnippet("function xlsxToText(wb){", "  // --- Fáze 4: zpětný export DOCX");
const xlsxSnippet2 = extractSnippet("function stripWorkbookMeta(wb){", "  function stampPdfMeta(doc, title){");

const xlsxCode = `import { bindReplacer, effectiveHits } from "../core/detector.js";

` + (xlsxSnippet1 + "\n" + xlsxSnippet2)
  .replace(/function xlsxToText/g, "export function xlsxToText")
  .replace(/async function extractXlsx/g, "export async function extractXlsx")
  .replace(/function exportXlsxFileFflate/g, "export function exportXlsxFileFflate")
  .replace(/function exportXlsxFile\(/g, "export function exportXlsxFile(")
  .replace(/function stripWorkbookMeta/g, "export function stripWorkbookMeta");

writeFileSync("src/formats/xlsx.js", xlsxCode, "utf8");
console.log("-> src/formats/xlsx.js");

// 6. DOCX
const docxSnippet1 = extractSnippet("const DOCX_REL_NS = ", "  function stripWorkbookMeta(wb){");
const docxSnippet2 = extractSnippet("function extractDocxTextWithFflate(buf){", "  function isImageFile(name, type){");

const docxCode = `import { bindReplacer, effectiveHits } from "../core/detector.js";

` + (docxSnippet1 + "\n" + docxSnippet2)
  .replace(/function docxRelationshipSourcePart/g, "export function docxRelationshipSourcePart")
  .replace(/function docxNormalizeZipPath/g, "export function docxNormalizeZipPath")
  .replace(/function docxResolveRelTarget/g, "export function docxResolveRelTarget")
  .replace(/function docxRelativeZipPath/g, "export function docxRelativeZipPath")
  .replace(/function docxSetTextPreservingSpace/g, "export function docxSetTextPreservingSpace")
  .replace(/function docxMakeWork/g, "export function docxMakeWork")
  .replace(/function docxReplaceInXml/g, "export function docxReplaceInXml")
  .replace(/function docxStripVisualObjects/g, "export function docxStripVisualObjects")
  .replace(/function docxStripMediaRelationships/g, "export function docxStripMediaRelationships")
  .replace(/function docxRemoveMediaParts/g, "export function docxRemoveMediaParts")
  .replace(/function docxAssertNoEmbeddedMedia/g, "export function docxAssertNoEmbeddedMedia")
  .replace(/function docxAssertNoDanglingRelationships/g, "export function docxAssertNoDanglingRelationships")
  .replace(/function docxStripMeta/g, "export function docxStripMeta")
  .replace(/async function exportDocxFile/g, "export async function exportDocxFile")
  .replace(/function extractDocxTextWithFflate/g, "export function extractDocxTextWithFflate");

writeFileSync("src/formats/docx.js", docxCode, "utf8");
console.log("-> src/formats/docx.js");

// 7. RTF & ODT
const rtfSnippet = extractSnippet("function decodeTextBuffer(buf){", "  function extractOdtText(buf){");
const rtfCode = `import { toBytes } from "../core/detector.js";\n\n` + rtfSnippet
  .replace(/function decodeTextBuffer/g, "export function decodeTextBuffer")
  .replace(/function isBinaryBuffer/g, "export function isBinaryBuffer")
  .replace(/function extractRtfText/g, "export function extractRtfText");
writeFileSync("src/formats/rtf.js", rtfCode, "utf8");
console.log("-> src/formats/rtf.js");

const odtSnippet = extractSnippet("function extractOdtText(buf){", "  function extractDocxTextWithFflate(buf){");
const odtCode = odtSnippet.replace(/function extractOdtText/g, "export function extractOdtText");
writeFileSync("src/formats/odt.js", odtCode, "utf8");
console.log("-> src/formats/odt.js");

// 8. PDF
const pdfQuadsSnippet = extractSnippet("function pdfWordQuads(glyphs){", "  function paintPdfVisualOverlays(){");
const pdfSigSnippet = extractSnippet("function pdfHasSignatureBytes(buf){", "  function localizeIngestError(err, fallbackFileName = \"\") {");
const pdfVerifySnippet = extractSnippet("function verifySanitizedPdfText(bytes, activeHits){", "  async function exportPdfTrueRedact(source, hits, title, mode, lang){");
const pdfStampSnippet = extractSnippet("function stampPdfMeta(doc, title){", "  function leakScan(text){");

const pdfCode = `// PDF format handling and security preflights (ADR-0001, ADR-0002)
import { toBytes } from "../core/detector.js";

function translit(ch){
  const map = { "á":"a","č":"c","ď":"d","é":"e","ě":"e","í":"i","ň":"n","ó":"o","ř":"r","š":"s","ť":"t","ú":"u","ů":"u","ý":"y","ž":"z",
                "Á":"A","Č":"C","Ď":"D","É":"E","Ě":"E","Í":"I","Ň":"N","Ó":"O","Ř":"R","Š":"S","Ť":"T","Ú":"U","Ů":"U","Ý":"Y","Ž":"Z" };
  return map[ch] || ch;
}

` + (pdfStampSnippet + "\n" + pdfQuadsSnippet + "\n" + pdfSigSnippet + "\n" + pdfVerifySnippet)
  .replace(/function stampPdfMeta/g, "export function stampPdfMeta")
  .replace(/function pdfWordQuads/g, "export function pdfWordQuads")
  .replace(/function pdfHasSignatureBytes/g, "export function pdfHasSignatureBytes")
  .replace(/function verifySanitizedPdfText/g, "export function verifySanitizedPdfText")
  .replace(/function assertSecurePdfBytes/g, "export function assertSecurePdfBytes");

writeFileSync("src/formats/pdf.js", pdfCode, "utf8");
console.log("-> src/formats/pdf.js");

// 9. Ingest
const ingestSnippet = extractSnippet("const IngestErrorCode = Object.freeze({", "  async function onFile(file){");
const ingestCode = `import { toBytes } from "../core/detector.js";
import { extractXlsx } from "./xlsx.js";
import { pdfHasSignatureBytes } from "./pdf.js";

async function sha256(buf){
  const subtle = globalThis.crypto ? globalThis.crypto.subtle : null;
  if (!subtle) return "mockhash";
  const h = await subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export ` + ingestSnippet
  .replace(/class DocumentIngestionError/g, "export class DocumentIngestionError")
  .replace(/function localizeIngestError/g, "export function localizeIngestError")
  .replace(/async function buildCanonicalDocument/g, "export async function buildCanonicalDocument")
  .replace(/function applyDocumentToState/g, "export function applyDocumentToState")
  .replace(/async function ingest\(/g, "export async function ingest(")
  .replace(/function isImageFile/g, "export function isImageFile")
  .replace(/async function handleImageFile/g, "export async function handleImageFile")
  .replace(/async function ingestDocument\(/g, "export async function ingestDocument(")
  .replace(/async function ingestDocumentBatch/g, "export async function ingestDocumentBatch");

writeFileSync("src/formats/ingest.js", ingestCode, "utf8");
console.log("-> src/formats/ingest.js");

console.log("All core and format modules extracted successfully!");
