# Code Audit & Safe Optimization: Znečitelně

Comprehensive audit and targeted remediation for **Znečitelně** (client-side offline document anonymization) resolving code inconsistencies, dead/duplicate code, and algorithmic bottlenecks to maximize processing speed and memory efficiency for large documents while preserving 100% of existing contracts and test suites.

## User Review & Critical Decisions

> [!IMPORTANT]
> The audit covers detection, export, and UI pipelines. As confirmed during clarification, remediation follows a **safe refactoring** strategy: preserving all public contracts, existing function signatures, and test gate invariants while eliminating algorithmic overhead and dead constructs.

- **Confirmed Decision (Scope)**: Full codebase audit across detection, export, and UI pipelines.
- **Confirmed Decision (Remediation Strategy)**: Identify issues and safely refactor without breaking existing contracts or public interfaces.
- **Confirmed Decision (Optimization Priority)**: Maximize processing speed and memory efficiency for large documents.

---

## 1. Overview & Core Concept

- **What It Does**: Conducts a static and algorithmic audit of the standalone monolithic application (`znecitelne.html`, `server.js`, and `test.js`), systematically identifying:
  1. **Dead & Redundant Code**: Duplicate helper implementations (`docxMakeWork` vs `makeWork`), vestigial DOM classes (`pv-prev-box`), and orphan routines.
  2. **Inconsistencies**: Legacy terminology divergence against `GLOSSARY.md` (e.g., "entity cache" in test names, internal "gazetteer" reason tagging) and inconsistent error/state normalization.
  3. **Bad Optimizations & Scalability Bottlenecks**: Severe memory reallocation patterns during redaction application (`apply()`), unbounded backward text slicing in linguistic triggers (`isSentenceStart()`), nested $O(E \cdot H \cdot F)$ loops in entity propagation (`EntityPropagationCache`), unindexed cell-to-hit filtering in spreadsheet exports, and redundant full-text scans on UI review renders.
- **Target Persona & Context**: Legal, compliance, and public administration users in the Czech Republic processing large sensitive documents (PDF, DOCX, XLSX, TXT) entirely offline in local browser memory without cloud exposure.
- **Key Value**: Orders-of-magnitude reduction in heap allocation and CPU time on multi-megabyte documents and hundreds of entities, eliminating browser freezes and stuttering while keeping the code clean, coherent, and verified by `npm test`.

---

## 2. User Experience & Visual Design

- **User Flows & Interaction**:
  - The UI and user experience remain identical in appearance and behavior.
  - Large document ingestion (multi-megabyte files with thousands of hits) becomes substantially more responsive during review, hit selection, and export generation.
  - Review list navigation (`paintReview`) responds smoothly without recomputing full-text leak scans on every single item selection or filter toggle.
- **Aesthetic Direction & Styling**:
  - Maintains the existing neutral, high-contrast, accessible light/dark theme defined in `znecitelne.html`.
  - Removes dead class reference `pv-prev-box` from the PDF visual overlay builder (`b.className = ...`) to prevent unstyled or orphaned DOM attributes.
- **Feedback & Responsiveness**:
  - Memory pressure is slashed, preventing tab crashes and GC stalls on memory-constrained client machines.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Linear-time String Reconstruction in `apply()`**:
  - *Chosen Approach*: Replace the reverse-slicing loop (`out = out.slice(0, h.start) + replacer(h) + out.slice(h.end)`) with a single-pass slice-and-join array builder that slices only the intervening untouched text segments and appends replacements in $O(L + H)$ time.
  - *Why*: In a 2 MB document with 1,500 hits, the existing reverse-slice loop re-slices the entire 2 MB document 1,500 times, copying over 3 GB of temporary strings into memory and causing massive GC pause times. The linear builder allocates only the necessary pieces once.
  - *Alternatives Considered*: In-place string mutation (impossible in JavaScript primitives) or regex replacement (risks unintended substring collisions).
- **Decision 2: Bounded Context Window in `isSentenceStart()`**:
  - *Chosen Approach*: Bound `text.slice(0, start)` to a maximum 200-character lookback window (`text.slice(Math.max(0, start - 200), start)`).
  - *Why*: `isSentenceStart` only inspects preceding punctuation (`.?!…`), line breaks, bullet points, and abbreviation patterns within 50–100 characters. Slicing from index 0 on a 500 KB document at offset 450,000 for every person candidate creates hundreds of megabytes of garbage.
- **Decision 3: Map-Based Lookups in `EntityPropagationCache` and `detect()`**:
  - *Chosen Approach*:
    1. In `EntityPropagationCache`, replace the triple-nested loop ($O(\text{Entities} \times \text{Hits} \times \text{Forms})$) with a pre-indexed `Map<lowercaseForm, entityKey>` enabling $O(1)$ form resolution.
    2. In `detect().push()`, replace `bag.find(...)` with a `Map<hitKey, hit>` to update duplicates in $O(1)$ rather than linear $O(N)$ scanning across the hit array.
  - *Why*: Prevents exponential slowdown on complex documents with numerous entities and repeated names across sections.
- **Decision 4: Memoized Review & Leak Scanning in `paintReview()`**:
  - *Chosen Approach*: Cache the result of `apply(S.text, S.hits, S.mode, S.lang)` and the residual leak scan (`leftovers`), invalidating the cache only when document text, hits, mode, or language actually change, rather than re-running full-text substring scans on simple UI clicks (such as selecting a hit).
  - *Why*: Clicking between hits in the review list should be instantaneous ($<5\text{ ms}$) rather than triggering a multi-megabyte string scan on each click.
- **Decision 5: Consolidation of Duplicate `docxMakeWork`**:
  - *Chosen Approach*: Remove `docxMakeWork` and route DOCX processing through the canonical `makeWork` function.
  - *Why*: Eliminates 18 lines of exact duplicate code and ensures Unicode space and hyphen normalizations remain in a single source of truth.
- **Decision 6: Preserving Compatibility While Aligning Terminology**:
  - *Chosen Approach*: Update test case names and internal descriptions to use canonical domain terms ("Dokumentová mezipaměť entit" instead of "entity cache"). Ensure reason scoring supports canonical terminology while maintaining backward-compatible aliases for any serialized configurations.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Znečitelně (znecitelne.html)                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌─────────────────────┐              ┌───────────────────────────┐   │
│   │  Ingestion Pipeline │              │   Detection Pipeline      │   │
│   │  - TXT, PDF, DOCX,  │ ──> text ──> │   - makeWork (canonical)  │   │
│   │    XLSX, RTF, ODT   │              │   - bounded sentence scan │   │
│   └─────────────────────┘              │   - O(1) bagMap in push   │   │
│                                        └─────────────┬─────────────┘   │
│                                                      │                 │
│                                                      ▼                 │
│                                        ┌───────────────────────────┐   │
│                                        │ EntityPropagationCache    │   │
│                                        │ - Map<form, key> lookup   │   │
│                                        │ - fast interval conflict  │   │
│                                        └─────────────┬─────────────┘   │
│                                                      │                 │
│                                                      ▼                 │
│   ┌─────────────────────┐              ┌───────────────────────────┐   │
│   │ UI Review & Viewer  │              │   Deconfliction Engine    │   │
│   │ - paintReview()     │ <── hits ─── │   - resolveHits()         │   │
│   │ - memoized leaks    │              │   - effectiveHits()       │   │
│   │ - instant selection │              │   - visibleHits()         │   │
│   └──────────┬──────────┘              └─────────────┬─────────────┘   │
│              │                                       │                 │
│              ▼                                       ▼                 │
│   ┌────────────────────────────────────────────────────────────┐       │
│   │                    Export Pipeline                         │       │
│   │  - apply(): single-pass linear array builder O(L + H)      │       │
│   │  - exportXlsxFile: indexed interval filter                 │       │
│   │  - pdfWordQuads: O(1) reverse line search                  │       │
│   │  - True Redact / Dual-Layer Raster PDF (ADR-0001)          │       │
│   └────────────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Optimizations & Code Modifications Summary

| Area | Current Issue | Optimized Implementation | Expected Benefit |
|---|---|---|---|
| **Text Redaction (`apply`)** | Repeated string concatenation `out.slice(...) + rep + out.slice(...)` in $O(H \cdot L)$ | Linear $O(L + H)$ token builder accumulating slices into an array and joining | Eliminates gigabytes of heap reallocations; 50-100x faster on large docs |
| **Sentence Start (`isSentenceStart`)** | Unbounded `text.slice(0, start)` on every person candidate | Bounded window: `text.slice(Math.max(0, start - 200), start)` | Reduces detection memory allocation by 90%+ |
| **Hit Collection (`detect.push`)** | $O(N)$ `bag.find(...)` linear scan on every seen duplicate key | $O(1)$ lookup via `bagMap = new Map()` alongside `bag` | Eliminates $O(N^2)$ slowdown during entity detection |
| **Entity Propagation (`EntityPropagationCache`)** | Triple nested loop over Entities $\times$ Hits $\times$ Forms with repeated `.toLocaleLowerCase()` | Single precomputed `Map<form, entityKey>` with $O(1)$ lookup | Converts cubic $O(E \cdot H \cdot F)$ loop into linear $O(H)$ pass |
| **Spreadsheet Export (`exportXlsxFile`)** | Nested $O(\text{Cells} \cdot \text{Hits})$ `.filter(...)` on every single cell | Binary search / active pointer over ordered `accepted` hits | Slashes export time on large spreadsheets with thousands of cells |
| **PDF Quads (`pdfWordQuads`)** | Linear `.find()` from beginning of line array on sorted glyphs | Reverse check from `lines[lines.length - 1]` | Speeds up PDF visual layer generation for dense documents |
| **Review UI (`paintReview`)** | Full `apply()` and `.includes()` leak check on every hit click | Memoized leak analysis cache keyed by `(text, hitsHash, mode, lang)` | Instant hit selection and review responsiveness |
| **Dead Code Cleanup** | Duplicate `docxMakeWork` (lines 3176-3192) and orphan `.pv-prev-box` class | Eliminate duplicate, route to `makeWork`, clean class attribute | Reduces codebase footprint and maintenance overhead |
| **Terminology Inconsistencies** | "entity cache" strings in test descriptions | Aligned with `GLOSSARY.md` ("Dokumentová mezipaměť entit") | Conformance with canonical domain terminology |

### Verification Plan

1. **Automated Unit & Quality Gate Tests**:
   - Run `node build.js` to ensure canonical markers and library bundles remain valid.
   - Run `node test.js` to verify all 105+ quality gate assertions pass without errors.
2. **Regression Verification**:
   - Ensure `resolveHits`, `effectiveHits`, `visibleHits`, `apply`, `docxReplaceInXml`, `ingestDocumentBatch`, and `exportPdfTrueRedact` retain identical behavior and output.
3. **Performance Profiling Check**:
   - Benchmark synthetic large text (1 MB+, 2,000 hits) before and after optimization to confirm substantial reduction in runtime and peak memory consumption.
