import { bindReplacer, effectiveHits } from "../core/detector.js";

export function xlsxToText(wb){
    const cellMap = []; let text = "";
    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      text += "\n\n--- "+sheetName+" ---\n";
      const ref = ws["!ref"]; if (!ref) return;
      const range = XLSX.utils.decode_range(ref);
      for (let r=range.s.r; r<=range.e.r; r++) {
        for (let c=range.s.c; c<=range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell || cell.v===undefined || cell.v===null || cell.v==="") continue;
          const str = String(cell.v);
          const start = text.length; text += str; const end = text.length;
          cellMap.push({ sheet: sheetName, ref: addr, start, end });
          text += "\t";
        }
        text += "\n";
      }
    });
    return { text, cellMap };
  }
  export async function extractXlsx(buf){
    if (!window.XLSX) throw new Error("XLSX: knihovna se nenačetla (síť).");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return xlsxToText(XLSX.read(u8, { type:"array" }));
  }

  export function exportXlsxFileFflate(sourceBuf, hits, mode, lang, stripMeta = true) {
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
    if (!flate || !flate.unzipSync) return { ok: false, reason: "fflate missing" };

    const replacer = bindReplacer(mode, lang, hits);
    const map = new Map();
    effectiveHits(hits).forEach(h => {
      if (h.value && !map.has(h.value)) map.set(h.value, replacer(h));
    });

    const files = flate.unzipSync(new Uint8Array(sourceBuf.slice(0)));
    for (const k of Object.keys(files)) {
      const norm = k.replace(/\\/g, "/");
      if (norm !== k) {
        files[norm] = files[k];
        delete files[k];
      }
    }
    const dec = new TextDecoder("utf-8"), enc = new TextEncoder();
    const values = Array.from(map.keys()).filter(Boolean).sort((a,b) => b.length - a.length);

    // 1. In-place XML string replacement in xl/sharedStrings.xml
    if (files["xl/sharedStrings.xml"] && values.length) {
      let xml = dec.decode(files["xl/sharedStrings.xml"]);
      xml = xml.replace(/(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g, (match, openTag, textContent, closeTag) => {
        let replaced = textContent;
        values.forEach(v => {
          if (replaced.includes(v)) {
            replaced = replaced.replaceAll(v, map.get(v));
          }
        });
        return openTag + replaced + closeTag;
      });
      files["xl/sharedStrings.xml"] = enc.encode(xml);
    }

    // 2. In-place XML string replacement in worksheets for inline strings
    const sheetRe = /^xl\/worksheets\/sheet\d+\.xml$/i;
    for (const name of Object.keys(files)) {
      if (sheetRe.test(name) && values.length) {
        let xml = dec.decode(files[name]);
        if (xml.includes("<t>") || xml.includes("<is>")) {
          xml = xml.replace(/(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g, (match, openTag, textContent, closeTag) => {
            let replaced = textContent;
            values.forEach(v => {
              if (replaced.includes(v)) {
                replaced = replaced.replaceAll(v, map.get(v));
              }
            });
            return openTag + replaced + closeTag;
          });
          files[name] = enc.encode(xml);
        }
      }
    }

    // 3. Strip metadata in docProps/core.xml if requested
    if (stripMeta && files["docProps/core.xml"]) {
      let xml = dec.decode(files["docProps/core.xml"]);
      xml = xml.replace(/<dc:creator>[\s\S]*?<\/dc:creator>/gi, "<dc:creator></dc:creator>")
               .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/gi, "<cp:lastModifiedBy></cp:lastModifiedBy>");
      if (xml.includes("<dc:description>")) {
        xml = xml.replace(/<dc:description>[\s\S]*?<\/dc:description>/gi, "<dc:description>Znečitelně — metadata stripped</dc:description>");
      } else if (xml.includes("</cp:coreProperties>")) {
        xml = xml.replace("</cp:coreProperties>", "<dc:description>Znečitelně — metadata stripped</dc:description></cp:coreProperties>");
      }
      files["docProps/core.xml"] = enc.encode(xml);
    }

    const bytes = flate.zipSync(files, { level: 6 });
    return { ok: true, bytes };
  }

  export function exportXlsxFile(sourceBuf, hits, mode, lang){
    if (window.fflate && typeof exportXlsxFileFflate === "function") {
      const fflateRes = exportXlsxFileFflate(sourceBuf, hits, mode, lang, S.stripMeta);
      if (fflateRes && fflateRes.ok) return fflateRes.bytes;
    }
    const wb = XLSX.read(sourceBuf.slice(0), { type:"array" });
    const { cellMap } = xlsxToText(wb);
    const replacer = bindReplacer(mode, lang, hits);
    const accepted = effectiveHits(hits);
    if (!accepted.length) {
      if (S.stripMeta) stripWorkbookMeta(wb);
      return XLSX.write(wb, { bookType:"xlsx", type:"array" });
    }
    cellMap.forEach(cm => {
      let low = 0, high = accepted.length - 1, first = accepted.length;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (accepted[mid].end > cm.start) {
          first = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
      const cellHits = [];
      for (let i = first; i < accepted.length && accepted[i].start < cm.end; i++) {
        if (accepted[i].end > cm.start) {
          cellHits.push(accepted[i]);
        }
      }
      if (!cellHits.length) return;
      const ws = wb.Sheets[cm.sheet]; const cell = ws[cm.ref]; if (!cell) return;
      let str = String(cell.v);
      cellHits.reverse().forEach(h => {
        const s = Math.max(0, h.start-cm.start);
        const e = Math.min(str.length, h.end-cm.start);
        if (e<=s) return;
        const piece = (h.start>=cm.start && h.end<=cm.end) ? replacer(h) : replacer({ ...h, value: str.slice(s,e) });
        str = str.slice(0,s)+piece+str.slice(e);
      });
      cell.v = str; cell.t = "s"; delete cell.f; delete cell.w;
    });
    if (S.stripMeta) stripWorkbookMeta(wb);
    return XLSX.write(wb, { bookType:"xlsx", type:"array" });
  }


export function stripWorkbookMeta(wb){
    wb.Props = {
      Title: "anonymized",
      Subject: "",
      Author: "",
      Manager: "",
      Company: "",
      LastAuthor: "",
      CreatedDate: new Date(0),
      ModifiedDate: new Date(0),
      Keywords: "",
      Comments: "Znečitelně — metadata stripped"
    };
    wb.Custprops = {};
    if (wb.Workbook && wb.Workbook.WBProps) {
    }
  }
