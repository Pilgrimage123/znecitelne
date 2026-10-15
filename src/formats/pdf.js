// PDF format handling and security preflights (ADR-0001, ADR-0002)
import { toBytes } from "../core/detector.js";

function translit(ch){
  const map = { "á":"a","č":"c","ď":"d","é":"e","ě":"e","í":"i","ň":"n","ó":"o","ř":"r","š":"s","ť":"t","ú":"u","ů":"u","ý":"y","ž":"z",
                "Á":"A","Č":"C","Ď":"D","É":"E","Ě":"E","Í":"I","Ň":"N","Ó":"O","Ř":"R","Š":"S","Ť":"T","Ú":"U","Ů":"U","Ý":"Y","Ž":"Z" };
  return map[ch] || ch;
}

export function stampPdfMeta(doc, title){
    try {
      doc.setTitle((title||"document")+" — anonymized");
      doc.setAuthor("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setProducer("Znečitelně");
      doc.setCreator("Znečitelně");
      if (S.stripMeta && doc.setCreationDate) doc.setCreationDate(new Date(0));
    } catch (_) {}
  }

export function pdfWordQuads(glyphs){
    if (!glyphs || !glyphs.length) return [];
    const lines = [];
    const sorted = glyphs.slice().sort((a,b) => a.y - b.y || a.x - b.x);
    for (const g of sorted) {
      let line = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        if (Math.abs(l.y - g.y) < Math.max(g.h, l.h) * 0.45) {
          line = l;
          break;
        }
        if (g.y - l.y > Math.max(g.h, l.h) * 2) {
          break;
        }
      }
      if (line) {
        line.minX = Math.min(line.minX, g.x);
        line.maxX = Math.max(line.maxX, g.x + g.w);
        line.minY = Math.min(line.minY, g.y);
        line.maxY = Math.max(line.maxY, g.y + g.h);
        line.h = Math.max(line.h, g.h);
        line.glyphs.push(g);
      } else {
        lines.push({ y: g.y, h: g.h, minX: g.x, maxX: g.x + g.w, minY: g.y, maxY: g.y + g.h, glyphs: [g] });
      }
    }
    return lines.map(l => {
      const fullH = Math.max(l.maxY - l.minY, l.h, 6);
      // Mírně zúžit svisle: inset ~10 % výšky fontu (min 1px, max 2.5px), aby se box nedotkl sousedních řádků
      const vInset = Math.max(1, Math.min(2.5, fullH * 0.1));
      return {
        x: l.minX,
        y: l.minY + vInset,
        w: Math.max(l.maxX - l.minX, 4),
        h: Math.max(fullH - (vInset * 2), 4),
        rawMinX: l.minX,
        rawMaxX: l.maxX,
        rawMinY: l.minY,
        rawMaxY: l.maxY,
        rawH: fullH,
        glyphs: l.glyphs
      };
    });
  }


export function pdfHasSignatureBytes(buf){
    try {
      const s = new TextDecoder("latin1").decode(toBytes(buf));
      return /\/ByteRange\s*\[/.test(s) && /\/Type\s*\/Sig\b|\/SubFilter\s*\/(?:adbe|ETSI)/.test(s);
    } catch (_) { return false; }
  }
  const IngestErrorCode = Object.freeze({
    EMPTY_DOCUMENT: "errFileEmpty",
    FILE_TOO_LARGE: "errFileTooLarge",
    UNSUPPORTED_BINARY: "errFileBinary",
    LEGACY_DOC_FORMAT: "errDocOld",
    IMAGE_NEED_OCR: "errImageNeedOcr"
  });

  class DocumentIngestionError extends Error {
    constructor(code, fileName = "", cause = null) {
      super(code);
      this.name = "DocumentIngestionError";
      this.code = code;
      this.fileName = fileName;
      this.cause = cause;
    }
  }


export function verifySanitizedPdfText(bytes, activeHits){
    if (!window.fflate || !activeHits || !activeHits.length) return true;
    try {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let decompressedAll = "";
      const latin = new TextDecoder("latin1").decode(u8);
      const streamRe = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let m;
      while ((m = streamRe.exec(latin)) !== null) {
        const startByte = m.index + m[0].indexOf("\n") + 1;
        let endByte = m.index + m[0].lastIndexOf("endstream");
        while (endByte > startByte && (u8[endByte - 1] === 10 || u8[endByte - 1] === 13)) {
          endByte--;
        }
        const slice = u8.subarray(startByte, endByte);
        try {
          const unzipped = window.fflate.unzlibSync(slice);
          decompressedAll += " " + new TextDecoder("latin1").decode(unzipped);
        } catch (_) {
          decompressedAll += " " + m[1];
        }
      }
      for (const h of activeHits) {
        if (!h.value || h.value.length < 3) continue;
        const rawVal = h.value.trim();
        const safeVal = [...rawVal].map(translit).join("");
        const hex = [...safeVal].map(c => c.charCodeAt(0).toString(16).padStart(2,"0")).join("").toUpperCase();
        if (decompressedAll.includes(safeVal) || decompressedAll.toUpperCase().includes(hex)) {
          throw new Error("PDF security verification failed: sensitive hit found in text layer: "+rawVal);
        }
      }
      return true;
    } catch (err) {
      if (err.message && err.message.includes("PDF security verification failed")) throw err;
      throw new Error("PDF security verification failed: " + (err.message || String(err)));
    }
  }

  export function assertSecurePdfBytes(bytes){
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const ascii = new TextDecoder("latin1").decode(u8);
    const normAscii = ascii.replace(/\/([^\s<>[\]{}/%]+)/g, (_, name) => {
      const decoded = name.replace(/#([0-9a-fA-F]{2})/g, (__, hex) => String.fromCharCode(parseInt(hex, 16)));
      return "/" + decoded;
    });
    const forbidden = ["/AcroForm", "/Sig", "/EmbeddedFiles", "/JavaScript", "/JS"];
    const found = forbidden.filter(token => ascii.includes(token) || normAscii.includes(token));
    if (found.length) {
      throw new Error("PDF security preflight failed: "+found.join(", "));
    }
    const eof = (ascii.match(/%%EOF/g)||[]).length;
    if (eof !== 1) {
      throw new Error("PDF security preflight failed: expected one %%EOF, got "+eof);
    }
    return bytes;
  }

  /*
   * SECURITY INVARIANT:
   * Secure export must never be derived from PDFDocument.load(source).
   * pdf-lib can retain source objects which are no longer reachable from the
   * page tree. Replacing pages and deleting annotations therefore does not
   * prove irreversible removal of source content/signatures.
   *
   * Keep this API stable, but fail closed to the isolated raster constructor
   * until a future true-redaction implementation has an object-level proof.
   */
