import { bindReplacer, effectiveHits, makeWork } from "../core/detector.js";

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
  export function docxReplaceInXml(xml, map, tagName, found, occurrenceTracker){
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("XML");
    const values = Array.from((occurrenceTracker?.allValues || map.keys())).filter(Boolean).sort((a,b) => b.length - a.length);
    let paras = Array.from(doc.getElementsByTagNameNS(DOCX_W_NS, "p"));
    if (!paras.length) {
      const DRAWING_A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
      paras = Array.from(doc.getElementsByTagNameNS(DRAWING_A_NS, "p"));
    }
    if (!paras.length) {
      paras = Array.from(doc.getElementsByTagName("p"));
    }
    let changed = false;

    paras.forEach(p => {
      const nodes = Array.from(p.getElementsByTagName("*")).filter(n => {
        let a = n.parentNode;
        while (a && a.localName !== "p") a = a.parentNode;
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
            const repObj = occurrenceTracker
              ? occurrenceTracker.getReplacement(v)
              : (map.has(v) ? { replace: true, value: map.get(v) } : { replace: false });
            if (repObj.replace) {
              matches.push({ s: ix, e: end, rep: repObj.value });
              if (found) found.add(v);
            }
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
              const repObj = occurrenceTracker
                ? occurrenceTracker.getReplacement(v)
                : (map.has(v) ? { replace: true, value: map.get(v) } : { replace: false });
              if (repObj.replace) {
                matches.push({ s: origStart, e: origEnd, rep: repObj.value });
                if (found) found.add(v);
              }
            }
            wFrom = wEnd;
          }
        }
      });

      if (!matches.length) return;
      matches.sort((a,b) => a.s - b.s);

      let nodeStart = 0;
      nodes.forEach((n, nodeIndex) => {
        const isText = n.localName === tagName;
        const t = texts[nodeIndex];
        const a = nodeStart;
        const b = a + t.length;
        nodeStart = b;
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

  export function docxStripAuthorInitials(xml) {
    return xml
      .replace(/\s+(?:w:)?author="[^"]*"/g, "")
      .replace(/\s+(?:w:)?initials="[^"]*"/g, "");
  }

  export function getOrderedDocxPartNames(files, partRe) {
    const headers = [], body = [], footers = [], comments = [], charts = [], diagrams = [], others = [];
    for (const name of Object.keys(files)) {
      if (!partRe.test(name)) continue;
      const lower = name.toLowerCase();
      if (/^word\/header\d*\.xml$/i.test(lower)) headers.push(name);
      else if (lower === "word/document.xml") body.push(name);
      else if (/^word\/(footnotes|endnotes|footer\d*)\.xml$/i.test(lower)) footers.push(name);
      else if (/^word\/comments\w*\.xml$/i.test(lower)) comments.push(name);
      else if (/^word\/charts\/chart\d*\.xml$/i.test(lower)) charts.push(name);
      else if (/^word\/diagrams\/data\d*\.xml$/i.test(lower)) diagrams.push(name);
      else others.push(name);
    }
    headers.sort();
    footers.sort();
    comments.sort();
    charts.sort();
    diagrams.sort();
    return [...headers, ...body, ...footers, ...comments, ...charts, ...diagrams, ...others];
  }

  export async function exportDocxFile(sourceBuf, hits, mode, lang){
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
    if (!flate) return { ok:false, reason:"fflate" };
    if (!sourceBuf) return { ok:false, reason:"sourceBuf missing" };

    const replacer = bindReplacer(mode, lang, hits);
    const map = new Map();
    effectiveHits(hits).forEach(h => {
      if (h.value && !map.has(h.value)) map.set(h.value, replacer(h));
    });

    const occCounts = new Map();
    const hitsByValue = new Map();
    (hits || []).forEach(h => {
      if (!h || !h.value) return;
      if (!hitsByValue.has(h.value)) hitsByValue.set(h.value, []);
      hitsByValue.get(h.value).push(h);
    });

    const occurrenceTracker = {
      allValues: Array.from(hitsByValue.keys()),
      getReplacement(v) {
        const list = hitsByValue.get(v) || [];
        const idx = occCounts.get(v) || 0;
        occCounts.set(v, idx + 1);
        if (idx < list.length) {
          const hit = list[idx];
          if (hit.accept === false) return { replace: false };
          return { replace: true, value: replacer(hit) };
        }
        if (list.length > 0 && list.every(h => h.accept !== false)) {
          return { replace: true, value: replacer(list[list.length - 1]) };
        }
        return { replace: false };
      }
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
    const found = new Set();
    const partRe = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments\w*|charts\/chart\d*|diagrams\/data\d*)\.xml$/i;
    const stripMeta = (typeof S !== "undefined" && S.stripMeta !== undefined) ? S.stripMeta : true;

    const orderedParts = getOrderedDocxPartNames(files, partRe);
    for (const name of orderedParts) {
      let xml = dec.decode(files[name]);

      let strippedMetaInPart = false;
      if (stripMeta) {
        const strippedXml = docxStripAuthorInitials(xml);
        if (strippedXml !== xml) {
          xml = strippedXml;
          strippedMetaInPart = true;
        }
      }

      const a = docxReplaceInXml(xml, map, "t", found, occurrenceTracker);
      if (a) xml = a;

      const b = docxReplaceInXml(xml, map, "delText", found, occurrenceTracker);
      if (b) xml = b;

      /*
       * True media lockdown: no image/OLE/VML object survives the exported DOCX.
       * This is intentionally unconditional for the anonymisation export.
       */
      const stripped = docxStripVisualObjects(xml);
      if (stripped.removed) xml = stripped.xml;

      if (a || b || stripped.removed || strippedMetaInPart) files[name] = enc.encode(xml);
    }

    if (stripMeta) {
      for (const name of Object.keys(files)) {
        if (/^docProps\/(core|app)\.xml$/.test(name)) {
          files[name] = enc.encode(docxStripMeta(name, dec.decode(files[name])));
        } else if (name === "docProps/custom.xml") {
          files[name] = enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>');
        }
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

    const bytes = flate.zipSync(files, { level: 6 });

    const mammoth = (typeof window !== "undefined" && window.mammoth) || (typeof globalThis !== "undefined" && globalThis.mammoth) || null;
    if (mammoth) {
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const chk = (await mammoth.extractRawText({ arrayBuffer: buf })).value || "";
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
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
    if (!flate || !flate.unzipSync) throw new Error("fflate není k dispozici");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const files = flate.unzipSync(u8);
    const docKey = Object.keys(files).find(k => k.replace(/\\/g, "/").toLowerCase() === "word/document.xml");
    const docEntry = docKey ? files[docKey] : null;
    if (!docEntry) throw new Error("Neplatný DOCX: chybí word/document.xml");

    function parseDocxXml(entryBytes){
      if (!entryBytes) return "";
      const xml = new TextDecoder("utf-8").decode(entryBytes);
      if (typeof DOMParser === "undefined") {
        const textNodes = [];
        const reP = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gi;
        let pm;
        while ((pm = reP.exec(xml)) !== null) {
          const pXml = pm[1];
          let pText = "";
          const reItem = /<w:(?:t(?:\s[^>]*)?>([^<]*)<\/w:t>|tab\/>|noBreakHyphen\/>|softHyphen\/>|br(?:\s[^>]*)?\/>)/gi;
          let im;
          while ((im = reItem.exec(pXml)) !== null) {
            if (im[1] !== undefined) pText += im[1];
            else if (im[0].includes("tab")) pText += "\t";
            else if (im[0].includes("noBreakHyphen")) pText += "\u2011";
            else if (im[0].includes("softHyphen")) pText += "\u00AD";
            else if (im[0].includes("br")) pText += "\n";
          }
          if (pText) textNodes.push(pText);
        }
        return textNodes.join("\n");
      }
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

