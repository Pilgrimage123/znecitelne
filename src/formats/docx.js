import { bindReplacer, effectiveHits } from "../core/detector.js";

const DOCX_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
  const DOCX_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  export function docxRelationshipSourcePart(relName){
    if (relName === "_rels/.rels") return "";
    const m = relName.match(/^(.*)\/_rels\/([^/]+)\.rels$/i);
    if (!m) throw new Error("Invalid .rels path: " + relName);
    return `${m[1]}/${m[2]}`;
  }

  export function docxNormalizeZipPath(path){
    const out = [];
    String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").split("/").forEach(part => {
      if (!part || part === ".") return;
      if (part === "..") out.pop();
      else out.push(part);
    });
    return out.join("/");
  }

  export function docxResolveRelTarget(sourcePart, target){
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
    let decoded = target;
    try { decoded = decodeURIComponent(target); } catch (_) {}
    const base = sourcePart ? sourcePart.slice(0, sourcePart.lastIndexOf("/") + 1) : "";
    return docxNormalizeZipPath(base + decoded);
  }

  export function docxRelativeZipPath(fromDir, targetPath){
    const from = fromDir ? fromDir.split("/").filter(Boolean) : [];
    const to = targetPath.split("/").filter(Boolean);
    while (from.length && to.length && from[0] === to[0]) {
      from.shift(); to.shift();
    }
    return [...from.map(() => ".."), ...to].join("/");
  }

  export function docxSetTextPreservingSpace(node, text){
    while (node.firstChild) node.removeChild(node.firstChild);
    node.appendChild(node.ownerDocument.createTextNode(text));
    if (/^\s|\s$/u.test(text) || /\s{2,}/u.test(text)) {
      node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    } else {
      node.removeAttributeNS("http://www.w3.org/XML/1998/namespace", "space");
      node.removeAttribute("xml:space");
    }
  }

  export function docxMakeWork(text){
    return makeWork(text);
  }

  /*
   * Replaces matches across multiple w:t / w:delText nodes inside one w:p.
   * We deliberately never merge w:r elements: w:rPr therefore stays intact.
   * Supports split runs, non-breaking spaces (\u00A0), non-breaking hyphens,
   * tabs (\t), soft breaks, and Czech typographical punctuation and quotes.
   * The replacement is assigned to the first affected text node; subsequent
   * affected nodes are reduced to their remaining local text.
   */
  export function docxReplaceInXml(xml, map, tagName, found){
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("XML");
    const values = Array.from(map.keys()).filter(Boolean).sort((a,b) => b.length - a.length);
    const paras = Array.from(doc.getElementsByTagNameNS(DOCX_W_NS, "p"));
    let changed = false;

    paras.forEach(p => {
      const nodes = Array.from(p.getElementsByTagNameNS(DOCX_W_NS, "*")).filter(n => {
        let a = n.parentNode;
        while (a && !(a.localName === "p" && a.namespaceURI === DOCX_W_NS)) a = a.parentNode;
        if (a !== p) return false;
        const name = n.localName;
        return name === tagName || name === "tab" || name === "noBreakHyphen" || name === "softHyphen" || name === "br";
      });
      if (!nodes.length) return;

      const texts = nodes.map(n => {
        const name = n.localName;
        if (name === tagName) {
          const t = (n.textContent || "").normalize("NFC");
          if (n.textContent !== t) n.textContent = t;
          return t;
        }
        if (name === "tab") return "\t";
        if (name === "noBreakHyphen") return "\u2011";
        if (name === "softHyphen") return "\u00AD";
        if (name === "br" && !n.getAttributeNS(DOCX_W_NS, "type")) return "\n";
        return "";
      });
      const full = texts.join("");
      if (!full) return;

      const used = new Array(full.length).fill(false);
      const matches = [];
      const { work: fullWork, toSrc: fullToSrc } = docxMakeWork(full);

      values.forEach(v => {
        // Pass 1: exact matching
        let from = 0, ix;
        while ((ix = full.indexOf(v, from)) >= 0) {
          const end = ix + v.length;
          let free = true;
          for (let k = ix; k < end; k++) {
            if (used[k]) { free = false; break; }
          }
          if (free) {
            for (let k = ix; k < end; k++) used[k] = true;
            matches.push({ s: ix, e: end, rep: map.get(v) });
            found.add(v);
          }
          from = end;
        }

        // Pass 2: normalized matching (handling Czech quotes „ “, non-breaking space \u00A0, non-breaking hyphen, soft hyphen, and NFC)
        const vWork = docxMakeWork(v).work;
        if (vWork && fullWork) {
          let wFrom = 0, wIx;
          while ((wIx = fullWork.indexOf(vWork, wFrom)) >= 0) {
            const wEnd = wIx + vWork.length;
            const origStart = fullToSrc[wIx];
            const origEnd = fullToSrc[wEnd - 1] + 1;
            let free = true;
            for (let k = origStart; k < origEnd; k++) {
              if (used[k]) { free = false; break; }
            }
            if (free) {
              for (let k = origStart; k < origEnd; k++) used[k] = true;
              matches.push({ s: origStart, e: origEnd, rep: map.get(v) });
              found.add(v);
            }
            wFrom = wEnd;
          }
        }
      });

      if (!matches.length) return;
      matches.sort((a,b) => a.s - b.s);

      nodes.forEach((n, nodeIndex) => {
        const isText = n.localName === tagName;
        const t = texts[nodeIndex];
        const a = texts.slice(0, nodeIndex).reduce((x, y) => x + y.length, 0);
        const b = a + t.length;
        let cursor = a;
        let out = "";

        for (const m of matches) {
          if (m.e <= a || m.s >= b) continue;
          const cs = Math.max(m.s, a);
          const ce = Math.min(m.e, b);

          if (cs > cursor) out += t.slice(cursor - a, cs - a);

          /*
           * Put the replacement only into the first text node touched by the match.
           * Other touched nodes contribute no duplicate replacement.
           */
          if (isText && !m._emitted) {
            out += m.rep;
            m._emitted = true;
          }
          cursor = Math.max(cursor, ce);
        }

        if (cursor < b) out += t.slice(cursor - a);

        if (isText) {
          if (out !== t) {
            docxSetTextPreservingSpace(n, out);
            changed = true;
          }
        } else if (cursor >= b && out === "") {
          n.parentNode?.removeChild(n);
          changed = true;
        }
      });
    });

    return changed
      ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        new XMLSerializer().serializeToString(doc)
      : null;
  }

  export function docxStripVisualObjects(xml){
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("XML");
    let removed = 0;

    ["drawing", "object", "pict"].forEach(localName => {
      Array.from(doc.getElementsByTagNameNS(DOCX_W_NS, localName)).forEach(node => {
        node.parentNode?.removeChild(node);
        removed++;
      });
    });

    return {
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        new XMLSerializer().serializeToString(doc),
      removed
    };
  }

  export function docxStripMediaRelationships(files, dec, enc){
    for (const name of Object.keys(files)) {
      if (name !== "_rels/.rels" && !/^.+\/_rels\/[^/]+\.rels$/i.test(name)) continue;

      const doc = new DOMParser().parseFromString(dec.decode(files[name]), "application/xml");
      if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid relationships: " + name);

      const sourcePart = docxRelationshipSourcePart(name);
      let changed = false;
      Array.from(doc.getElementsByTagNameNS(DOCX_REL_NS, "Relationship")).forEach(rel => {
        const type = rel.getAttribute("Type") || "";
        const target = docxResolveRelTarget(sourcePart, rel.getAttribute("Target"));
        if (
          /\/relationships\/(?:image|oleObject|package|vmlDrawing|audio|video)$/i.test(type) ||
          (target && /^word\/(?:media|embeddings)\//i.test(target))
        ) {
          rel.parentNode?.removeChild(rel);
          changed = true;
        }
      });

      if (changed) {
        files[name] = enc.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          new XMLSerializer().serializeToString(doc)
        );
      }
    }
  }

  export function docxRemoveMediaParts(files){
    for (const name of Object.keys(files)) {
      if (/^word\/(?:media|embeddings)\//i.test(name)) delete files[name];
    }
  }

  export function docxAssertNoEmbeddedMedia(files){
    const leftovers = Object.keys(files).filter(name => /^word\/(?:media|embeddings)\//i.test(name));
    if (leftovers.length) {
      throw new Error("DOCX still contains embedded media: " + leftovers.join(", "));
    }
  }

  export function docxAssertNoDanglingRelationships(files, dec){
    for (const name of Object.keys(files)) {
      if (name !== "_rels/.rels" && !/^.+\/_rels\/[^/]+\.rels$/i.test(name)) continue;

      const doc = new DOMParser().parseFromString(dec.decode(files[name]), "application/xml");
      if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid relationships: " + name);

      const sourcePart = docxRelationshipSourcePart(name);
      Array.from(doc.getElementsByTagNameNS(DOCX_REL_NS, "Relationship")).forEach(rel => {
        if (rel.getAttribute("TargetMode") === "External") return;
        const target = docxResolveRelTarget(sourcePart, rel.getAttribute("Target"));
        if (target && !files[target]) {
          throw new Error("Dangling DOCX relationship: " + name + " -> " + target);
        }
      });
    }
  }

  export function docxStripMeta(name, xml){
    const blank = (tags) => tags.reduce((x, tg) => x.replace(new RegExp("(<" + tg + "(?:\\s[^>]*)?>)[\\s\\S]*?(</" + tg + ">)", "g"), "$1$2"), xml);
    if (/docProps\/core\.xml$/.test(name)) return blank(["dc:creator","cp:lastModifiedBy","dc:title","dc:subject","cp:keywords","dc:description"]);
    if (/docProps\/app\.xml$/.test(name)) return blank(["Company","Manager"]);
    return xml;
  }

  export async function exportDocxFile(sourceBuf, hits, mode, lang){
    if (!window.fflate) return { ok:false, reason:"fflate" };

    const replacer = bindReplacer(mode, lang, hits);
    const map = new Map();
    effectiveHits(hits).forEach(h => {
      if (h.value && !map.has(h.value)) map.set(h.value, replacer(h));
    });

    const files = fflate.unzipSync(new Uint8Array(sourceBuf.slice(0)));
    for (const k of Object.keys(files)) {
      const norm = k.replace(/\\/g, "/");
      if (norm !== k) {
        files[norm] = files[k];
        delete files[k];
      }
    }
    const dec = new TextDecoder("utf-8"), enc = new TextEncoder();
    const found = new Set();
    const partRe = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments\w*)\.xml$/i;

    for (const name of Object.keys(files)) {
      if (partRe.test(name)) {
        let xml = dec.decode(files[name]);

        const a = docxReplaceInXml(xml, map, "t", found);
        if (a) xml = a;

        const b = docxReplaceInXml(xml, map, "delText", found);
        if (b) xml = b;

        /*
         * True media lockdown: no image/OLE/VML object survives the exported DOCX.
         * This is intentionally unconditional for the anonymisation export.
         */
        const stripped = docxStripVisualObjects(xml);
        if (stripped.removed) xml = stripped.xml;

        if (a || b || stripped.removed) files[name] = enc.encode(xml);
      } else if (S.stripMeta && /^docProps\/(core|app)\.xml$/.test(name)) {
        files[name] = enc.encode(docxStripMeta(name, dec.decode(files[name])));
      } else if (S.stripMeta && name === "docProps/custom.xml") {
        files[name] = enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>');
      }
    }

    docxStripMediaRelationships(files, dec, enc);
    docxRemoveMediaParts(files);

    const missing = Array.from(map.keys()).filter(v => !found.has(v));
    if (missing.length) {
      return { ok:false, reason: missing.length + " × nález nenalezen ve struktuře DOCX / not found in DOCX structure" };
    }

    docxAssertNoEmbeddedMedia(files);
    docxAssertNoDanglingRelationships(files, dec);

    const bytes = fflate.zipSync(files, { level: 6 });

    if (window.mammoth) {
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const chk = (await window.mammoth.extractRawText({ arrayBuffer: buf })).value || "";
      const left = Array.from(map.entries()).filter(([v, rep]) => !rep.includes(v) && chk.includes(v));
      if (left.length) {
        throw new Error("Zbytková hodnota po kontrole");
      }
    }

    return {
      ok:true,
      bytes,
      removedMedia:true
    };
  }

export function extractDocxTextWithFflate(buf){
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

