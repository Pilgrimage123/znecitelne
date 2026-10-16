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

  export function paintPdfVisualOverlays(){
    if (!PV) return;
    const previewOn = S.docView === "preview";
    const isBox = S.mode === "box" || !S.mode;
    const replacer = (previewOn && !isBox) ? bindReplacer(S.mode, S.lang, S.hits) : null;
    PV.pages.forEach(pg => {
      pg.layer.innerHTML = "";
      visibleHits(S.hits, S.selectedId).forEach(h => {
        const meta = (S.pages || []).find(p => p.n === pg.n);
        if (!meta || h.start < meta.start || h.start >= meta.end + 1) return;
        const rel = h.start - meta.start;
        let idx = pg.text.slice(rel, rel + h.value.length) === h.value ? rel : pg.text.indexOf(h.value);
        if (idx < 0) return;
        const end = idx + Math.max(h.value.length, 1);
        const glyphs = pg.map.filter(m => m.end > idx && m.start < end);
        if (!glyphs.length) return;
        const quads = pdfWordQuads(glyphs);
        quads.forEach((r, qIdx) => {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.id = h.id;
          const lineGlyphs = (r.glyphs && r.glyphs.length) ? r.glyphs : pg.map.filter(m => m.end > idx && m.start < end && Math.abs(m.y - r.y) < Math.max(m.h, r.h) * 0.6);
          const hasBaseline = lineGlyphs.some(g => g && g.baselineY);
          let boxX = r.x, boxY = r.y, boxW = r.w, boxH = r.h;
          if (previewOn) {
            if (hasBaseline) {
              const bGlyphs = lineGlyphs.filter(g => g && g.baselineY);
              const baseLine = bGlyphs[0].baselineY;
              const fH = Math.max(...bGlyphs.map(g => g.fontH || g.h));
              const minX = Math.min(...lineGlyphs.map(g => g.x));
              const maxX = Math.max(...lineGlyphs.map(g => g.x + g.w));
              boxX = Math.max(0, minX - 2);
              boxW = Math.max(maxX + 3 - boxX, 6);
              boxY = Math.max(0, baseLine - fH * 1.02);
              boxH = Math.max((baseLine + fH * 0.28) - boxY, 8);
            } else {
              const padY = Math.max(2, Math.round((r.rawH || r.h) * 0.16));
              boxX = Math.max(0, (r.rawMinX != null ? r.rawMinX : r.x) - 2);
              const maxX = (r.rawMaxX != null ? r.rawMaxX : (r.x + r.w)) + 3;
              boxW = Math.max(maxX - boxX, 6);
              boxY = Math.max(0, (r.rawMinY != null ? r.rawMinY : r.y) - padY);
              const maxY = (r.rawMaxY != null ? r.rawMaxY : (r.y + r.h)) + padY;
              boxH = Math.max(maxY - boxY, 8);
            }
          }
          b.style.left = boxX + "px";
          b.style.top = boxY + "px";
          b.style.height = boxH + "px";
          b.onclick = () => select(h.id);

          if (!h.accept) {
            b.className = "pv-box pv-off" + (S.selectedId === h.id ? " pv-sel" : "");
            b.style.width = r.w + "px";
            b.setAttribute("aria-label", i().cats[h.type] || h.type);
          } else if (!previewOn) {
            b.className = "pv-box pv-on" + (S.selectedId === h.id ? " pv-sel" : "");
            b.style.width = r.w + "px";
            b.setAttribute("aria-label", i().cats[h.type] || h.type);
          } else if (isBox) {
            b.className = "pv-box pv-prev pv-prev-box" + (S.selectedId === h.id ? " pv-sel" : "");
            b.style.width = boxW + "px";
            b.setAttribute("aria-label", (i().cats[h.type] || h.type) + " (" + (i().redact || "anonymizováno") + ")");
          } else {
            const token = replacer ? replacer(h) : "";
            b.className = "pv-box pv-prev pv-prev-token" + (S.selectedId === h.id ? " pv-sel" : "");
            b.style.minWidth = boxW + "px";
            b.style.width = "auto";
            const wrapW = pg.wrap ? (pg.wrap.clientWidth || parseFloat(pg.wrap.style.width) || 0) : 0;
            const maxW = Math.max(boxW, (wrapW > boxX ? wrapW - boxX - 2 : 500));
            b.style.maxWidth = maxW + "px";
            const fontSize = Math.max(8, Math.min(13, Math.round(boxH * 0.65)));
            b.style.fontSize = fontSize + "px";
            if (qIdx === 0) {
              b.textContent = token;
            } else {
              b.textContent = "";
            }
            b.setAttribute("aria-label", token + " · " + (i().cats[h.type] || h.type));
            b.title = token;
          }
          pg.layer.appendChild(b);
        });
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
    if (!window.pdfjsLib) throw new Error("PDF: knihovna se nenačetla.");
    if (window.__pdfWorkerReady) return window.__pdfWorkerReady;
    window.__pdfWorkerReady = (async () => {
      const local = "./lib/pdf.worker.min.js";
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = local;
      } catch (_) {}
      return "local";
    })();
    return window.__pdfWorkerReady;
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
    if (window.pdfjsLib && pdfjsLib.AnnotationMode) {
      opts.annotationMode = pdfjsLib.AnnotationMode.ENABLE;
    }
    return opts;
  }
  function shouldCoverVisibleStamps(){
    return !S.enabled || S.enabled.sigcert !== false;
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
    async function getOcrWorker(){
      if (ocrWorker) return ocrWorker;
      if (!S.ocrEnabled || !window.Tesseract) return null;
      try {
        showOcrProgress(S.lang === "cs" ? "OCR: inicializuji jazykový model…" : "OCR: loading language model…");
        ocrWorker = await Tesseract.createWorker("ces", 1, {
          ...((window.__libLocal && window.__libLocal.tesseract) ? { workerPath:"./lib/tesseract/worker.min.js", corePath:"./lib/tesseract/core/", langPath:"./lib/tesseract/lang/" } : {}),
          logger: m => {
            if (m.status === "loading language traineddata") {
              showOcrProgress((S.lang === "cs" ? "OCR: stahuji jazykový model" : "OCR: downloading model") +
                " (" + Math.round((m.progress || 0) * 100) + "%)…");
            } else if (m.status === "recognizing text") {
              showOcrProgress(
                (S.lang === "cs" ? "OCR: rozpoznávám text" : "OCR: recognizing text") +
                " (" + Math.round((m.progress || 0) * 100) + "%)…"
              );
            }
          }
        });
        showOcrProgress(S.lang === "cs" ? "OCR: připraveno" : "OCR: ready");
        return ocrWorker;
      } catch (e) {
        console.warn("Tesseract OCR init failed:", e);
        ocrWorker = null;
        hideOcrProgress();
        return null;
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
            const { data: ocrData } = await activeWorker.recognize(canvas);

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

        let sigWorker = null;
        if (signatures.length && !isScan && S.ocrEnabled) {
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
              const { data: ocrData } = await sigWorker.recognize(crop);
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
        hideOcrProgress();
      }
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
      const redactedIntervals = [];
      effectiveHits(hits).filter(h => (h.page || pageOf(h.start)) === i).forEach(hit => {
        let idx = -1;
        if (pageMeta && hit.start >= pageMeta.start && hit.end <= pageMeta.end) {
          idx = hit.start - pageMeta.start;
          const slice = text.slice(idx, idx+hit.value.length);
          if (slice !== hit.value) {
            const local = text.indexOf(hit.value);
            idx = local;
          }
        }
        if (idx < 0) idx = text.indexOf(hit.value);
        if (idx < 0) {
          const compact = hit.value.replace(/\s+/g," ").trim();
          idx = text.indexOf(compact);
        }
        if (idx < 0) return;
        redactedIntervals.push({ start: idx, end: idx + Math.max(hit.value.length, 1) });
        const end = idx + Math.max(hit.value.length, 1);
        const glyphs = map.filter(m => m.end>idx && m.start<end);
        if (!glyphs.length) return;
        const quads = pdfWordQuads(glyphs);
        quads.forEach(r => {
          let boxX, boxY, boxW, boxH;
          const lineGlyphs = (r.glyphs && r.glyphs.length) ? r.glyphs : glyphs.filter(g => Math.abs(g.y - r.y) < Math.max(g.h, r.h) * 0.6);
          const hasBaseline = lineGlyphs.some(g => g && g.baselineY);
          const padXLeft = Math.max(2, Math.round(scale * 1.2));
          const padXRight = Math.max(3, Math.round(scale * 1.8));
          if (hasBaseline) {
            const bGlyphs = lineGlyphs.filter(g => g && g.baselineY);
            const baseLine = bGlyphs[0].baselineY;
            const fH = Math.max(...bGlyphs.map(g => g.fontH || g.h));
            const minX = Math.min(...lineGlyphs.map(g => g.x));
            const maxX = Math.max(...lineGlyphs.map(g => g.x + g.w));
            boxX = minX - padXLeft;
            boxW = Math.max(maxX + padXRight - boxX, 6);
            boxY = baseLine - fH * 1.04;
            const bottomY = baseLine + fH * 0.30;
            boxH = Math.max(bottomY - boxY, 8);
          } else {
            const padY = Math.max(2.5, Math.round((r.rawH || r.h) * 0.18));
            boxX = (r.rawMinX != null ? r.rawMinX : r.x) - padXLeft;
            const maxX = (r.rawMaxX != null ? r.rawMaxX : (r.x + r.w)) + padXRight;
            boxW = Math.max(maxX - boxX, 6);
            boxY = (r.rawMinY != null ? r.rawMinY : r.y) - padY;
            const maxY = (r.rawMaxY != null ? r.rawMaxY : (r.y + r.h)) + padY;
            boxH = Math.max(maxY - boxY, 8);
          }

          if (isBox) {
            ctx.fillStyle = "#16181d";
            ctx.fillRect(boxX, boxY, boxW, boxH);
            return;
          }
          const token = replacer(hit);
          let size = Math.max(8, Math.min(boxH * 0.65, 14 * scale));
          ctx.font = size+"px sans-serif";
          let tokenW = ctx.measureText(token).width;
          while (tokenW > boxW*3 && size > 8) { size -= 1; ctx.font = size+"px sans-serif"; tokenW = ctx.measureText(token).width; }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(boxX, boxY, Math.max(boxW, tokenW+6), boxH);
          ctx.fillStyle = "#0c0c0c";
          ctx.textBaseline = "middle";
          ctx.fillText(token, boxX + 3, boxY + boxH / 2);
        });
      });
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

function base64ToUint8Array(base64){
    const clean = String(base64 || "").replace(/^data:.*?;base64,/, "").replace(/\s+/g, "");
    if (!clean) return new Uint8Array(0);
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
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
