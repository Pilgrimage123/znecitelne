# Implementation Plan: Bug Fixes, Dead Code Removal & Smart State Architecture

## 1. Logic & Runtime Bug Fixes

### 1.1 SPZ (License Plate) Unconditional Match Bug (`src/core/detector.js`)
- **Issue**: On line 450, the medium-suspicion SPZ detector ends with `return ctxHas(f,i,i+v.length,["spz","vozid","značk","plate"], win) || true;`. The trailing `|| true` short-circuits the context check, causing any `[1-9][A-ZÁ]{1,2}\s?\d{4}` alphanumeric code (e.g. room numbers, parcel codes, model numbers) to match unconditionally even when context keywords are absent in medium suspicion mode.
- **Fix**: Remove `|| true` so that in medium-suspicion mode (`win > 0`), SPZ candidates without an internal space require either surrounding vehicle/plate context keywords (`ctxHas(...)`) or explicit space formatting (`\s` between region code and digits), while high-suspicion mode (`win === 0`) continues to match broadly via `ctxHas(..., 0)` returning `true`.

### 1.2 Unscoped Global Library Lookups (`src/formats/ingest.js`, `src/ui/app.js`)
- **Issue**:
  - `src/formats/ingest.js` (line 168) resolves `tesseractLib` on line 116, but calls `Tesseract.createWorker("ces", 1, ...)` directly instead of `tesseractLib.createWorker(...)`, risking a `ReferenceError` when `Tesseract` is attached to `window` or `globalThis` rather than lexical scope.
  - `src/ui/app.js` (line 2025) resolves `flateLib` on line 2022, checks `if (S.kind === "docx" && S.sourceBuf && flateLib)`, and then calls `window.fflate.unzipSync(...)` instead of `flateLib.unzipSync(...)`.
- **Fix**: Replace both calls with `tesseractLib.createWorker(...)` and `flateLib.unzipSync(...)`.

### 1.3 Broken Queue Item Removal & Stale Header Queue Badge (`src/ui/app.js`)
- **Issue**: `removeQueueItem(idx)` (line 2536) and `onFiles()` (line 2324) call `renderQueue()`, which looks up `$("queueBar")` — a DOM element removed in ADR-0013 (`2026.10.20-ai47`). Removing a non-active item from the batch queue popover therefore fails to refresh the queue count badge and popover list.
- **Fix**: Replace calls to `renderQueue()` with `paintWorkBar()` / `paint()`, and ensure `removeQueueItem(idx)` refreshes both the header queue badge and the open queue popover list.

### 1.4 Replace Native `window.prompt()` with In-App Password Modal (`src/ui/app.js`, `src/template.html`)
- **Issue**: `exportSessionPrompt()` (lines 1210, 1212) and `onFile()` when loading `.znecitelne-session` (line 2284) use native `prompt()`, which is blocked in sandboxed iframe environments and inconsistent with `showConfirm()` (which replaced native `confirm()`).
- **Fix**: Extend the existing `#confirmModal` (or add a dedicated password input row inside `#confirmModal`) with `showPasswordPrompt({ title, message, confirmLabel, requireRepeat })` returning a `Promise<string|null>`. Wire `exportSessionPrompt()` and `.znecitelne-session` import in `onFile()` to `await showPasswordPrompt(...)`.

### 1.5 Review Panel Cache Invalidation Bug (`src/ui/app.js`)
- **Issue**: In `paintReview()` (line 1795), `_reviewCache.key` is computed only from `S.hits.length`, `acceptedCount`, and `acceptedSig` (sum of `h.id` for accepted hits) plus language/mode/step. It does not invalidate when:
  - Custom replacement dictionaries (`S.secrets`, `S.systems`, `S.projects`, `S.orgs`) change,
  - Document profile (`S.profile`) or legal basis (`h.legalBasis`, `h.legalCustom`) changes,
  - A hit's value or span (`h.value`, `h.start`, `h.end`) is edited without changing its `id` or `accept` boolean.
- **Fix**: Include a lightweight state revision counter `S.rev` (incremented on hit/dictionary/profile mutations) or include dictionary & span signatures in `cacheKey` so `paintReview()` and entity grouping always reflect current replacements.

### 1.6 Redundant Condition & Span Sort Comparator (`src/ui/app.js`, `src/core/detector.js`)
- **Issue**:
  - `src/ui/app.js` (lines 1188–1189) has a duplicate nested `if (Q.cur >= 0 && Q.items[Q.cur])` check in `paintSmartBanners()`.
  - `src/core/detector.js` (line 894) sorts hits with `(b.end-a.start)-(a.end-a.start)` instead of `(b.end-b.start)-(a.end-a.start)`.
- **Fix**: Deduplicate the nested `if` in `paintSmartBanners()` and write the span-length tie-breaker clearly as `(b.end - b.start) - (a.end - a.start)`.

---

## 2. Dead Code & Obsolete Remnant Removal

1. **Remove Unbundled `src/worker/worker.js`**:
   - Delete `src/worker/worker.js` and remove `"src/worker/worker.js"` from `requiredModules` in `build.js` (it was never included in `bundleModules` or imported anywhere).
2. **Remove Unused Marquee Stubs & CSS (`src/ui/movie.js`, `src/ui/app.js`, `src/template.html`)**:
   - Remove empty no-op exports `initActionMarquees` and `startTextMarquee` from `src/ui/movie.js` and their unused import in `src/ui/app.js`.
   - Remove dead `.chip-track`, `.chip-content-clone`, and `@keyframes chipMarquee` rules from `src/template.html`.
3. **Remove Obsolete `renderQueue()` and `barPos` Remnants (`src/ui/app.js`)**:
   - Remove dead `renderQueue()` function (lines 2540–2569) targeting non-existent `#queueBar`.
   - Clean up obsolete `S.barPos`, `znec-barpos` storage reads, and `barPos` in `SNAP_SETTING_KEYS`, simplifying `applyBarPos()` into a clean layout-variable updater (`syncStickyOffsets()`).
4. **Remove Permanently Hidden `#landingSettingsDetails` (`src/template.html`, `src/ui/app.js`)**:
   - `#landingSettingsDetails` has both `class="settings hidden"` and `style="display:none"`, yet `paintLanding()` re-renders `#settingsMount` into it on every render (settings live in `#settingsModal`). Remove the hidden duplicate mount from `src/template.html` and `paintLanding()`.
5. **Remove Empty Conditional Blocks (`src/formats/xlsx.js`, `src/ui/app.js`)**:
   - Clean up empty `if (wb.Workbook && wb.Workbook.WBProps) {}` in `src/formats/xlsx.js` (actually delete `wb.Workbook.WBProps` when present to strip workbook metadata) and remove the empty `if (fromEl && tipAnchor && ...) {}` block in `src/ui/app.js`.

---

## 3. Resolving Inconsistencies

1. **Circular Dependency Between `morphology.js` and `detector.js`**:
   - `src/core/detector.js` imports from `src/core/morphology.js`, while `src/core/morphology.js` (line 535) has `export { declinedPersonTokenBase } from "./detector.js"`.
   - Move `declinedPersonTokenBase` into `src/core/morphology.js` (where all other Czech declension helpers live) and re-export it from `src/core/detector.js` so existing callers (`test.js`, `propagation.js`, `detector.js`) remain 100% compatible without a circular module graph.
2. **i18n Parity & Accuracy (`src/core/i18n.js`)**:
   - Add missing `processedLocally: "Processed locally"` key to `I18N.en` to match `I18N.cs`.
   - Fix `I18N.en.pdfaDecl` and `I18N.en.pdfaNote` so they accurately reflect that sRGB `OutputIntent` and XMP `pdfaid` metadata **are** embedded (matching `I18N.cs` and `src/formats/pdf.js`).
   - Update `I18N.cs.inspireList` and `I18N.en.inspireList` so already-shipped features (four-eyes `.znecitelne-session` handoff, visual PDF preview, DOCX round-trip XML sanitization, and multi-file batch queue) are not listed as "not implemented yet".
3. **Normalize `S.seen` Tracking Across Hits & Sessions (`src/ui/app.js`, `src/crypto/session.js`)**:
   - Ensure `S.seen` consistently tracks hit IDs across manual review, entity-level toggling (`patchEntity`), morphology propagation, and session import/export while also supporting string keys if passed in unit tests.

---

## 4. Smart Data Structure & State Architecture Improvements (In-Place)

While preserving `S`, `Q`, and `CanonicalDocument` signatures for full test compatibility:

1. **Eliminate Duplicate Binary Buffers in Batch Queue (`Q.items` vs `snapState`)**:
   - Currently, each item in `Q.items` holds `it.doc` (with `sourceBuf: ArrayBuffer`, `pages`, `text`, `cellMap`) **and** `it.snap` (where `snapState()` clones `S.sourceBuf.slice(0)`, `pages`, `text`, `cellMap` again), doubling RAM usage for every queued PDF/DOCX/XLSX.
   - Refactor `snapState()` / `restoreSnap()` so immutable document payload fields (`sourceBuf`, `text`, `pages`, `noTextPages`, `cellMap`, `hashIn`, `sigDetected`) reference the frozen `CanonicalDocument` (`S.doc` / `it.doc`) rather than cloning multi-megabyte `ArrayBuffer` instances on every queue switch, cloning `sourceBuf` only at the moment a format exporter mutates bytes.
2. **Initialize & Maintain `S.auditTrail`, `S.legalReason`, and `S.rev` on `S`**:
   - Explicitly initialize `auditTrail: []`, `legalReason: ""`, `rev: 0`, and `doc: null` in `S` and `reset()`.
   - Record structured audit entries in `S.auditTrail` when hits/entities are toggled, added manually, or propagated so `exportSession()`, `importSession()`, and `buildAudit()` have complete provenance data.
3. **Indexed Entity & Hit Lookup Helper**:
   - Memoize `groupHitsIntoEntities(S.hits)` keyed by `S.rev` (and replacement settings signature) so repeated UI renders (`paintWorkBar`, `paintReview`, `paintEntitySummary`, `updateExportReadiness`) reuse the computed entity map and bound replacer instead of rebuilding entity groups and replacer closures multiple times per frame.

---

## 5. Verification Plan

1. Rebuild the single-file artifact (`znecitelne.html`) via `node build.js`.
2. Add unit tests in `test.js` covering:
   - Medium-suspicion SPZ context filtering vs high-suspicion SPZ matching,
   - Circular-free `declinedPersonTokenBase` import from both `morphology.js` and `detector.js`,
   - Memory-deduplicated `snapState()` / `restoreSnap()` with `CanonicalDocument` and `auditTrail` preservation,
   - `i18n` key parity between `I18N.cs` and `I18N.en`.
3. Run `node test.js` and `compile_applet` to verify all unit, regression, and bundle checks pass.
