import { bindReplacer, effectiveHits } from "../core/detector.js";

export function getXlsxLib() {
  return (typeof XLSX !== "undefined" ? XLSX : null) ||
         (typeof window !== "undefined" ? window.XLSX : null) ||
         (typeof globalThis !== "undefined" ? globalThis.XLSX : null) ||
         null;
}

export function xlsxToText(wb){
    const cellMap = []; let text = "";
    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      text += "\n\n--- "+sheetName+" ---\n";
      const ref = ws["!ref"]; if (!ref) return;
      const xlsxLib = getXlsxLib();
      if (!xlsxLib || !xlsxLib.utils) throw new Error("XLSX: knihovna se nenačetla.");
      const range = xlsxLib.utils.decode_range(ref);
      for (let r=range.s.r; r<=range.e.r; r++) {
        for (let c=range.s.c; c<=range.e.c; c++) {
          const addr = xlsxLib.utils.encode_cell({ r, c });
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
    const xlsxLib = getXlsxLib();
    if (!xlsxLib) throw new Error("XLSX: knihovna se nenačetla.");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return xlsxToText(xlsxLib.read(u8, { type:"array" }));
  }

export function decodeXml(str) {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) && code >= 0 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code >= 0 ? String.fromCodePoint(code) : "";
    });
}

export function encodeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function replaceAcrossRuns(runs, values, getReplacement) {
  const texts = runs.map(r => r.text || "");
  const full = texts.join("");
  if (!full) return false;

  const used = new Array(full.length).fill(false);
  const matches = [];

  for (const v of values) {
    if (!v) continue;
    let from = 0, ix;
    while ((ix = full.indexOf(v, from)) >= 0) {
      const end = ix + v.length;
      let free = true;
      for (let k = ix; k < end; k++) {
        if (used[k]) { free = false; break; }
      }
      if (free) {
        for (let k = ix; k < end; k++) used[k] = true;
        const rep = typeof getReplacement === "function" ? getReplacement(v) : (getReplacement && getReplacement.get ? getReplacement.get(v) : null);
        if (rep !== null && rep !== undefined) {
          matches.push({ s: ix, e: end, rep: String(rep) });
        }
      }
      from = end;
    }
  }

  if (!matches.length) return false;
  matches.sort((a, b) => a.s - b.s);

  let runStart = 0;
  runs.forEach((r, idx) => {
    const t = texts[idx];
    const a = runStart;
    const b = a + t.length;
    runStart = b;
    let cursor = a;
    let out = "";

    for (const m of matches) {
      if (m.e <= a || m.s >= b) continue;
      const cs = Math.max(m.s, a);
      const ce = Math.min(m.e, b);

      if (cs > cursor) out += t.slice(cursor - a, cs - a);
      if (!m._emitted) {
        out += m.rep;
        m._emitted = true;
      }
      cursor = Math.max(cursor, ce);
    }
    if (cursor < b) out += t.slice(cursor - a);

    if (out !== t) {
      r.setText(out);
    }
  });

  return true;
}

function sanitizeSharedStrings(xml, values, getReplacement) {
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (!doc.getElementsByTagName("parsererror").length) {
        const siNodes = Array.from(doc.getElementsByTagName("si"));
        let changed = false;
        siNodes.forEach(si => {
          const tNodes = Array.from(si.getElementsByTagName("t"));
          if (!tNodes.length) return;
          const runs = tNodes.map(node => ({
            text: node.textContent || "",
            setText(newText) {
              node.textContent = newText;
              if (/^\s|\s$/u.test(newText) || /\s{2,}/u.test(newText)) {
                node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
              }
            }
          }));
          if (replaceAcrossRuns(runs, values, getReplacement)) changed = true;
        });
        if (changed) return new XMLSerializer().serializeToString(doc);
        return xml;
      }
    } catch (_) {}
  }

  // Fallback for Node.js / non-DOMParser environments
  return xml.replace(/(<si(?:\s+[^>]*)?>)([\s\S]*?)(<\/si>)/g, (fullSi, openSi, innerSi, closeSi) => {
    const tTagRe = /(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g;
    const runs = [];
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tTagRe.exec(innerSi)) !== null) {
      const rawTag = match[1];
      const rawText = match[2];
      const closeTag = match[3];
      const decoded = decodeXml(rawText);
      const run = {
        text: decoded,
        updated: decoded,
        setText(newText) { this.updated = newText; }
      };
      runs.push(run);
      parts.push({
        prefix: innerSi.slice(lastIndex, match.index),
        rawTag,
        closeTag,
        run
      });
      lastIndex = match.index + match[0].length;
    }

    if (!runs.length) return fullSi;

    const changed = replaceAcrossRuns(runs, values, getReplacement);
    if (!changed) return fullSi;

    let outInner = "";
    for (const p of parts) {
      outInner += p.prefix;
      let tag = p.rawTag;
      const encText = encodeXml(p.run.updated);
      if (/^\s|\s$/u.test(p.run.updated) || /\s{2,}/u.test(p.run.updated)) {
        if (!tag.includes('xml:space="preserve"')) {
          tag = tag.replace(/<t(\s|>)/, '<t xml:space="preserve"$1');
        }
      }
      outInner += tag + encText + p.closeTag;
    }
    outInner += innerSi.slice(lastIndex);
    return openSi + outInner + closeSi;
  });
}

function sanitizeWorksheet(xml, values, getReplacement) {
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (!doc.getElementsByTagName("parsererror").length) {
        let changed = false;
        // 1. Inline strings in <is>
        const isNodes = Array.from(doc.getElementsByTagName("is"));
        isNodes.forEach(is => {
          const tNodes = Array.from(is.getElementsByTagName("t"));
          if (!tNodes.length) return;
          const runs = tNodes.map(node => ({
            text: node.textContent || "",
            setText(newText) {
              node.textContent = newText;
              if (/^\s|\s$/u.test(newText) || /\s{2,}/u.test(newText)) {
                node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
              }
            }
          }));
          if (replaceAcrossRuns(runs, values, getReplacement)) changed = true;
        });

        // 2. Cell formula values <v> and formula expressions <f>
        const cNodes = Array.from(doc.getElementsByTagName("c"));
        cNodes.forEach(c => {
          const cellType = c.getAttribute("t");
          const fNodes = c.getElementsByTagName("f");
          const vNodes = c.getElementsByTagName("v");
          const hasFormula = fNodes.length > 0;

          if (hasFormula) {
            const fNode = fNodes[0];
            let fText = fNode.textContent || "";
            let fChanged = false;
            values.forEach(v => {
              if (fText.includes(v)) {
                const rep = typeof getReplacement === "function" ? getReplacement(v) : (getReplacement && getReplacement.get ? getReplacement.get(v) : null);
                if (rep !== null && rep !== undefined) {
                  fText = fText.replaceAll(v, rep);
                  fChanged = true;
                }
              }
            });
            if (fChanged) {
              fNode.textContent = fText;
              changed = true;
            }
          }

          if (cellType === "str" || hasFormula) {
            if (vNodes.length > 0) {
              const vNode = vNodes[0];
              let vText = vNode.textContent || "";
              let vChanged = false;
              values.forEach(v => {
                if (vText.includes(v)) {
                  const rep = typeof getReplacement === "function" ? getReplacement(v) : (getReplacement && getReplacement.get ? getReplacement.get(v) : null);
                  if (rep !== null && rep !== undefined) {
                    vText = vText.replaceAll(v, rep);
                    vChanged = true;
                  }
                }
              });
              if (vChanged) {
                vNode.textContent = vText;
                c.setAttribute("t", "str");
                changed = true;
              }
            }
          }
        });

        if (changed) return new XMLSerializer().serializeToString(doc);
        return xml;
      }
    } catch (_) {}
  }

  // Fallback for Node.js / non-DOMParser environments
  let resXml = xml;

  // 1. Sanitize <is>...</is>
  resXml = resXml.replace(/(<is(?:\s+[^>]*)?>)([\s\S]*?)(<\/is>)/g, (fullIs, openIs, innerIs, closeIs) => {
    const tTagRe = /(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g;
    const runs = [];
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tTagRe.exec(innerIs)) !== null) {
      const rawTag = match[1];
      const rawText = match[2];
      const closeTag = match[3];
      const decoded = decodeXml(rawText);
      const run = {
        text: decoded,
        updated: decoded,
        setText(newText) { this.updated = newText; }
      };
      runs.push(run);
      parts.push({
        prefix: innerIs.slice(lastIndex, match.index),
        rawTag,
        closeTag,
        run
      });
      lastIndex = match.index + match[0].length;
    }

    if (!runs.length) return fullIs;

    const changed = replaceAcrossRuns(runs, values, getReplacement);
    if (!changed) return fullIs;

    let outInner = "";
    for (const p of parts) {
      outInner += p.prefix;
      let tag = p.rawTag;
      const encText = encodeXml(p.run.updated);
      if (/^\s|\s$/u.test(p.run.updated) || /\s{2,}/u.test(p.run.updated)) {
        if (!tag.includes('xml:space="preserve"')) {
          tag = tag.replace(/<t(\s|>)/, '<t xml:space="preserve"$1');
        }
      }
      outInner += tag + encText + p.closeTag;
    }
    outInner += innerIs.slice(lastIndex);
    return openIs + outInner + closeIs;
  });

  // 2. Sanitize <c ...><v> and <f>
  resXml = resXml.replace(/(<c\b([^>]*?)>)([\s\S]*?)(<\/c>)/g, (fullC, openC, attrs, innerC, closeC) => {
    const isShared = /\bt="s"/i.test(attrs);
    if (isShared) return fullC; // Shared string index; not a string literal

    const isStr = /\bt="str"/i.test(attrs);
    const hasFormula = /<f(?:\s+[^>]*)?>/.test(innerC);

    let updatedInner = innerC;
    let cNeedsStrType = false;

    if (hasFormula) {
      updatedInner = updatedInner.replace(/(<f(?:\s+[^>]*)?>)([\s\S]*?)(<\/f>)/g, (_, openF, fContent, closeF) => {
        let decF = decodeXml(fContent);
        values.forEach(v => {
          if (decF.includes(v)) {
            const rep = typeof getReplacement === "function" ? getReplacement(v) : (getReplacement && getReplacement.get ? getReplacement.get(v) : null);
            if (rep !== null && rep !== undefined) {
              decF = decF.replaceAll(v, rep);
            }
          }
        });
        return openF + encodeXml(decF) + closeF;
      });
    }

    if (isStr || hasFormula) {
      updatedInner = updatedInner.replace(/(<v(?:\s+[^>]*)?>)([\s\S]*?)(<\/v>)/g, (_, openV, vContent, closeV) => {
        let decV = decodeXml(vContent);
        let vChanged = false;
        values.forEach(v => {
          if (decV.includes(v)) {
            const rep = typeof getReplacement === "function" ? getReplacement(v) : (getReplacement && getReplacement.get ? getReplacement.get(v) : null);
            if (rep !== null && rep !== undefined) {
              decV = decV.replaceAll(v, rep);
              vChanged = true;
            }
          }
        });
        if (vChanged) cNeedsStrType = true;
        return openV + encodeXml(decV) + closeV;
      });
    }

    if (cNeedsStrType && !isStr) {
      openC = openC.replace(/<c\b/, '<c t="str"');
    }

    return openC + updatedInner + closeC;
  });

  return resXml;
}

function sanitizeComments(xml, values, getReplacement, stripMeta) {
  let resXml = xml;
  if (stripMeta) {
    resXml = resXml.replace(/<author>[\s\S]*?<\/author>/gi, "<author></author>");
  } else {
    resXml = resXml.replace(/(<author(?:\s+[^>]*)?>)([\s\S]*?)(<\/author>)/g, (_, openA, content, closeA) => {
      let decA = decodeXml(content);
      values.forEach(v => {
        if (decA.includes(v)) {
          const rep = typeof getReplacement === "function" ? getReplacement(v) : (getReplacement && getReplacement.get ? getReplacement.get(v) : null);
          if (rep !== null && rep !== undefined) decA = decA.replaceAll(v, rep);
        }
      });
      return openA + encodeXml(decA) + closeA;
    });
  }

  // Sanitize text runs inside <comment>
  resXml = resXml.replace(/(<text(?:\s+[^>]*)?>)([\s\S]*?)(<\/text>)/g, (fullText, openText, innerText, closeText) => {
    const tTagRe = /(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g;
    const runs = [];
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tTagRe.exec(innerText)) !== null) {
      const rawTag = match[1];
      const rawText = match[2];
      const closeTag = match[3];
      const decoded = decodeXml(rawText);
      const run = {
        text: decoded,
        updated: decoded,
        setText(newText) { this.updated = newText; }
      };
      runs.push(run);
      parts.push({
        prefix: innerText.slice(lastIndex, match.index),
        rawTag,
        closeTag,
        run
      });
      lastIndex = match.index + match[0].length;
    }

    if (!runs.length) return fullText;

    const changed = replaceAcrossRuns(runs, values, getReplacement);
    if (!changed) return fullText;

    let outInner = "";
    for (const p of parts) {
      outInner += p.prefix;
      let tag = p.rawTag;
      const encText = encodeXml(p.run.updated);
      if (/^\s|\s$/u.test(p.run.updated) || /\s{2,}/u.test(p.run.updated)) {
        if (!tag.includes('xml:space="preserve"')) {
          tag = tag.replace(/<t(\s|>)/, '<t xml:space="preserve"$1');
        }
      }
      outInner += tag + encText + p.closeTag;
    }
    outInner += innerText.slice(lastIndex);
    return openText + outInner + closeText;
  });

  return resXml;
}

export function exportXlsxFileFflate(sourceBuf, hits, mode, lang, stripMeta = true) {
  if (!sourceBuf) return { ok: false, reason: "sourceBuf missing" };
  const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
  if (!flate || !flate.unzipSync) return { ok: false, reason: "fflate missing" };

  const replacer = bindReplacer(mode, lang, hits);
  const occCounts = new Map();
  const hitsByValue = new Map();
  (hits || []).forEach(h => {
    if (!h || !h.value) return;
    if (!hitsByValue.has(h.value)) hitsByValue.set(h.value, []);
    hitsByValue.get(h.value).push(h);
  });

  const getReplacement = (v) => {
    const list = hitsByValue.get(v) || [];
    const idx = occCounts.get(v) || 0;
    occCounts.set(v, idx + 1);
    if (idx < list.length) {
      const hit = list[idx];
      if (hit.accept === false) return null;
      return replacer(hit);
    }
    if (list.length > 0 && list.every(h => h.accept !== false)) {
      return replacer(list[list.length - 1]);
    }
    return null;
  };

  const files = flate.unzipSync(new Uint8Array(sourceBuf.slice(0)));
  for (const k of Object.keys(files)) {
    const norm = k.replace(/\\/g, "/");
    if (norm !== k) {
      files[norm] = files[k];
      delete files[k];
    }
  }
  const dec = new TextDecoder("utf-8"), enc = new TextEncoder();
  const values = Array.from(hitsByValue.keys()).filter(Boolean).sort((a,b) => b.length - a.length);

  // 1. Sanitize xl/sharedStrings.xml
  if (files["xl/sharedStrings.xml"] && values.length) {
    let xml = dec.decode(files["xl/sharedStrings.xml"]);
    xml = sanitizeSharedStrings(xml, values, getReplacement);
    files["xl/sharedStrings.xml"] = enc.encode(xml);
  }

  // 2. Sanitize worksheets
  const sheetRe = /^xl\/worksheets\/sheet\d+\.xml$/i;
  for (const name of Object.keys(files)) {
    if (sheetRe.test(name) && values.length) {
      let xml = dec.decode(files[name]);
      xml = sanitizeWorksheet(xml, values, getReplacement);
      files[name] = enc.encode(xml);
    }
  }

  // 3. Sanitize comments
  const commentRe = /^xl\/comments\d*\.xml$/i;
  for (const name of Object.keys(files)) {
    if (commentRe.test(name)) {
      let xml = dec.decode(files[name]);
      xml = sanitizeComments(xml, values, getReplacement, stripMeta);
      files[name] = enc.encode(xml);
    }
  }

  // 4. Strip metadata in docProps/core.xml and docProps/app.xml if requested
  if (stripMeta) {
    if (files["docProps/core.xml"]) {
      let xml = dec.decode(files["docProps/core.xml"]);
      xml = xml.replace(/<dc:creator>[\s\S]*?<\/dc:creator>/gi, "<dc:creator></dc:creator>")
               .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/gi, "<cp:lastModifiedBy></cp:lastModifiedBy>")
               .replace(/<dc:title>[\s\S]*?<\/dc:title>/gi, "<dc:title></dc:title>")
               .replace(/<dc:subject>[\s\S]*?<\/dc:subject>/gi, "<dc:subject></dc:subject>")
               .replace(/<cp:keywords>[\s\S]*?<\/cp:keywords>/gi, "<cp:keywords></cp:keywords>");
      if (xml.includes("<dc:description>")) {
        xml = xml.replace(/<dc:description>[\s\S]*?<\/dc:description>/gi, "<dc:description>Znečitelně — metadata stripped</dc:description>");
      } else if (xml.includes("</cp:coreProperties>")) {
        xml = xml.replace("</cp:coreProperties>", "<dc:description>Znečitelně — metadata stripped</dc:description></cp:coreProperties>");
      }
      files["docProps/core.xml"] = enc.encode(xml);
    }
    if (files["docProps/app.xml"]) {
      let xml = dec.decode(files["docProps/app.xml"]);
      xml = xml.replace(/<Company>[\s\S]*?<\/Company>/gi, "<Company></Company>")
               .replace(/<Manager>[\s\S]*?<\/Manager>/gi, "<Manager></Manager>");
      files["docProps/app.xml"] = enc.encode(xml);
    }
  }

  const bytes = flate.zipSync(files, { level: 6 });
  return { ok: true, bytes };
}

  export function exportXlsxFile(sourceBuf, hits, mode, lang){
    if (!sourceBuf) return null;
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
    const stripMetaVal = (typeof S !== "undefined" && S.stripMeta !== undefined) ? S.stripMeta : true;
    if (flate && typeof exportXlsxFileFflate === "function") {
      const fflateRes = exportXlsxFileFflate(sourceBuf, hits, mode, lang, stripMetaVal);
      if (fflateRes && fflateRes.ok) return fflateRes.bytes;
    }
    const xlsxLib = getXlsxLib();
    if (!xlsxLib) throw new Error("XLSX: knihovna se nenačetla.");
    const wb = xlsxLib.read(sourceBuf.slice(0), { type:"array" });
    const { cellMap } = xlsxToText(wb);
    const replacer = bindReplacer(mode, lang, hits);
    const accepted = effectiveHits(hits);
    if (!accepted.length) {
      if (stripMetaVal) stripWorkbookMeta(wb);
      return xlsxLib.write(wb, { bookType:"xlsx", type:"array" });
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
    if (stripMetaVal) stripWorkbookMeta(wb);
    return xlsxLib.write(wb, { bookType:"xlsx", type:"array" });
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
      delete wb.Workbook.WBProps;
    }
  }
