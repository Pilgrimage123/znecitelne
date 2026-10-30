import { toBytes } from "../core/detector.js";
import { extractXlsx } from "./xlsx.js";
import { pdfHasSignatureBytes, extractPdf, canFetchLocalAssets } from "./pdf.js";
import { decodeTextBuffer, isBinaryBuffer, extractRtfText } from "./rtf.js";
import { extractOdtText } from "./odt.js";
import { extractDocxTextWithFflate } from "./docx.js";

export async function sha256(buf){
  const subtle = globalThis.crypto ? globalThis.crypto.subtle : null;
  if (!subtle) return "mockhash";
  const source = typeof buf === "string" ? new TextEncoder().encode(buf) : buf;
  const h = await subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export const IngestErrorCode = Object.freeze({
    EMPTY_DOCUMENT: "errFileEmpty",
    FILE_TOO_LARGE: "errFileTooLarge",
    UNSUPPORTED_BINARY: "errFileBinary",
    LEGACY_DOC_FORMAT: "errDocOld",
    IMAGE_NEED_OCR: "errImageNeedOcr"
  });

  export class DocumentIngestionError extends Error {
    constructor(code, fileName = "", cause = null) {
      super(code);
      this.name = "DocumentIngestionError";
      this.code = code;
      this.fileName = fileName;
      this.cause = cause;
    }
  }

  export function localizeIngestError(err, fallbackFileName = "") {
    if (!err) return "";
    const code = err.code || err.message;
    const f = err.fileName || fallbackFileName || "";
    const dict = (typeof i === "function") ? i() : {};
    if (code === IngestErrorCode.EMPTY_DOCUMENT || code === "errFileEmpty") {
      return (dict.errFileEmpty || "Soubor {f} je prázdný.").replace("{f}", f);
    }
    if (code === IngestErrorCode.FILE_TOO_LARGE || code === "errFileTooLarge") {
      return (dict.errFileTooLarge || "Soubor {f} je příliš velký (limit 100 MB).").replace("{f}", f);
    }
    if (code === IngestErrorCode.UNSUPPORTED_BINARY || code === "errFileBinary") {
      return (dict.errFileBinary || "Soubor {f} obsahuje neznámá binární data.").replace("{f}", f);
    }
    if (code === IngestErrorCode.LEGACY_DOC_FORMAT || code === "errDocOld") {
      return dict.errDocOld || "Starý binární formát DOC není podporován. Uložte jej jako DOCX.";
    }
    if (code === IngestErrorCode.IMAGE_NEED_OCR || code === "errImageNeedOcr") {
      return dict.errImageNeedOcr || "Pro zpracování obrázků musí být povoleno OCR.";
    }
    return err.message || String(err);
  }

  export async function buildCanonicalDocument({ fileName, kind, text, sourceBuf = null, pages = null, cellMap = null, sigDetected = false }){
    const cleanText = String(text || "").normalize("NFC");
    const docPages = (pages && pages.length)
      ? pages
      : (cleanText ? [{ n: 1, start: 0, end: cleanText.length, body: cleanText, items: [], noTextLayer: false }] : []);
    const hashIn = sourceBuf ? await sha256(sourceBuf) : (cleanText ? await sha256(new TextEncoder().encode(cleanText)) : "");

    return Object.freeze({
      id: "doc_" + Math.random().toString(36).slice(2, 10),
      fileName: fileName || "document",
      kind: kind || "text",
      text: cleanText,
      sourceBuf: (kind === "pdf" || kind === "xlsx" || kind === "docx") ? sourceBuf : null,
      pages: docPages,
      noTextPages: docPages.filter(p => p.noTextLayer).length,
      cellMap: cellMap || [],
      sigDetected: !!sigDetected,
      hashIn: hashIn
    });
  }

  export function applyDocumentToState(doc, targetState){
    const state = targetState || (typeof S !== "undefined" ? S : (typeof globalThis !== "undefined" && globalThis.S ? globalThis.S : null));
    if (!doc || !state) return;
    if (typeof S !== "undefined") S.doc = doc;
    state.doc = doc;
    state.fileName = doc.fileName;
    state.kind = doc.kind;
    state.text = doc.text;
    state.sourceBuf = doc.sourceBuf;
    state.pages = doc.pages;
    state.noTextPages = doc.noTextPages;
    state.cellMap = doc.cellMap;
    state.sigDetected = doc.sigDetected;
    state.hashIn = doc.hashIn;
    state.hashOut = "";
    state.reviewed = false;
    state.hits = [];
    state.auditTrail = [];
    state.rev = (state.rev || 0) + 1;
    if (typeof runAnalyze === "function") {
      runAnalyze(doc.text);
    }
  }

  export async function ingest(name, kind, text, buf, extra){
    const doc = await buildCanonicalDocument({
      fileName: name,
      kind: kind,
      text: text,
      sourceBuf: buf,
      pages: extra && extra.pages,
      cellMap: extra && extra.cellMap,
      sigDetected: kind === "pdf" && (((extra && extra.pages) || []).some(p => p.signatures && p.signatures.length) || pdfHasSignatureBytes(buf))
    });
    applyDocumentToState(doc);
    return doc;
  }

  export function isImageFile(name, type){
    const n = (name || "").toLowerCase();
    return /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(n) || (typeof type === "string" && type.startsWith("image/"));
  }

  export async function handleImageFile(file, buf, options = {}){
    const ocrEnabled = options.ocrEnabled ?? (typeof S !== "undefined" ? S.ocrEnabled : false);
    const tesseractLib = (typeof window !== "undefined" && window.Tesseract) || (typeof globalThis !== "undefined" && globalThis.Tesseract) || null;
    if (!ocrEnabled || !tesseractLib) {
      throw new DocumentIngestionError(IngestErrorCode.IMAGE_NEED_OCR, file ? file.name : "");
    }
    const reportProgress = options.onProgress || (typeof showOcrProgress === "function" ? showOcrProgress : () => {});
    const t = options.lang || (typeof S !== "undefined" && S.lang ? S.lang : "cs");
    reportProgress(t === "cs" ? "OCR: připravuji obrázek…" : "OCR: preparing image…");

    const imgBlob = new Blob([buf], { type: (file && file.type) || "image/png" });
    const imgUrl = URL.createObjectURL(imgBlob);
    let img;
    try {
      img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Nelze načíst obrázek"));
        el.src = imgUrl;
      });
    } finally {
      URL.revokeObjectURL(imgUrl);
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    let ocrWorker = null;
    let text = "";
    let items = [];
    let initTimer = null;
    try {
      const canFetch = await canFetchLocalAssets();
      if (!canFetch) {
        throw new Error(t === "cs"
          ? "OCR vyžaduje spuštění ze síťové složky, intranetu nebo webového serveru (v režimu přímého otevření souboru file:/// prohlížeč z bezpečnostních důvodů blokuje spouštění lokálních modulů)."
          : "OCR requires running from a web server or intranet folder (direct file:/// opening blocks WebAssembly modules due to browser security policies).");
      }
      reportProgress(t === "cs" ? "OCR: spouštím rozpoznávání textu…" : "OCR: running recognition…");
      const timeoutPromise = new Promise((_, reject) => {
        initTimer = setTimeout(() => reject(new Error("OCR worker init timeout (10s)")), 10000);
      });
      let workerErrReject;
      const errPromise = new Promise((_, reject) => {
        workerErrReject = reject;
      });
      const localOpts = (typeof window !== "undefined" && window.__libLocal && window.__libLocal.tesseract) ? {
        workerPath: (typeof location !== "undefined" && location.href) ? new URL("./lib/tesseract/worker.min.js", location.href).href : "./lib/tesseract/worker.min.js",
        corePath: (typeof location !== "undefined" && location.href) ? new URL("./lib/tesseract/core/", location.href).href : "./lib/tesseract/core/",
        langPath: (typeof location !== "undefined" && location.href) ? new URL("./lib/tesseract/lang/", location.href).href : "./lib/tesseract/lang/"
      } : {};
      const createPromise = tesseractLib.createWorker("ces", 1, {
        ...localOpts,
        errorHandler: err => {
          if (workerErrReject) workerErrReject(new Error(typeof err === "string" ? err : ((err && err.message) || "OCR error")));
        },
        logger: m => {
          if (m.status === "recognizing text") {
            reportProgress((t === "cs" ? "OCR: rozpoznávám text" : "OCR: recognizing text") +
              " (" + Math.round((m.progress || 0) * 100) + "%)…");
          }
        }
      });
      ocrWorker = await Promise.race([createPromise, errPromise, timeoutPromise]);
      let rTimer = null;
      const recTimeout = new Promise((_, reject) => {
        rTimer = setTimeout(() => reject(new Error("OCR recognition timeout")), 30000);
      });
      let ocrData;
      try {
        const res = await Promise.race([ocrWorker.recognize(canvas), recTimeout]);
        ocrData = res.data;
      } finally {
        if (rTimer) clearTimeout(rTimer);
      }
      items = (ocrData.words || []).filter(w => w.text && w.text.trim() && (w.confidence || 0) > 20).map(w => ({
        str: w.text,
        _ocr: true,
        _pdfX: w.bbox.x0,
        _pdfYTop: w.bbox.y0,
        _pdfW: w.bbox.x1 - w.bbox.x0,
        _pdfH: w.bbox.y1 - w.bbox.y0,
        transform: null,
        width: w.bbox.x1 - w.bbox.x0
      }));
      text = items.map(w => w.str).join(" ");
    } catch (e) {
      console.warn("OCR on image failed:", e);
      throw new Error("OCR: " + (e.message || String(e)));
    } finally {
      if (initTimer) clearTimeout(initTimer);
      if (ocrWorker) {
        try { await ocrWorker.terminate(); } catch (_) {}
      }
      if (typeof hideOcrProgress === "function") hideOcrProgress();
    }

    let pdfBuf = null;
    const pdfLib = (typeof PDFLib !== "undefined" ? PDFLib : null) || (typeof window !== "undefined" && window.PDFLib) || (typeof globalThis !== "undefined" && globalThis.PDFLib) || null;
    if (pdfLib) {
      try {
        const { PDFDocument } = pdfLib;
        const doc = await PDFDocument.create();
        let pdfImg = null;
        if ((file && file.type === "image/png") || (file && /\.png$/i.test(file.name))) {
          try {
            pdfImg = await doc.embedPng(new Uint8Array(buf));
          } catch (_) {}
        }
        if (!pdfImg) {
          try {
            pdfImg = await doc.embedJpg(new Uint8Array(buf));
          } catch (_) {}
        }
        if (!pdfImg) {
          const jpgBlob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.92));
          if (jpgBlob) {
            const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
            pdfImg = await doc.embedJpg(jpgBytes);
          }
        }
        if (pdfImg) {
          const p = doc.addPage([canvas.width, canvas.height]);
          p.drawImage(pdfImg, { x: 0, y: 0, width: canvas.width, height: canvas.height });
          pdfBuf = await doc.save();
        }
      } catch (err) {
        console.warn("PDFLib image wrap skipped:", err);
      }
    }

    const docName = (file && file.name) || "image";
    if (pdfBuf) {
      return await buildCanonicalDocument({
        fileName: docName,
        kind: "pdf",
        text,
        sourceBuf: pdfBuf,
        pages: [{ n: 1, start: 0, end: text.length, body: text, items, noTextLayer: false }]
      });
    } else {
      return await buildCanonicalDocument({
        fileName: docName,
        kind: "text",
        text,
        sourceBuf: buf
      });
    }
  }

  export async function ingestDocument(input, options = {}){
    const file = input;
    const name = (file && file.name) || options.fileName || "document";
    const size = typeof file?.size === "number" ? file.size : (file?.buffer?.byteLength || 0);

    if (!file || (size === 0 && !file.arrayBuffer && !file.buffer)) {
      throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
    }
    if (size > 100 * 1024 * 1024) {
      throw new DocumentIngestionError(IngestErrorCode.FILE_TOO_LARGE, name);
    }

    const buf = file.arrayBuffer ? await file.arrayBuffer() : (file.buffer ? file.buffer : toBytes(file).buffer);
    if (!buf || buf.byteLength === 0) {
      throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
    }
    if (buf.byteLength > 100 * 1024 * 1024) {
      throw new DocumentIngestionError(IngestErrorCode.FILE_TOO_LARGE, name);
    }

    const n = name.toLowerCase();
    const type = (file && file.type) || options.type || "";
    const u8Magic = new Uint8Array(buf.slice(0, 8));
    const isZip = u8Magic.length >= 4 && u8Magic[0] === 0x50 && u8Magic[1] === 0x4B && u8Magic[2] === 0x03 && u8Magic[3] === 0x04;
    const isPdfMagic = u8Magic.length >= 5 && u8Magic[0] === 0x25 && u8Magic[1] === 0x50 && u8Magic[2] === 0x44 && u8Magic[3] === 0x46 && u8Magic[4] === 0x2D;
    const isRtfMagic = u8Magic.length >= 5 && u8Magic[0] === 0x7B && u8Magic[1] === 0x5C && u8Magic[2] === 0x72 && u8Magic[3] === 0x74 && u8Magic[4] === 0x66;

    if (n.endsWith(".doc")) {
      throw new DocumentIngestionError(IngestErrorCode.LEGACY_DOC_FORMAT, name);
    } else if (n.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      let text = "";
      let mammothErr = null;
      const mammoth = (typeof window !== "undefined" && window.mammoth) || (typeof globalThis !== "undefined" && globalThis.mammoth) || null;
      const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
      if (mammoth) {
        try {
          const res = await mammoth.extractRawText({ arrayBuffer: buf });
          text = (res && res.value) || "";
        } catch (e) {
          mammothErr = e;
        }
      }
      if (!text && flate) {
        try {
          text = extractDocxTextWithFflate(buf);
        } catch (e) {
          if (mammothErr) throw mammothErr;
          throw e;
        }
      } else if (!text && mammothErr) {
        throw mammothErr;
      }
      if (!text || !text.trim()) {
        throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
      }
      return await buildCanonicalDocument({ fileName: name, kind: "docx", text, sourceBuf: buf });
    } else if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".ods") || type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || type === "application/vnd.ms-excel" || type === "application/vnd.oasis.opendocument.spreadsheet") {
      const extracted = await extractXlsx(buf);
      if (!extracted || !extracted.text || !extracted.text.trim()) {
        throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
      }
      return await buildCanonicalDocument({ fileName: name, kind: "xlsx", text: extracted.text, sourceBuf: buf, cellMap: extracted.cellMap });
    } else if (n.endsWith(".odt") || type === "application/vnd.oasis.opendocument.text") {
      const text = extractOdtText(buf);
      if (!text || !text.trim()) {
        throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
      }
      return await buildCanonicalDocument({ fileName: name, kind: "text", text, sourceBuf: buf });
    } else if (n.endsWith(".rtf") || type === "application/rtf" || type === "text/rtf" || isRtfMagic) {
      const raw = decodeTextBuffer(buf);
      const text = extractRtfText(raw);
      if (!text || !text.trim()) {
        throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
      }
      return await buildCanonicalDocument({ fileName: name, kind: "text", text, sourceBuf: buf });
    } else if (n.endsWith(".pdf") || type === "application/pdf" || isPdfMagic) {
      const extracted = await extractPdf(buf);
      const sigDetected = (extracted.pages && extracted.pages.some(p => p.signatures && p.signatures.length)) || pdfHasSignatureBytes(buf);
      return await buildCanonicalDocument({ fileName: name, kind: "pdf", text: extracted.text, sourceBuf: buf, pages: extracted.pages, sigDetected });
    } else if (isImageFile(name, type)) {
      return await handleImageFile(file, buf, options);
    } else {
      const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
      if (isZip && flate) {
        try {
          const files = flate.unzipSync(new Uint8Array(buf));
          const hasDocXml = Object.keys(files).some(k => k.replace(/\\/g, "/").toLowerCase() === "word/document.xml");
          if (hasDocXml) {
            const text = extractDocxTextWithFflate(buf);
            if (!text || !text.trim()) throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
            return await buildCanonicalDocument({ fileName: name, kind: "docx", text, sourceBuf: buf });
          }
          const hasContentXml = Object.keys(files).some(k => k.toLowerCase() === "content.xml");
          if (hasContentXml) {
            const text = extractOdtText(buf);
            if (!text || !text.trim()) throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
            return await buildCanonicalDocument({ fileName: name, kind: "text", text, sourceBuf: buf });
          }
          const hasWbXml = Object.keys(files).some(k => k.replace(/\\/g, "/").toLowerCase() === "xl/workbook.xml");
          if (hasWbXml) {
            const extracted = await extractXlsx(buf);
            if (!extracted || !extracted.text || !extracted.text.trim()) throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
            return await buildCanonicalDocument({ fileName: name, kind: "xlsx", text: extracted.text, sourceBuf: buf, cellMap: extracted.cellMap });
          }
        } catch (zipErr) {
          if (zipErr instanceof DocumentIngestionError || (zipErr && zipErr.code)) throw zipErr;
        }
      }
      if (isBinaryBuffer(buf)) {
        throw new DocumentIngestionError(IngestErrorCode.UNSUPPORTED_BINARY, name);
      }
      const text = decodeTextBuffer(buf);
      if (!text || !text.trim()) {
        throw new DocumentIngestionError(IngestErrorCode.EMPTY_DOCUMENT, name);
      }
      return await buildCanonicalDocument({ fileName: name, kind: "text", text, sourceBuf: buf });
    }
  }

  export async function ingestDocumentBatch(list, options = {}){
    const files = Array.from(list || []);
    const results = [];
    for (const f of files) {
      try {
        const doc = await ingestDocument(f, options);
        results.push({ ok: true, fileName: (f && f.name) || "document", doc });
      } catch (err) {
        results.push({ ok: false, fileName: (f && f.name) || "document", error: err });
      }
    }
    return results;
  }

