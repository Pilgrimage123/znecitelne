// PDF format handling and security preflights (ADR-0001, ADR-0002)
import { toBytes, bindReplacer, effectiveHits } from "../core/detector.js";

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

export function pdfVisualAvailable(){ return S.kind === "pdf" && !!S.sourceBuf && !!window.pdfjsLib; }
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

export function pdfDetectFontFamily(fontName){
  const f = String(fontName || "").toLowerCase();
  if (/times|roman|serif|garamond|georgia|cambria|minion|baskerville/i.test(f)) return "serif";
  if (/courier|mono|consol|typewriter|menlo/i.test(f)) return "monospace";
  return "sans-serif";
}

export function pdfCompactToken(token){
  if (!token) return "";
  const m = token.match(/^\[([A-ZÁ-Ž_]+?)(?:_([A-Za-z0-9]+))?\]$/);
  if (!m) return token;
  const cat = m[1];
  const suffix = m[2];
  let p = cat.charAt(0);
  if (cat.startsWith("DATUM")) p = "DN";
  else if (cat.startsWith("DOKLAD")) p = "DOK";
  else if (cat.startsWith("TELEFON")) p = "TEL";
  else if (cat.startsWith("ADRESA")) p = "ADR";
  else if (cat.startsWith("PROJEKT")) p = "PRJ";
  else if (cat.startsWith("SYSTÉM") || cat.startsWith("SYSTEM")) p = "SYS";
  else if (cat.startsWith("INCIDENT")) p = "INC";
  else if (cat.startsWith("ŘÍZENÍ") || cat.startsWith("RIZENI")) p = "ŘÍZ";
  else if (cat.startsWith("ORGÁN") || cat.startsWith("ORGAN")) p = "ORG";
  return suffix ? `[${p}_${suffix}]` : `[${p}]`;
}

export function sampleCanvasBg(ctx, x, y, w, h, canvasW, canvasH){
  try {
    const samples = [];
    const check = (px, py) => {
      if (px >= 0 && px < canvasW && py >= 0 && py < canvasH) {
        const p = ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
        const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
        if (lum > 140 && p[3] > 200) samples.push([p[0], p[1], p[2]]);
      }
    };
    for (let s = 2; s <= 6; s += 2) {
      check(x - s, y + h / 2);
      check(x + w + s, y + h / 2);
      check(x + w / 2, y - s);
      check(x + w / 2, y + h + s);
    }
    if (samples.length >= 2) {
      const avgR = Math.round(samples.reduce((a, c) => a + c[0], 0) / samples.length);
      const avgG = Math.round(samples.reduce((a, c) => a + c[1], 0) / samples.length);
      const avgB = Math.round(samples.reduce((a, c) => a + c[2], 0) / samples.length);
      return `rgb(${avgR},${avgG},${avgB})`;
    }
  } catch (_) {}
  return "#ffffff";
}

export function mergeAdjacentBoxes(quads, scale){
  if (!quads || !quads.length) return [];
  const lines = [];
  quads.forEach(q => {
    const line = lines.find(l => Math.abs(l.baseLine - q.baseLine) <= Math.max(l.fH, q.fH) * 0.35);
    if (line) line.items.push(q);
    else lines.push({ baseLine: q.baseLine, fH: q.fH, items: [q] });
  });
  const out = [];
  lines.forEach(l => {
    l.items.sort((a, b) => a.boxX - b.boxX);
    let cur = null;
    for (const it of l.items) {
      if (!cur) {
        cur = { boxX: it.boxX, boxY: it.boxY, boxW: it.boxW, boxH: it.boxH, maxX: it.boxX + it.boxW };
        continue;
      }
      const gap = it.boxX - cur.maxX;
      if (gap <= Math.max(8 * scale, it.fH * 0.8)) {
        const newMaxX = Math.max(cur.maxX, it.boxX + it.boxW);
        cur.boxY = Math.min(cur.boxY, it.boxY);
        cur.boxH = Math.max(cur.boxH, it.boxH);
        cur.boxW = newMaxX - cur.boxX;
        cur.maxX = newMaxX;
      } else {
        out.push(cur);
        cur = { boxX: it.boxX, boxY: it.boxY, boxW: it.boxW, boxH: it.boxH, maxX: it.boxX + it.boxW };
      }
    }
    if (cur) out.push(cur);
  });
  return out;
}

export function resolvePageHitQuads(pageText, pageMap, hits, pageMeta, scale){
  if (!pageMap || !pageMap.length || !hits || !hits.length) return [];
  const assignedRanges = [];
  const results = [];
  const sortedHits = hits.slice().sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  sortedHits.forEach(h => {
    if (!h || !h.value) return;
    const val = h.value;
    const valLen = val.length;
    const rel = (pageMeta && Number.isFinite(pageMeta.start)) ? (h.start - pageMeta.start) : h.start;

    const occs = [];
    let p = 0;
    while ((p = pageText.indexOf(val, p)) !== -1) {
      occs.push(p);
      p += 1;
    }
    const normVal = val.replace(/\s+/g, " ").trim();
    if (!occs.length && normVal !== val) {
      p = 0;
      while ((p = pageText.indexOf(normVal, p)) !== -1) {
        occs.push(p);
        p += 1;
      }
    }

    const unassigned = occs.filter(idx => !assignedRanges.some(ar => idx < ar.end && (idx + valLen) > ar.start));

    let chosenIdx = -1;
    if (unassigned.includes(rel)) {
      chosenIdx = rel;
    } else if (unassigned.length > 0) {
      unassigned.sort((a, b) => Math.abs(a - rel) - Math.abs(b - rel));
      chosenIdx = unassigned[0];
    } else if (pageText.slice(rel, rel + valLen) === val) {
      chosenIdx = rel;
    } else {
      const winStart = Math.max(0, rel - 50);
      const winEnd = Math.min(pageText.length, rel + 50 + valLen);
      const localSub = pageText.slice(winStart, winEnd);
      const localIdx = localSub.indexOf(val);
      if (localIdx >= 0) {
        const candidate = winStart + localIdx;
        if (!assignedRanges.some(ar => candidate < ar.end && (candidate + valLen) > ar.start)) {
          chosenIdx = candidate;
        }
      }
    }

    if (chosenIdx < 0) {
      const directGlyphs = pageMap.filter(m => m.start >= rel && m.end <= (rel + Math.max(valLen, 1)));
      if (directGlyphs.length) {
        chosenIdx = rel;
      }
    }

    if (chosenIdx < 0) return;
    assignedRanges.push({ start: chosenIdx, end: chosenIdx + valLen });

    const endIdx = chosenIdx + Math.max(valLen, 1);
    const glyphs = pageMap.filter(m => m.end > chosenIdx && m.start < endIdx);
    if (!glyphs.length) return;

    const quads = pdfWordQuads(glyphs);
    quads.forEach((r, qIdx) => {
      const lineGlyphs = (r.glyphs && r.glyphs.length) ? r.glyphs : pageMap.filter(m => m.end > chosenIdx && m.start < endIdx && Math.abs(m.y - r.y) < Math.max(m.h, r.h) * 0.6);
      const bGlyphs = lineGlyphs.filter(g => g && g.baselineY);
      const hasBaseline = bGlyphs.length > 0;
      const baseLine = hasBaseline ? bGlyphs[0].baselineY : (r.y + (r.h || 10) * 0.82);
      const fH = hasBaseline ? Math.max(...bGlyphs.map(g => g.fontH || g.h)) : Math.max(r.rawH || r.h, 6);
      const minX = Math.min(...lineGlyphs.map(g => g.x));
      const maxX = Math.max(...lineGlyphs.map(g => g.x + g.w));

      let padXRight = Math.max(3, Math.round(scale * 1.8));
      const nextG = pageMap.find(m => m.start >= endIdx && m.str && m.str.trim());
      if (nextG && /^[,.:;!?)]/u.test(nextG.str) && nextG.x > maxX) {
        const gap = nextG.x - maxX;
        padXRight = Math.min(padXRight, Math.max(0, gap - 1));
      }
      let padXLeft = Math.max(2, Math.round(scale * 1.2));
      const prevG = pageMap.slice().reverse().find(m => m.end <= chosenIdx && m.str && m.str.trim());
      if (prevG && /^[(["]/u.test(prevG.str) && (prevG.x + prevG.w) < minX) {
        const gap = minX - (prevG.x + prevG.w);
        padXLeft = Math.min(padXLeft, Math.max(0, gap - 1));
      }

      const boxX = Math.max(0, minX - padXLeft);
      const boxW = Math.max(maxX + padXRight - boxX, 6);
      const boxY = baseLine - fH * 1.04;
      const bottomY = baseLine + fH * 0.30;
      const boxH = Math.max(bottomY - boxY, 8);
      const fontFam = pdfDetectFontFamily(lineGlyphs[0] && (lineGlyphs[0].fontName || lineGlyphs[0].name));

      results.push({
        hit: h,
        qIdx,
        totalQuads: quads.length,
        startIdx: chosenIdx,
        endIdx,
        boxX,
        boxY,
        boxW,
        boxH,
        minX,
        maxX,
        baseLine,
        fH,
        fontFam,
        hasBaseline,
        lineGlyphs
      });
    });
  });

  return results;
}

  export function paintPdfVisualOverlays(){
    if (!PV) return;
    const previewOn = S.docView === "preview";
    const isBox = S.mode === "box" || !S.mode;
    const replacer = (previewOn && !isBox) ? bindReplacer(S.mode, S.lang, S.hits) : null;
    PV.pages.forEach(pg => {
      pg.layer.innerHTML = "";
      const meta = (S.pages || []).find(p => p.n === pg.n);
      const visHits = visibleHits(S.hits, S.selectedId);
      const pageQuads = resolvePageHitQuads(pg.text, pg.map, visHits, meta, pg.scale || 1);
      pageQuads.forEach(q => {
        const h = q.hit;
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.id = h.id;
        b.style.left = q.boxX + "px";
        b.style.top = q.boxY + "px";
        b.style.height = q.boxH + "px";
        b.style.width = q.boxW + "px";
        b.onclick = () => select(h.id);

        if (!h.accept) {
          b.className = "pv-box pv-off" + (S.selectedId === h.id ? " pv-sel" : "");
          b.setAttribute("aria-label", (i().cats && i().cats[h.type]) || h.type);
        } else if (!previewOn) {
          b.className = "pv-box pv-on" + (S.selectedId === h.id ? " pv-sel" : "");
          b.setAttribute("aria-label", (i().cats && i().cats[h.type]) || h.type);
        } else if (isBox) {
          b.className = "pv-box pv-prev pv-prev-box" + (S.selectedId === h.id ? " pv-sel" : "");
          b.setAttribute("aria-label", ((i().cats && i().cats[h.type]) || h.type) + " (" + (i().redact || "anonymizováno") + ")");
        } else {
          const fullToken = replacer ? replacer(h) : "";
          b.className = "pv-box pv-prev pv-prev-token" + (S.selectedId === h.id ? " pv-sel" : "");
          b.style.maxWidth = q.boxW + "px";
          b.style.overflow = "hidden";
          b.style.textOverflow = "ellipsis";
          b.style.fontFamily = q.fontFam;
          const fontSize = Math.max(8, Math.min(13, Math.round(q.boxH * 0.65)));
          b.style.fontSize = fontSize + "px";
          if (q.qIdx === 0) {
            const compToken = pdfCompactToken(fullToken);
            const fitsFull = (fullToken.length * fontSize * 0.55) <= (q.boxW + 6);
            b.textContent = fitsFull ? fullToken : compToken;
          } else {
            b.textContent = "";
          }
          b.setAttribute("aria-label", fullToken + " · " + ((i().cats && i().cats[h.type]) || h.type));
          b.title = fullToken;
        }
        pg.layer.appendChild(b);
      });
    });
  }
  export async function buildPdfVisual(token){
    const host = $("pdfVisual");
    if (!host) return;
    const width = Math.max(280, Math.min(900, host.clientWidth - 16 || 700));
    if (PV && PV.buf === S.sourceBuf && PV.width === width && host.firstChild) { paintPdfVisualOverlays(); return; }
    host.innerHTML = `<p class="pv-note">${esc(i().visualNote)}</p>`;
    const pdf = await getPdfDocument(S.sourceBuf);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      if (token !== pvToken) return;
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const vp = page.getViewport({ scale });
      const vpHi = page.getViewport({ scale: scale * dpr });
      const wrap = document.createElement("div");
      wrap.className = "pv-page";
      wrap.style.width = vp.width + "px"; wrap.style.height = vp.height + "px";
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vpHi.width); canvas.height = Math.floor(vpHi.height);
      wrap.appendChild(canvas);
      const layer = document.createElement("div");
      layer.style.cssText = "position:absolute;inset:0";
      wrap.appendChild(layer);
      host.appendChild(wrap);
      await page.render(pdfRenderParams(canvas.getContext("2d"), vpHi)).promise;
      const meta = (S.pages || []).find(p => p.n === n);
      const raw = (meta && meta.items && meta.items.length) ? meta.items : (await page.getTextContent()).items;
      const mapped = mapPageGlyphs(raw, scale, vp);
      pages.push({ n, wrap, layer, text: mapped.text, map: mapped.map, scale });
    }
    if (token !== pvToken) return;
    PV = { buf: S.sourceBuf, width, pages };
    paintPdfVisualOverlays();
  }
  export function paintPdfVisual(){
    const btn = $("btnVisual"), host = $("pdfVisual"), t = i();
    const avail = pdfVisualAvailable();
    if (!avail && S.pdfVisual) S.pdfVisual = false;
    if (btn) {
      btn.classList.toggle("hidden", !avail);
      btn.textContent = S.pdfVisual ? t.visualOff : t.visualOn;
      btn.setAttribute("data-tip", t.tips.visual);
      btn.onclick = () => { S.pdfVisual = !S.pdfVisual; paintReview(); };
    }
    document.body.classList.toggle("pdf-visual-on", S.pdfVisual);
    const btnAdd = $("btnAdd");
    if (btnAdd) btnAdd.disabled = S.pdfVisual;
    if (host) {
      host.classList.toggle("hidden", !S.pdfVisual);
      if (!S.pdfVisual) { pvToken++; return; }
      if (PV && PV.buf === S.sourceBuf && host.querySelector(".pv-page")) { paintPdfVisualOverlays(); return; }
      const token = ++pvToken;
      buildPdfVisual(token).catch(e => { console.warn("PDF visual failed:", e); if (token === pvToken) host.innerHTML = `<p class="pv-note danger">${esc(t.visualErr)}</p>`; });
    }
  }
  export function clearPdfVisual(){
    PV = null;
    pvToken++;
    S.pdfVisual = false;
    document.body.classList.remove("pdf-visual-on");
    const h = $("pdfVisual");
    if (h) {
      h.innerHTML = "";
      h.classList.add("hidden");
    }
  }

export function pdfHasSignatureBytes(buf){
    try {
      const s = new TextDecoder("latin1").decode(toBytes(buf));
      return /\/ByteRange\s*\[/.test(s) && /\/Type\s*\/Sig\b|\/SubFilter\s*\/(?:adbe|ETSI)/.test(s);
    } catch (_) { return false; }
  }

export function pdfWorker(){
    const pdfjs = (typeof window !== "undefined" && window.pdfjsLib) || (typeof globalThis !== "undefined" && globalThis.pdfjsLib) || null;
    if (!pdfjs) throw new Error("PDF: knihovna se nenačetla.");
    const win = typeof window !== "undefined" ? window : globalThis;
    if (win.__pdfWorkerReady) return win.__pdfWorkerReady;
    win.__pdfWorkerReady = (async () => {
      const local = "./lib/pdf.worker.min.js";
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = local;
      } catch (_) {}
      return "local";
    })();
    return win.__pdfWorkerReady;
  }
  export async function getPdfDocument(data){
    await pdfWorker();
    const bytes = (data instanceof Uint8Array)
      ? new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
      : new Uint8Array(data.slice ? data.slice(0) : data);
    const options = {
      data: bytes,
      disableStream: true,
      disableAutoFetch: true
    };
    return pdfjsLib.getDocument(options).promise;
  }
  function pageTextFromItems(items){
    let text = "";
    let lastIt = null;
    for (const it of (items || [])) {
      if (!it || !it.str) continue;
      let sep = " ";
      if (lastIt) {
        if (it._ocr && lastIt._ocr) {
          const dy = Math.abs((it._pdfYTop || 0) - (lastIt._pdfYTop || 0));
          const avgH = ((it._pdfH || 10) + (lastIt._pdfH || 10)) / 2 || 10;
          if (dy > avgH * 0.45) sep = "\n";
        } else if (it.transform && lastIt.transform) {
          const dy = Math.abs(it.transform[5] - lastIt.transform[5]);
          const fontH = Math.hypot(it.transform[2], it.transform[3]) || 10;
          if (dy > fontH * 0.45) sep = "\n";
        }
      }
      if (text) text += sep;
      text += it.str;
      lastIt = it;
    }
    return text;
  }
  function mapPageGlyphs(items, scale, vp){
    let text = "";
    const map = [];
    let lastIt = null;
    for (const it of items) {
      if (!it || !it.str) continue;
      let sep = " ";
      if (lastIt) {
        if (it._ocr && lastIt._ocr) {
          const dy = Math.abs((it._pdfYTop || 0) - (lastIt._pdfYTop || 0));
          const avgH = ((it._pdfH || 10) + (lastIt._pdfH || 10)) / 2 || 10;
          if (dy > avgH * 0.45) sep = "\n";
        } else if (it.transform && lastIt.transform) {
          const dy = Math.abs(it.transform[5] - lastIt.transform[5]);
          const fontH = Math.hypot(it.transform[2], it.transform[3]) || 10;
          if (dy > fontH * 0.45) sep = "\n";
        }
      }
      if (text) text += sep;
      const baseStart = text.length;
      text += it.str;
      lastIt = it;
      const len = it.str.length;
      if (!len) continue;
      if (it._ocr) {
        const charW = (it._pdfW * scale) / len;
        for (let k = 0; k < len; k++) {
          map.push({
            start: baseStart + k,
            end: baseStart + k + 1,
            str: it.str[k],
            x: (it._pdfX * scale) + (k * charW),
            y: it._pdfYTop * scale,
            w: charW,
            h: it._pdfH * scale,
            fontH: it._pdfH * scale,
            baselineY: 0
          });
        }
      } else {
        const tx = vp && pdfjsLib.Util.transform(vp.transform, it.transform);
        const fontH = tx ? Math.hypot(tx[2], tx[3]) : 0;
        const totalW = (it.width || 0) * scale;
        const charW = len > 0 ? (totalW / len) : totalW;
        // In PDF coordinates, tx[4] is baseline X, tx[5] is baseline Y.
        // Cap-height is approx ~0.82 of font size above baseline.
        // Exact font size height is used instead of expanded 1.2 line-height:
        const yTop = tx ? (tx[5] - fontH * 0.82) : 0;
        for (let k = 0; k < len; k++) {
          map.push({
            start: baseStart + k,
            end: baseStart + k + 1,
            str: it.str[k],
            x: (tx ? tx[4] : 0) + (k * charW),
            y: yTop,
            w: charW,
            h: fontH,
            fontH,
            baselineY: tx ? tx[5] : 0
          });
        }
      }
    }
    return { text, map };
  }
  const STAMP_HINT_RE = /podpisuj[íi]c[íi]|podepisuj[íi]c[íi]|podepsán elektronick|elektronick(?:ým|ym) podpis|sériové\s+č\.?\s*cert|vydavatel\s+cert|signed\s+by|digital(?:ly)?\s+signed/i;
  function isSignatureAnnot(a){
    if (!a) return false;
    const ft = String(a.fieldType || a.ft || "").toLowerCase();
    const sub = String(a.subtype || a.SubType || "").toLowerCase();
    const name = String(a.fieldName || a.alternativeText || a.title || "");
    if (ft === "sig" || sub === "sig") return true;
    if (sub === "widget" && /sign|podpis|sig/i.test(name)) return true;
    if (sub === "stamp" && STAMP_HINT_RE.test(name + " " + (a.contents || ""))) return true;
    const blob = [a.contents, a.alternativeText, a.fieldName, a.title].filter(Boolean).join(" ");
    if (blob && STAMP_HINT_RE.test(blob)) return true;
    return false;
  }
  function annotRect(a){
    const r = a && (a.rect || a.Rect);
    if (!r || r.length < 4) return null;
    const x1 = +r[0], y1 = +r[1], x2 = +r[2], y2 = +r[3];
    if (![x1,y1,x2,y2].every(Number.isFinite)) return null;
    return [Math.min(x1,x2), Math.min(y1,y2), Math.max(x1,x2), Math.max(y1,y2)];
  }
  function annotPlainText(a){
    const parts = [];
    ["contents","alternativeText","fieldName","title","fieldValue"].forEach(k => {
      const v = a && a[k];
      if (v == null) return;
      if (typeof v === "string") parts.push(v);
      else if (typeof v === "object" && typeof v.str === "string") parts.push(v.str);
    });
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  async function pageSignatureMeta(page){
    let annots = [];
    try { annots = await page.getAnnotations({ intent: "display" }); }
    catch (_) { try { annots = await page.getAnnotations(); } catch (__) { annots = []; } }
    const out = [];
    (annots || []).forEach(a => {
      if (!isSignatureAnnot(a)) return;
      const rect = annotRect(a);
      if (!rect) return;
      out.push({
        rect,
        fieldName: a.fieldName || "",
        text: annotPlainText(a),
        id: a.id || ""
      });
    });
    return out;
  }
  function viewportCoverRect(vp, pdfRect){
    if (!vp || !pdfRect) return null;
    let r;
    if (typeof vp.convertToViewportRectangle === "function") {
      r = vp.convertToViewportRectangle(pdfRect);
    } else {
      const s = vp.scale || 1;
      const h = vp.height || 0;
      r = [pdfRect[0]*s, h - pdfRect[3]*s, pdfRect[2]*s, h - pdfRect[1]*s];
    }
    const x = Math.min(r[0], r[2]), y = Math.min(r[1], r[3]);
    const w = Math.abs(r[2]-r[0]), h = Math.abs(r[3]-r[1]);
    if (!(w > 2 && h > 2)) return null;
    return { x, y, w, h };
  }
  const STAMP_FIELD_RE = /^(podpisuj|podepisuj|podepsal|organizace|organisation|organization|s[eé]riov|cert\.?$|vydavatel|issuer|datum|čas$|cas$|důvod|duvod|m[ií]sto|dokument|podeps[aá]n|elektronick|podpisem|postsignum|qualified|public$|ca$|signed|digital)/i;
  const STAMP_ORG_ONLY_RE = /^(čb[uú]|cbu|úřad|urad|ministerstvo)$/i;
  function stampWordMidY(w){ return (w.bbox.y0 + w.bbox.y1) / 2; }
  function stampWordH(w){ return Math.max(1, w.bbox.y1 - w.bbox.y0); }
  function pickStampSignerWords(words){
    if (!words || !words.length) return [];
    const ws = words.slice().sort((a,b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));
    const labelIdx = ws.findIndex(w => /podpisuj|podepisuj|podepsal|signed/i.test(String(w.text||"").replace(/[:：]/g,"")));
    let picked = [];
    if (labelIdx >= 0) {
      const label = ws[labelIdx];
      const ly = stampWordMidY(label);
      const lh = stampWordH(label);
      for (let i = labelIdx + 1; i < ws.length; i++) {
        const w = ws[i];
        const raw = String(w.text||"").replace(/[:：]/g,"");
        if (Math.abs(stampWordMidY(w) - ly) <= Math.max(6, lh * 0.75)) {
          if (STAMP_FIELD_RE.test(raw)) break;
          picked.push(w);
          continue;
        }
        if (stampWordMidY(w) > ly + lh * 0.85) {
          if (STAMP_FIELD_RE.test(raw)) break;
          const key = raw.toLocaleLowerCase("cs").replace(/\./g,"");
          if (looksName(raw) || TITLES.includes(key) || /^(phdr|judr|mudr|ing|mgr|bc|ph\.?d)/i.test(raw)) picked.push(w);
          else break;
        }
      }
    }
    if (!picked.length) {
      picked = ws.filter(w => {
        const raw = String(w.text||"").replace(/[.,;:()]/g,"");
        if (!raw || STAMP_FIELD_RE.test(raw) || /^\d+$/.test(raw)) return false;
        const key = raw.toLocaleLowerCase("cs").replace(/\./g,"");
        if (TITLES.includes(key)) return true;
        return looksName(raw) || NAMES.has(key);
      });
    }
    if (!picked.length) return [];
    if (picked.every(w => STAMP_ORG_ONLY_RE.test(String(w.text||"").replace(/[.,:]/g,"").toLocaleLowerCase("cs")))) return [];
    return picked;
  }
  function mergeStampWordLines(words, pad){
    if (!words.length) return [];
    const p = pad == null ? 2 : pad;
    const lines = [];
    words.slice().sort((a,b)=>a.bbox.y0-b.bbox.y0).forEach(w => {
      const last = lines[lines.length-1];
      if (last && Math.abs(stampWordMidY(w) - stampWordMidY(last[0])) <= Math.max(6, stampWordH(w) * 0.7)) last.push(w);
      else lines.push([w]);
    });
    return lines.map(line => ({
      x0: Math.min(...line.map(w=>w.bbox.x0)) - p,
      y0: Math.min(...line.map(w=>w.bbox.y0)) - p,
      x1: Math.max(...line.map(w=>w.bbox.x1)) + p,
      y1: Math.max(...line.map(w=>w.bbox.y1)) + p
    }));
  }
  function stampNameRectsFromOcr(words, cropRect, ocrScale, pageHeight){
    const picked = pickStampSignerWords(words);
    if (!picked.length || !cropRect) return [];
    return mergeStampWordLines(picked, 3).map(b => {
      const x1 = (cropRect.x + b.x0) / ocrScale;
      const x2 = (cropRect.x + b.x1) / ocrScale;
      const top = (cropRect.y + b.y0) / ocrScale;
      const bot = (cropRect.y + b.y1) / ocrScale;
      return [x1, pageHeight - bot, x2, pageHeight - top];
    }).filter(r => (r[2]-r[0]) > 2 && (r[3]-r[1]) > 2);
  }
  function inferStampRectsFromItems(items, vp, scale){
    if (!items || !items.length) return [];
    const mapped = mapPageGlyphs(items, scale || 1, vp);
    const re = /podpisuj[íi]c[íi]|podepisuj[íi]c[íi]|podepsal(?:\/a)?|signed\s+by/gi;
    const boxes = [];
    let m;
    while ((m = re.exec(mapped.text))) {
      const after = mapped.text.slice(m.index + m[0].length);
      const skip = after.match(/^\s*[:=]?\s*/);
      const start = m.index + m[0].length + (skip ? skip[0].length : 0);
      const rest = mapped.text.slice(start);
      const stop = rest.search(/\s+(?:Organizace|Organisation|Sériové|Seriov|Vydavatel|Datum|Důvod|Místo)\b/i);
      const end = start + (stop >= 0 ? stop : Math.min(rest.length, 60));
      const glyphs = mapped.map.filter(g => g.end > start && g.start < end && /[\p{L}.]/u.test(g.str||""));
      if (!glyphs.length) continue;
      const joined = glyphs.map(g => g.str).join("");
      if (STAMP_ORG_ONLY_RE.test(joined.replace(/[.,:]/g,"").trim().toLocaleLowerCase("cs"))) continue;
      const minX = Math.min(...glyphs.map(g => g.x));
      const maxX = Math.max(...glyphs.map(g => g.x + g.w));
      const minY = Math.min(...glyphs.map(g => g.y));
      const maxY = Math.max(...glyphs.map(g => g.y + g.h));
      boxes.push({ x: minX - 2, y: minY - 1, w: Math.max(6, maxX - minX + 4), h: Math.max(6, maxY - minY + 2) });
    }
    return boxes;
  }
  function coverStampsOnCanvas(ctx, vp, signatures, canvasBoxes, mode, lang){
    if (!ctx) return;
    const label = (lang === "en") ? "[PERSON]" : "[OSOBA]";
    const paint = (x, y, w, h) => {
      const pad = 2;
      ctx.fillStyle = (mode === "box") ? "#16181d" : "#ffffff";
      ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
      if (mode !== "box") {
        const size = Math.max(7, Math.min(11, h * 0.85));
        ctx.font = "600 "+size+"px sans-serif";
        ctx.fillStyle = "#0c0c0c";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + 2, y + h / 2);
      }
    };
    (signatures || []).forEach(s => {
      const rects = (s.nameRects && s.nameRects.length) ? s.nameRects : [];
      rects.forEach(nr => {
        const r = viewportCoverRect(vp, nr);
        if (r) paint(r.x, r.y, r.w, r.h);
      });
    });
    (canvasBoxes || []).forEach(b => paint(b.x, b.y, b.w, b.h));
  }
  function pdfRenderParams(ctx, vp){
    const opts = { canvasContext: ctx, viewport: vp };
    const pdfjs = (typeof window !== "undefined" && window.pdfjsLib) || (typeof globalThis !== "undefined" && globalThis.pdfjsLib) || null;
    if (pdfjs && pdfjs.AnnotationMode) {
      opts.annotationMode = pdfjs.AnnotationMode.ENABLE;
    }
    return opts;
  }
  function shouldCoverVisibleStamps(){
    return !S.enabled || S.enabled.sigcert !== false;
  }
  let _canFetchLocalCache = null;
export async function canFetchLocalAssets() {
  if (_canFetchLocalCache !== null) return _canFetchLocalCache;
  if (typeof window === "undefined" || !window.fetch) {
    _canFetchLocalCache = false;
    return false;
  }
  if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
    try {
      await fetch("./lib/tesseract.min.js", { method: "HEAD" });
      _canFetchLocalCache = true;
    } catch (_) {
      _canFetchLocalCache = false;
    }
  } else {
    _canFetchLocalCache = true;
  }
  return _canFetchLocalCache;
}

export async function extractPdf(data){
    let pdf;
    try {
      pdf = await getPdfDocument(data);
    } catch (e) {
      if (e && (e.name === "PasswordException" || /password/i.test(e.message || ""))) {
        throw new Error(i().errPdfPassword);
      }
      if (e && (e.name === "InvalidPDFException" || /invalid pdf/i.test(e.message || ""))) {
        throw new Error(i().errPdfInvalid);
      }
      throw e;
    }
    const pages = [];
    let text = "";

    let ocrWorker = null;
    let ocrDisabled = false;
    async function safeOcrRecognize(worker, target, timeoutMs = 25000) {
      let rTimer = null;
      const timeoutPromise = new Promise((_, reject) => {
        rTimer = setTimeout(() => reject(new Error("OCR recognize timeout")), timeoutMs);
      });
      try {
        return await Promise.race([worker.recognize(target), timeoutPromise]);
      } finally {
        if (rTimer) clearTimeout(rTimer);
      }
    }
    async function getOcrWorker(){
      if (ocrWorker) return ocrWorker;
      const tesseractLib = (typeof window !== "undefined" && window.Tesseract) || (typeof globalThis !== "undefined" && globalThis.Tesseract) || null;
      if (ocrDisabled || !S.ocrEnabled || !tesseractLib) return null;
      const canFetch = await canFetchLocalAssets();
      if (!canFetch) {
        console.warn("OCR: local asset fetching is restricted under file:// protocol. Skipping OCR.");
        ocrDisabled = true;
        return null;
      }
      let initTimer = null;
      try {
        showOcrProgress(S.lang === "cs" ? "OCR: inicializuji jazykový model…" : "OCR: loading language model…");
        const timeoutPromise = new Promise((_, reject) => {
          initTimer = setTimeout(() => reject(new Error("OCR init timeout")), 8000);
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
            const cs = S.lang === "cs";
            if (m.status === "loading tesseract core") {
              showOcrProgress(cs ? "OCR: načítám jádro…" : "OCR: loading core…");
            } else if (m.status === "initializing tesseract") {
              showOcrProgress(cs ? "OCR: inicializuji jádro…" : "OCR: initializing core…");
            } else if (m.status === "loading language traineddata") {
              showOcrProgress((cs ? "OCR: stahuji jazykový model" : "OCR: downloading model") +
                " (" + Math.round((m.progress || 0) * 100) + "%)…");
            } else if (m.status === "initializing api") {
              showOcrProgress(cs ? "OCR: inicializuji rozpoznávání…" : "OCR: initializing recognition…");
            } else if (m.status === "recognizing text") {
              showOcrProgress(
                (cs ? "OCR: rozpoznávám text" : "OCR: recognizing text") +
                " (" + Math.round((m.progress || 0) * 100) + "%)…"
              );
            }
          }
        });

        ocrWorker = await Promise.race([createPromise, errPromise, timeoutPromise]);
        showOcrProgress(S.lang === "cs" ? "OCR: připraveno" : "OCR: ready");
        return ocrWorker;
      } catch (e) {
        console.warn("Tesseract OCR init failed:", e);
        ocrWorker = null;
        ocrDisabled = true;
        hideOcrProgress();
        return null;
      } finally {
        if (initTimer) clearTimeout(initTimer);
      }
    }

    try {
      for (let i=1;i<=pdf.numPages;i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const compact = (tc.items||[]).map(it => ({ str: it.str, transform: it.transform, width: it.width }));

        const meaningfulItems = compact.filter(it => it.str && it.str.trim());
        const totalTextLength = meaningfulItems.reduce((acc, it) => acc + it.str.trim().length, 0);
        const isScan = meaningfulItems.length === 0 || (meaningfulItems.length < 3 && totalTextLength < 8);

        let finalItems = compact;
        let body;

        let activeWorker = null;
        if (isScan && S.ocrEnabled) {
          activeWorker = await getOcrWorker();
        }

        if (isScan && activeWorker) {
          const t = S.lang;
          showOcrProgress((t === "cs" ? "OCR: zpracovávám stránku " : "OCR: processing page ") + i + "/" + pdf.numPages + "…");
          try {
            const ocrScale = 2.5;
            const vp = page.getViewport({ scale: ocrScale });
            const canvas = document.createElement("canvas");
            canvas.width = vp.width; canvas.height = vp.height;
            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport: vp }).promise;

            showOcrProgress((t === "cs" ? "OCR: stránka " : "OCR: page ") + i + "/" + pdf.numPages + "…");
            const { data: ocrData } = await safeOcrRecognize(activeWorker, canvas);

            finalItems = (ocrData.words || [])
              .filter(w => w.text && w.text.trim() && (w.confidence || 0) > 25)
              .map(w => ({
                str: w.text,
                _ocr: true,
                _pdfX:    w.bbox.x0 / ocrScale,
                _pdfYTop: w.bbox.y0 / ocrScale,
                _pdfW:    (w.bbox.x1 - w.bbox.x0) / ocrScale,
                _pdfH:    (w.bbox.y1 - w.bbox.y0) / ocrScale,
                transform: null,
                width:    (w.bbox.x1 - w.bbox.x0) / ocrScale
              }));

            body = pageTextFromItems(finalItems);
          } catch (e) {
            console.warn("OCR failed for page " + i + ":", e);
            body = pageTextFromItems(compact);
            finalItems = compact;
          }
        } else {
          body = pageTextFromItems(compact);
        }

        const signatures = await pageSignatureMeta(page);
        let stampText = signatures.map(s => s.text).filter(Boolean).join(" ");

        const hasVisibleSig = (signatures || []).some(sig => {
          const rect = sig && sig.rect;
          return rect && Math.abs(rect[2] - rect[0]) >= 8 && Math.abs(rect[3] - rect[1]) >= 8;
        });

        let sigWorker = null;
        if (hasVisibleSig && !isScan && S.ocrEnabled) {
          sigWorker = await getOcrWorker();
        }

        if (sigWorker && signatures.length && !isScan) {
          try {
            const ocrScale = 2.2;
            const vp = page.getViewport({ scale: ocrScale });
            const canvas = document.createElement("canvas");
            canvas.width = vp.width; canvas.height = vp.height;
            const ctx = canvas.getContext("2d");
            await page.render(pdfRenderParams(ctx, vp)).promise;
            for (const sig of signatures) {
              const r = viewportCoverRect(vp, sig.rect);
              if (!r || r.w < 8 || r.h < 8) continue;
              showOcrProgress((S.lang === "cs" ? "OCR: razítko podpisu, str. " : "OCR: signature stamp, p. ") + i + "…");
              const crop = document.createElement("canvas");
              const cw = Math.min(canvas.width, Math.max(8, Math.ceil(r.w)));
              const ch = Math.min(canvas.height, Math.max(8, Math.ceil(r.h)));
              crop.width = cw; crop.height = ch;
              crop.getContext("2d").drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, cw, ch);
              const { data: ocrData } = await safeOcrRecognize(sigWorker, crop);
              const words = (ocrData.words || []).filter(w => w.text && w.text.trim() && (w.confidence || 0) > 20);
              const line = words.map(w => w.text).join(" ").replace(/\s+/g, " ").trim();
              const pageH = page.getViewport({ scale: 1 }).height;
              sig.nameRects = stampNameRectsFromOcr(words, r, ocrScale, pageH);
              const signer = pickStampSignerWords(words).map(w => w.text).join(" ").trim();
              if (signer) sig.signer = signer;
              if (line) {
                stampText = (stampText ? stampText + " " : "") + line;
                words.forEach(w => {
                  finalItems.push({
                    str: w.text,
                    _ocr: true,
                    _pdfX:    (r.x + w.bbox.x0) / ocrScale,
                    _pdfYTop: (r.y + w.bbox.y0) / ocrScale,
                    _pdfW:    (w.bbox.x1 - w.bbox.x0) / ocrScale,
                    _pdfH:    (w.bbox.y1 - w.bbox.y0) / ocrScale,
                    transform: null,
                    width:    (w.bbox.x1 - w.bbox.x0) / ocrScale
                  });
                });
              }
              if (line && !sig.text) sig.text = line;
            }
          } catch (e) {
            console.warn("OCR of signature stamp failed on page " + i + ":", e);
          }
        }

        if (stampText) body = (body ? body + "\n" : "") + stampText;

        const noTextLayer = isScan && (!activeWorker || !finalItems.some(it => it.str && it.str.trim()));

        const chunkPrefix = "\n\n--- "+i+" ---\n";
        const chunk = chunkPrefix + body;
        const start = text.length + (body ? chunkPrefix.length : chunk.length);
        text += chunk;
        pages.push({ n:i, start, end: start+body.length, body, items: finalItems, noTextLayer, signatures });
      }
    } finally {
      if (ocrWorker) {
        try { await ocrWorker.terminate(); } catch (_) {}
      }
      hideOcrProgress();
    }

    return { text, pages };
  }

export async function exportPdfTrueRedact(source, hits, title, mode, lang){
    const bytes = await exportPdfRaster(source, hits, title, mode, lang);
    return { bytes: assertSecurePdfBytes(bytes), rasterPages: new Set() };
  }

  export async function exportPdfRaster(source, hits, title, mode, lang){
    const pdf = await getPdfDocument(source);
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.create();
    stampPdfMeta(doc, title);
    addSrgbOutputIntent(doc);
    const isBox = mode === "box" || !mode;
    const replacer = (mode && !isBox) ? bindReplacer(mode, lang, hits) : null;
    const textFont = S.truePdfRedact ? await doc.embedFont(PDFLib.StandardFonts.Helvetica) : null;
    for (let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i);
      const scale = 1.7; const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas"); canvas.width=vp.width; canvas.height=vp.height;
      const ctx = canvas.getContext("2d");
      await page.render(pdfRenderParams(ctx, vp)).promise;
      const pageMeta = (S.pages||[]).find(p => p.n===i);
      const rawItems = (pageMeta && pageMeta.items && pageMeta.items.length) ? pageMeta.items : (await page.getTextContent()).items;
      const mapped = mapPageGlyphs(rawItems, scale, vp);
      const text = mapped.text;
      const map = mapped.map;
      const effHits = effectiveHits(hits).filter(h => (h.page || pageOf(h.start)) === i);
      const pageQuads = resolvePageHitQuads(text, map, effHits, pageMeta, scale);
      const redactedIntervals = [];
      pageQuads.forEach(q => {
        if (q.startIdx != null && q.endIdx != null) {
          redactedIntervals.push({ start: q.startIdx, end: q.endIdx });
        }
      });

      if (isBox) {
        const mergedBoxes = mergeAdjacentBoxes(pageQuads, scale);
        mergedBoxes.forEach(b => {
          ctx.fillStyle = "#16181d";
          ctx.fillRect(b.boxX, b.boxY, b.boxW, b.boxH);
        });
      } else {
        pageQuads.forEach(q => {
          const bgCol = sampleCanvasBg(ctx, q.boxX, q.boxY, q.boxW, q.boxH, canvas.width, canvas.height);
          ctx.fillStyle = bgCol;
          ctx.fillRect(q.boxX, q.boxY, q.boxW, q.boxH);

          if (q.qIdx === 0 && replacer) {
            const fullToken = replacer(q.hit);
            const compToken = pdfCompactToken(fullToken);
            let size = Math.max(8, Math.min(q.boxH * 0.65, 14 * scale));
            ctx.font = size + "px " + q.fontFam;
            let tokenW = ctx.measureText(fullToken).width;
            let useToken = fullToken;
            if (tokenW > q.boxW - 4) {
              useToken = compToken;
              tokenW = ctx.measureText(useToken).width;
            }
            while (tokenW > q.boxW - 4 && size > 8) {
              size -= 1;
              ctx.font = size + "px " + q.fontFam;
              tokenW = ctx.measureText(useToken).width;
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(q.boxX, q.boxY, q.boxW, q.boxH);
            ctx.clip();

            let scaleX = 1;
            if (tokenW > q.boxW - 4) {
              scaleX = Math.max(0.75, (q.boxW - 4) / Math.max(1, tokenW));
            }

            ctx.fillStyle = "#0c0c0c";
            ctx.textBaseline = "alphabetic";
            if (scaleX < 1) {
              ctx.scale(scaleX, 1);
              ctx.fillText(useToken, (q.boxX + 2) / scaleX, q.baseLine);
            } else {
              ctx.fillText(useToken, q.boxX + 2, q.baseLine);
            }
            ctx.restore();
          }
        });
      }
      if (shouldCoverVisibleStamps()) {
        const sigs = (pageMeta && pageMeta.signatures) || await pageSignatureMeta(page);
        const inferred = inferStampRectsFromItems(rawItems, vp, scale);
        coverStampsOnCanvas(ctx, vp, sigs, inferred, mode, lang);
      }
      const blob = await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error("blob")), "image/jpeg", 0.84));
      const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const p = doc.addPage([canvas.width / scale, canvas.height / scale]);
      p.drawImage(img, { x:0, y:0, width:p.getWidth(), height:p.getHeight() });

      if (S.truePdfRedact && textFont && map && map.length) {
        let currentRun = [];
        const flushRun = (run) => {
          if (!run.length) return;
          const runStr = run.map(g => g.str).join("");
          const safeText = [...runStr].map(translit).join("");
          if (!safeText.trim()) return;
          const firstG = run[0];
          const pdfX = firstG.x / scale;
          const pdfY = (canvas.height - firstG.y - firstG.h) / scale;
          const fSize = Math.max(4, Math.min(72, (firstG.h / scale) * 0.9));
          try {
            p.drawText(safeText, {
              x: Math.max(0, pdfX),
              y: Math.max(0, pdfY),
              size: fSize,
              font: textFont,
              opacity: 0
            });
          } catch (_) {}
        };

        for (const g of map) {
          const isRedacted = redactedIntervals.some(r => g.start < r.end && g.end > r.start);
          if (isRedacted || !g.str || /\s/.test(g.str)) {
            flushRun(currentRun);
            currentRun = [];
          } else {
            currentRun.push(g);
          }
        }
        flushRun(currentRun);
      }
    }
    const outBytes = await doc.save({ useObjectStreams:false });
    const verifiedBytes = assertSecurePdfBytes(outBytes);
    if (S.truePdfRedact) {
      verifySanitizedPdfText(verifiedBytes, effectiveHits(hits));
    }
    return verifiedBytes;
  }

export function base64ToUint8Array(base64){
    const clean = String(base64 || "").replace(/^data:.*?;base64,/, "").replace(/\s+/g, "");
    if (!clean) return new Uint8Array(0);
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  export const SRGB_ICC_PROFILE_BASE64 = "AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oACgABAAkAEQATYWNzcEFQUEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hhZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAAfQAAAAUclRSQwAAAggAAAAgZ1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPcAADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcAALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAAVHsAAEzNAACZmgAAJmYAAA9c";

  export function stripDiacritic(str){
    return String(str || "").split("").map(translit).join("");
  }

  function pdfResolveObject(doc, obj){
    return obj ? doc.context.lookup(obj) : undefined;
  }

  function pdfFindFontDescriptor(doc, fontDict, seen){
    const { PDFDict, PDFArray, PDFName } = PDFLib;
    if (!(fontDict instanceof PDFDict)) return null;
    seen = seen || new Set();

    const key = fontDict.toString();
    if (seen.has(key)) return null;
    seen.add(key);

    const direct = fontDict.get(PDFName.of("FontDescriptor"));
    if (direct) return pdfResolveObject(doc, direct);

    const descendants = fontDict.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
    if (descendants) {
      for (let i = 0; i < descendants.size(); i++) {
        const d = descendants.lookup(i);
        const found = pdfFindFontDescriptor(doc, d, seen);
        if (found) return found;
      }
    }
    return null;
  }

  function pdfFontIsEmbedded(doc, fontDict){
    const { PDFDict, PDFName } = PDFLib;
    const descriptor = pdfFindFontDescriptor(doc, fontDict);
    if (!(descriptor instanceof PDFDict)) return false;
    return Boolean(
      descriptor.get(PDFName.of("FontFile")) ||
      descriptor.get(PDFName.of("FontFile2")) ||
      descriptor.get(PDFName.of("FontFile3"))
    );
  }

  function inspectPdfFontEmbedding(pdfDoc){
    const { PDFDict, PDFName } = PDFLib;
    const result = [];

    pdfDoc.getPages().forEach((page, pageIndex) => {
      const resources = page.node.Resources();
      if (!resources) return;

      const fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
      if (!fonts) return;

      for (const [name] of fonts.entries()) {
        const font = fonts.lookup(PDFName.of(name));
        result.push({
          page: pageIndex + 1,
          name,
          embedded: pdfFontIsEmbedded(pdfDoc, font)
        });
      }
    });

    return result;
  }



  export function addSrgbOutputIntent(pdfDoc){
    const { PDFName } = PDFLib;
    const iccBytes = base64ToUint8Array(SRGB_ICC_PROFILE_BASE64);
    if (!iccBytes.length) throw new Error("Missing sRGB ICC profile");

    /*
     * ICC profile stream:
     *   /N 3
     *
     * The profile itself remains an ordinary PDF stream and is referenced by
     * /DestOutputProfile from the OutputIntent dictionary.
     */
    const iccStream = pdfDoc.context.stream(iccBytes, { N: 3 });
    const iccRef = pdfDoc.context.register(iccStream);

    const intentDict = pdfDoc.context.obj({
      Type: "OutputIntent",
      S: "GTS_PDFA1",
      OutputConditionIdentifier: "sRGB IEC61966-2.1",
      RegistryName: "http://www.color.org",
      Info: "sRGB IEC61966-2.1",
      DestOutputProfile: iccRef
    });

    const intentRef = pdfDoc.context.register(intentDict);
    pdfDoc.catalog.set(PDFName.of("OutputIntents"), pdfDoc.context.obj([intentRef]));

    return { iccRef, intentRef };
  }


  export async function applyPdfaDeclaration(bytes){
    const { PDFDocument, PDFName } = PDFLib;
    const doc = await PDFDocument.load(bytes, { updateMetadata:false });

    const fontAudit = inspectPdfFontEmbedding(doc);
    const unembeddedPages = [...new Set(fontAudit.filter(f => !f.embedded).map(f => f.page))];

    addSrgbOutputIntent(doc);

    const xmp = '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">' +
      '<pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance>' +
      '<xmp:CreatorTool>Znečitelně</xmp:CreatorTool>' +
      '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';

    const stream = doc.context.stream(xmp, { Type:"Metadata", Subtype:"XML" });
    doc.catalog.set(PDFName.of("Metadata"), doc.context.register(stream));

    const out = await doc.save({ useObjectStreams:false });
    return {
      bytes: out,
      fontAudit,
      unembeddedPages
    };
  }

const CP1250_CHARS = {
  'Á': '\xC1', 'á': '\xE1',
  'Č': '\xC8', 'č': '\xE8',
  'Ď': '\xCF', 'ď': '\xEF',
  'É': '\xC9', 'é': '\xE9',
  'Ě': '\xCC', 'ě': '\xEC',
  'Í': '\xCD', 'í': '\xED',
  'Ň': '\xD2', 'ň': '\xF2',
  'Ó': '\xD3', 'ó': '\xF3',
  'Ř': '\xD8', 'ř': '\xF8',
  'Š': '\x8A', 'š': '\x9A',
  'Ť': '\x8D', 'ť': '\x9D',
  'Ú': '\xDA', 'ú': '\xFA',
  'Ů': '\xD9', 'ů': '\xF9',
  'Ý': '\xFD', 'ý': '\xFD',
  'Ž': '\x8E', 'ž': '\x9E'
};

function toCp1250Latin(str) {
  return [...str].map(c => CP1250_CHARS[c] || c).join("");
}

function toUtf16BeHex(str) {
  return [...str].map(c => c.charCodeAt(0).toString(16).padStart(4, "0")).join("").toUpperCase();
}

function toAsciiHex(str) {
  return [...str].map(c => (c.charCodeAt(0) & 0xff).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function verifySanitizedPdfText(bytes, activeHits){
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
    if (!flate || !activeHits || !activeHits.length) return true;
    try {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let decompressedAll = "";
      const latin = new TextDecoder("latin1").decode(u8);
      const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(u8);
      const streamRe = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let m;
      while ((m = streamRe.exec(latin)) !== null) {
        const startByte = m.index + m[0].indexOf("\n") + 1;
        let endByte = m.index + m[0].lastIndexOf("endstream");
        while (endByte > startByte && (u8[endByte - 1] === 10 || u8[endByte - 1] === 13)) {
          endByte--;
        }
        const slice = u8.subarray(startByte, endByte);
        const dictIndex = latin.lastIndexOf("<<", m.index);
        const dictStr = dictIndex !== -1 ? latin.slice(dictIndex, m.index) : "";
        const isFlate = /\/Filter\s*(?:\/FlateDecode|\[[^\]]*\/FlateDecode)/.test(dictStr);

        let unzipped = null;
        try {
          unzipped = flate.unzlibSync(slice);
        } catch (_) {
          try {
            unzipped = flate.inflateSync(slice);
          } catch (_) {}
        }

        if (unzipped) {
          decompressedAll += " " + new TextDecoder("latin1").decode(unzipped);
          decompressedAll += " " + new TextDecoder("utf-8", { fatal: false }).decode(unzipped);
        } else if (isFlate) {
          throw new Error("PDF security verification failed: decompression of /FlateDecode stream failed (fail-closed)");
        } else {
          decompressedAll += " " + m[1];
        }
      }

      const allText = latin + " " + utf8 + " " + decompressedAll;
      const allTextUpper = allText.toUpperCase();

      for (const h of activeHits) {
        if (!h.value || h.value.length < 3) continue;
        const rawVal = h.value.trim();
        if (rawVal.length < 3) continue;
        const safeVal = [...rawVal].map(translit).join("");
        const cp1250Val = toCp1250Latin(rawVal);
        const utf16beHex = toUtf16BeHex(rawVal);
        const asciiHex = toAsciiHex(safeVal);

        if (
          allText.includes(rawVal) ||
          allText.includes(safeVal) ||
          allText.includes(cp1250Val) ||
          allTextUpper.includes(utf16beHex) ||
          allTextUpper.includes(asciiHex)
        ) {
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
    const forbidden = ["/AcroForm", "/Sig", "/EmbeddedFiles", "/JavaScript", "/JS", "/ObjStm", "/Launch", "/RichMedia"];
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

export async function exportTextPdf(text, title) {
  if (!window.PDFLib) throw new Error("PDFLib is not loaded");
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const doc = await PDFDocument.create();
  stampPdfMeta(doc, title);
  addSrgbOutputIntent(doc);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = 14;
  const maxLinesPerPage = Math.floor((pageHeight - margin * 2 - 30) / lineHeight);

  const rawLines = String(text || "").split(/\r?\n/);
  const wrappedLines = [];
  for (const raw of rawLines) {
    if (!raw.length) {
      wrappedLines.push("");
      continue;
    }
    const safe = stripDiacritic(raw);
    const words = safe.split(" ");
    let current = "";
    for (const w of words) {
      const testLine = current ? current + " " + w : w;
      if (font.widthOfTextAtSize(testLine, fontSize) > contentWidth && current) {
        wrappedLines.push(current);
        current = w;
      } else {
        current = testLine;
      }
    }
    if (current) wrappedLines.push(current);
  }

  let lineIdx = 0;
  const totalPages = Math.max(1, Math.ceil(wrappedLines.length / maxLinesPerPage));
  let pageNum = 1;

  while (lineIdx < wrappedLines.length || pageNum === 1) {
    const page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const safeTitle = stripDiacritic(title || "Document");
    page.drawText(safeTitle.slice(0, 60), { x: margin, y: y - 10, size: 8, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(`${pageNum} / ${totalPages}`, { x: pageWidth - margin - 35, y: y - 10, size: 8, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    y -= 30;

    for (let i = 0; i < maxLinesPerPage && lineIdx < wrappedLines.length; i++, lineIdx++) {
      const l = wrappedLines[lineIdx];
      if (l) {
        page.drawText(l, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      }
      y -= lineHeight;
    }
    pageNum++;
  }

  const outBytes = await doc.save({ useObjectStreams: false });
  return assertSecurePdfBytes(outBytes);
}

export async function exportProtocolPdf(){
  if (!window.PDFLib) {
    const t = (typeof I18N !== "undefined" && typeof S !== "undefined" && I18N[S.lang]) ? I18N[S.lang] : null;
    throw new Error((t && t.recordNeedPdfLib) || "PDFLib is not loaded");
  }
  const appState = typeof S !== "undefined" ? S : { lang: "cs", hits: [] };
  const t = (typeof I18N !== "undefined" && I18N[appState.lang]) ? I18N[appState.lang] : {
    record: {
      title: "Protokol o anonymizaci",
      internal: "INTERNÍ DOKUMENT – CITLIVÝ",
      notice: "Tento protokol je určen pouze pro interní potřebu a audit. Místo původních hodnot obsahuje jen masku (první znak a délku) a solený otisk SHA-256; u údajů s malou entropií (např. rodné číslo) nelze vyloučit zpětné dohledání, proto protokol nezveřejňujte.",
      file: "Dokument",
      operator: "Odpovědný pracovník",
      date: "Vygenerováno",
      profile: "Profil",
      mode: "Režim zpracování",
      rules: "Verze pravidel",
      hashIn: "SHA-256 vstupu",
      hashOut: "SHA-256 výstupu",
      notExported: "— (dokument zatím nebyl exportován)",
      reviewed: "Zkontrolováno",
      fourEyes: "Čtyři oči",
      yes: "ano",
      no: "ne",
      salt: "Sůl otisků",
      saltNote: "Otisk hodnoty = SHA-256(sůl + původní hodnota); zobrazeno prvních 24 znaků.",
      counts: "Anonymizováno / ponecháno",
      sig: "Elektronický podpis v originále",
      cols: ["#","Typ","Str.","Maska","Otisk SHA-256","Zákonný důvod"],
      none: "Žádný údaj není označen k anonymizaci.",
      page: "Strana"
    },
    legalShort: { trade:"§ 504 OZ", gdpr:"čl. 6 GDPR", security:"Bezpečnost", custom:"Vlastní" }
  };
  const rec = t.record;
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const doc = await PDFDocument.create();
  stampPdfMeta(doc, (appState.fileName || "document") + " — protokol");
  addSrgbOutputIntent(doc);

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const saltBytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < 8; i++) saltBytes[i] = Math.floor(Math.random() * 256);
  }
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const redactedHits = (appState.hits || []).filter(h => h.accept);
  const rows = [];
  for (let idx = 0; idx < redactedHits.length; idx++) {
    const h = redactedHits[idx];
    const val = String(h.value || "");
    const mask = val.length > 0 ? `${val[0]}${"*".repeat(Math.max(0, Math.min(val.length - 1, 14)))} (${val.length})` : "";
    let digest = "";
    try {
      const subtle = globalThis.crypto?.subtle;
      if (subtle) {
        const raw = await subtle.digest("SHA-256", new TextEncoder().encode(salt + val));
        digest = Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
      }
    } catch (_) {}
    if (!digest) {
      let hVal = 0x811c9dc5;
      for (let i = 0; i < (salt + val).length; i++) {
        hVal ^= (salt + val).charCodeAt(i);
        hVal = Math.imul(hVal, 0x01000193);
      }
      digest = Math.abs(hVal).toString(16).padStart(8, "0").repeat(3).slice(0, 24);
    }
    const cat = (t.cats && t.cats[h.type]) || h.type;
    const legKey = (typeof legalOf === "function" ? legalOf(h) : (h.legalBasis || "gdpr"));
    const legLabel = (legKey === "custom" && h.legalCustom)
      ? h.legalCustom
      : ((t.legalShort && t.legalShort[legKey]) || legKey);

    rows.push({
      num: String(idx + 1),
      type: stripDiacritic(cat),
      page: String(h.page || (typeof pageOf === "function" ? pageOf(h.start) : 1)),
      mask: stripDiacritic(mask),
      digest,
      legal: stripDiacritic(legLabel)
    });
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageNum = 1;

  function checkNewPage(neededHeight) {
    if (y - neededHeight < margin + 25) {
      page.drawText(`${stripDiacritic(rec.page || "Page")} ${pageNum}`, {
        x: pageWidth - margin - 50,
        y: margin - 15,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      });
      page = doc.addPage([pageWidth, pageHeight]);
      pageNum++;
      y = pageHeight - margin;
      drawPageHeader();
    }
  }

  function drawPageHeader() {
    page.drawText(stripDiacritic(rec.title), {
      x: margin,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4)
    });
    page.drawText(stripDiacritic(rec.internal), {
      x: pageWidth - margin - fontBold.widthOfTextAtSize(stripDiacritic(rec.internal), 9),
      y: y - 10,
      size: 9,
      font: fontBold,
      color: rgb(0.8, 0.2, 0.2)
    });
    y -= 25;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
    y -= 15;
  }

  // First page banner
  page.drawRectangle({
    x: margin,
    y: y - 30,
    width: contentWidth,
    height: 30,
    color: rgb(0.96, 0.92, 0.92)
  });
  page.drawText(stripDiacritic(rec.internal), {
    x: margin + 10,
    y: y - 20,
    size: 11,
    font: fontBold,
    color: rgb(0.75, 0.15, 0.15)
  });
  y -= 40;

  // Title
  page.drawText(stripDiacritic(rec.title), {
    x: margin,
    y: y - 16,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 30;

  // Notice box
  const words = stripDiacritic(rec.notice).split(/\s+/);
  const noticeLines = [];
  let curL = "";
  for (const w of words) {
    const test = curL ? curL + " " + w : w;
    if (fontRegular.widthOfTextAtSize(test, 8.5) > contentWidth - 20 && curL) {
      noticeLines.push(curL);
      curL = w;
    } else {
      curL = test;
    }
  }
  if (curL) noticeLines.push(curL);

  const noticeBoxH = noticeLines.length * 11 + 14;
  page.drawRectangle({
    x: margin,
    y: y - noticeBoxH,
    width: contentWidth,
    height: noticeBoxH,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: rgb(0.85, 0.85, 0.88),
    borderWidth: 0.5
  });
  let ny = y - 12;
  for (const nl of noticeLines) {
    page.drawText(nl, { x: margin + 10, y: ny, size: 8.5, font: fontRegular, color: rgb(0.35, 0.35, 0.35) });
    ny -= 11;
  }
  y -= (noticeBoxH + 15);

  const rulesVer = (typeof RULES !== "undefined" ? RULES : "2026.10.15-ai42");
  const metaPairs = [
    [rec.file, appState.fileName || "document"],
    [rec.operator, appState.operator || "—"],
    [rec.date, new Date().toISOString().slice(0, 19).replace("T", " ")],
    [rec.profile, appState.profile || "default"],
    [rec.mode, appState.mode || "pseudo"],
    [rec.rules, "v" + rulesVer],
    [rec.hashIn, appState.hashIn || "—"],
    [rec.hashOut, appState.hashOut || stripDiacritic(rec.notExported)],
    [rec.reviewed, appState.reviewed ? stripDiacritic(rec.yes) : stripDiacritic(rec.no)],
    [rec.fourEyes, appState.secondEyes ? stripDiacritic(rec.yes) : stripDiacritic(rec.no)],
    [rec.counts, `${redactedHits.length} / ${(appState.hits || []).length - redactedHits.length}`],
    [rec.salt, salt + " (" + stripDiacritic(rec.saltNote) + ")"]
  ];

  for (const [k, v] of metaPairs) {
    checkNewPage(14);
    page.drawText(stripDiacritic(k) + ":", { x: margin, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    const valStr = stripDiacritic(String(v));
    const isHash = valStr.length > 30 && /^[a-f0-9]+$/i.test(valStr);
    page.drawText(valStr.slice(0, 75), {
      x: margin + 140,
      y,
      size: 8.5,
      font: isHash ? fontMono : fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    });
    y -= 13;
  }

  y -= 15;
  checkNewPage(35);

  const cols = [
    { title: rec.cols[0], w: 25, x: margin },
    { title: rec.cols[1], w: 85, x: margin + 25 },
    { title: rec.cols[2], w: 35, x: margin + 110 },
    { title: rec.cols[3], w: 105, x: margin + 145 },
    { title: rec.cols[4], w: 120, x: margin + 250 },
    { title: rec.cols[5], w: 100, x: margin + 370 }
  ];

  page.drawRectangle({
    x: margin,
    y: y - 16,
    width: contentWidth,
    height: 18,
    color: rgb(0.92, 0.94, 0.96)
  });
  for (const c of cols) {
    page.drawText(stripDiacritic(c.title), {
      x: c.x + 3,
      y: y - 12,
      size: 8,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2)
    });
  }
  y -= 20;

  if (!rows.length) {
    checkNewPage(20);
    page.drawText(stripDiacritic(rec.none), {
      x: margin + 5,
      y,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    });
    y -= 15;
  } else {
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      checkNewPage(14);
      const row = rows[rIdx];
      if (rIdx % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: y - 10,
          width: contentWidth,
          height: 13,
          color: rgb(0.98, 0.98, 0.99)
        });
      }
      page.drawText(row.num, { x: cols[0].x + 3, y, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(row.type.slice(0, 16), { x: cols[1].x + 3, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(row.page, { x: cols[2].x + 3, y, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(row.mask.slice(0, 18), { x: cols[3].x + 3, y, size: 8, font: fontMono, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(row.digest.slice(0, 24), { x: cols[4].x + 3, y, size: 7.5, font: fontMono, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(row.legal.slice(0, 18), { x: cols[5].x + 3, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      y -= 13;
    }
  }

  page.drawText(`${stripDiacritic(rec.page || "Page")} ${pageNum}`, {
    x: pageWidth - margin - 50,
    y: margin - 15,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5)
  });

  const outBytes = await doc.save({ useObjectStreams: false });
  return assertSecurePdfBytes(outBytes);
}
