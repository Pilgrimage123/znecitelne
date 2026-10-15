import { toBytes } from "../core/detector.js";
import { extractXlsx } from "./xlsx.js";
import { pdfHasSignatureBytes } from "./pdf.js";

async function sha256(buf){
  const subtle = globalThis.crypto ? globalThis.crypto.subtle : null;
  if (!subtle) return "mockhash";
  const h = await subtle.digest("SHA-256", buf);
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

  export function applyDocumentToState(doc){
    if (!doc) return;
    S.fileName = doc.fileName;
    S.kind = doc.kind;
    S.text = doc.text;
    S.sourceBuf = doc.sourceBuf;
    S.pages = doc.pages;
    S.noTextPages = doc.noTextPages;
    S.cellMap = doc.cellMap;
    S.sigDetected = doc.sigDetected;
    S.hashIn = doc.hashIn;
    S.hashOut = "";
    S.reviewed = false;
    S.hits = [];
    runAnalyze(doc.text);
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
  function decodeTextBuffer(buf){
    const u8 = toBytes(buf);
    if (!u8 || !u8.length) return "";
    if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) {
      return new TextDecoder("utf-8").decode(u8.subarray(3));
    }
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
      return new TextDecoder("utf-16le").decode(u8.subarray(2));
    }
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
      return new TextDecoder("utf-16be").decode(u8.subarray(2));
    }
    if (u8.length >= 4) {
      const checkLen = Math.min(u8.length - (u8.length % 2), 256);
      let zeroOdds = 0, zeroEvens = 0;
      for (let i = 0; i < checkLen; i += 2) {
        if (u8[i] === 0) zeroEvens++;
        if (u8[i + 1] === 0) zeroOdds++;
      }
      const half = checkLen / 2;
      if (zeroOdds / half > 0.8) {
        try {
          return new TextDecoder("utf-16le").decode(u8);
        } catch (_) {}
      } else if (zeroEvens / half > 0.8) {
        try {
          return new TextDecoder("utf-16be").decode(u8);
        } catch (_) {}
      }
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(u8);
    } catch (_) {}
    try {
      return new TextDecoder("windows-1250").decode(u8);
    } catch (_) {}
    try {
      return new TextDecoder("iso-8859-2").decode(u8);
    } catch (_) {
      return new TextDecoder("latin1").decode(u8);
    }
  }

  function isBinaryBuffer(buf){
    const u8 = toBytes(buf);
    if (!u8 || !u8.length) return false;
    if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return false;
    if (u8.length >= 2 && ((u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF))) return false;
    if (u8.length >= 4) {
      const checkLen = Math.min(u8.length - (u8.length % 2), 256);
      let zeroOdds = 0, zeroEvens = 0;
      for (let i = 0; i < checkLen; i += 2) {
        if (u8[i] === 0) zeroEvens++;
        if (u8[i + 1] === 0) zeroOdds++;
      }
      const half = checkLen / 2;
      if (zeroOdds / half > 0.8 || zeroEvens / half > 0.8) return false;
    }
    const limit = Math.min(u8.length, 8000);
    let ctrl = 0;
    for (let i = 0; i < limit; i++) {
      const b = u8[i];
      if (b === 0) return true;
      if (b < 9 || (b > 13 && b < 32 && b !== 27)) ctrl++;
    }
    return (ctrl / limit) > 0.05;
  }

  function extractRtfText(rtfStr){
    let raw = String(rtfStr || "");
    let s = "";
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === "{" && raw[i + 1] === "\\") {
        const rest = raw.slice(i + 2);
        if (/^(\*|(?:fonttbl|colortbl|stylesheet|info|pict)\b)/i.test(rest)) {
          let depth = 1;
          i += 2;
          while (i < raw.length && depth > 0) {
            if (raw[i] === "\\") { i += 2; continue; }
            if (raw[i] === "{") depth++;
            else if (raw[i] === "}") depth--;
            i++;
          }
          continue;
        }
      }
      s += raw[i];
      i++;
    }
    s = s.replace(/\\bullet\b ?/gi, "•")
         .replace(/\\endash\b ?/gi, "–")
         .replace(/\\emdash\b ?/gi, "—")
         .replace(/\\ldblquote\b ?/gi, "„")
         .replace(/\\rdblquote\b ?/gi, "“")
         .replace(/\\lquote\b ?/gi, "‘")
         .replace(/\\rquote\b ?/gi, "’")
         .replace(/\\~/g, "\u00A0")
         .replace(/\\_/g, "\u2011");
    s = s.replace(/\\par\b ?/gi, "\n").replace(/\\line\b ?/gi, "\n").replace(/\\tab\b ?/gi, "\t");
    s = s.replace(/\\u(-?\d+)[^\\{}]?/g, (_, c) => {
      let n = parseInt(c, 10);
      if (n < 0) n += 65536;
      return String.fromCharCode(n);
    });
    s = s.replace(/(?:\\'([0-9a-fA-F]{2}))+/g, m => {
      const b = [];
      const re = /\\'([0-9a-fA-F]{2})/g;
      let x;
      while ((x = re.exec(m)) !== null) b.push(parseInt(x[1], 16));
      try {
        return new TextDecoder("windows-1250").decode(new Uint8Array(b));
      } catch (_) {
        return m;
      }
    });
    s = s.replace(/\\\\/g, "\uE000").replace(/\\\{/g, "\uE001").replace(/\\\}/g, "\uE002");
    s = s.replace(/\\([\\{}~])/g, "$1");
    s = s.replace(/\\([a-zA-Z]+)-?\d* ?/g, "");
    s = s.replace(/[{}]/g, "");
    s = s.replace(/\\/g, "");
    s = s.replace(/\uE001/g, "{").replace(/\uE002/g, "}").replace(/\uE000/g, "\\");
    return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }

  function extractOdtText(buf){
    if (!window.fflate) throw new Error("fflate není k dispozici");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const files = fflate.unzipSync(u8);
    const content = files["content.xml"];
    if (!content) throw new Error("Neplatný ODT: chybí content.xml");
    const xml = new TextDecoder("utf-8").decode(content);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("Chyba XML v ODT");
    const elements = Array.from(doc.getElementsByTagNameNS("*", "*")).filter(n => {
      const name = n.localName;
      return name === "p" || name === "h";
    });
    return elements.map(el => {
      const parts = Array.from(el.childNodes).map(n => {
        if (n.nodeType === 3) return n.nodeValue || "";
        const name = n.localName;
        if (name === "tab") return "\t";
        if (name === "line-break") return "\n";
        if (name === "s") {
          const count = parseInt(n.getAttributeNS("*", "c") || n.getAttribute("text:c") || "1", 10);
          return " ".repeat(Math.max(1, count));
        }
        return n.textContent || "";
      });
      return parts.join("").trim();
    }).filter(Boolean).join("\n\n");
  }

  function extractDocxTextWithFflate(buf){
    if (!window.fflate) throw new Error("fflate není k dispozici");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const files = fflate.unzipSync(u8);
    const docKey = Object.keys(files).find(k => k.replace(/\\/g, "/").toLowerCase() === "word/document.xml");
    const docEntry = docKey ? files[docKey] : null;
    if (!docEntry) throw new Error("Neplatný DOCX: chybí word/document.xml");

    function parseDocxXml(entryBytes){
      if (!entryBytes) return "";
      const xml = new TextDecoder("utf-8").decode(entryBytes);
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.getElementsByTagName("parsererror").length) return "";
      const paras = Array.from(doc.getElementsByTagNameNS(DOCX_W_NS, "p"));
      return paras.map(p => {
        const texts = Array.from(p.getElementsByTagNameNS(DOCX_W_NS, "*")).filter(n => {
          const name = n.localName;
          return name === "t" || name === "tab" || name === "noBreakHyphen" || name === "softHyphen" || name === "br";
        }).map(n => {
          const name = n.localName;
          if (name === "t") return n.textContent || "";
          if (name === "tab") return "\t";
          if (name === "noBreakHyphen") return "\u2011";
          if (name === "softHyphen") return "\u00AD";
          if (name === "br") return "\n";
          return "";
        });
        return texts.join("");
      }).join("\n");
    }

    const sections = [];
    Object.keys(files).filter(k => /^word\/header\d*\.xml$/i.test(k.replace(/\\/g, "/"))).sort().forEach(k => {
      const t = parseDocxXml(files[k]).trim();
      if (t) sections.push(t);
    });
    const body = parseDocxXml(docEntry);
    if (body) sections.push(body);
    Object.keys(files).filter(k => /^word\/(footnotes|endnotes|footer\d*)\.xml$/i.test(k.replace(/\\/g, "/"))).sort().forEach(k => {
      const t = parseDocxXml(files[k]).trim();
      if (t) sections.push(t);
    });

    return sections.join("\n\n");
  }

  export function isImageFile(name, type){
    const n = (name || "").toLowerCase();
    return /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(n) || (typeof type === "string" && type.startsWith("image/"));
  }

  export async function handleImageFile(file, buf, options = {}){
    const ocrEnabled = options.ocrEnabled ?? S.ocrEnabled;
    if (!ocrEnabled || !window.Tesseract) {
      throw new DocumentIngestionError(IngestErrorCode.IMAGE_NEED_OCR, file ? file.name : "");
    }
    const reportProgress = options.onProgress || showOcrProgress;
    const t = options.lang || S.lang;
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
    try {
      reportProgress(t === "cs" ? "OCR: spouštím rozpoznávání textu…" : "OCR: running recognition…");
      ocrWorker = await Tesseract.createWorker("ces", 1, {
        ...((window.__libLocal && window.__libLocal.tesseract) ? { workerPath:"./lib/tesseract/worker.min.js", corePath:"./lib/tesseract/core/", langPath:"./lib/tesseract/lang/" } : {}),
        logger: m => {
          if (m.status === "recognizing text") {
            reportProgress((t === "cs" ? "OCR: rozpoznávám text" : "OCR: recognizing text") +
              " (" + Math.round((m.progress || 0) * 100) + "%)…");
          }
        }
      });
      const { data: ocrData } = await ocrWorker.recognize(canvas);
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
      if (ocrWorker) await ocrWorker.terminate();
      hideOcrProgress();
    }

    let pdfBuf = null;
    if (window.PDFLib) {
      try {
        const { PDFDocument } = PDFLib;
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
      if (window.mammoth) {
        try {
          const res = await window.mammoth.extractRawText({ arrayBuffer: buf });
          text = (res && res.value) || "";
        } catch (e) {
          mammothErr = e;
        }
      }
      if (!text && window.fflate) {
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
      if (isZip && window.fflate) {
        try {
          const files = fflate.unzipSync(new Uint8Array(buf));
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

