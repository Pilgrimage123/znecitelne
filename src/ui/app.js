import { KEYS, PII_KEYS, ORG_KEYS, RULES, CHANGELOG, LABEL, STATUS_GENERIC, PUBLIC, SAMPLE } from "../core/rules.js";
import { I18N, formatPlural } from "../core/i18n.js";
import { isOnomasticName, initOnomasticRegistry, createOnomasticTrie } from "../core/onomastic.js";
import { isCzechVerbOrParticiple, isSentenceStart, declinedPersonTokenBase } from "../core/morphology.js";
import { EntityPropagationCache, createEntityPropagationCache, expandCzechNameMorphology } from "../core/propagation.js";
import { detect, apply, applyCourtProfileRules, filterCourtDecisionsWhitelist, effectiveHits, resolveHits, visibleHits, topHits, bindReplacer, buildGlossary, pageOf } from "../core/detector.js";
import { exportSession, importSession } from "../crypto/session.js";
import { extractPdf, exportPdfTrueRedact, exportPdfRaster, applyPdfaDeclaration, pdfWorker, getPdfDocument, exportTextPdf, exportProtocolPdf, base64ToUint8Array, SRGB_ICC_PROFILE_BASE64, canFetchLocalAssets } from "../formats/pdf.js";
import { exportDocxFile, docxMakeWork, docxNormalizeZipPath, docxRelativeZipPath } from "../formats/docx.js";
import { exportXlsxFile, exportXlsxFileFflate } from "../formats/xlsx.js";
import { ingestDocument, ingestDocumentBatch, buildCanonicalDocument, applyDocumentToState, DocumentIngestionError, IngestErrorCode, localizeIngestError, sha256 } from "../formats/ingest.js";
import { startMovieTutorial, exitMovieTutorial, MOVIE_SPEED, MOVIE_SLOWDOWN, movieEffectiveSpeed, initActionMarquees, startTextMarquee } from "./movie.js";


export const S = {
    lang: localStorage.getItem("znec-lang") === "en" ? "en" : "cs",
    theme: (localStorage.getItem("znec-theme") === "dark" || localStorage.getItem("znec-theme") === "light")
      ? localStorage.getItem("znec-theme")
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    profile: "publicai", mode: "pseudo",
    suspicion: localStorage.getItem("znec-suspicion") || "medium",
    enabled: Object.fromEntries(KEYS.map(k => [k, true])),
    secrets: "jednotkové ceny",
    systems: "AIS SBS | SYSTÉM\neSpis | INTEGRACE\nSAMO2 | MODUL",
    projects: "CBUAIS | PROJEKT\nORION | PROJEKT",
    orgs: "OBÚ | ORGÁN",
    stripMeta: true, pdfaDecl: localStorage.getItem("znec-pdfa") === "1", includeOutline: true, publicGlossary: true, truePdfRedact: true,
    expertMode: localStorage.getItem("znec-expert") === "1",
    processAnalysis: localStorage.getItem("znec-process") === "1",
    quickMode: (localStorage.getItem("znec-quick") === "1" || localStorage.getItem("znec-quick") === "0")
      ? localStorage.getItem("znec-quick") === "1"
      : (window.matchMedia ? window.matchMedia("(max-width: 720px)").matches : false),
    barPos: (["top","bottom"].includes(localStorage.getItem("znec-barpos")) ? localStorage.getItem("znec-barpos") : "top"),
    fastApprove: localStorage.getItem("znec-fastapprove") === "1",
    ocrEnabled: localStorage.getItem("znec-ocr") !== "0",
    ocrSupported: null,
    operator: "", sigDetected: false, fileName: "", kind: "text", text: "", sourceBuf: null,
    pages: [], noTextPages: 0, cellMap: [], activeSheet: null,
    hashIn: "", hashOut: "", hits: [], reviewed: false, secondEyes: false,
    isSecondReviewMode: false, firstOperator: "",
    selectedId: null, filter: "all", seen: new Set(),
    analysisContext: "",
    docView: localStorage.getItem("znec-docview") === "preview" ? "preview" : "original",
    pdfVisual: false,
    viewMode: localStorage.getItem("znec-viewmode") || "entities",
    expandedEntities: new Set(),
    movie: false, movieStepIndex: 0
  };
  const i = () => I18N[S.lang];
  const $ = (id) => document.getElementById(id);
  function applyTheme(){
    const dark = S.theme === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0d1218" : "#1f3348");
    const btn = $("btnTheme");
    if (btn) {
      const t = i();
      const lblTheme = $("lblThemeText");
      if (lblTheme) {
        lblTheme.textContent = dark ? (S.lang === "cs" ? "Světlý režim" : "Light mode") : (S.lang === "cs" ? "Tmavý režim" : "Dark mode");
      } else {
        btn.textContent = dark ? "☀" : "☾";
      }
      const themeIcon = btn.querySelector(".dropdown-item-icon");
      if (themeIcon) {
        themeIcon.innerHTML = dark
          ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
          : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      }
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.setAttribute("aria-label", dark ? t.themeLight : t.themeDark);
      btn.setAttribute("data-tip", t.tips.theme);
    }
  }
  function toggleTheme(){
    S.theme = S.theme === "dark" ? "light" : "dark";
    localStorage.setItem("znec-theme", S.theme);
    applyTheme();
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  async function toggleFullscreen() {
    try {
      if (!isFullscreen()) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
      const t = i();
      toast(t.fullscreenNotAllowed || (S.lang === "cs" ? "Režim celé obrazovky není v tomto okně povolen." : "Fullscreen mode is not permitted in this window."));
    }
  }

  function updateFullscreenUI() {
    const fs = isFullscreen();
    document.body.classList.toggle("is-fullscreen", fs);
    const t = i();
    const enterTip = t.fullscreenTip || (S.lang === "cs" ? "Celá obrazovka (F)" : "Fullscreen (F)");
    const exitTip = t.fullscreenExitTip || (S.lang === "cs" ? "Ukončit celou obrazovku (F)" : "Exit fullscreen (F)");
    const tipText = fs ? exitTip : enterTip;

    const btn = $("btnFullscreen");
    if (btn) {
      btn.title = tipText;
      btn.setAttribute("aria-label", tipText);
      btn.setAttribute("data-tip", tipText);
      btn.setAttribute("aria-pressed", fs ? "true" : "false");
      btn.innerHTML = fs
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    }

    const lblMenu = $("lblFullscreenMenuText");
    if (lblMenu) {
      lblMenu.textContent = fs ? (t.fullscreenExit || (S.lang === "cs" ? "Ukončit celou obrazovku" : "Exit fullscreen")) : (t.fullscreen || (S.lang === "cs" ? "Celá obrazovka" : "Fullscreen"));
    }

    const menuIcon = $("btnMenuFullscreen")?.querySelector(".dropdown-item-icon");
    if (menuIcon) {
      menuIcon.innerHTML = fs
        ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
        : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
    }
  }

function leakScan(text){
    const checks = [
      { id:"ticket", re:/\b[A-Z][A-Z0-9]{1,9}-\d{2,7}\b/g },
      { id:"email", re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
      { id:"iban", re:/\bCZ\d{2}(?:\s?\d{4}){5}\b/gi },
      { id:"rc", re:/\b\d{2}(?:0[1-9]|1[0-2]|5[1-9]|6[0-2])(?:0[1-9]|[12]\d|3[01])\s*\/\s*\d{3,4}\b/g },
      { id:"casefile", re:/\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,8}\s+\d{3,6}\/\d{4}\b/g },
      { id:"incident", re:/\b(?:HD|INC)\s*[-:]?\s*\d{3,7}\b/gi },
      { id:"ip", re:/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g },
      { id:"credential", re:/\b(?:sk-live-|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._\-]{12,})/g },
      { id:"host", re:/\bhttps?:\/\/[^\s]+(?:\.internal|\.local|\.corp|\.intranet)/gi }
    ];
    const found = [];
    checks.forEach(c => {
      const m = text.match(c.re);
      if (m && m.length) found.push({ id:c.id, n:m.length, sample:m[0] });
    });
    parseDict(S.systems+"\n"+S.projects+"\n"+S.orgs).forEach(d => {
      if (d.name.length>=3 && text.toLocaleLowerCase("cs").includes(d.name.toLocaleLowerCase("cs"))) {
        found.push({ id:"dict", n:1, sample:d.name });
      }
    });
    return found;
  }
  function analyzeProcess(orig, replaced, hits){
    const packMode = S.mode==="box"?"pseudo":S.mode;
    const replacer = bindReplacer(packMode, S.lang, hits);
    const rawLines = orig.split(/\n/);
    const numbered = [];
    const prose = [];
    let cursor = 0;
    rawLines.forEach((raw) => {
      const ln = raw.trim();
      const start = ln ? cursor + raw.indexOf(ln) : cursor;
      cursor += raw.length + 1;
      if (!ln) return;
      const localHits = hits.filter(h => h.accept && h.start >= start && h.start < start+ln.length);
      const item = { text: generalizeLine(ln, localHits, start, replacer), rawLen: ln.length };
      if (/^(?:\d+[\.)]\s+|[-*•]\s+|(?:krok|step)\s+\d+)/i.test(ln)) numbered.push(item);
      else if (/(?:nejprve|poté|následně|pak se|analyti|vývoj|nasad|schvál|ověř|předá)/i.test(ln) && ln.length<220) prose.push(item);
    });
    const steps = (numbered.length ? numbered : prose).map((s, i) => ({ ...s, n: i+1 }));
    const byType = {};
    hits.filter(h=>h.accept).forEach(h => {
      (byType[h.type] = byType[h.type]||new Set()).add(replacer(h));
    });
    const ticketTokens = [...(byType.ticket||[])];
    const links = [];
    if (ticketTokens.length>1) links.push(ticketTokens.join(" → "));
    const actors = [];
    ["analytik","vývoj","tester","provoz","objednatel","zhotovitel","schvalovatel","manažer","analyst","developer","tester","operator"].forEach(role => {
      if (orig.toLocaleLowerCase("cs").includes(role)) actors.push(role);
    });
    const leaks = leakScan(replaced);
    const orgKept = hits.some(h => !h.accept && ORG_KEYS.includes(h.type));
    const orgAccepted = hits.filter(h => h.accept && ORG_KEYS.includes(h.type)).length;
    const verdict = leaks.length || S.profile==="internal" || (S.profile==="publicai" && orgKept)
      ? "internal"
      : (S.profile==="publicai" || S.profile==="registr" || S.profile==="infoact" || S.profile==="court")
        ? "public"
        : "internal";
    return { steps: steps.slice(0,24), actors, systems: [...(byType.system||[]), ...(byType.project||[]), ...(byType.orgunit||[])], tickets: ticketTokens, links, leaks, verdict, orgAccepted };
  }
  function generalizeLine(line, hits, lineStart, replacer){
    replacer = replacer || bindReplacer(S.mode==="box"?"pseudo":S.mode, S.lang, hits);
    const base = lineStart || 0;
    let out = line;
    effectiveHits(hits).reverse().forEach(h => {
      const s = h.start - base, e = h.end - base;
      if (s>=0 && e<=out.length && out.slice(s,e)===h.value) out = out.slice(0,s)+replacer(h)+out.slice(e);
      else if (out.includes(h.value)) out = out.replace(h.value, replacer(h));
    });
    return out;
  }
  function processHTML(info){
    const t = i();
    if (!S.text) return "";
    const leakCls = info.leaks.length ? "leak-bad" : "leak-ok";
    const verd = info.verdict==="public" && !info.leaks.length ? t.readyPublic : t.readyInternal;
    const steps = info.steps.length
      ? "<ol>"+info.steps.map(s=>"<li>"+esc(s.text)+"</li>").join("")+"</ol>"
      : "<p class='layer-note'>"+esc(t.processEmpty)+"</p>";
    const list = (arr) => arr.length ? "<ul>"+arr.map(x=>"<li class='token'>"+esc(x)+"</li>").join("")+"</ul>" : "<p class='layer-note'>—</p>";
    const leaks = info.leaks.length
      ? "<ul>"+info.leaks.map(l=>"<li class='token'>"+esc(l.id)+" × "+l.n+" · "+esc(l.sample)+"</li>").join("")+"</ul>"
      : "<p class='"+leakCls+"'>"+esc(t.leakOk)+"</p>";
    return `<p class="proc-summary"><strong>${esc(t.verdict)}:</strong> ${esc(verd)}</p>
      <h3>${esc(t.processRisks)}</h3>${info.leaks.length?"<p class='leak-bad'>"+esc(t.leakBad)+"</p>":""}${leaks}
      <details class="proc-details"><summary>${esc(t.processToggle)}</summary>
      <p class="layer-note" style="margin-top:0">${esc(t.processHint)}</p>
      <h3>${esc(t.processSteps)}</h3>${steps}
      <h3>${esc(t.processActors)}</h3>${list(info.actors)}
      <h3>${esc(t.processSystems)}</h3>${list(info.systems)}
      <h3>${esc(t.processTickets)}</h3>${list(info.links.length?info.links:info.tickets)}
      </details>`;
  }
  function processMarkdown(info){
    const t = i();
    const lines = ["# "+t.processTitle, "", "**"+t.verdict+":** "+(info.verdict==="public"&&!info.leaks.length?t.readyPublic:t.readyInternal), ""];
    lines.push("## "+t.processSteps);
    if (!info.steps.length) lines.push(t.processEmpty);
    else info.steps.forEach(s => lines.push(s.n+". "+s.text));
    lines.push("", "## "+t.processActors);
    (info.actors.length?info.actors:["—"]).forEach(a => lines.push("- "+a));
    lines.push("", "## "+t.processSystems);
    (info.systems.length?info.systems:["—"]).forEach(a => lines.push("- "+a));
    lines.push("", "## "+t.processTickets);
    (info.tickets.length?info.tickets:["—"]).forEach(a => lines.push("- "+a));
    lines.push("", "## "+t.processRisks);
    if (!info.leaks.length) lines.push(t.leakOk);
    else {
      lines.push(t.leakBad);
      info.leaks.forEach(l => lines.push("- "+l.id+" × "+l.n+" · "+l.sample));
    }
    lines.push("", "_Generated locally by Znečitelně "+RULES+". No original identifiers in this outline._");
    return lines.join("\n");
  }

function download(name, blob){
    if (S._batchFiles && typeof S._batchFiles === "object") {
      let finalName = name;
      let counter = 1;
      while (S._batchFiles[finalName]) {
        finalName = name.replace(/(\.[^.]+$)/, `_${counter}$1`);
        counter++;
      }
      S._batchFiles[finalName] = blob;
      return;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  let _toastTimer = null;
  function toast(msg){
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
    if (_ocrProgressTimer) { clearTimeout(_ocrProgressTimer); _ocrProgressTimer = null; }
    const t = $("toast");
    if (!t) return;
    t.textContent = String(msg || "");
    t.style.display = "block";
    _toastTimer = setTimeout(() => { if (t) t.style.display = "none"; _toastTimer = null; }, 2400);
  }
  let _ocrProgressTimer = null;
  let _ocrSafetyTimer = null;
  function showOcrProgress(msg) {
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
    if (_ocrProgressTimer) { clearTimeout(_ocrProgressTimer); _ocrProgressTimer = null; }
    if (_ocrSafetyTimer) { clearTimeout(_ocrSafetyTimer); _ocrSafetyTimer = null; }
    const t = $("toast");
    if (!t) return;
    t.textContent = String(msg || "");
    t.style.display = "block";
    _ocrSafetyTimer = setTimeout(() => {
      if (t && t.textContent === String(msg || "")) t.style.display = "none";
      _ocrSafetyTimer = null;
    }, 20000);
  }
  function hideOcrProgress() {
    if (_ocrSafetyTimer) { clearTimeout(_ocrSafetyTimer); _ocrSafetyTimer = null; }
    _ocrProgressTimer = setTimeout(() => {
      const t = $("toast");
      if (t) t.style.display = "none";
      _ocrProgressTimer = null;
    }, 800);
  }
  export function showConfirm(message, okLabel, cancelLabel) {
    const modal = $("confirmModal");
    if (!modal) {
      try {
        return Promise.resolve(window.confirm(message));
      } catch (_) {
        return Promise.resolve(true);
      }
    }
    return new Promise((resolve) => {
      const msgEl = $("confirmMessage");
      const btnOk = $("btnConfirmOk");
      const btnCancel = $("btnConfirmCancel");
      const t = i();
      if (msgEl) msgEl.textContent = message;
      if (btnOk) btnOk.textContent = okLabel || (t.clear || (S.lang === "cs" ? "Zavřít" : "Close"));
      if (btnCancel) btnCancel.textContent = cancelLabel || (t.cancel || (S.lang === "cs" ? "Zpět" : "Cancel"));

      modal.classList.remove("hidden");
      btnCancel?.focus();

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(false);
        }
      };

      const cleanup = (res) => {
        modal.classList.add("hidden");
        if (btnOk) btnOk.onclick = null;
        if (btnCancel) btnCancel.onclick = null;
        modal.onclick = null;
        document.removeEventListener("keydown", onKeyDown);
        resolve(res);
      };

      if (btnOk) btnOk.onclick = () => cleanup(true);
      if (btnCancel) btnCancel.onclick = () => cleanup(false);
      modal.onclick = (e) => {
        if (e.target === modal) cleanup(false);
      };
      document.addEventListener("keydown", onKeyDown);
    });
  }
  let tipTimer = null;
  let tipAnchor = null;
  const TIP_DELAY_MS = 350;
  function positionTip(el){
    const box = $("tip");
    if (!box) return;
    box.style.left = "0px";
    box.style.top = "0px";
    const r = el.getBoundingClientRect();
    const tw = Math.min(280, box.offsetWidth || 280);
    const th = box.offsetHeight || 48;
    const gap = 8;
    const margin = 8;
    let y = r.bottom + gap;
    let placement = "bottom";
    if (y + th + margin > innerHeight) {
      const yTop = r.top - th - gap;
      if (yTop >= margin) { y = yTop; placement = "top"; }
      else y = Math.max(margin, innerHeight - th - margin);
    }
    let x = r.left + (r.width / 2) - (tw / 2);
    if (x + tw + margin > innerWidth) x = innerWidth - tw - margin;
    if (x < margin) x = margin;
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.setAttribute("data-placement", placement);
  }
  function tipShow(el, text, immediate){
    if (!el || !text) return;
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    const reveal = () => {
      tipAnchor = el;
      const box = $("tip");
      box.textContent = text;
      box.classList.add("on");
      positionTip(el);
    };
    if (immediate || (tipAnchor === el && $("tip").classList.contains("on"))) reveal();
    else tipTimer = setTimeout(reveal, TIP_DELAY_MS);
  }
  function tipHide(fromEl){
    if (fromEl && tipAnchor && (fromEl === tipAnchor || fromEl.contains(tipAnchor) || tipAnchor.contains(fromEl))) {
    }
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    tipAnchor = null;
    $("tip").classList.remove("on");
  }
  let tipsBound = false;
  function bindTips(){
    if (tipsBound) return;
    tipsBound = true;
    const elOf = (e) => e.target && e.target.closest && e.target.closest("[data-tip]");
    document.addEventListener("pointerover", (e) => {
      const el = elOf(e);
      if (!el) return;
      const related = e.relatedTarget;
      if (related && el.contains(related)) return;
      tipShow(el, el.getAttribute("data-tip"));
    });
    document.addEventListener("pointerout", (e) => {
      const el = elOf(e);
      if (!el) return;
      const related = e.relatedTarget;
      if (related && el.contains(related)) return;
      if (related && related.closest && related.closest("[data-tip]") === el) return;
      tipHide(el);
    });
    document.addEventListener("focusin", (e) => { const el = elOf(e); if (el) tipShow(el, el.getAttribute("data-tip"), true); });
    document.addEventListener("focusout", (e) => {
      const next = e.relatedTarget;
      if (next && next.closest && next.closest("[data-tip]")) return;
      tipHide();
    });
  }

  function settingsHTML(prefix){
    const p = prefix || "";
    const t = i();
    return `
      <div class="settings-tab-pane" id="${p}tabPaneProfile" role="tabpanel" aria-labelledby="${p === 'm_' ? 'tabBtnProfile' : ''}">
        <label class="field">${t.profile} <button type="button" class="help-i" data-tip="${t.tips.cats.ico}">?</button></label>
        <select id="${p}selProfile">${Object.entries(t.profiles).map(([k,v])=>`<option value="${k}" ${S.profile===k?"selected":""}>${v}</option>`).join("")}</select>
        <label class="field">${t.mode}</label>
        <select id="${p}selMode">${Object.entries(t.modes).map(([k,v])=>`<option value="${k}" ${S.mode===k?"selected":""}>${v}</option>`).join("")}</select>
        <label class="field">${t.suspicion} <button type="button" class="help-i" data-tip="${t.tips.suspicion}">?</button></label>
        <select id="${p}selSuspicion">${Object.entries(t.suspicions).map(([k,v])=>`<option value="${k}" ${S.suspicion===k?"selected":""}>${v}</option>`).join("")}</select>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="${p}chkFast" ${S.fastApprove?"checked":""}/> ${t.fastApprove} <button type="button" class="help-i" data-tip="${t.tips.fastApprove}">?</button></label>
        <label class="check"><input type="checkbox" id="${p}chkQuick" ${S.quickMode?"checked":""}/> ${t.quickMode} <button type="button" class="help-i" data-tip="${t.tips.quickMode}">?</button></label>
        <p class="lbl" style="margin-top:16px">${t.layerPii}</p>
        <div class="cats">${PII_KEYS.map(k=>`<label><input type="checkbox" data-cat="${k}" ${S.enabled[k]?"checked":""} /> <span>${t.cats[k]}</span> <button type="button" class="help-i" data-tip="${t.tips.cats[k]}">?</button></label>`).join("")}</div>
        <p class="lbl">${t.layerOrg}</p>
        <div class="cats">${ORG_KEYS.map(k=>`<label><input type="checkbox" data-cat="${k}" ${S.enabled[k]?"checked":""} /> <span>${t.cats[k]}</span> <button type="button" class="help-i" data-tip="${t.tips.cats[k]}">?</button></label>`).join("")}</div>
      </div>
      <div class="settings-tab-pane hidden" id="${p}tabPaneDicts" role="tabpanel" aria-labelledby="${p === 'm_' ? 'tabBtnDicts' : ''}">
        <label class="field">${t.secrets}</label>
        <textarea id="${p}taSecrets">${escAttr(S.secrets)}</textarea>
        <label class="field">${t.systemsDict}</label>
        <textarea id="${p}taSystems">${escAttr(S.systems)}</textarea>
        <label class="field">${t.projectsDict}</label>
        <textarea id="${p}taProjects">${escAttr(S.projects)}</textarea>
        <label class="field">${t.orgsDict}</label>
        <textarea id="${p}taOrgs">${escAttr(S.orgs)}</textarea>
        <p class="dict-hint">${t.dictHint}</p>
      </div>
      <div class="settings-tab-pane hidden" id="${p}tabPaneFormats" role="tabpanel" aria-labelledby="${p === 'm_' ? 'tabBtnFormats' : ''}">
        <label class="check"><input type="checkbox" id="${p}chkMeta" ${S.stripMeta?"checked":""}/> ${t.stripMeta} <button type="button" class="help-i" data-tip="${t.tips.stripMeta}">?</button></label>
        <label class="check"><input type="checkbox" id="${p}chkTrueRedact" ${S.truePdfRedact?"checked":""}/> ${t.truePdfRedact} <button type="button" class="help-i" data-tip="${t.truePdfRedactHint}">?</button></label>
        <label class="check"><input type="checkbox" id="${p}chkOcr" ${S.ocrEnabled?"checked":""}/> ${t.enableOcr} <button type="button" class="help-i" data-tip="${t.tips.ocr}">?</button></label>
        ${S.ocrSupported === false ? `<div class="ocr-unsupported-note" style="color:var(--muted);font-size:12px;margin:-2px 0 6px 28px;">⚠️ ${S.lang === "cs" ? "OCR vyžaduje spuštění ze síťové složky / intranetu (v režimu přímého otevření souboru file:/// prohlížeč blokuje spouštění lokálních modulů)." : "OCR requires running from an intranet or web server (file:/// mode blocks local modules)."}</div>` : ""}
        <label class="check"><input type="checkbox" id="${p}chkExpert" ${S.expertMode?"checked":""}/> ${t.expertMode} <button type="button" class="help-i" data-tip="${t.tips.expertMode}">?</button></label>
        <label class="check"><input type="checkbox" id="${p}chkProcessAnalysis" ${S.processAnalysis?"checked":""}/> ${t.processAnalysisLabel} <button type="button" class="help-i" data-tip="${t.tips.processAnalysis}">?</button></label>
      </div>`;
  }
  function escAttr(s){
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function applyProfile(p){
    S.profile = p;
    if (p === "custom") return;
    KEYS.forEach(k => { S.enabled[k] = true; });
    if (p === "infoact") S.enabled.ico = false;
    if (p === "registr" || p === "infoact" || p === "court") {
      ORG_KEYS.forEach(k => { if (k !== "secrets") S.enabled[k] = false; });
      if (p === "registr") S.mode = "box";
    }
    if (p === "internal") {
      S.mode = "pseudo";
      S.publicGlossary = false;
    }
    if (p === "publicai") {
      S.mode = "pseudo";
      S.stripMeta = true;
      S.publicGlossary = true;
      S.includeOutline = true;
    }
  }
  function wireSettings(root, prefix){
    const p = prefix || "";
    const q = (id) => root.querySelector("#"+p+id);
    const selProf = q("selProfile");
    if (selProf) selProf.onchange = (e) => {
      applyProfile(e.target.value);
      root.querySelectorAll("[data-cat]").forEach(cb => { cb.checked = S.enabled[cb.getAttribute("data-cat")]; });
      const sm = q("selMode"); if (sm) sm.value = S.mode;
      if (S.text) runAnalyze();
      else paintLanding();
      syncSettingsForms(root);
    };
    const selMode = q("selMode");
    if (selMode) selMode.onchange = (e) => { S.mode = e.target.value; if (S.text) paintReview(); syncSettingsForms(root); };
    const selSusp = q("selSuspicion");
    if (selSusp) selSusp.onchange = (e) => {
      S.suspicion = e.target.value;
      localStorage.setItem("znec-suspicion", S.suspicion);
      if (S.text) runAnalyze();
      else paintLanding();
      syncSettingsForms(root);
    };
    root.querySelectorAll("[data-cat]").forEach(cb => cb.onchange = () => {
      S.enabled[cb.getAttribute("data-cat")] = cb.checked;
      S.profile = "custom";
      const sp = q("selProfile"); if (sp) sp.value = "custom";
      if (S.text) runAnalyze();
      syncSettingsForms(root);
    });
    const bindTa = (id, field) => {
      const el = q(id); if (!el) return;
      el.oninput = (e) => { S[field] = e.target.value; };
      el.onchange = () => { if (S.text) runAnalyze(); };
    };
    bindTa("taSecrets", "secrets");
    bindTa("taSystems", "systems");
    bindTa("taProjects", "projects");
    bindTa("taOrgs", "orgs");
    const meta = q("chkMeta");
    if (meta) meta.onchange = (e) => { S.stripMeta = e.target.checked; };
    const trueRedact = q("chkTrueRedact");
    if (trueRedact) trueRedact.onchange = (e) => { S.truePdfRedact = e.target.checked; };
    const ocrChk = q("chkOcr");
    if (ocrChk) ocrChk.onchange = (e) => {
      S.ocrEnabled = e.target.checked;
      localStorage.setItem("znec-ocr", S.ocrEnabled ? "1" : "0");
      const dh = $("dropHint");
      if (dh) dh.textContent = S.ocrEnabled ? i().dropHintOcr : i().dropHint;
      syncSettingsForms(root);
    };
    const expert = q("chkExpert");
    if (expert) expert.onchange = (e) => {
      S.expertMode = e.target.checked;
      localStorage.setItem("znec-expert", S.expertMode ? "1" : "0");
      if (S.text) paintReview();
    };
    const procAn = q("chkProcessAnalysis");
    if (procAn) procAn.onchange = (e) => {
      S.processAnalysis = e.target.checked;
      localStorage.setItem("znec-process", S.processAnalysis ? "1" : "0");
      syncSettingsForms(root);
      if (S.text) paintReview();
    };
    const quick = q("chkQuick");
    if (quick) quick.onchange = (e) => {
      S.quickMode = e.target.checked;
      localStorage.setItem("znec-quick", S.quickMode ? "1" : "0");
      applyQuickMode();
      if (S.text) paintReview();
      syncSettingsForms(root);
    };
    const fast = q("chkFast");
    if (fast) fast.onchange = (e) => {
      S.fastApprove = e.target.checked;
      localStorage.setItem("znec-fastapprove", S.fastApprove ? "1" : "0");
      applyFastApprove();
      if (S.text) paintReview();
      syncSettingsForms(root);
    };
  }
  function reviewSkipped(){
    return !!S.fastApprove;
  }
  function applyQuickMode(){
    document.body.classList.toggle("quick-mode", !!S.quickMode);
  }
  function applyFastApprove(){
    document.body.classList.toggle("fast-approve", !!S.fastApprove);
  }
  function syncSettingsForms(except){
    const mounts = [$("settingsMount"), $("settingsModalMount")].filter(Boolean);
    mounts.forEach(m => {
      if (m === except || !m.children.length) return;
      const selP = m.querySelector("[id$=selProfile]");
      const selM = m.querySelector("[id$=selMode]");
      const selS = m.querySelector("[id$=selSuspicion]");
      const ta = m.querySelector("[id$=taSecrets]");
      const ts = m.querySelector("[id$=taSystems]");
      const tp = m.querySelector("[id$=taProjects]");
      const to = m.querySelector("[id$=taOrgs]");
      const cm = m.querySelector("[id$=chkMeta]");
      const ctr = m.querySelector("[id$=chkTrueRedact]");
      const co = m.querySelector("[id$=chkOcr]");
      const ce = m.querySelector("[id$=chkExpert]");
      const cpa = m.querySelector("[id$=chkProcessAnalysis]");
      const cq = m.querySelector("[id$=chkQuick]");
      const cf = m.querySelector("[id$=chkFast]");
      if (selP) selP.value = S.profile;
      if (selM) selM.value = S.mode;
      if (selS) selS.value = S.suspicion;
      if (ta && document.activeElement !== ta) ta.value = S.secrets;
      if (ts && document.activeElement !== ts) ts.value = S.systems;
      if (tp && document.activeElement !== tp) tp.value = S.projects;
      if (to && document.activeElement !== to) to.value = S.orgs;
      if (cm) cm.checked = !!S.stripMeta;
      if (ctr) ctr.checked = !!S.truePdfRedact;
      if (co) co.checked = !!S.ocrEnabled;
      if (ce) ce.checked = !!S.expertMode;
      if (cpa) cpa.checked = !!S.processAnalysis;
      if (cq) cq.checked = !!S.quickMode;
      if (cf) cf.checked = !!S.fastApprove;
      m.querySelectorAll("[data-cat]").forEach(cb => { cb.checked = !!S.enabled[cb.getAttribute("data-cat")]; });
    });
    document.querySelectorAll("#landingProfilePills .profile-pill-btn").forEach(pl => {
      const isSel = pl.dataset.profile === S.profile;
      pl.classList.toggle("on", isSel);
      pl.setAttribute("aria-checked", isSel ? "true" : "false");
    });
  }
  let SETTINGS_MODAL_SNAPSHOT = null;
  let LANDING_SETTINGS_SIGNATURE = "";

  function captureSettingsModalSnapshot(){
    const storage = {};
    [
      "znec-suspicion",
      "znec-ocr",
      "znec-expert",
      "znec-process",
      "znec-quick",
      "znec-fastapprove",
      "znec-barpos",
      "znec-pdfa"
    ].forEach(key => {
      storage[key] = localStorage.getItem(key);
    });

    return {
      settings: snapshotSettings(),
      document: S.text ? snapState() : null,
      storage
    };
  }

  function restoreSettingsModalSnapshot(snapshot){
    if (!snapshot) return;

    restoreSettingsSnapshot(snapshot.settings);

    if (snapshot.document) {
      restoreState(snapshot.document);
    }

    Object.keys(snapshot.storage || {}).forEach(key => {
      const value = snapshot.storage[key];
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });

    applyQuickMode();
    applyFastApprove();
    applyBarPos();
  }

  function switchSettingsTab(rawTabId) {
    const tabId = (typeof rawTabId === "string" && ["tabProfile", "tabDicts", "tabFormats"].includes(rawTabId)) ? rawTabId : "tabProfile";
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.setAttribute("tabindex", active ? "0" : "-1");
    });
    const paneProfile = $("m_tabPaneProfile");
    const paneDicts = $("m_tabPaneDicts");
    const paneFormats = $("m_tabPaneFormats");
    if (paneProfile) paneProfile.classList.toggle("hidden", tabId !== "tabProfile");
    if (paneDicts) paneDicts.classList.toggle("hidden", tabId !== "tabDicts");
    if (paneFormats) paneFormats.classList.toggle("hidden", tabId !== "tabFormats");
  }

  function openSettings(rawActiveTab = "tabProfile"){
    const activeTab = (typeof rawActiveTab === "string" && ["tabProfile", "tabDicts", "tabFormats"].includes(rawActiveTab)) ? rawActiveTab : "tabProfile";
    const t = i();

    SETTINGS_MODAL_SNAPSHOT = captureSettingsModalSnapshot();

    $("settingsTitle").textContent = t.settings;
    if ($("tabBtnProfile")) $("tabBtnProfile").textContent = t.tabProfile || "Profil publikace";
    if ($("tabBtnDicts")) $("tabBtnDicts").textContent = t.tabDicts || "Projektové slovníky";
    if ($("tabBtnFormats")) $("tabBtnFormats").textContent = t.tabFormats || "Formáty a zabezpečení";

    $("btnSettingsApply").textContent = t.apply;
    $("btnSettingsClose").textContent = t.cancel;
    $("settingsModalMount").innerHTML = settingsHTML("m_");
    wireSettings($("settingsModalMount"), "m_");

    const tabBtns = Array.from(document.querySelectorAll(".settings-tab-btn"));
    tabBtns.forEach((btn, idx) => {
      btn.onclick = () => switchSettingsTab(btn.dataset.tab);
      btn.onkeydown = (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const next = tabBtns[(idx + 1) % tabBtns.length];
          next.focus();
          switchSettingsTab(next.dataset.tab);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          const prev = tabBtns[(idx - 1 + tabBtns.length) % tabBtns.length];
          prev.focus();
          switchSettingsTab(prev.dataset.tab);
        }
      };
    });
    switchSettingsTab(activeTab);

    $("settingsModal").classList.remove("hidden");
    const activeBtn = tabBtns.find(b => b.dataset.tab === activeTab) || tabBtns[0];
    activeBtn?.focus();
    bindTips();
  }

  function closeSettings(){
    const snapshot = SETTINGS_MODAL_SNAPSHOT;
    SETTINGS_MODAL_SNAPSHOT = null;

    $("settingsModal").classList.add("hidden");

    if (snapshot) {
      restoreSettingsModalSnapshot(snapshot);
    }

    const root = $("settingsModalMount");
    if (root) root.innerHTML = "";

    if (S.text) {
      paint();
    } else if (!$("landing").classList.contains("hidden")) {
      $("settingsMount").innerHTML = settingsHTML();
      wireSettings($("settingsMount"));
    }
  }

  function paintLanding(){
    const t = i();
    const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    const setTip = (id, tip) => { const el = $(id); if (el) el.setAttribute("data-tip", tip); };
    setT("title", t.name); setT("tagline", t.tagline);
    setT("lead", t.landingLead);
    setT("s1", t.landingStep1); setT("s2", t.landingStep2); setT("s3", t.landingStep3);
    const showOcrHint = S.ocrEnabled && S.ocrSupported !== false;
    setT("privacy", t.privacy); setT("dropTitle", t.drop); setT("dropHint", showOcrHint ? t.dropHintOcr : t.dropHint);
    setT("btnSample", t.trySample); setTip("btnSample", t.tips.sample);
    setT("btnBrowse", t.browse); setTip("btnBrowse", t.tips.browse);
    setT("lblLandingProfile", (t.profile || "Profil publikace") + ":");
    setT("btnLandingProfileMore", S.lang === "cs" ? "Upravit v Nastavení ⚙" : "Customize in Settings ⚙");
    const pillTranslations = {
      registr: { title: S.lang === "cs" ? "Registr smluv" : "Contracts Reg.", badge: "340/2015 Sb.", tip: t.tips.profiles.registr },
      infoact: { title: "InfZ 106", badge: "106/1999 Sb.", tip: t.tips.profiles.infoact },
      court: { title: S.lang === "cs" ? "Rozhodnutí" : "Court Decisions", badge: "403/2022 Sb.", tip: t.tips.profiles.court },
      publicai: { title: S.lang === "cs" ? "Veřejná AI" : "Public AI", badge: S.lang === "cs" ? "Všechny tokeny" : "All tokens", tip: t.tips.profiles.publicai }
    };
    document.querySelectorAll("#landingProfilePills .profile-pill-btn").forEach(pl => {
      const pInfo = pillTranslations[pl.dataset.profile];
      if (pInfo) {
        const pt = pl.querySelector(".pill-title");
        const pb = pl.querySelector(".pill-badge");
        if (pt) pt.textContent = pInfo.title;
        if (pb) pb.textContent = pInfo.badge;
        if (pInfo.tip) pl.title = pInfo.tip;
      }
    });
    setT("btnMovie", t.movieTutorial); setTip("btnMovie", t.tips.movie);

    const pills = document.querySelectorAll("#landingProfilePills .profile-pill-btn");
    pills.forEach(pill => {
      const p = pill.dataset.profile;
      const isSelected = S.profile === p;
      pill.classList.toggle("on", isSelected);
      pill.setAttribute("aria-checked", isSelected ? "true" : "false");
      pill.onclick = () => {
        applyProfile(p);
        pills.forEach(pl => {
          const sel = pl.dataset.profile === p;
          pl.classList.toggle("on", sel);
          pl.setAttribute("aria-checked", sel ? "true" : "false");
        });
        syncSettingsForms();
      };
    });
    const btnMoreProf = $("btnLandingProfileMore");
    if (btnMoreProf) {
      btnMoreProf.onclick = () => {
        openSettings();
        const tabBtn = $("tabBtnProfile");
        if (tabBtn) tabBtn.click();
      };
    }
    const lblLang = $("lblLangText");
    if (lblLang) {
      lblLang.textContent = S.lang === "cs" ? "Jazyk: English" : "Language: Čeština";
    } else {
      setT("btnLang", S.lang === "cs" ? "EN" : "CS");
    }
    setTip("btnLang", t.tips.lang);
    applyTheme();
    setTip("btnHelp", t.tips.help);
    const lblHelp = $("lblHelpText");
    if (lblHelp) lblHelp.textContent = t.helpTitle || "Nápověda a klávesy";
    const lblFeat = $("lblFeaturesText");
    if (lblFeat) lblFeat.textContent = t.featuresBtn || "Přehled funkcí";
    const lblChange = $("lblChangelogText");
    if (lblChange) lblChange.textContent = t.changelogBtn || "Changelog";
    setT("btnFeatures", t.featuresBtn); setTip("btnFeatures", t.tips.features);
    setT("btnChangelog", t.changelogBtn); setTip("btnChangelog", t.tips.changelog);
    setTip("btnSettings", t.tips.settings);
    const bs = $("btnSettings"); if (bs) bs.setAttribute("aria-label", t.settings);
    setT("sumSettings", t.settings);
    const landingSettingsSignature = S.lang + "|" + t.settings + "|" + t.categories;
    const settingsMount = $("settingsMount");
    if (settingsMount && (!settingsMount.children.length || LANDING_SETTINGS_SIGNATURE !== landingSettingsSignature)) {
      settingsMount.innerHTML = settingsHTML();
      wireSettings(settingsMount);
      LANDING_SETTINGS_SIGNATURE = landingSettingsSignature;
    } else if (settingsMount) {
      syncSettingsForms(settingsMount);
    }
    $("footer").textContent = t.footer;
    bindTips();
  }

  function esc(s){
    const amp = "&" + "amp;";
    const lt = "&" + "lt;";
    const gt = "&" + "gt;";
    const quot = "&" + "quot;";
    return String(s).replace(/&/g, amp).replace(/</g, lt).replace(/>/g, gt).replace(/"/g, quot).replace(/'/g, "&#39;");
  }
  function hitEvidence(h, t, full){
    const ev = h.confidence==="high"?t.high:t.medium;
    if (!full) return ev;
    const labels = (t && t.reasonLabels) || {};
    const rs = (h.reasons||[]).map(r => {
      if (labels[r]) return labels[r];
      if (r === "trigger:role") return "[Trigger: role]";
      if (r === "trigger:official") return "[Trigger: úřední]";
      if (r === "propagation") return "[Propagace]";
      if (r === "ocr:fuzzy") return "[OCR: fuzzy]";
      return r.replace(/^context:/,"ctx:");
    });
    return [ev].concat(rs).join(" · ");
  }
  function origHTML(){
    const t = i(); const vis = visibleHits(S.hits, S.selectedId);
    let html = ""; let cur = 0;
    vis.forEach(h => {
      if (h.start > cur) html += esc(S.text.slice(cur, h.start));
      const cls = "mk " + (h.accept?"mk-on":"mk-off") + (S.selectedId===h.id?" mk-sel":"");
      const catName = (t.cats && t.cats[h.type]) || (LABEL[S.lang] && LABEL[S.lang][h.type]) || h.type;
      const tip = catName+" · "+hitEvidence(h, t, true);
      html += `<button type="button" class="${cls}" data-id="${h.id}" data-tip="${esc(tip)}">${esc(S.text.slice(h.start,h.end))}</button>`;
      cur = h.end;
    });
    html += esc(S.text.slice(cur));
    return html;
  }
  function previewHTML(){
    const t = i();
    const vis = visibleHits(S.hits, S.selectedId);
    const replacer = bindReplacer(S.mode, S.lang, S.hits);
    let html = ""; let cur = 0;
    vis.forEach(h => {
      if (h.start > cur) html += esc(S.text.slice(cur, h.start));
      const catName = (t.cats && t.cats[h.type]) || (LABEL[S.lang] && LABEL[S.lang][h.type]) || h.type;
      const tip = catName+" · "+hitEvidence(h, t, true);
      if (h.accept) {
        const cls = "mk mk-preview" + (S.selectedId===h.id?" mk-sel":"");
        html += `<button type="button" class="${cls}" data-id="${h.id}" data-tip="${esc(tip)}">${esc(replacer(h))}</button>`;
      } else {
        const cls = "mk mk-off" + (S.selectedId===h.id?" mk-sel":"");
        html += `<button type="button" class="${cls}" data-id="${h.id}" data-tip="${esc(tip)}">${esc(S.text.slice(h.start,h.end))}</button>`;
      }
      cur = h.end;
    });
    html += esc(S.text.slice(cur));
    return html;
  }

  // --- Fáze 4: vizuální PDF náhled (canvas + klikací překryv nálezů) ---
  let PV = null; // { buf, width, pages:[{n, wrap, layer, text, map, scale}] }
  let pvToken = 0;
  function setDocView(view){
    S.docView = view === "preview" ? "preview" : "original";
    localStorage.setItem("znec-docview", S.docView);
    paintReview();
  }
  function filtered(){
    if (S.filter === "all") return S.hits;
    if (S.filter === "redact") return S.hits.filter(h => h.accept);
    if (S.filter === "keep") return S.hits.filter(h => !h.accept);
    if (S.filter === "secondReview") {
      return S.hits.filter(h => {
        const isException = !h.accept;
        const isManual = (h.reasons && (h.reasons.includes("manual") || h.reasons.includes("morphology") || h.reasons.includes("dict"))) || h.userModified || h.confidence === "manual";
        return isException || isManual;
      });
    }
    return S.hits;
  }
  let _reviewCache = null;

  export function legalOf(h) {
    if (!h) return "gdpr";
    if (h.legalBasis) return h.legalBasis;
    if (S.legalReason) return S.legalReason;
    if (h.type === "secrets") return "trade";
    if (["credential", "ip", "host", "system", "project", "ticket", "incident"].includes(h.type)) return "security";
    return "gdpr";
  }

  export function buildAudit() {
    const salt = S.auditSalt || (S.auditSalt = Array.from(globalThis.crypto?.getRandomValues?.(new Uint8Array(8)) || [1,2,3,4,5,6,7,8]).map(b => b.toString(16).padStart(2, "0")).join(""));
    const items = (S.hits || []).map(h => {
      const val = String(h.value || "");
      const mask = val.length > 0 ? `${val[0]}${"*".repeat(Math.max(0, val.length - 1))} (${val.length})` : "";
      return {
        id: h.id,
        type: h.type,
        page: h.page || 1,
        action: h.accept ? "redact" : "keep",
        mask,
        entityKey: h.entityKey || null,
        legalBasis: legalOf(h),
        legalCustom: (legalOf(h) === "custom" ? (h.legalCustom || "") : "")
      };
    });

    return {
      application: "Znečitelně",
      rulesVersion: RULES,
      timestamp: new Date().toISOString(),
      document: {
        fileName: S.fileName || "document",
        kind: S.kind || "text",
        hashIn: S.hashIn || "",
        hashOut: S.hashOut || ""
      },
      operator: S.operator || "",
      profile: S.profile,
      mode: S.mode,
      review: {
        reviewed: !!S.reviewed,
        secondEyes: !!S.secondEyes,
        fastApprove: !!S.fastApprove,
        quickMode: !!S.quickMode
      },
      counts: {
        total: S.hits.length,
        redacted: S.hits.filter(h => h.accept).length,
        kept: S.hits.filter(h => !h.accept).length
      },
      salt,
      findings: items,
      auditTrail: S.auditTrail || []
    };
  }

  export function groupHitsIntoEntities(hits) {
    const groups = new Map();
    hits.forEach(h => {
      const key = h.entityKey || `${h.type}|${(h.value || "").trim().toLocaleLowerCase("cs")}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          type: h.type,
          canonicalValue: h.value || "",
          hits: [],
          forms: new Set(),
          legalBasis: legalOf(h)
        });
      }
      const g = groups.get(key);
      g.hits.push(h);
      if ((h.value || "").trim()) g.forms.add(h.value.trim());
      if (h.value && h.value.length > g.canonicalValue.length) {
        g.canonicalValue = h.value;
      }
    });

    const replacer = bindReplacer(S.mode === "box" ? "pseudo" : S.mode, S.lang, hits);
    return Array.from(groups.values()).map(g => {
      const acceptedCount = g.hits.filter(h => h.accept).length;
      const acceptState = acceptedCount === g.hits.length ? "all" : (acceptedCount === 0 ? "none" : "mixed");
      const sampleHit = g.hits[0];
      const token = sampleHit ? replacer(sampleHit) : "";
      return {
        ...g,
        acceptState,
        acceptedCount,
        totalCount: g.hits.length,
        formsList: Array.from(g.forms),
        token
      };
    });
  }

  function patchEntity(entityKey, accept) {
    S.hits.forEach(h => {
      const k = h.entityKey || `${h.type}|${(h.value || "").trim().toLocaleLowerCase("cs")}`;
      if (k === entityKey) {
        h.accept = accept;
        h.userModified = true;
        S.seen.add(h.id);
      }
    });
    paintReview();
  }

  function paintEntities(entities, t) {
    const container = $("entityList");
    if (!container) return;
    const filteredEntities = entities.filter(e => {
      if (S.filter === "redact") return e.acceptState === "all" || e.acceptState === "mixed";
      if (S.filter === "keep") return e.acceptState === "none";
      if (S.filter === "secondReview") {
        return e.hits.some(h => (!h.accept) || (h.reasons && (h.reasons.includes("manual") || h.reasons.includes("morphology") || h.reasons.includes("dict"))) || h.userModified || h.confidence === "manual");
      }
      return true;
    });

    if (!filteredEntities.length) {
      container.innerHTML = `<p class="layer-note" style="text-align:center;padding:16px;">${esc(t.noHits)}</p>`;
      return;
    }

    container.innerHTML = filteredEntities.map(e => {
      const isExpanded = S.expandedEntities.has(e.key);
      const catName = (t.cats && t.cats[e.type]) || (LABEL[S.lang] && LABEL[S.lang][e.type]) || e.type;
      const badgeCls = e.acceptState === "all" ? "ec-redact" : (e.acceptState === "none" ? "ec-keep" : "ec-mixed");
      const isSel = e.hits.some(h => h.id === S.selectedId);
      const countLabel = formatPlural(e.totalCount, t.entityOccurrencesPlural || t.entityOccurrences, S.lang);
      const casesLabel = formatPlural(e.formsList.length, t.entityCasesPlural || t.entityCases, S.lang);
      const formsSummary = e.formsList.length > 1
        ? `${countLabel} (${casesLabel}: ${esc(e.formsList.join(", "))})`
        : countLabel;
      const hasException = e.acceptState === "none" || e.hits.some(h => !h.accept);
      const hasManual = e.hits.some(h => h.reasons && (h.reasons.includes("manual") || h.confidence === "manual" || h.userModified));
      const secondEyesBadge = hasException
        ? `<span class="badge" style="padding:1px 5px;font-size:9px;color:var(--ok);border-color:var(--ok)">${S.lang === "cs" ? "Výjimka: Ponecháno" : "Exception: Kept"}</span>`
        : (hasManual ? `<span class="badge" style="padding:1px 5px;font-size:9px;color:var(--hit);border-color:var(--hit)">${S.lang === "cs" ? "Ruční zásah" : "Manual entry"}</span>` : "");

      return `
        <div class="entity-card ${badgeCls} ${isSel ? "sel" : ""}" data-ekey="${escAttr(e.key)}">
          <div class="ec-header" role="button" tabindex="0" aria-expanded="${isExpanded}" aria-label="${escAttr(e.canonicalValue)}: ${isExpanded ? (t.entityCollapse || "skrýt") : (t.entityExpand || "zobrazit")}" data-etoggle="${escAttr(e.key)}">
            <div style="flex:1;min-width:0">
              <h3 class="ec-title">${esc(e.canonicalValue)}</h3>
              <div class="ec-meta">
                <span class="pill ${e.acceptState === "all" ? "pill-hit" : "pill-ok"}" style="font-size:9px;padding:1px 6px;">${esc(catName)}</span>
                ${e.token ? `<span class="ec-token">${esc(e.token)}</span>` : ""}
                <span class="ec-badge-count">${esc(formsSummary)}</span>
                ${secondEyesBadge}
              </div>
            </div>
            <span style="font-size:12px;color:var(--muted);padding-left:4px;" aria-hidden="true">${isExpanded ? "▲" : "▼"}</span>
          </div>
          <div class="ec-actions">
            <button type="button" class="btn btn-sm ${e.acceptState === "all" ? "btn-sec" : "btn-ghost"}" data-eact="redact" data-ekey="${escAttr(e.key)}" aria-label="${escAttr(t.redact)}">🔒 ${esc(t.redact)}</button>
            <button type="button" class="btn btn-sm ${e.acceptState === "none" ? "btn-sec" : "btn-ghost"}" data-eact="keep" data-ekey="${escAttr(e.key)}" aria-label="${escAttr(t.keep)}">✓ ${esc(t.keep)}</button>
            <span style="flex:1"></span>
            <button type="button" class="btn btn-sm btn-ghost" data-etoggle="${escAttr(e.key)}" style="font-size:11px;min-height:36px;padding:0 10px;">
              ${isExpanded ? esc(t.entityCollapse || "Skrýt") : esc(t.entityExpand || "Výskyty")}
            </button>
          </div>
          ${isExpanded ? `
            <div class="ec-subhits">
              ${e.hits.map(h => `
                <div class="ec-subhit ${S.selectedId === h.id ? "mk-sel" : ""}" data-hid="${h.id}">
                  <span class="mono" style="font-weight:600">${esc(h.value)}</span>
                  <span style="display:inline-flex;gap:4px;align-items:center;">
                    <span class="pill ${h.accept ? "pill-hit" : "pill-ok"}" style="font-size:8px;padding:1px 5px;"><span class="pill-label">${h.accept ? "🔒 " + esc(t.redact) : "✓ " + esc(t.keep)}</span></span>
                    <span class="mono" style="color:var(--muted);font-size:10px">#${h.id}</span>
                  </span>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-etoggle]").forEach(el => {
      const toggle = (e) => {
        e.stopPropagation();
        const k = el.dataset.etoggle;
        if (S.expandedEntities.has(k)) S.expandedEntities.delete(k);
        else S.expandedEntities.add(k);
        paintReview();
      };
      el.onclick = toggle;
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(e);
        }
      };
    });

    container.querySelectorAll("[data-eact]").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const k = b.dataset.ekey;
        const act = b.dataset.eact === "redact";
        patchEntity(k, act);
      };
    });

    container.querySelectorAll("[data-hid]").forEach(el => {
      el.onclick = () => {
        select(+el.dataset.hid);
      };
    });
  }

  function paintSmartBanners(leftovers, leaks, t) {
    const container = $("smartBanners");
    if (!container) return;
    const banners = [];

    if (S.kind === "pdf" && S.sigDetected) {
      banners.push(`
        <div class="smart-banner smart-banner-info">
          <div class="sb-content">
            <span class="sb-icon">🔏</span>
            <div>
              <h4 class="sb-title">${esc(t.smartSigTitle || "Detekováno razítko elektronického podpisu")}</h4>
              <p class="sb-desc">${esc(t.smartSigDesc || "Vizuální razítko podpisu bude zachováno, začerní se pouze jméno podepsané osoby.")}</p>
            </div>
          </div>
        </div>
      `);
    }

    if (S.noTextPages > 0) {
      banners.push(`
        <div class="smart-banner smart-banner-warn">
          <div class="sb-content">
            <span class="sb-icon">📄</span>
            <div>
              <h4 class="sb-title">${esc(formatPlural(S.noTextPages, t.smartScanTitlePlural || t.smartScanTitle, S.lang))}</h4>
              <p class="sb-desc">${esc(t.smartScanDesc || "Tyto stránky neobsahují strojově čitelný text a vyžadují OCR.")}</p>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-sec" id="btnBannerOcr">${esc(t.smartScanBtn || "Spustit OCR")}</button>
        </div>
      `);
    }

    if (leftovers.length > 0 || leaks.length > 0) {
      banners.push(`
        <div class="smart-banner smart-banner-danger">
          <div class="sb-content">
            <span class="sb-icon">⚠</span>
            <div>
              <h4 class="sb-title">${esc(t.smartRiskTitle || "Zbytková rizika v dokumentu")}</h4>
              <p class="sb-desc">${esc(t.smartRiskDesc || "Po navržené anonymizaci v textu stále zůstávají citlivé vzory.")}</p>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-sec" id="btnBannerInspect">${esc(t.smartRiskBtn || "Zkontrolovat")}</button>
        </div>
      `);
    }

    container.innerHTML = banners.join("");

    if ($("btnBannerOcr")) {
      $("btnBannerOcr").onclick = () => {
        S.ocrEnabled = true;
        localStorage.setItem("znec-ocr", "1");
        toast(t.enableOcr || "OCR povoleno");
        if (Q.cur >= 0 && Q.items[Q.cur]) {
        if (Q.cur >= 0 && Q.items[Q.cur]) {
          const curItem = Q.items[Q.cur];
          curItem.snap = null;
          curItem.doc = null;
          void openQueueItem(Q.cur);
        }
        }
      };
    }
    if ($("btnBannerInspect")) {
      $("btnBannerInspect").onclick = () => {
        if (leftovers.length && leftovers[0]) select(leftovers[0].id);
        else if (leaks.length) {
          if ($("processPane")) $("processPane").classList.remove("hidden");
          $("processPane")?.scrollIntoView({ behavior: "smooth" });
        }
      };
    }
  }

  async function exportSessionPrompt(){
    const pwd = prompt(S.lang === "cs" ? "Zadejte heslo pro zašifrování sezení (pro druhou kontrolu):" : "Enter password to encrypt session (for second review):");
    if (!pwd) return false;
    const pwdConfirm = prompt(S.lang === "cs" ? "Potvrďte heslo:" : "Confirm password:");
    if (pwd !== pwdConfirm) {
      toast(S.lang === "cs" ? "Hesla se neshodují." : "Passwords do not match.");
      return false;
    }
    try {
      const envelopeJson = await exportSession(S, pwd);
      const blob = new Blob([envelopeJson], { type: "application/json" });
      const baseName = (S.fileName || "dokument").replace(/\.[^/.]+$/, "");
      download(`${baseName}.znecitelne-session`, blob);
      toast(S.lang === "cs" ? "Šifrované sezení bylo uloženo." : "Encrypted session saved.");
      return true;
    } catch (err) {
      toast((S.lang === "cs" ? "Chyba při exportu sezení: " : "Error exporting session: ") + (err.message || String(err)));
      return false;
    }
  }

  async function openCloseDocModal(){
    if (Q.items.length > 1) {
      const ok = await showConfirm(
        S.lang === "cs" ? "Opravdu chcete odebrat tento dokument z fronty?" : "Remove this document from queue?",
        S.lang === "cs" ? "Odebrat z fronty" : "Remove from queue",
        S.lang === "cs" ? "Zpět" : "Cancel"
      );
      if (ok) {
        removeQueueItem(Q.cur);
      }
      return;
    }
    if (!S.hits || !S.hits.length) {
      reset();
      return;
    }
    const t = i();
    const modal = $("closeDocModal");
    if (!modal) {
      const ok = await showConfirm(
        S.lang === "cs" ? "Opravdu chcete zavřít dokument? Neuložené změny budou ztraceny." : "Close document? Unsaved changes will be lost.",
        S.lang === "cs" ? "Zavřít dokument" : "Close document",
        S.lang === "cs" ? "Zpět" : "Cancel"
      );
      if (ok) reset();
      return;
    }
    if ($("closeDocTitle")) $("closeDocTitle").textContent = t.closeDocTitle || "Zavřít dokument?";
    if ($("closeDocDesc")) $("closeDocDesc").textContent = t.closeDocDesc || "Máte rozpracované změny v anonymizaci dokumentu. Neuložené změny budou ztraceny. Můžete si stav bezpečně uložit pro druhou kontrolu.";
    if ($("lblCloseSaveSession")) $("lblCloseSaveSession").textContent = t.closeSaveSession || "Předat pro 4 oči (uložit sezení)";
    if ($("lblCloseDiscard")) $("lblCloseDiscard").textContent = t.closeDiscard || "Zavřít bez uložení";
    if ($("lblCloseCancel")) $("lblCloseCancel").textContent = t.closeCancel || (S.lang === "cs" ? "Zpět k dokumentu" : "Back to document");
    else if ($("btnCloseCancel")) $("btnCloseCancel").textContent = t.closeCancel || (S.lang === "cs" ? "Zpět k dokumentu" : "Back to document");

    const btnSave = $("btnCloseSaveSession");
    if (btnSave) {
      btnSave.onclick = async () => {
        const saved = await exportSessionPrompt();
        if (saved) {
          modal.classList.add("hidden");
          reset();
        }
      };
    }
    const btnDiscard = $("btnCloseDiscard");
    if (btnDiscard) {
      btnDiscard.onclick = () => {
        modal.classList.add("hidden");
        reset();
      };
    }
    const btnCancel = $("btnCloseCancel");
    if (btnCancel) {
      btnCancel.onclick = () => {
        modal.classList.add("hidden");
      };
    }
    modal.classList.remove("hidden");
    btnCancel?.focus();
  }

  function paintWorkBar(acceptedCount, totalCount, t) {
    const isReviewActive = !!(S.text || (S.kind === "pdf" && S.sourceBuf));
    document.body.classList.toggle("has-doc", isReviewActive);
    const docContext = $("headerDocContext");
    const approval = $("headerApproval");
    const exportGroup = $("headerExportGroup");

    if (docContext) docContext.classList.toggle("hidden", !isReviewActive);
    if (approval) approval.classList.toggle("hidden", !isReviewActive);
    if (exportGroup) exportGroup.classList.toggle("hidden", !isReviewActive);

    const lblPriv = $("lblHeaderPrivacy");
    if (lblPriv) lblPriv.textContent = t.processedLocally || (S.lang === "cs" ? "Zpracováno lokálně" : "Processed locally");
    const privBadge = $("headerPrivacyBadge");
    if (privBadge) privBadge.title = t.privacy || "";
    if ($("lblReviewedText")) $("lblReviewedText").textContent = t.reviewed;
    if ($("lblSecondEyesText")) $("lblSecondEyesText").textContent = t.secondEyes;
    if ($("lblQpTitle")) $("lblQpTitle").textContent = t.queueLbl;
    if ($("btnQpNextUnreviewed")) $("btnQpNextUnreviewed").textContent = S.lang === "cs" ? "➔ Přejít na další neschválený" : "➔ Next unreviewed document";
    if ($("btnQpExportAll")) $("btnQpExportAll").textContent = t.queueExportReviewedZip || t.queueAll;

    const btnMore = $("btnHeaderMore");
    const moreMenu = $("headerMoreMenu");
    if (btnMore && moreMenu) {
      btnMore.onclick = (e) => {
        e.stopPropagation();
        const isHidden = moreMenu.classList.toggle("hidden");
        btnMore.setAttribute("aria-expanded", !isHidden ? "true" : "false");
      };
    }
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if ($("lblThemeText")) $("lblThemeText").textContent = isDark ? (S.lang === "cs" ? "Světlý režim" : "Light mode") : (S.lang === "cs" ? "Tmavý režim" : "Dark mode");
    const themeIcon = $("btnTheme")?.querySelector(".dropdown-item-icon");
    if (themeIcon) {
      themeIcon.innerHTML = isDark
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
    if ($("lblLangText")) $("lblLangText").textContent = S.lang === "cs" ? "Jazyk: English" : "Language: Čeština";
    if ($("lblHelpText")) $("lblHelpText").textContent = t.helpTitle || "Nápověda a klávesy";
    if ($("lblFeaturesText")) $("lblFeaturesText").textContent = t.featuresBtn || "Přehled funkcí";
    if ($("lblChangelogText")) $("lblChangelogText").textContent = t.changelogBtn || "Historie verzí";
    updateFullscreenUI();

    if (!isReviewActive) return;

    const docName = $("headerDocName");
    if (docName) docName.textContent = S.fileName || "Dokument";

    const queueWrap = $("headerQueueWrap");
    const queueToggle = $("btnQueueToggle");
    const queuePopover = $("queuePopover");
    const queueSel = $("headerQueueSelect");
    if (queueWrap && queueToggle && queuePopover) {
      if (Q.items.length > 1) {
        queueWrap.classList.remove("hidden");
        const curNum = Q.cur + 1;
        const totalNum = Q.items.length;
        if ($("lblQueueToggle")) {
          $("lblQueueToggle").textContent = S.lang === "cs"
            ? `Dokument ${curNum} z ${totalNum}`
            : `Document ${curNum} of ${totalNum}`;
        }
        let approvedCount = 0;
        let pendingCount = 0;
        let warnCount = 0;
        Q.items.forEach((it, idx) => {
          const isRev = idx === Q.cur ? S.reviewed : !!(it.snap && it.snap.reviewed);
          const hasWarn = idx === Q.cur ? (S.noTextPages > 0 || S.sigDetected) : !!(it.snap && (it.snap.noTextPages > 0 || it.snap.sigDetected));
          if (isRev) approvedCount++;
          else pendingCount++;
          if (hasWarn) warnCount++;
        });

        const miniBadge = $("queueMiniBadge");
        if (miniBadge) miniBadge.textContent = `${approvedCount}/${totalNum} ✓`;

        if ($("lblQpCount")) {
          $("lblQpCount").textContent = formatPlural(totalNum, ["1 dokument", "{n} dokumenty", "{n} dokumentů"], S.lang);
        }
        if ($("qpStatApproved")) $("qpStatApproved").textContent = `✓ ${approvedCount} ` + (S.lang === "cs" ? "schváleno" : "approved");
        if ($("qpStatPending")) $("qpStatPending").textContent = `⏳ ${pendingCount} ` + (S.lang === "cs" ? "nezkontrolováno" : "unreviewed");
        const statWarn = $("qpStatWarn");
        if (statWarn) {
          statWarn.classList.toggle("hidden", warnCount === 0);
          statWarn.textContent = `⚠️ ${warnCount} ` + (S.lang === "cs" ? "k pozornosti" : "attention");
        }

        const btnNextUnrev = $("btnQpNextUnreviewed");
        if (btnNextUnrev) {
          let nextUnrevIdx = -1;
          for (let step = 1; step <= totalNum; step++) {
            const checkIdx = (Q.cur + step) % totalNum;
            const isRev = checkIdx === Q.cur ? S.reviewed : !!(Q.items[checkIdx].snap && Q.items[checkIdx].snap.reviewed);
            if (!isRev) {
              nextUnrevIdx = checkIdx;
              break;
            }
          }
          btnNextUnrev.disabled = nextUnrevIdx === -1;
          btnNextUnrev.onclick = (e) => {
            e.stopPropagation();
            if (nextUnrevIdx !== -1) {
              queuePopover.classList.add("hidden");
              queueToggle.setAttribute("aria-expanded", "false");
              void openQueueItem(nextUnrevIdx);
            }
          };
        }

        const itemsList = $("qpItemsList");
        if (itemsList) {
          itemsList.innerHTML = Q.items.map((it, idx) => {
            const isCur = idx === Q.cur;
            const isRev = isCur ? S.reviewed : !!(it.snap && it.snap.reviewed);
            const hasWarn = isCur ? (S.noTextPages > 0 || S.sigDetected) : !!(it.snap && (it.snap.noTextPages > 0 || it.snap.sigDetected));
            const statusIco = isRev ? "✓" : (hasWarn ? "⚠️" : "⏳");
            const statusClass = isRev ? "ok" : (hasWarn ? "danger" : "muted");
            const statusTitle = isRev ? (S.lang === "cs" ? "Schváleno" : "Approved") : (hasWarn ? (S.lang === "cs" ? "Vyžaduje pozornost" : "Needs attention") : (S.lang === "cs" ? "Nezkontrolováno" : "Unreviewed"));
            const ext = (it.name.split('.').pop() || "doc").toUpperCase();
            const hitsCount = isCur ? S.hits.length : (it.snap?.hits?.length ?? it.doc?.hits?.length ?? "");
            return `
              <div class="qp-item ${isCur ? 'active' : ''}" data-idx="${idx}" role="button" tabindex="0">
                <span class="qp-status-ico ${statusClass}" title="${statusTitle}">${statusIco}</span>
                <div class="qp-item-info">
                  <span class="qp-item-name" title="${escAttr(it.name)}">${esc(it.name)}</span>
                  <div class="qp-item-meta">
                    <span class="badge" style="padding:1px 5px;font-size:10px">${ext}</span>
                    ${hitsCount !== "" ? `<span>${hitsCount} ${S.lang === 'cs' ? 'nálezů' : 'hits'}</span>` : ""}
                    ${isCur ? `<span style="font-weight:700;color:var(--accent)">(${S.lang === 'cs' ? 'aktivní' : 'active'})</span>` : ""}
                  </div>
                </div>
                <button type="button" class="qp-item-del" data-del="${idx}" title="${S.lang === 'cs' ? 'Odebrat z fronty' : 'Remove'}">✕</button>
              </div>
            `;
          }).join("");

          itemsList.querySelectorAll(".qp-item").forEach(itemEl => {
            itemEl.onclick = (e) => {
              if (e.target.closest(".qp-item-del")) return;
              const idx = +itemEl.dataset.idx;
              queuePopover.classList.add("hidden");
              queueToggle.setAttribute("aria-expanded", "false");
              if (idx !== Q.cur) void openQueueItem(idx);
            };
          });

          itemsList.querySelectorAll(".qp-item-del").forEach(delBtn => {
            delBtn.onclick = (e) => {
              e.stopPropagation();
              const idx = +delBtn.dataset.del;
              removeQueueItem(idx);
            };
          });
        }

        queueToggle.onclick = (e) => {
          e.stopPropagation();
          const isHidden = queuePopover.classList.toggle("hidden");
          queueToggle.setAttribute("aria-expanded", !isHidden ? "true" : "false");
        };

        const btnQpExportAll = $("btnQpExportAll");
        if (btnQpExportAll) {
          btnQpExportAll.onclick = (e) => {
            e.stopPropagation();
            queuePopover.classList.add("hidden");
            queueToggle.setAttribute("aria-expanded", "false");
            $("menuExportQueueZip")?.click();
          };
        }

        if (queueSel) {
          queueSel.innerHTML = Q.items.map((it, idx) => {
            const rev = idx === Q.cur ? S.reviewed : !!(it.snap && it.snap.reviewed);
            return `<option value="${idx}" ${idx === Q.cur ? "selected" : ""}>${rev ? "✓ " : ""}${escAttr(it.name)}</option>`;
          }).join("");
          queueSel.onchange = (e) => {
            const idx = +e.target.value;
            if (idx !== Q.cur) void openQueueItem(idx);
          };
        }
      } else {
        queueWrap.classList.add("hidden");
        queuePopover.classList.add("hidden");
      }
    }

    const btnAddDoc = $("btnHeaderAddDoc");
    if (btnAddDoc) {
      btnAddDoc.onclick = pickFile;
      btnAddDoc.title = t.queueAddDoc || "Přidat další dokument do fronty";
    }

    const btnHdrClear = $("btnHeaderClear");
    if (btnHdrClear) {
      btnHdrClear.title = t.clear || "Zavřít dokument";
      btnHdrClear.setAttribute("aria-label", btnHdrClear.title);
      btnHdrClear.setAttribute("data-tip", btnHdrClear.title);
      btnHdrClear.onclick = () => openCloseDocModal();
    }

    const unseenCount = Math.max(0, S.hits.filter(h => !S.seen.has(h.id)).length);
    const pendingBadge = $("badgePendingFindings");
    if (pendingBadge) {
      pendingBadge.textContent = formatPlural(unseenCount, t.unreviewedCountPlural || t.unreviewedCount, S.lang);
    }

    const badge2nd = $("badgeSecondReviewer");
    if (badge2nd) {
      if (S.isSecondReviewMode || S.secondEyes) {
        badge2nd.classList.remove("hidden");
        const opName = S.firstOperator || (S.lang === "cs" ? "1. kontrola hotova" : "1st review done");
        badge2nd.innerHTML = `👁️ ${S.lang === "cs" ? "1. zpracovatel" : "1st reviewer"}: <strong>${esc(opName)}</strong>`;
      } else {
        badge2nd.classList.add("hidden");
      }
    }

    const chkRev = $("chkRev");
    if (chkRev) {
      chkRev.checked = !!S.reviewed;
      chkRev.onchange = async (e) => {
        if (e.target.checked && unseenCount > 0) {
          const confirmMsg = formatPlural(unseenCount, t.unseenConfirm, S.lang);
          const ok = await showConfirm(
            confirmMsg,
            S.lang === "cs" ? "Pokračovat" : "Continue",
            S.lang === "cs" ? "Zpět" : "Cancel"
          );
          if (!ok) {
            e.target.checked = false;
            return;
          }
        }
        S.reviewed = e.target.checked;
        paintReview();
      };
    }

    const chk2 = $("chk2");
    const lbl2 = $("lblHeaderSecondEyes");
    if (lbl2 && chk2) {
      lbl2.classList.toggle("hidden", !!S.fastApprove || !!S.quickMode);
      chk2.checked = !!S.secondEyes;
      chk2.onchange = (e) => {
        S.secondEyes = e.target.checked;
        if (!S.secondEyes && !S.isSecondReviewMode && S.filter === "secondReview") S.filter = "all";
        paintReview();
      };
    }

    const exportReady = !!(S.reviewed || reviewSkipped());
    const gateHint = $("exportGateHint");
    if (gateHint) {
      if (!exportReady) {
        gateHint.classList.remove("hidden");
        gateHint.textContent = t.exportLockedReason || (S.lang === "cs" ? "Nejprve zaškrtněte Zkontrolováno" : "Tick Reviewed first");
      } else {
        gateHint.classList.add("hidden");
        gateHint.textContent = "";
      }
    }

    const btnExp = $("btnExp");
    if (btnExp) {
      btnExp.disabled = !exportReady;
      btnExp.textContent = t.export;
      btnExp.setAttribute("data-tip", exportReady ? t.tips.export : t.tips.exportLocked);
      btnExp.onclick = () => openExport(false);
    }

    const btnExpToggle = $("btnExpMenuToggle");
    const expMenu = $("headerExportMenu");
    if (btnExpToggle && expMenu) {
      btnExpToggle.disabled = !exportReady;
      btnExpToggle.title = t.exportMenuToggle || (S.lang === "cs" ? "Další možnosti exportu" : "More export options");
      btnExpToggle.setAttribute("aria-label", btnExpToggle.title);
      btnExpToggle.onclick = (e) => {
        e.stopPropagation();
        const willOpen = expMenu.classList.contains("hidden");
        expMenu.classList.toggle("hidden", !willOpen);
        btnExpToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      };
    }

    if ($("lblExpGroupDoc")) $("lblExpGroupDoc").textContent = t.exportGroupDoc || t.lblExpGroupDoc || "Dokumentový výstup";
    if ($("lblExpGroupCollab")) $("lblExpGroupCollab").textContent = t.exportGroupHandoff || t.lblExpGroupCollab || "Předání a spolupráce";
    if ($("lblExpGroupAudit")) $("lblExpGroupAudit").textContent = t.exportGroupAudit || t.lblExpGroupAudit || "Audit a evidence";
    if ($("lblExportSession")) $("lblExportSession").textContent = t.exportSession || (S.lang === "cs" ? "Předat pro 4 oči (.znecitelne-session)" : "Save for 4-eyes review (.znecitelne-session)");
    if ($("lblExpSessionDesc")) $("lblExpSessionDesc").textContent = t.exportSessionDesc || "";
    if ($("lblExportAudit")) $("lblExportAudit").textContent = t.exportAudit || (S.lang === "cs" ? "Auditní protokol (JSON)" : "Audit log (JSON)");
    if ($("lblExpAuditDesc")) $("lblExpAuditDesc").textContent = t.exportAuditDesc || "";
    if ($("lblExportRecord")) $("lblExportRecord").textContent = t.exportRecord || (S.lang === "cs" ? "Protokol o anonymizaci (PDF)" : "Redaction record (PDF)");
    if ($("lblExpRecordDesc")) $("lblExpRecordDesc").textContent = t.exportRecordDesc || "";
    if ($("lblExportAi")) $("lblExportAi").textContent = t.aiPack || t.exportAiPack || "AI balíček (ZIP)";
    if ($("lblExpAiDesc")) $("lblExpAiDesc").textContent = t.exportAiDesc || "";








    const menuQueueZip = $("menuExportQueueZip");
    if (menuQueueZip) {
      if (Q.items.length > 1) {
        menuQueueZip.classList.remove("hidden");
        const lblQueue = $("lblMenuQueueZip");
        if (lblQueue) {
          lblQueue.textContent = t.queueExportReviewedZip || "Exportovat schválené z fronty (ZIP)";
        } else {
          menuQueueZip.textContent = t.queueExportReviewedZip || "Exportovat schválené z fronty (ZIP)";
        }
        menuQueueZip.onclick = () => {
          expMenu?.classList.add("hidden");
          btnExpToggle?.setAttribute("aria-expanded", "false");
          exportAllReviewed();
        };
      } else {
        menuQueueZip.classList.add("hidden");
      }
    }

    const menuAi = $("menuExportAi");
    if (menuAi) {
      menuAi.onclick = () => {
        expMenu?.classList.add("hidden");
        btnExpToggle?.setAttribute("aria-expanded", "false");
        openExport(true);
      };
    }

    const menuSession = $("menuExportSession");
    if (menuSession) {
      menuSession.onclick = async () => {
        expMenu?.classList.add("hidden");
        btnExpToggle?.setAttribute("aria-expanded", "false");
        await exportSessionPrompt();
      };
    }

    const menuAudit = $("menuExportAudit");
    if (menuAudit) {
      menuAudit.onclick = () => {
        expMenu?.classList.add("hidden");
        btnExpToggle?.setAttribute("aria-expanded", "false");
        download("znecitelne-audit.json", new Blob([JSON.stringify(buildAudit(), null, 2)], { type: "application/json" }));
      };
    }

    const menuRecord = $("menuExportRecord");
    if (menuRecord) {
      menuRecord.onclick = async () => {
        expMenu?.classList.add("hidden");
        btnExpToggle?.setAttribute("aria-expanded", "false");
        try {
          const bytes = await exportProtocolPdf();
          download((S.fileName || "document").replace(/\.[^.]+$/, "") + "-protokol.pdf", new Blob([bytes], { type: "application/pdf" }));
        } catch (e) {
          toast(e.message || String(e));
        }
      };
    }
  }

  function colLettersToIndex(letters) {
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
      idx = idx * 26 + (letters.charCodeAt(i) - 64);
    }
    return idx - 1;
  }
  function indexToColLetters(idx) {
    let str = "";
    let n = idx;
    while (n >= 0) {
      str = String.fromCharCode((n % 26) + 65) + str;
      n = Math.floor(n / 26) - 1;
    }
    return str;
  }

  function renderXlsxGrid(container, previewOn) {
    const t = i();
    const visHits = visibleHits(S.hits, S.selectedId);
    const replacer = bindReplacer(S.mode, S.lang, S.hits);

    const sheets = [];
    const seenSheets = new Set();
    (S.cellMap || []).forEach(c => {
      const s = c.sheet || "List 1";
      if (!seenSheets.has(s)) {
        seenSheets.add(s);
        sheets.push(s);
      }
    });

    if (!S.activeSheet || !seenSheets.has(S.activeSheet)) {
      S.activeSheet = sheets[0] || "List 1";
    }

    const currentCells = (S.cellMap || []).filter(c => (c.sheet || "List 1") === S.activeSheet);

    let minR = Infinity, maxR = -Infinity;
    let minC = Infinity, maxC = -Infinity;
    const gridMap = new Map();

    currentCells.forEach(cell => {
      const m = String(cell.ref || "").match(/^([A-Za-z]+)(\d+)$/);
      if (m) {
        const cLetters = m[1].toUpperCase();
        const rNum = parseInt(m[2], 10);
        const cIdx = colLettersToIndex(cLetters);
        if (rNum < minR) minR = rNum;
        if (rNum > maxR) maxR = rNum;
        if (cIdx < minC) minC = cIdx;
        if (cIdx > maxC) maxC = cIdx;
        gridMap.set(`${rNum},${cIdx}`, cell);
      }
    });

    if (!Number.isFinite(minR)) { minR = 1; maxR = 1; minC = 0; maxC = 0; }
    maxR = Math.min(maxR, minR + 500);
    maxC = Math.min(maxC, minC + 50);

    let tabsHtml = "";
    if (sheets.length > 1) {
      tabsHtml = `<div class="xlsx-sheet-tabs" role="tablist">` +
        sheets.map(s => `<button type="button" class="xlsx-sheet-tab-btn ${s === S.activeSheet ? 'active' : ''}" data-sheet="${escAttr(s)}">${esc(s)}</button>`).join("") +
        `</div>`;
    }

    let colsHtml = `<th class="xlsx-th-corner">#</th>`;
    for (let c = minC; c <= maxC; c++) {
      colsHtml += `<th class="xlsx-th-col">${indexToColLetters(c)}</th>`;
    }

    let rowsHtml = "";
    for (let r = minR; r <= maxR; r++) {
      let cellsInRow = `<td class="xlsx-td-row">${r}</td>`;
      for (let c = minC; c <= maxC; c++) {
        const cell = gridMap.get(`${r},${c}`);
        if (!cell) {
          cellsInRow += `<td class="xlsx-td-cell"></td>`;
        } else {
          const rawVal = S.text.slice(cell.start, cell.end);
          const cellHits = visHits.filter(h => h.start < cell.end && h.end > cell.start);
          if (!cellHits.length) {
            cellsInRow += `<td class="xlsx-td-cell" data-cell-start="${cell.start}" data-cell-end="${cell.end}" title="${escAttr(cell.ref)}: ${escAttr(rawVal)}">${esc(rawVal)}</td>`;
          } else {
            let cellContent = "";
            let cur = cell.start;
            cellHits.forEach(h => {
              if (h.start > cur) cellContent += esc(S.text.slice(cur, Math.min(h.start, cell.end)));
              const catName = (t.cats && t.cats[h.type]) || (LABEL[S.lang] && LABEL[S.lang][h.type]) || h.type;
              const tip = catName + " · " + hitEvidence(h, t, true);
              const cls = "mk " + (previewOn ? (h.accept ? "mk-preview" : "mk-off") : (h.accept ? "mk-on" : "mk-off")) + (S.selectedId === h.id ? " mk-sel" : "");
              const val = previewOn && h.accept ? replacer(h) : S.text.slice(Math.max(cell.start, h.start), Math.min(cell.end, h.end));
              cellContent += `<button type="button" class="${cls}" data-id="${h.id}" data-tip="${esc(tip)}">${esc(val)}</button>`;
              cur = Math.min(cell.end, h.end);
            });
            if (cur < cell.end) cellContent += esc(S.text.slice(cur, cell.end));
            cellsInRow += `<td class="xlsx-td-cell" data-cell-start="${cell.start}" data-cell-end="${cell.end}" title="${escAttr(cell.ref)}">${cellContent}</td>`;
          }
        }
      }
      rowsHtml += `<tr>${cellsInRow}</tr>`;
    }

    container.innerHTML = `
      ${tabsHtml}
      <div class="xlsx-table-container">
        <table class="xlsx-table">
          <thead><tr>${colsHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll(".xlsx-sheet-tab-btn").forEach(btn => {
      btn.onclick = () => {
        S.activeSheet = btn.dataset.sheet;
        renderXlsxGrid(container, previewOn);
      };
    });

    container.querySelectorAll("button.mk").forEach(b => {
      b.onclick = () => select(+b.dataset.id);
    });
  }

  function paintReview(){
    const t = i();
    let acceptedCount = 0;
    let acceptedSig = 0;
    for (let idx = 0; idx < S.hits.length; idx++) {
      const h = S.hits[idx];
      if (h.accept) {
        acceptedCount++;
        acceptedSig = (acceptedSig * 33 + (h.id || idx)) | 0;
      }
    }
    const cacheKey = `${S.text ? S.text.length : 0}_${S.mode}_${S.lang}_${!!S.processAnalysis}_${S.hits.length}_${acceptedCount}_${acceptedSig}`;
    let replaced, leftovers, leaks, red, proc;
    if (_reviewCache && _reviewCache.key === cacheKey && _reviewCache.text === S.text) {
      replaced = _reviewCache.replaced;
      leftovers = _reviewCache.leftovers;
      leaks = _reviewCache.leaks;
      red = _reviewCache.red;
      proc = _reviewCache.proc || { leaks: [] };
    } else {
      replaced = apply(S.text, S.hits, S.mode, S.lang);
      const eff = effectiveHits(S.hits);
      leftovers = eff.filter(h => h.value.length >= 5 && replaced.includes(h.value));
      proc = S.processAnalysis ? analyzeProcess(S.text, replaced, S.hits) : { leaks: [] };
      leaks = proc.leaks;
      red = acceptedCount;
      _reviewCache = {
        key: cacheKey,
        proc,
        text: S.text,
        replaced,
        leftovers,
        leaks,
        red
      };
    }
    let residualText = S.hits.length ? (leftovers.length?t.residual:t.residualOk) : t.noHits;
    let residualClass = leftovers.length ? "danger" : "ok";
    if (leaks.length && !leftovers.length) {
      residualClass = "danger";
      residualText = t.leakBad;
    }
    const residualEl = $("residual");
    if (residualEl) {
      residualEl.className = residualClass + " hidden";
      residualEl.textContent = residualText;
    }
    const scanWarn = $("scanWarn");
    if (S.noTextPages) {
      scanWarn.classList.remove("hidden");
      scanWarn.textContent = formatPlural(S.noTextPages, t.scanWarningPlural || t.scanWarning, S.lang);
    } else {
      scanWarn.classList.add("hidden");
      scanWarn.textContent = "";
    }
    const sigWarn = $("sigWarn");
    if (S.kind === "pdf" && S.sigDetected) { sigWarn.classList.remove("hidden"); sigWarn.textContent = "⚠ " + t.sigWarning; }
    else { sigWarn.classList.add("hidden"); sigWarn.textContent = ""; }

    paintSmartBanners(leftovers, leaks, t);
    paintWorkBar(red, S.hits.length, t);

    const previewOn = S.docView === "preview";
    if ($("lblOrig")) $("lblOrig").textContent = previewOn ? t.previewChanges : t.original;
    if ($("btnAdd")) {
      $("btnAdd").textContent = t.addSelection;
      $("btnAdd").setAttribute("data-tip", t.tips.addSelection);
    }

    const isXlsx = S.kind === "xlsx" && S.cellMap && S.cellMap.length > 0;
    const xlsxGrid = $("xlsxGrid");
    const origPre = $("orig");

    if (isXlsx && xlsxGrid && origPre) {
      origPre.classList.add("hidden");
      xlsxGrid.classList.remove("hidden");
      renderXlsxGrid(xlsxGrid, previewOn);
    } else if (origPre) {
      origPre.classList.remove("hidden");
      if (xlsxGrid) xlsxGrid.classList.add("hidden");
      origPre.innerHTML = previewOn ? previewHTML() : origHTML();
      origPre.querySelectorAll("button.mk").forEach(b => b.onclick = () => select(+b.dataset.id));
    }
    paintPdfVisual();

    // Segmented document view controls
    const btnOrig = $("btnViewOrig");
    const btnPrev = $("btnViewPreview");
    const btnVis = $("btnVisual");
    if (btnOrig) {
      const isSel = !previewOn && !S.pdfVisual;
      btnOrig.textContent = S.lang === "cs" ? "Původní text" : "Original text";
      btnOrig.classList.toggle("on", isSel);
      btnOrig.setAttribute("aria-pressed", isSel ? "true" : "false");
      btnOrig.onclick = () => {
        if (S.pdfVisual) S.pdfVisual = false;
        setDocView("original");
      };
    }
    if (btnPrev) {
      const isSel = previewOn && !S.pdfVisual;
      btnPrev.textContent = S.lang === "cs" ? "Náhled změn" : "Preview changes";
      btnPrev.classList.toggle("on", isSel);
      btnPrev.setAttribute("aria-pressed", isSel ? "true" : "false");
      btnPrev.onclick = () => {
        if (S.pdfVisual) S.pdfVisual = false;
        setDocView("preview");
      };
    }
    if (btnVis) {
      btnVis.classList.toggle("on", !!S.pdfVisual);
      btnVis.setAttribute("aria-pressed", S.pdfVisual ? "true" : "false");
    }

    // View mode: entities vs individual hits
    const isEntities = S.viewMode !== "hits";
    const btnModeEnt = $("btnModeEntities");
    const btnModeH = $("btnModeHits");
    if (btnModeEnt) {
      btnModeEnt.classList.toggle("on", isEntities);
      btnModeEnt.textContent = t.viewEntities || (S.lang === "cs" ? "Entitní přehled" : "Entity view");
      if (btnModeH) btnModeH.textContent = t.viewHits || (S.lang === "cs" ? "Jednotlivé nálezy" : "Individual findings");
      if ($("btnAll")) $("btnAll").textContent = t.acceptAll;
      if ($("btnOff")) $("btnOff").textContent = t.keepOfficials;
      if ($("btnNone")) $("btnNone").textContent = t.rejectAll;
      if ($("lblMedia")) $("lblMedia").textContent = S.lang === "cs" ? "Obrázky a podpisy" : "Images & signatures";
      btnModeEnt.setAttribute("aria-pressed", isEntities ? "true" : "false");
      btnModeEnt.onclick = () => {
        S.viewMode = "entities";
        try { localStorage.setItem("znec-viewmode", "entities"); } catch (_) {}
        paintReview();
      };
    }
    if (btnModeH) {
      btnModeH.classList.toggle("on", !isEntities);
      btnModeH.setAttribute("aria-pressed", !isEntities ? "true" : "false");
      btnModeH.onclick = () => {
        S.viewMode = "hits";
        try { localStorage.setItem("znec-viewmode", "hits"); } catch (_) {}
        paintReview();
      };
    }
    if ($("entityList")) $("entityList").classList.toggle("hidden", !isEntities);
    if ($("hitList")) $("hitList").classList.toggle("hidden", isEntities);

    if ($("lblFiltersAside")) $("lblFiltersAside").textContent = t.lblFiltersAside || (S.lang === "cs" ? "Filtrovat zobrazení" : "Filter view");
    if ($("lblBulkAside")) $("lblBulkAside").textContent = t.lblBulkAside || (S.lang === "cs" ? "Hromadné akce" : "Bulk actions");
    if ($("shortcutHint")) $("shortcutHint").innerHTML = `<span><kbd>J</kbd>/<kbd>K</kbd> ${S.lang === "cs" ? "další" : "next"} · <kbd>R</kbd> ${S.lang === "cs" ? "anonymizovat" : "redact"} · <kbd>P</kbd> ${S.lang === "cs" ? "ponechat" : "keep"} · <kbd>F</kbd> ${S.lang === "cs" ? "celá obrazovka" : "fullscreen"}</span>`;

    const filterKeys = (S.isSecondReviewMode || S.secondEyes)
      ? ["all", "secondReview", "redact", "keep"]
      : ["all", "redact", "keep"];
    $("filters").innerHTML = filterKeys.map(f => {
      let label = t.filterAll;
      if (f === "secondReview") label = t.filterSecondReview || (S.lang === "cs" ? "Ruční změny a výjimky" : "Manual & Exceptions");
      else if (f === "redact") label = t.filterRedact;
      else if (f === "keep") label = t.filterKeep;
      return `<button type="button" class="chip ${S.filter===f?"on":""}" data-f="${f}" aria-pressed="${S.filter===f}">${label}</button>`;
    }).join("");
    $("filters").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { S.filter = b.dataset.f; paintReview(); });

    if (isEntities) {
      paintEntities(groupHitsIntoEntities(S.hits), t);
    }

    const list = filtered();
    $("hitList").innerHTML = list.map(h => {
      const catName = (t.cats && t.cats[h.type]) || (LABEL[S.lang] && LABEL[S.lang][h.type]) || h.type;
      return `<button type="button" class="hit ${S.selectedId===h.id?"sel":""}" data-id="${h.id}">
      <span class="mono" style="width:24px;color:var(--muted)">${h.id}</span>
      <span style="flex:1;min-width:0"><span class="wrap-line" style="font-size:12px;color:var(--muted)">${catName} · ${hitEvidence(h,t,S.expertMode)}</span><span class="hit-value mono">${esc(h.value)}</span></span>
      <span class="pill ${h.accept?"pill-hit":"pill-ok"}"><span class="pill-label">${h.accept ? "🔒 " + esc(t.redact) : "✓ " + esc(t.keep)}</span><span class="pill-ghost" aria-hidden="true">${h.accept ? "✓ " + esc(t.keep) : "🔒 " + esc(t.redact)}</span></span>
    </button>`;
    }).join("");
    $("hitList").querySelectorAll(".hit").forEach(b => b.onclick = () => select(+b.dataset.id));

    const sel = S.hits.find(h => h.id===S.selectedId);
    if (sel) {
      const adjacentHits = S.hits.filter(h => h.id !== sel.id && (Math.abs(h.start - sel.end) <= 4 || Math.abs(sel.start - h.end) <= 4));
      const a = Math.max(0, sel.start-42), b = Math.min(S.text.length, sel.end+42);
      const snip = (a>0?"…":"")+S.text.slice(a,b)+(b<S.text.length?"…":"");
      $("inspector").innerHTML = `<p class="lbl">${t.selected}</p><p class="insp-marquee mono">${esc(sel.value)}</p>
        <p class="lbl">${t.context}</p><p class="wrap-line mono" style="color:var(--muted)">${esc(snip)}</p>
        <p class="layer-note">${esc(hitEvidence(sel,t,S.expertMode))}${(S.expertMode && sel.entityKey)?" · "+esc(sel.entityKey):""}</p>
        <label class="lbl" for="selLegal" data-tip="${escAttr(t.legalTip)}">${t.legalLabel}</label>
        <select id="selLegal" data-tip="${escAttr(t.legalTip)}">${Object.entries(t.legalOpts).map(([k,v])=>`<option value="${k}" ${legalOf(sel)===k?"selected":""}>${v}</option>`).join("")}</select>
        <input type="text" id="inLegal" class="${legalOf(sel)==="custom"?"":"hidden"}" value="${esc(sel.legalCustom||"")}" placeholder="${escAttr(t.legalCustomPh)}" style="margin-top:6px" />
        <div class="btn-pair">
          <button class="btn btn-sm" id="btnR" data-tip="${t.redact} · R">${t.redact}</button>
          <button class="btn btn-sm btn-sec" id="btnK" data-tip="${t.keep} · P">${t.keep}</button>
        </div>
        ${adjacentHits.length > 0 ? `<button type="button" class="btn btn-sm btn-ghost" id="btnToggleGroup" style="width:100%;margin-top:6px">${S.lang==='cs'?'👥 Schválit/vyřadit skupinu':'👥 Toggle group'}</button>` : ""}
        ${sel.type === "name" ? `<button type="button" class="btn btn-sm btn-sec" id="btnMorphExpand" style="width:100%;margin-top:8px" data-tip="${escAttr(t.morphTip)}">🔍 ${esc(t.morphBtn)}</button>` : ""}`;
      $("btnR").onclick = () => patch(sel.id, true); $("btnK").onclick = () => patch(sel.id, false);
      if ($("btnToggleGroup")) {
        $("btnToggleGroup").onclick = () => {
          const nextAccept = !sel.accept;
          patch(sel.id, nextAccept);
          adjacentHits.forEach(ah => patch(ah.id, nextAccept));
        };
      }
      $("selLegal").onchange = (e) => {
        const val = e.target.value;
        sel.legalBasis = val;
        if (sel.entityKey) {
          S.hits.forEach(h => {
            if (h.entityKey === sel.entityKey) h.legalBasis = val;
          });
        }
        paintReview();
      };
      $("inLegal").oninput = (e) => {
        const val = e.target.value;
        sel.legalCustom = val;
        if (sel.entityKey) {
          S.hits.forEach(h => {
            if (h.entityKey === sel.entityKey) h.legalCustom = val;
          });
        }
      };
      if ($("btnMorphExpand")) {
        $("btnMorphExpand").onclick = () => {
          const beforeCount = S.hits.length;
          expandCzechNameMorphology(S.text, S.hits, sel);
          const added = S.hits.length - beforeCount;
          toast(formatPlural(added, t.morphToastPlural || t.morphToast, S.lang));
          paintReview();
        };
      }

    } else $("inspector").innerHTML = "";
    paintQuickHitBar(sel, t);
    if ($("lblProc")) $("lblProc").textContent = t.processTitle;
    if ($("processPane")) $("processPane").classList.toggle("hidden", !S.processAnalysis);
    if ($("processBox") && S.processAnalysis) $("processBox").innerHTML = processHTML(proc);
    if ($("mediaPane") && $("mediaBox")) {
      const hasSig = !!S.sigDetected;
      let docxMediaCount = 0;
      const flateLib = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
      if (S.kind === "docx" && S.sourceBuf && flateLib) {
        try {
          const files = window.fflate.unzipSync(new Uint8Array(S.sourceBuf.slice(0)));
          docxMediaCount = Object.keys(files).filter(k => /^word\/(?:media|embeddings)\//i.test(k)).length;
        } catch (_) {}
      }
      const showMedia = hasSig || docxMediaCount > 0;
      $("mediaPane").classList.toggle("hidden", !showMedia);
      if (showMedia) {
        let mediaHtml = "";
        if (hasSig) {
          mediaHtml += `<div style="background:var(--bg-subtle);padding:6px 8px;border-radius:4px;border-left:3px solid var(--accent)">
            <strong>${S.lang === 'cs' ? 'Digitální podpis / certifikát' : 'Digital signature / certificate'}</strong>
            <p style="margin:2px 0 0;color:var(--muted)">${S.lang === 'cs' ? 'V dokumentu byl detekován podpis. Při exportu bude v souladu s bezpečnostní politikou odstraněn.' : 'Signature detected. Will be stripped upon export per security policy.'}</p>
          </div>`;
        }
        if (docxMediaCount > 0) {
          mediaHtml += `<div style="background:var(--bg-subtle);padding:6px 8px;border-radius:4px;border-left:3px solid var(--accent)">
            <strong>${S.lang === 'cs' ? 'Vložené objekty a média' : 'Embedded objects & media'} (${docxMediaCount})</strong>
            <p style="margin:2px 0 0;color:var(--muted)">${S.lang === 'cs' ? 'Detekovány vložené obrázky. Odstraňují se pro zamezení úniku naskenovaných podpisů či razítek.' : 'Embedded images detected. Stripped to prevent graphic signature or stamp leakage.'}</p>
          </div>`;
        }
        $("mediaBox").innerHTML = mediaHtml;
      }
    }
    const exportReady = !!(S.reviewed || reviewSkipped());

    // Bulk actions
    const doAll = () => {
      S._bulkUndoState = S.hits.map(h => ({ id: h.id, accept: h.accept }));
      S.hits.forEach(h => { h.accept = true; });
      toast(t.bulkUndoToast || (S.lang === "cs" ? "Akci lze vrátit tlačítkem Zpět." : "You can undo this with the Undo button."));
      paintReview();
    };
    const doNone = async () => {
      if (S.hits.some(h => h.accept)) {
        const ok = await showConfirm(
          t.bulkConfirmNone || (S.lang === "cs" ? "Opravdu chcete ponechat všechny nálezy (zrušit veškeré začernění)?" : "Keep all findings (clear all redactions)?"),
          S.lang === "cs" ? "Ponechat vše" : "Keep all",
          S.lang === "cs" ? "Zpět" : "Cancel"
        );
        if (!ok) return;
      }
      S._bulkUndoState = S.hits.map(h => ({ id: h.id, accept: h.accept }));
      S.hits.forEach(h => { h.accept = false; });
      toast(t.bulkUndoToast || (S.lang === "cs" ? "Akci lze vrátit tlačítkem Zpět." : "You can undo this with the Undo button."));
      paintReview();
    };
    const doOff = () => {
      S._bulkUndoState = S.hits.map(h => ({ id: h.id, accept: h.accept }));
      S.hits.forEach(h => {
        const around = S.text.slice(Math.max(0,h.start-80), h.end+20);
        if (isPublic(h.value) || isPublic(around) || (h.type==="ico" && /státní podnik|ministerstvo|úřad|správa|republik/i.test(around))) h.accept = false;
      });
      toast(t.bulkUndoToast || (S.lang === "cs" ? "Akci lze vrátit tlačítkem Zpět." : "You can undo this with the Undo button."));
      paintReview();
    };

    if ($("btnAll")) $("btnAll").onclick = doAll;
    if ($("btnNone")) $("btnNone").onclick = doNone;
    if ($("btnOff")) $("btnOff").onclick = doOff;

    const btnBulkUndo = $("btnBulkUndo");
    if (btnBulkUndo) {
      btnBulkUndo.classList.toggle("hidden", !S._bulkUndoState);
      btnBulkUndo.textContent = t.undoBtn || (S.lang === "cs" ? "↶ Zpět" : "↶ Undo");
      btnBulkUndo.onclick = () => {
        if (S._bulkUndoState) {
          const map = new Map(S._bulkUndoState.map(x => [x.id, x.accept]));
          S.hits.forEach(h => {
            if (map.has(h.id)) h.accept = map.get(h.id);
          });
          S._bulkUndoState = null;
          toast(t.bulkReverted || (S.lang === "cs" ? "Hromadná akce byla vrácena." : "Bulk action reverted."));
          paintReview();
        }
      };
    }

    bindTips();
    requestAnimationFrame(updateBarHeightVar);
  }
  function scrollChildIntoContainer(container, child, margin = 8) {
    if (!container || !child) return;
    const cRect = container.getBoundingClientRect();
    const chRect = child.getBoundingClientRect();
    if (chRect.top < cRect.top) {
      container.scrollTop -= (cRect.top - chRect.top) + margin;
    } else if (chRect.bottom > cRect.bottom) {
      container.scrollTop += (chRect.bottom - cRect.bottom) + margin;
    }
  }
  function select(id){
    S.selectedId = id; S.seen.add(id);
    if (id != null && S.kind === "xlsx" && S.cellMap && S.cellMap.length > 0 && !S.pdfVisual) {
      const hitObj = S.hits.find(x => x.id === id);
      if (hitObj) {
        const hitCell = S.cellMap.find(c => hitObj.start < c.end && hitObj.end > c.start);
        if (hitCell && hitCell.sheet && S.activeSheet !== hitCell.sheet) {
          S.activeSheet = hitCell.sheet;
        }
      }
    }
    paintReview();
    const isXlsxDoc = S.kind === "xlsx" && S.cellMap && S.cellMap.length > 0 && !S.pdfVisual;
    const docHost = S.pdfVisual ? $("pdfVisual") : (isXlsxDoc ? $("xlsxGrid") : $("orig"));
    const el = docHost ? docHost.querySelector(`[data-id="${id}"]`) : null;
    if (el) el.scrollIntoView({ block:"center", behavior:"smooth" });
    const asideItem = $("entityList")?.querySelector(".entity-card.sel") || $("hitList")?.querySelector(".hit.sel");
    const asideList = $("entityList")?.classList.contains("hidden") ? $("hitList") : $("entityList");
    if (asideList && asideItem) {
      scrollChildIntoContainer(asideList, asideItem, 6);
    }
    const insp = $("inspector");
    const aside = $("reviewAside");
    if (insp && aside && !insp.classList.contains("hidden") && S.selectedId) {
      scrollChildIntoContainer(aside, insp, 16);
    }
  }
  function patch(id, accept){ const h = S.hits.find(x=>x.id===id); if (h) { h.accept = accept; h.userModified = true; } S.seen.add(id); paintReview(); }
  function selectNextHit(){
    const list = filtered();
    if (!list.length) return;
    const idx = list.findIndex(h => h.id===S.selectedId);
    const n = list[(idx<0?0:idx+1)%list.length];
    if (n) select(n.id);
  }
  function selectPrevHit(){
    const list = filtered();
    if (!list.length) return;
    const idx = list.findIndex(h => h.id===S.selectedId);
    const n = list[(idx<0?0:idx-1+list.length)%list.length];
    if (n) select(n.id);
  }
  function paintQuickHitBar(sel, t){
    const box = $("quickHitBar");
    if (!box) return;
    document.body.classList.toggle("hit-selected", !!(S.quickMode && sel));
    if (!S.quickMode || !sel) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    const catName = (t.cats && t.cats[sel.type]) || (LABEL[S.lang] && LABEL[S.lang][sel.type]) || sel.type;
    box.classList.remove("hidden");
    box.innerHTML = `<div class="qh-inner">
      <div class="qh-val"><span class="qh-label">${esc(catName)}</span><span class="qh-text">${esc(sel.value)}</span></div>
      <div class="qh-actions">
        <button class="btn btn-sm" id="qhR" data-tip="${t.redact} · R">${t.redact}</button>
        <button class="btn btn-sm btn-sec" id="qhK" data-tip="${t.keep} · P">${t.keep}</button>
        <span class="qh-navs">
          <button class="btn btn-sm qh-nav" id="qhPrev" data-tip="${t.kbdPrev}" aria-label="${esc(t.kbdPrev)}"><span class="qh-arrow" aria-hidden="true">←</span></button>
          <button class="btn btn-sm qh-nav" id="qhNext" data-tip="${t.kbdNext}" aria-label="${esc(t.kbdNext)}"><span class="qh-arrow" aria-hidden="true">→</span></button>
        </span>
      </div>
    </div>`;
    $("qhR").onclick = () => patch(sel.id, true);
    $("qhK").onclick = () => patch(sel.id, false);
    $("qhPrev").onclick = selectPrevHit;
    $("qhNext").onclick = selectNextHit;
    bindTips();
    requestAnimationFrame(updateBarHeightVar);
  }
  function applyBarPos(){
    const qbar = $("quickHitBar");
    if (qbar) qbar.setAttribute("data-pos", "bottom");
    updateHeaderHeightVar();
    updateBarHeightVar();
  }
  function updateHeaderHeightVar(){
    const hdr = document.querySelector("header.app");
    const h = hdr ? Math.ceil(hdr.getBoundingClientRect().height) : 60;
    document.documentElement.style.setProperty("--hdr-h", h+"px");
  }
  function updateBarHeightVar(){
    document.documentElement.style.setProperty("--export-bar-h", "0px");
    const qbar = $("quickHitBar");
    const showingQuick = S.quickMode && qbar && !qbar.classList.contains("hidden") && document.body.classList.contains("hit-selected");
    const total = showingQuick ? Math.ceil(qbar.getBoundingClientRect().height) + 8 : 0;
    document.documentElement.style.setProperty("--bar-h", Math.max(total, 0)+"px");
  }
  function paint(){
    document.documentElement.lang = S.lang;
    applyQuickMode();
    applyFastApprove();
    paintLanding();
    applyBarPos();
    const hasDoc = !!(S.text || (S.kind === "pdf" && S.sourceBuf));
    if (hasDoc) {
      $("landing").classList.add("hidden");
      $("review").classList.remove("hidden");
      paintReview();
    } else {
      $("landing").classList.remove("hidden");
      $("review").classList.add("hidden");
      $("quickHitBar").classList.add("hidden");
      $("quickHitBar").innerHTML = "";
      document.body.classList.remove("hit-selected");
      paintWorkBar(0, 0, i());
    }
    renderQueue();
  }
  function secretList(){ return S.secrets.split("\n").map(s=>s.trim()).filter(Boolean); }
  function runAnalyze(text, opts){
    const src = text ?? S.text;
    const prev = Array.isArray(S.hits) ? S.hits : [];
    const contextBefore = S.analysisContext || "";
    const contextNow = analysisContextKey();
    const canReusePrevious = contextBefore === contextNow && contextBefore !== "";
    const previousForReuse = canReusePrevious ? prev : [];
    const fresh = detect(src, S.enabled, secretList());
    const bySpan = new Map(previousForReuse.map(h => [h.type+"|"+h.start+"|"+h.end+"|"+h.value, h]));
    const byVal = new Map();

    previousForReuse.forEach(h => {
      const k = h.type+"|"+h.value.toLocaleLowerCase("cs");
      if (!byVal.has(k)) byVal.set(k, h);
    });

    S.hits = fresh.map(h => {
      const exact = bySpan.get(h.type+"|"+h.start+"|"+h.end+"|"+h.value);
      const loose = byVal.get(h.type+"|"+h.value.toLocaleLowerCase("cs"));

      if (exact) h.accept = exact.accept;
      else if (loose) h.accept = loose.accept;

      const prevHit = exact || loose;
      if (prevHit) {
        if (prevHit.legalBasis) h.legalBasis = prevHit.legalBasis;
        if (prevHit.legalCustom) h.legalCustom = prevHit.legalCustom;
      }
      return h;
    });

    const sameSet =
      canReusePrevious &&
      previousForReuse.length === S.hits.length &&
      S.hits.every(h =>
        bySpan.has(h.type+"|"+h.start+"|"+h.end+"|"+h.value)
      );

    S.selectedId = S.hits.some(h => h.id === S.selectedId)
      ? S.selectedId
      : (S.hits[0] ? S.hits[0].id : null);

    if (!sameSet) {
      S.seen = new Set(S.selectedId ? [S.selectedId] : []);
    }

    if (!sameSet && !(opts && opts.keepReview)) {
      S.reviewed = false;
      S.secondEyes = false;
    }

    S.analysisContext = contextNow;
    paint();
  }

async function onFile(file){
    $("errLand").classList.add("hidden");
    $("errLand").textContent = "";
    if (file && (file.name.endsWith(".znecitelne-session") || file.name.endsWith(".json"))) {
      try {
        const text = await (file.text ? file.text() : new TextDecoder().decode(file.buffer ? new Uint8Array(file.buffer) : toBytes(file)));
        if (text.includes('"format": "znecitelne-session"') || text.includes('"format":"znecitelne-session"')) {
          const pwd = prompt(S.lang === "cs" ? "Zadejte heslo pro otevření šifrovaného sezení:" : "Enter password to decrypt session:");
          if (!pwd) return false;
          const sessionData = await importSession(text, pwd);
          S.fileName = sessionData.doc.fileName;
          S.kind = sessionData.doc.kind;
          S.text = sessionData.doc.text;
          S.pages = Array.isArray(sessionData.doc.pages) && sessionData.doc.pages.length && typeof sessionData.doc.pages[0] === "object"
            ? sessionData.doc.pages
            : [{ n: 1, start: 0, end: (sessionData.doc.text || "").length }];
          S.noTextPages = sessionData.doc.noTextPages || 0;
          S.hashIn = sessionData.doc.hashIn || "";
          S.reviewed = sessionData.doc.reviewed ?? true;
          S.secondEyes = true;
          S.isSecondReviewMode = true;
          S.firstOperator = sessionData.operator || "";
          S.filter = "secondReview";
          S.cellMap = sessionData.doc.cellMap || [];
          S.sigDetected = !!sessionData.doc.sigDetected;
          S.hits = sessionData.hits || [];
          S.seen = new Set(sessionData.seen || []);
          if (sessionData.profile) S.profile = sessionData.profile;
          if (sessionData.replaceMode || sessionData.mode) S.mode = sessionData.replaceMode || sessionData.mode;
          if (sessionData.lang) S.lang = sessionData.lang;
          if (sessionData.legalReason) S.legalReason = sessionData.legalReason;
          S.sourceBuf = sessionData.doc.sourceBuf || null;
          S.activeSheet = (S.cellMap && S.cellMap.length > 0) ? (S.cellMap[0].sheet || "List 1") : null;
          S.selectedId = S.hits[0] ? S.hits[0].id : null;
          clearPdfVisual();
          Q.items = [{ name: S.fileName || file.name, file, doc: null, snap: snapState() }];
          Q.cur = 0;
          paint();
          toast(S.lang === "cs" ? "Sezení bylo úspěšně načteno pro druhou kontrolu." : "Session loaded for second-eye review.");
          return true;
        }
      } catch (err) {
        const msg = (S.lang === "cs" ? "Chyba dešifrování sezení: " : "Session decryption error: ") + (err.message || String(err));
        $("errLand").textContent = msg;
        $("errLand").classList.remove("hidden");
        toast(msg);
        return false;
      }
    }
    try {
      const doc = await ingestDocument(file, {
        ocrEnabled: S.ocrEnabled,
        lang: S.lang,
        onProgress: showOcrProgress
      });
      applyDocumentToState(doc);
      return true;
    } catch (e) {
      const msg = localizeIngestError(e, file ? file.name : "");
      $("errLand").textContent = msg;
      $("errLand").classList.remove("hidden");
      toast(msg);
      return false;
    }
  }
  const Q = { items: [], cur: -1 };
  let QUEUE_LOAD_GENERATION = 0;
  const SNAP_KEYS = ["fileName","kind","text","sourceBuf","pages","noTextPages","cellMap","activeSheet","hashIn","hashOut","hits","reviewed","secondEyes","isSecondReviewMode","firstOperator","selectedId","filter","seen","sigDetected","analysisContext","settings"];
  const SNAP_SETTING_KEYS = ["profile","mode","suspicion","enabled","secrets","systems","projects","orgs","stripMeta","pdfaDecl","includeOutline","publicGlossary","truePdfRedact","ocrEnabled","expertMode","processAnalysis","quickMode","fastApprove","barPos"];

  function snapshotSettings(){
    const out = {};
    SNAP_SETTING_KEYS.forEach(k => {
      if (k === "enabled") out[k] = { ...(S.enabled || {}) };
      else out[k] = S[k];
    });
    return out;
  }

  function restoreSettingsSnapshot(snapshot){
    if (!snapshot) return;
    SNAP_SETTING_KEYS.forEach(k => {
      if (k === "enabled") S.enabled = { ...(snapshot.enabled || {}) };
      else if (Object.prototype.hasOwnProperty.call(snapshot, k)) S[k] = snapshot[k];
    });
    applyQuickMode();
    applyFastApprove();
    applyBarPos();
    syncSettingsForms();
  }

  function analysisContextKey(){
    return [
      S.hashIn || "",
      S.profile || "",
      S.mode || "",
      S.suspicion || "",
      JSON.stringify(S.enabled || {}),
      S.secrets || "",
      S.systems || "",
      S.projects || "",
      S.orgs || ""
    ].join("\u001f");
  }

  const snapState = () => {
    const o = {};
    SNAP_KEYS.forEach(k => {
      if (k === "hits") o[k] = Array.isArray(S[k]) ? S[k].map(h => ({ ...h })) : [];
      else if (k === "pages") o[k] = Array.isArray(S[k]) ? S[k].map(pg => ({ ...pg })) : [];
      else if (k === "cellMap") o[k] = Array.isArray(S[k]) ? S[k].map(cell => ({ ...cell })) : [];
      else if (k === "seen") o[k] = new Set(S[k] || []);
      else if (k === "sourceBuf" && S[k] && typeof S[k].slice === "function") o[k] = S[k].slice(0);
      else if (k === "settings") o[k] = snapshotSettings();
      else o[k] = S[k];
    });
    o.analysisContext = S.analysisContext || analysisContextKey();
    return o;
  };

  const restoreState = (o) => {
    if (!o) return;
    SNAP_KEYS.forEach(k => {
      if (k === "hits") S[k] = Array.isArray(o[k]) ? o[k].map(h => ({ ...h })) : [];
      else if (k === "pages") S[k] = Array.isArray(o[k]) ? o[k].map(pg => ({ ...pg })) : [];
      else if (k === "cellMap") S[k] = Array.isArray(o[k]) ? o[k].map(cell => ({ ...cell })) : [];
      else if (k === "seen") S[k] = new Set(o[k] || []);
      else if (k === "sourceBuf" && o[k] && typeof o[k].slice === "function") S[k] = o[k].slice(0);
      else if (k !== "settings") S[k] = o[k];
    });
    restoreSettingsSnapshot(o.settings);
    S.analysisContext = o.analysisContext || analysisContextKey();
  };

  function saveCurrent(){
    if (Q.cur >= 0 && Q.items[Q.cur] && (S.text || (S.kind === "pdf" && S.sourceBuf))) {
      Q.items[Q.cur].snap = snapState();
    }
  }

  async function onFiles(list){
    const files = Array.from(list || []);
    if (!files.length || S.movie) return;
    const sessionFile = files.find(f => f && (f.name.endsWith(".znecitelne-session") || f.name.endsWith(".json")));
    if (files.length === 1 && sessionFile) {
      try {
        const rawText = await (sessionFile.text ? sessionFile.text() : new TextDecoder().decode(sessionFile.buffer ? new Uint8Array(sessionFile.buffer) : toBytes(sessionFile)));
        if (rawText.includes('"format": "znecitelne-session"') || rawText.includes('"format":"znecitelne-session"')) {
          await onFile(sessionFile);
          return;
        }
      } catch (_) {}
    }
    QUEUE_LOAD_GENERATION++;
    saveCurrent();
    const start = Q.items.length;

    const results = await ingestDocumentBatch(files, {
      ocrEnabled: S.ocrEnabled,
      lang: S.lang,
      onProgress: showOcrProgress
    });

    let added = 0;
    for (let idx = 0; idx < results.length; idx++) {
      const res = results[idx];
      const origFile = files[idx];
      if (res.ok) {
        Q.items.push({ name: res.fileName, file: origFile, doc: res.doc, snap: null });
        added++;
      } else {
        const msg = localizeIngestError(res.error, res.fileName);
        toast(msg);
      }
    }

    if (added > 0) {
      await openQueueItem(start);
    } else if (!Q.items.length) {
      paintLanding();
    } else {
      renderQueue();
    }
  }

  function removeQueueItem(idx){
    if (idx < 0 || idx >= Q.items.length) return;
    saveCurrent();
    const isCur = idx === Q.cur;
    Q.items.splice(idx, 1);
    if (!Q.items.length) {
      reset();
      return;
    }
    if (isCur) {
      Q.cur = -1;
      const nextIdx = Math.min(idx, Q.items.length - 1);
      void openQueueItem(nextIdx);
    } else {
      if (Q.cur > idx) Q.cur--;
      renderQueue();
    }
  }

  async function openQueueItem(idx){
    const generation = ++QUEUE_LOAD_GENERATION;
    const it = Q.items[idx];
    if (!it) return;

    saveCurrent();
    const prevItem = Q.items[Q.cur] || null;
    Q.cur = idx;
    clearPdfVisual();

    if (it.snap) {
      if (generation !== QUEUE_LOAD_GENERATION || Q.items[idx] !== it) return;
      restoreState(it.snap);
      paint();
      return;
    }

    let ok = false;
    if (it.doc) {
      applyDocumentToState(it.doc);
      ok = true;
    } else {
      try {
        ok = await onFile(it.file);
      } catch (_) {
        ok = false;
      }
    }

    if (generation !== QUEUE_LOAD_GENERATION || Q.items[idx] !== it || Q.cur !== idx) {
      return;
    }

    if (ok && (S.text || (S.kind === "pdf" && S.sourceBuf))) {
      it.snap = snapState();
      return;
    }

    const failedIndex = Q.items.indexOf(it);
    if (failedIndex >= 0) Q.items.splice(failedIndex, 1);
    Q.cur = -1;

    if (prevItem && Q.items.includes(prevItem) && prevItem.snap) {
      const backIndex = Q.items.indexOf(prevItem);
      Q.cur = backIndex;
      restoreState(prevItem.snap);
      paint();
      return;
    }

    if (Q.items.length > 0) {
      const nextIdx = Math.min(Math.max(0, failedIndex), Q.items.length - 1);
      await openQueueItem(nextIdx);
      return;
    }

    reset();
  }

  function renderQueue(){
    const bar = $("queueBar");
    if (!bar) return;
    if (Q.items.length < 2) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      return;
    }
    const t = i();
    const chips = Q.items.map((it, n) => {
      const rev = n === Q.cur ? S.reviewed : !!(it.snap && it.snap.reviewed);
      return `<span class="qchip-wrap"><button type="button" class="btn btn-sm btn-sec qchip${n===Q.cur?" active":""}" data-q="${n}" title="${escAttr(it.name)}" aria-pressed="${n===Q.cur}">${rev?"✓ ":""}${esc(it.name)}</button><button type="button" class="qchip-del" data-qdel="${n}" title="${escAttr(t.queueRemove || 'Odebrat')}" aria-label="${escAttr(t.queueRemove || 'Odebrat')}">×</button></span>`;
    }).join("");
    bar.innerHTML = `<span style="font-size:13px;color:var(--muted)">${t.queueLbl}:</span>${chips}<button type="button" class="btn btn-sm" id="qAll">${t.queueAll}</button>`;
    bar.classList.remove("hidden");
    bar.querySelectorAll("[data-q]").forEach(b => {
      b.onclick = () => {
        const n = +b.dataset.q;
        if (n !== Q.cur) void openQueueItem(n);
      };
    });
    bar.querySelectorAll("[data-qdel]").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const n = +b.dataset.qdel;
        removeQueueItem(n);
      };
    });
    $("qAll").onclick = exportAllReviewed;
  }

  function exportAllReviewed(){
    const t = i();
    saveCurrent();

    const ready = Q.items.filter(it => it && it.snap && it.snap.reviewed);
    if (!ready.length) {
      toast(t.queueNone);
      return;
    }

    const keepItem = Q.items[Q.cur] || null;
    openExport(false);

    const go = $("goExp");
    if (!go) return;

    go.onclick = async () => {
      go.disabled = true;
      go.textContent = t.exporting;
      let done = 0;
      let failed = 0;
      const batchReturnState = snapState();
      const chosenSettings = {
        stripMeta: S.stripMeta,
        pdfaDecl: S.pdfaDecl,
        includeOutline: S.includeOutline,
        publicGlossary: S.publicGlossary
      };
      S._batchExport = true;
      S._batchFiles = {};
      const batchAudits = [];
      try {
        for (const it of ready) {
          if (!it || !it.snap || !it.snap.reviewed) continue;
          let itemReturnState = null;
          try {
            itemReturnState = snapState();
            restoreState(it.snap);
            Object.assign(S, chosenSettings);
            S._batchExport = true;
            S._exportNotice = null;
            S._aiPack = false;
            const ok = await doExport();
            if (ok) {
              const exportedHash = S.hashOut;
              it.snap = { ...it.snap, hashOut: exportedHash };
              batchAudits.push(buildAudit());
              done++;
            } else {
              failed++;
            }
          } catch (e) {
            failed++;
            console.error("Batch export failed:", it.name, e);
          } finally {
            S._exportNotice = null;
            S._aiPack = false;
            S._batchExport = true;
            if (itemReturnState) restoreState(itemReturnState);
          }
        }
        if (done > 0 && S._batchFiles) {
          const flateLib = window.fflate || (typeof fflate !== "undefined" ? fflate : null);
          if (flateLib && typeof flateLib.zipSync === "function") {
            const zipEntries = {};
            for (const [fname, fblob] of Object.entries(S._batchFiles)) {
              zipEntries[fname] = new Uint8Array(await fblob.arrayBuffer());
            }
            zipEntries["audit-davka.json"] = flateLib.strToU8(JSON.stringify(batchAudits, null, 2));
            const zipBytes = flateLib.zipSync(zipEntries);
            S._batchFiles = null;
            download("znecitelne-davka.zip", new Blob([zipBytes], {type:"application/zip"}));
          } else {
            const filesToDownload = Object.entries(S._batchFiles);
            S._batchFiles = null;
            for (const [fname, fblob] of filesToDownload) {
              download(fname, fblob);
            }
            download("audit-davka.json", new Blob([JSON.stringify(batchAudits, null, 2)], {type:"application/json"}));
          }
        }
      } finally {
        S._batchFiles = null;
        S._batchExport = false;
        restoreState(batchReturnState);
        if (keepItem) {
          const keepIndex = Q.items.indexOf(keepItem);
          if (keepIndex >= 0 && keepItem.snap) {
            Q.cur = keepIndex;
            restoreState(keepItem.snap);
          }
        }
        paint();
        $("exportModal").classList.add("hidden");
        go.disabled = false;
        go.textContent = t.diffApproveExport;
      }
      if (failed) {
        const failMsg = S.lang === "cs" ? (String(failed) + " selhalo") : (String(failed) + " failed");
        toast(formatPlural(done, t.queueDonePlural || t.queueDone, S.lang) + " · " + failMsg);
      } else {
        toast(formatPlural(done, t.queueDonePlural || t.queueDone, S.lang));
      }
    };
  }

function getRedactionDiff(text, hits, mode, lang){
    const packMode = (mode === "box" && S._aiPack) ? "pseudo" : mode;
    const replaced = apply(text, hits, packMode, lang);
    const activeHits = effectiveHits(hits);

    const reWord = /[\p{L}\p{N}_@.-]+/gu;
    const wordsBefore = (text.match(reWord) || []);
    const wordsAfter = (replaced.match(reWord) || []);

    const removedMap = new Map();
    activeHits.forEach(h => {
      const val = (h.value || "").trim();
      if (!val) return;
      const key = val.toLocaleLowerCase("cs");
      const existing = removedMap.get(key) || { value: val, type: h.type, count: 0 };
      existing.count++;
      removedMap.set(key, existing);
    });

    const removedList = Array.from(removedMap.values());
    return {
      textBefore: text,
      textAfter: replaced,
      wordsBeforeCount: wordsBefore.length,
      wordsAfterCount: wordsAfter.length,
      removedWordsCount: removedList.reduce((sum, item) => sum + item.count, 0),
      removedList,
      safeAdjacentRows: true
    };
  }
  function openExport(aiPack){
    const t = i();
    S._aiPack = !!aiPack;
    const packMode = S.mode==="box" && S._aiPack ? "pseudo" : S.mode;
    const diff = getRedactionDiff(S.text, S.hits, packMode, S.lang);
    const tip = (key) => escAttr((t.tips && t.tips[key]) || "");
    const help = (key) => `<button type="button" class="help-i" data-tip="${tip(key)}">?</button>`;
    $("exportModal").classList.remove("hidden");

    const diffHtml = `
      <div class="diff-card" style="margin:12px 0;padding:12px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:4px;">
          <h3 style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);">${t.diffTitle}</h3>
          <span class="badge ok" style="font-size:11px;background:var(--surface);">${t.diffCleanBadge}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted);margin-bottom:8px;font-family:var(--mono);">
          <span>${t.diffBeforeWords.replace("{n}", diff.wordsBeforeCount)}</span>
          <span>•</span>
          <span>${t.diffAfterWords.replace("{n}", diff.wordsAfterCount)}</span>
          <span>•</span>
          <span style="color:var(--danger);font-weight:600;">${t.diffRemovedCount.replace("{n}", diff.removedWordsCount)}</span>
        </div>
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;">${t.diffRemovedTitle.replace("{n}", diff.removedList.length)}:</p>
        <div style="max-height:140px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;">
          ${diff.removedList.length ? diff.removedList.map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid color-mix(in srgb, var(--border) 40%, transparent);font-size:12px;">
              <span class="mono" style="font-weight:600;color:var(--fg);">${esc(item.value)}</span>
              <span style="display:inline-flex;gap:6px;align-items:center;">
                <span class="pill pill-hit" style="font-size:9px;">${esc(t.cats[item.type] || item.type)}</span>
                <span class="badge" style="padding:1px 6px;font-size:10px;">${item.count}×</span>
              </span>
            </div>
          `).join("") : `<div style="font-size:12px;color:var(--muted);padding:4px 0;">${t.diffNoRemoved}</div>`}
        </div>
        <p style="margin:8px 0 0;font-size:11px;color:var(--ok);font-weight:600;display:flex;align-items:center;gap:4px;">
          <span>✔</span> ${t.diffCleanCheck}
        </p>
      </div>`;

    const isAi = !!aiPack;
    const optionsHtml = S.quickMode ? "" : `
      ${S.fastApprove ? "" : `<label class="field" data-tip="${tip("operator")}">${t.operator} ${help("operator")}</label>
      <input type="text" id="opIn" value="${esc(S.operator)}" placeholder="${escAttr(t.operatorPh)}" data-tip="${tip("operator")}" />`}
      ${!isAi ? `
        <label class="check" data-tip="${tip("stripMeta")}"><input type="checkbox" id="exMeta" ${S.stripMeta?"checked":""}/> ${t.stripMeta} ${help("stripMeta")}</label>
        <label class="check"><input type="checkbox" id="exPdfa" ${S.pdfaDecl?"checked":""}/> ${t.pdfaDecl}</label>
      ` : `
        <label class="check" data-tip="${tip("includeOutline")}"><input type="checkbox" id="exOut" ${S.includeOutline?"checked":""}/> ${t.includeOutline} ${help("includeOutline")}</label>
        <label class="check" data-tip="${tip("publicGlossary")}"><input type="checkbox" id="exGloss" ${S.publicGlossary?"checked":""}/> ${t.publicGlossary} ${help("publicGlossary")}</label>
      `}
    `;

    $("exportSheet").innerHTML = `<h2 data-tip="${tip("confirmExport")}">${t.confirmTitle}</h2>
      <p style="color:var(--muted)" data-tip="${tip("confirmExport")}">${t.confirmExport}</p>
      ${diffHtml}
      ${optionsHtml}
      <p class="mono" style="font-size:11px;color:var(--muted);word-break:break-all" data-tip="${tip("hashIn")}">SHA-256 ${esc(S.hashIn)}</p>
      <p style="font-size:12px;color:var(--muted)" data-tip="${tip(isAi?"goAiPack":"goExport")}">v${RULES}${isAi?" · AI balíček (ZIP)":""}</p>
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn" id="goExp" data-tip="${tip(isAi?"goAiPack":"goExport")}">${t.diffApproveExport}</button>
        <button class="btn btn-sec" id="noExp" data-tip="${tip("cancelExport")}">${t.cancel}</button>
        <span style="flex:1"></span>
        <button class="btn btn-sm btn-ghost btn-eq" id="btnAudit" type="button" data-tip="${tip("audit")}">${t.audit}</button>
        <button class="btn btn-sm btn-ghost" id="btnRecord" type="button" data-tip="${escAttr(t.recordTip)}">🔒 ${t.recordBtn}</button>
      </div>`;

    const opIn = $("opIn"); if (opIn) opIn.oninput = (e) => S.operator = e.target.value;
    const exMeta = $("exMeta"); if (exMeta) exMeta.onchange = (e) => { S.stripMeta = e.target.checked; };
    const exPdfa = $("exPdfa"); if (exPdfa) exPdfa.onchange = (e) => { S.pdfaDecl = e.target.checked; try { localStorage.setItem("znec-pdfa", e.target.checked ? "1" : "0"); } catch (_) {} };
    const exOut = $("exOut"); if (exOut) exOut.onchange = (e) => { S.includeOutline = e.target.checked; };
    const exGloss = $("exGloss"); if (exGloss) exGloss.onchange = (e) => { S.publicGlossary = e.target.checked; };
    $("noExp").onclick = () => $("exportModal").classList.add("hidden");
    $("goExp").onclick = doExport;
    $("btnAudit").onclick = () => download("znecitelne-audit.json", new Blob([JSON.stringify(buildAudit(),null,2)], {type:"application/json"}));
    $("btnRecord").onclick = async () => {
      try {
        const bytes = await exportProtocolPdf();
        download((S.fileName||"document").replace(/\.[^.]+$/,"")+"-protokol.pdf", new Blob([bytes], {type:"application/pdf"}));
      } catch (e) { toast(e.message||String(e)); }
    };
    bindTips();
  }
  /*
   * Local ICC data: no network request is made at export time.
   * The profile is a standard sRGB profile generated through LittleCMS (imported from pdf.js).
   */

async function maybePdfa(bytes, notes){
    if (!S.pdfaDecl) return { bytes, unembeddedPages:[], fontAudit:[] };
    const t = i();
    try {
      const out = await applyPdfaDeclaration(bytes);
      if (out.unembeddedPages.length) {
        notes.push(t.pdfaFontWarn.replace("{n}", out.unembeddedPages.join(", ")));
      } else {
        notes.push(t.pdfaNote);
      }
      return out;
    } catch (_) {
      notes.push(t.pdfaFail);
      return { bytes, unembeddedPages:[], fontAudit:[] };
    }
  }
  async function doExport(){
    const t = i();
    const batchExport = !!S._batchExport;
    if (!S.reviewed && !reviewSkipped()) {
      if (!batchExport) toast(t.needReview);
      return false;
    }

    const btn = $("goExp");
    if (btn) {
      btn.disabled = true;
      btn.textContent = t.exporting;
    }

    try {
      const base = (S.fileName||"document").replace(/\.[^.]+$/,"")+"-anonymized";
      const packMode = S.mode==="box" && S._aiPack ? "pseudo" : S.mode;
      const replaced = apply(S.text, S.hits, packMode, S.lang);
      const info = analyzeProcess(S.text, replaced, S.hits);
      let docxRes = null; const pdfaNotes = [];
      if (!S._aiPack && S.kind==="docx" && S.sourceBuf) {
        try {
          docxRes = await exportDocxFile(S.sourceBuf, S.hits, S.mode, S.lang);
        } catch (e) {
          const reason = (e && e.message) || "error";
          docxRes = { ok: false, reason };
          S._exportNotice = t.docxFallback.replace("{r}", reason);
        }
        if (!docxRes.ok && !S._exportNotice) {
          S._exportNotice = t.docxFallback.replace("{r}", docxRes.reason);
        }
      }
      if (!S._aiPack && S.kind==="pdf" && S.sourceBuf && window.pdfjsLib && window.PDFLib) {
        let bytes, rasterPages;
        if (S.truePdfRedact) {
          try {
            const result = await exportPdfTrueRedact(S.sourceBuf, S.hits, S.fileName, S.mode, S.lang);
            bytes = result.bytes;
            rasterPages = result.rasterPages;
          } catch (e) {
            bytes = await exportPdfRaster(S.sourceBuf, S.hits, S.fileName, S.mode, S.lang);
          }
        } else {
          bytes = await exportPdfRaster(S.sourceBuf, S.hits, S.fileName, S.mode, S.lang);
        }
        const pdfaResult = await maybePdfa(bytes, pdfaNotes);
        bytes = pdfaResult.bytes;
        S.hashOut = await sha256(bytes);
        download(base+".pdf", new Blob([bytes], {type:"application/pdf"}));
        if (rasterPages && rasterPages.size) S._exportNotice = t.exportedMixed.replace("{n}", Array.from(rasterPages).sort((a,b)=>a-b).join(", "));
        else if (S.truePdfRedact && !S._exportNotice) S._exportNotice = t.pdfSearchableVerified;
      } else if (!S._aiPack && S.kind==="xlsx" && S.sourceBuf && window.XLSX) {
        const bytes = exportXlsxFile(S.sourceBuf, S.hits, S.mode, S.lang);
        S.hashOut = await sha256(bytes);
        download(base+".xlsx", new Blob([bytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      } else if (docxRes && docxRes.ok) {
        S.hashOut = await sha256(docxRes.bytes);
        download(base+".docx", new Blob([docxRes.bytes], {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));
        S._exportNotice = t.exportedDocx;
      } else if (!S._aiPack) {
        download(base+".txt", new Blob([replaced], {type:"text/plain;charset=utf-8"}));
        if (window.PDFLib) {
          let bytes = await exportTextPdf(replaced, S.fileName);
          const pdfaResult = await maybePdfa(bytes, pdfaNotes);
          bytes = pdfaResult.bytes;
          S.hashOut = await sha256(bytes);
          download(base+".pdf", new Blob([bytes], {type:"application/pdf"}));
        }
      }
      if (S._aiPack) {
        const gloss = buildGlossary(S.hits, packMode, S.lang, S.publicGlossary);
        const glossJson = JSON.stringify({
          product:"Znečitelně", rulesVersion:RULES, public:!!S.publicGlossary,
          note: S.publicGlossary ? "Original values omitted for public AI." : "Previews are truncated.",
          tokens: gloss, leakScan: info.leaks, verdict: info.verdict
        }, null, 2);
        const auditJson = JSON.stringify(buildAudit(), null, 2);

        const flateLib = window.fflate || (typeof fflate !== "undefined" ? fflate : null);
        if (flateLib && typeof flateLib.zipSync === "function") {
          const zipEntries = {};
          zipEntries[base + "-ai.txt"] = flateLib.strToU8(replaced);
          if (S.includeOutline) {
            zipEntries[base + "-osnova.md"] = flateLib.strToU8(processMarkdown(info));
          }
          zipEntries[base + "-slovnik.json"] = flateLib.strToU8(glossJson);
          zipEntries[base + "-audit.json"] = flateLib.strToU8(auditJson);
          if (window.PDFLib) {
            const bytes = await exportTextPdf(replaced+"\n\n---\n"+processMarkdown(info), S.fileName+" AI pack");
            S.hashOut = await sha256(bytes);
            zipEntries[base + "-ai.pdf"] = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          }
          const zipBytes = flateLib.zipSync(zipEntries);
          download(base + "-ai-pack.zip", new Blob([zipBytes], {type:"application/zip"}));
        } else {
          download(base+"-ai.txt", new Blob([replaced], {type:"text/plain;charset=utf-8"}));
          if (S.includeOutline) download(base+"-osnova.md", new Blob([processMarkdown(info)], {type:"text/markdown;charset=utf-8"}));
          download(base+"-slovnik.json", new Blob([glossJson], {type:"application/json"}));
          download(base+"-audit.json", new Blob([auditJson], {type:"application/json"}));
          if (window.PDFLib) {
            const bytes = await exportTextPdf(replaced+"\n\n---\n"+processMarkdown(info), S.fileName+" AI pack");
            S.hashOut = await sha256(bytes);
            download(base+"-ai.pdf", new Blob([bytes], {type:"application/pdf"}));
          }
        }
      }
      if (pdfaNotes.length) S._exportNotice = ((S._exportNotice || t.exported) + " " + pdfaNotes[0]).trim();
      if (!batchExport) {
        $("exportModal").classList.add("hidden");
        toast(S._exportNotice || t.exported);
      }
      S._exportNotice = null;
      return true;
    } catch (e) {
      if (!batchExport) toast(e.message||String(e));
      return false;
    } finally {
      if (btn && !batchExport) {
        btn.disabled=false;
        btn.textContent=t.diffApproveExport;
      }
    }
  }
  function reset(){
    QUEUE_LOAD_GENERATION++;
    Q.items = [];
    Q.cur = -1;
    clearPdfVisual();

    S.sigDetected = false;
    S.text = "";
    S.hits = [];
    S.fileName = "";
    S.reviewed = false;
    S.secondEyes = false;
    S.isSecondReviewMode = false;
    S.firstOperator = "";
    S.activeSheet = null;
    if (S.filter === "secondReview") S.filter = "all";
    S.selectedId = null;
    S.seen = new Set();
    S.hashIn = "";
    S.hashOut = "";
    S.sourceBuf = null;
    S.pages = [];
    S.noTextPages = 0;
    S.cellMap = [];
    S.analysisContext = "";
    S._exportNotice = null;
    S._aiPack = false;
    S._batchExport = false;
    S._bulkUndoState = null;

    document.body.classList.remove("has-doc");
    const closeDocModal = $("closeDocModal");
    if (closeDocModal) closeDocModal.classList.add("hidden");

    paint();
  }

  $("btnLang").onclick = () => { S.lang = S.lang==="cs"?"en":"cs"; localStorage.setItem("znec-lang", S.lang); paint(); };
  $("btnTheme").onclick = toggleTheme;
  if ($("btnFullscreen")) $("btnFullscreen").onclick = () => { void toggleFullscreen(); };
  if ($("btnMenuFullscreen")) $("btnMenuFullscreen").onclick = () => {
    $("headerMoreMenu")?.classList.add("hidden");
    $("btnHeaderMore")?.setAttribute("aria-expanded", "false");
    void toggleFullscreen();
  };
  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((evt) => {
    document.addEventListener(evt, updateFullscreenUI);
  });
  $("btnSettings").onclick = () => openSettings("tabProfile");
  $("btnSettingsApply").onclick = () => {
    const root = $("settingsModalMount");
    const pull = (id, field) => {
      const el = root.querySelector("#"+id);
      if (el) S[field] = el.value;
    };

    pull("m_taSecrets", "secrets");
    pull("m_taSystems", "systems");
    pull("m_taProjects", "projects");
    pull("m_taOrgs", "orgs");

    const cm = root.querySelector("#m_chkMeta");
    if (cm) S.stripMeta = cm.checked;

    SETTINGS_MODAL_SNAPSHOT = null;
    $("settingsModal").classList.add("hidden");

    if (S.text) {
      runAnalyze();
    } else if (!$("landing").classList.contains("hidden")) {
      $("settingsMount").innerHTML = settingsHTML();
      wireSettings($("settingsMount"));
    }

    applyQuickMode();
    applyFastApprove();
    applyBarPos();
  };
  $("btnSettingsClose").onclick = closeSettings;
  function openHelpModal(){
    const t=i(); $("helpModal").classList.remove("hidden");
    $("helpSheet").innerHTML = `<h2>${t.helpTitle}</h2><p style="color:var(--muted)">${t.help}</p>
      <ul style="padding:0;list-style:none"><li><kbd>J</kbd> ${t.kbdNext} · <kbd>K</kbd> ${t.kbdPrev}</li>
      <li style="margin-top:8px"><kbd>R</kbd> ${t.kbdRedact}</li>
      <li style="margin-top:8px"><kbd>P</kbd> ${t.kbdKeep}</li>
      <li style="margin-top:8px"><kbd>F</kbd> ${t.kbdFullscreen || "Celá obrazovka"}</li></ul>
      <p style="color:var(--muted);font-size:13px">Profil „Veřejná AI“ drží konzistentní tokeny (CBUAIS-5164 → [TICKET_001]) a maže Author / lastModifiedBy. Stejná osoba s titulem, iniciálou i v pádě sdílí token. Slovník a osnova používají stejná čísla jako text. Slovník pište jako <span class="mono">eSpis | INTEGRACE</span> — krátké názvy se berou jen na hranici slova.</p>
      <button class="btn" style="margin-top:12px" id="okHelp">OK</button>`;
    const btnOkHelp = $("okHelp");
    if (btnOkHelp) {
      btnOkHelp.onclick = () => $("helpModal").classList.add("hidden");
      btnOkHelp.focus();
    }
  }

  function openFeaturesModal(){
    const t = i(); $("featuresModal").classList.remove("hidden");
    const helpBtn = tip => tip ? ` <button type="button" class="help-i" data-tip="${escAttr(tip)}">?</button>` : "";
    const li = arr => arr.map(k => `<li>${t.cats[k] || k}${helpBtn(t.tips.cats[k])}</li>`).join("");
    const ul = arr => `<ul class="feat-list">${arr.map(v => `<li>${v.t}${helpBtn(v.tip)}</li>`).join("")}</ul>`;
    const dl = (obj, tips) => `<ul style="margin:0;padding-left:18px">${Object.keys(obj).map(k => `<li>${obj[k]}${helpBtn(tips && tips[k])}</li>`).join("")}</ul>`;
    $("featuresSheet").innerHTML = `<h2 style="margin-top:0">${t.featuresTitle}</h2>
      <p style="color:var(--muted)">${t.featuresIntro}</p>

      <h3 class="feat-h">${t.featuresFormatsTitle}</h3>
      ${ul(t.featuresFormatsList)}
      <p style="color:var(--muted);font-size:13px;margin:8px 0 0"><strong>${t.truePdfRedact}.</strong> ${t.truePdfRedactHint}</p>

      <h3 class="feat-h">${t.featuresDetectTitle}</h3>
      <div style="display:grid;gap:16px;grid-template-columns:1fr 1fr">
        <div><h4 class="feat-h4">${t.layerPii}</h4><ul style="margin:0;padding-left:18px">${li(PII_KEYS)}</ul></div>
        <div><h4 class="feat-h4">${t.layerOrg}</h4><ul style="margin:0;padding-left:18px">${li(ORG_KEYS)}</ul></div>
      </div>

      <h3 class="feat-h">${t.profile}</h3>
      ${dl(t.profiles, t.tips.profiles)}

      <h3 class="feat-h">${t.mode}</h3>
      ${dl(t.modes, t.tips.modes)}

      <h3 class="feat-h">${t.featuresExportTitle}</h3>
      ${ul(t.featuresExportList)}

      <!-- Fáze 1: pouze textový popis, bez logiky -->
      <h3 class="feat-h">${t.inspireTitle}</h3>
      <p style="color:var(--muted);font-size:13px;margin:0 0 6px">${t.inspireIntro}</p>
      ${ul(t.inspireList)}

      <!-- Plán změn — aktuální rozpracované DOCX/PDF bezpečnostní změny -->
      <h3 class="feat-h">${t.planTitle}</h3>
      <p style="color:var(--muted);font-size:13px;margin:0 0 6px">${t.planIntro}</p>
      ${ul(t.planList)}

      <p style="color:var(--muted);font-size:13px;margin-top:16px;display:flex;gap:8px;align-items:flex-start">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none;margin-top:2px" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>${t.privacy}</span>
      </p>
      <button class="btn" style="margin-top:12px" id="okFeatures">OK</button>`;
    const btnOkFeat = $("okFeatures");
    if (btnOkFeat) {
      btnOkFeat.onclick = () => $("featuresModal").classList.add("hidden");
      btnOkFeat.focus();
    }
  }

  function openChangelogModal(){
    const t = i(); $("changelogModal").classList.remove("hidden");
    const rows = CHANGELOG.map(c => `<li><strong>${c.version}</strong> — ${c.notes[S.lang] || c.notes.cs}</li>`).join("");
    $("changelogSheet").innerHTML = `<h2>${t.changelogTitle}</h2>
      <p style="color:var(--muted)">${t.changelogIntro}</p>
      <ul style="margin:0;padding-left:18px">${rows}</ul>
      <p style="color:var(--muted);font-size:13px;margin-top:16px">${t.changelogNote}</p>
      <button class="btn" style="margin-top:12px" id="okChangelog">OK</button>`;
    const btnOkChange = $("okChangelog");
    if (btnOkChange) {
      btnOkChange.onclick = () => $("changelogModal").classList.add("hidden");
      btnOkChange.focus();
    }
  }

  $("btnHelp").onclick = openHelpModal;
  if ($("btnFeatures")) $("btnFeatures").onclick = openFeaturesModal;
  if ($("btnChangelog")) $("btnChangelog").onclick = openChangelogModal;
  if ($("btnHdrFeatures")) $("btnHdrFeatures").onclick = () => { $("headerMoreMenu")?.classList.add("hidden"); openFeaturesModal(); };
  if ($("btnHdrChangelog")) $("btnHdrChangelog").onclick = () => { $("headerMoreMenu")?.classList.add("hidden"); openChangelogModal(); };

  document.addEventListener("click", (e) => {
    const expMenu = $("headerExportMenu");
    const moreMenu = $("headerMoreMenu");
    if (expMenu && !expMenu.classList.contains("hidden") && !e.target.closest("#headerExportGroup")) {
      expMenu.classList.add("hidden");
      $("btnExpMenuToggle")?.setAttribute("aria-expanded", "false");
    }
    if (moreMenu && !moreMenu.classList.contains("hidden") && !e.target.closest(".header-more-group")) {
      moreMenu.classList.add("hidden");
      $("btnHeaderMore")?.setAttribute("aria-expanded", "false");
    }
    const queuePopover = $("queuePopover");
    if (queuePopover && !queuePopover.classList.contains("hidden") && !e.target.closest("#headerDocContext")) {
      queuePopover.classList.add("hidden");
      $("btnQueueToggle")?.setAttribute("aria-expanded", "false");
    }
  }, { passive: true });

  function pickFile(){
    if (S.movie) return;
    const f = $("file");
    f.value = "";
    f.click();
  }
  $("helpModal").onclick = (e) => { if (e.target.id==="helpModal") e.target.classList.add("hidden"); };
  $("featuresModal").onclick = (e) => { if (e.target.id==="featuresModal") e.target.classList.add("hidden"); };
  $("changelogModal").onclick = (e) => { if (e.target.id==="changelogModal") e.target.classList.add("hidden"); };
  $("exportModal").onclick = (e) => { if (e.target.id==="exportModal") e.target.classList.add("hidden"); };
  $("settingsModal").onclick = (e) => { if (e.target.id==="settingsModal") closeSettings(); };
  const closeDocModalEl = $("closeDocModal");
  if (closeDocModalEl) closeDocModalEl.onclick = (e) => { if (e.target.id==="closeDocModal") e.target.classList.add("hidden"); };
  $("btnSample").onclick = async () => {
    if (S.movie) return;
    const enc = new TextEncoder().encode(SAMPLE);
    const buf = enc.buffer.slice(enc.byteOffset, enc.byteOffset+enc.byteLength);
    const file = new File([buf], "smlouva-vzor.txt", { type: "text/plain" });
    await onFiles([file]);
  };
  $("btnMovie").onclick = () => startMovieTutorial(MOVIE_SCRIPT);
  $("movie-btn-back").onclick = () => movieBackStep();
  $("movie-btn-playpause").onclick = () => movieTogglePause();
  $("movie-btn-skip").onclick = () => movieSkipStep();

  document.addEventListener("mousedown", (e) => {
    if (!S.movie || MOVIE_PAUSED || e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest(
      "button, a, input, select, textarea, label, summary, details, " +
      ".modal, #movie-title-card, #movie-controls"
    )) return;
    movieSkipStep();
  });
  $("movie-btn-speed").onclick = () => movieToggleSpeed();
  $("movie-btn-exit").onclick = () => exitMovieTutorial();
  $("movie-title-card").addEventListener("click", (e) => {
    if (e.target.id === "movie-title-card") movieCloseTitleCard();
  });

  function isIgnoredSystemFile(name){
    if (!name) return true;
    const base = name.split("/").pop().split("\\").pop();
    return base.startsWith("~$") || base.startsWith("._") || base === ".DS_Store" || base === "Thumbs.db" || base === "desktop.ini";
  }

  async function collectFilesFromDataTransfer(dt){
    if (!dt) return [];
    const items = dt.items;
    if (!items || !items.length) {
      return Array.from(dt.files || []).filter(f => !isIgnoredSystemFile(f.name));
    }
    const files = [];
    async function scanEntry(entry){
      if (!entry) return;
      if (entry.isFile) {
        return new Promise(res => {
          try {
            entry.file(f => {
              if (f && !isIgnoredSystemFile(f.name)) files.push(f);
              res();
            }, () => res());
          } catch (_) { res(); }
        });
      }
      if (entry.isDirectory) {
        try {
          const reader = entry.createReader();
          const readEntries = () => new Promise(res => {
            reader.readEntries(async entries => {
              if (!entries || !entries.length) return res();
              for (const c of entries) await scanEntry(c);
              await readEntries();
              res();
            }, () => res());
          });
          await readEntries();
        } catch (_) {}
      }
    }
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (typeof it.webkitGetAsEntry === "function") {
        let entry = null;
        try { entry = it.webkitGetAsEntry(); } catch (_) {}
        if (entry) { promises.push(scanEntry(entry)); continue; }
      }
      const f = it.getAsFile ? it.getAsFile() : null;
      if (f && !isIgnoredSystemFile(f.name)) files.push(f);
    }
    if (promises.length) await Promise.all(promises);
    return files.length ? files : Array.from(dt.files || []).filter(f => !isIgnoredSystemFile(f.name));
  }

  $("btnBrowse").onclick = pickFile;
  $("file").onchange = (e) => { if (e.target.files.length) onFiles(e.target.files); e.target.value = ""; };
  $("drop").onclick = pickFile;
  $("drop").ondragover = (e) => { e.preventDefault(); $("drop").classList.add("over"); };
  $("drop").ondragleave = () => $("drop").classList.remove("over");
  $("drop").ondrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    $("drop").classList.remove("over");
    const files = await collectFilesFromDataTransfer(e.dataTransfer);
    if (files.length) onFiles(files);
  };

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    const d = $("drop");
    if (d && !d.closest(".hidden")) d.classList.add("over");
  });
  window.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      const d = $("drop");
      if (d) d.classList.remove("over");
    }
  });
  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const d = $("drop");
    if (d) d.classList.remove("over");
    if (e.target instanceof Element && (e.target.id === "drop" || e.target.closest("#drop"))) return;
    const files = await collectFilesFromDataTransfer(e.dataTransfer);
    if (files.length) onFiles(files);
  });

  globalThis.addManualHitFromVisual = (selectedText, pageNum, relStart, relEnd) => {
    const sel = (selectedText || "").trim();
    if (sel.length < 2) return;
    let start = -1;
    const pageMeta = (S.pages || []).find(p => p.n === pageNum);
    if (pageMeta) {
      if (typeof relStart === "number" && typeof pageMeta.start === "number") {
        const candOffset = pageMeta.start + relStart;
        if (S.text.slice(candOffset, candOffset + sel.length) === sel) {
          start = candOffset;
        }
      }
      if (start < 0 && pageMeta.body) {
        const idx = pageMeta.body.indexOf(sel);
        if (idx >= 0 && typeof pageMeta.start === "number") start = pageMeta.start + idx;
      }
    }
    if (start < 0) start = S.text.indexOf(sel);
    if (start < 0) return;

    const nid = S.hits.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1;
    const words = sel.split(/\s+/);
    const isName = looksName(sel) || (words.length >= 2 && words.some(w => looksName(w)));
    const hitType = isName ? "name" : "secrets";
    const entityKey = isName ? ("name|" + nameKey(sel)) : ("secrets|" + sel.toLocaleLowerCase("cs"));
    const newHit = {
      id: nid,
      type: hitType,
      value: sel,
      start,
      end: start + sel.length,
      accept: true,
      confidence: "high",
      reasons: ["manual", isName ? "morphology" : "dict"],
      userModified: true,
      entityKey,
      page: pageNum || pageOf(start)
    };
    S.hits.push(newHit);
    S.selectedId = nid;
    S.seen.add(nid);
    if (!isName && !secretList().includes(sel)) S.secrets += "\n" + sel;
    if (isName) {
      const beforeCount = S.hits.length;
      expandCzechNameMorphology(S.text, S.hits, newHit);
      const added = S.hits.length - beforeCount;
      if (added > 0) toast(formatPlural(added, i().morphToastPlural || i().morphToast, S.lang));
    }
    paintReview();
  };

  $("btnAdd").onclick = () => {
    const sel = window.getSelection().toString().trim();
    if (sel.length<3) return;
    let start = -1;
    const origEl = $("orig");
    const xlsxGridEl = $("xlsxGrid");
    const selection = window.getSelection();
    if (selection && selection.rangeCount && xlsxGridEl && !xlsxGridEl.classList.contains("hidden") && xlsxGridEl.contains(selection.getRangeAt(0).startContainer)) {
      const startNode = selection.getRangeAt(0).startContainer;
      const tdEl = (startNode instanceof Element ? startNode : startNode.parentElement)?.closest("td[data-cell-start]");
      if (tdEl) {
        const cStart = +tdEl.dataset.cellStart;
        const cEnd = +tdEl.dataset.cellEnd;
        const inCellIdx = S.text.slice(cStart, cEnd).indexOf(sel);
        if (inCellIdx >= 0) start = cStart + inCellIdx;
      }
    }
    if (selection && selection.rangeCount && origEl && origEl.contains(selection.getRangeAt(0).startContainer)) {
      const range = selection.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(origEl);
      preRange.setEnd(range.startContainer, range.startOffset);
      const offset = preRange.toString().length;
      if (S.text.slice(offset, offset + sel.length) === sel) {
        start = offset;
      }
    }
    if (start < 0) start = S.text.indexOf(sel);
    if (start < 0) return;
    const nid = S.hits.reduce((m,h)=>Math.max(m,h.id||0),0)+1;
    const words = sel.split(/\s+/);
    const isName = looksName(sel) || (words.length >= 2 && words.some(w => looksName(w)));
    const hitType = isName ? "name" : "secrets";
    const entityKey = isName ? ("name|" + nameKey(sel)) : ("secrets|" + sel.toLocaleLowerCase("cs"));
    const newHit = { id:nid, type:hitType, value:sel, start, end:start+sel.length, accept:true, confidence:"high", reasons:["manual", isName ? "morphology" : "dict"], userModified:true, entityKey, page: pageOf(start) };
    S.hits.push(newHit);
    S.selectedId = nid;
    S.seen.add(nid);
    if (!isName && !secretList().includes(sel)) S.secrets += "\n"+sel;
    if (isName) {
      const beforeCount = S.hits.length;
      expandCzechNameMorphology(S.text, S.hits, newHit);
      const added = S.hits.length - beforeCount;
      if (added > 0) toast(formatPlural(added, i().morphToastPlural || i().morphToast, S.lang));
    }
    paintReview();
  };
  document.onkeydown = (e) => {
    if (S.movie) {
      const k = e.key;
      if (["ArrowLeft","ArrowRight"," ","Escape","Esc","j","J","k","K","r","R","p","P","ArrowUp","ArrowDown"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (MOVIE_TRANSITION_LOCK) return;
      if (k === "ArrowLeft") movieBackStep();
      else if (k === "ArrowRight") movieSkipStep();
      else if (k === " ") movieTogglePause();
      else if (k === "Escape" || k === "Esc") exitMovieTutorial(true);
      return;
    }
    const openModal = document.querySelector(".modal:not(.hidden)");
    if (openModal) {
      if (e.key === "Escape" || e.key === "Esc") {
        if (openModal.id === "settingsModal") closeSettings();
        else openModal.classList.add("hidden");
        return;
      }
      if (e.key === "Tab") {
        const focusables = Array.from(openModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (!openModal.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Esc") {
      const expMenu = $("headerExportMenu");
      const moreMenu = $("headerMoreMenu");
      if (expMenu && !expMenu.classList.contains("hidden")) {
        expMenu.classList.add("hidden");
        $("btnExpMenuToggle")?.setAttribute("aria-expanded", "false");
        $("btnExpMenuToggle")?.focus();
        return;
      }
      if (moreMenu && !moreMenu.classList.contains("hidden")) {
        moreMenu.classList.add("hidden");
        $("btnHeaderMore")?.setAttribute("aria-expanded", "false");
        $("btnHeaderMore")?.focus();
        return;
      }
      const queuePopover = $("queuePopover");
      if (queuePopover && !queuePopover.classList.contains("hidden")) {
        queuePopover.classList.add("hidden");
        $("btnQueueToggle")?.setAttribute("aria-expanded", "false");
        $("btnQueueToggle")?.focus();
        return;
      }
    }
    const expMenu = $("headerExportMenu");
    const moreMenu = $("headerMoreMenu");
    const activeDropdown = (expMenu && !expMenu.classList.contains("hidden")) ? expMenu : ((moreMenu && !moreMenu.classList.contains("hidden")) ? moreMenu : null);
    if (activeDropdown) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(activeDropdown.querySelectorAll('.dropdown-item:not(.hidden):not([disabled])'));
        if (items.length) {
          const curIdx = items.indexOf(document.activeElement);
          let nextIdx = 0;
          if (curIdx >= 0) {
            nextIdx = e.key === "ArrowDown" ? (curIdx + 1) % items.length : (curIdx - 1 + items.length) % items.length;
          } else {
            nextIdx = e.key === "ArrowDown" ? 0 : items.length - 1;
          }
          items[nextIdx].focus();
        }
        return;
      }
    }
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      void toggleFullscreen();
      return;
    }

    if (!S.text) return;
    const list = filtered();
    if (!list.length) return;
    if (e.key==="j"||e.key==="J"||e.key==="ArrowDown") { e.preventDefault(); selectNextHit(); }
    else if (e.key==="k"||e.key==="K"||e.key==="ArrowUp") { e.preventDefault(); selectPrevHit(); }
    else if ((e.key==="r"||e.key==="R") && S.selectedId) patch(S.selectedId, true);
    else if ((e.key==="p"||e.key==="P") && S.selectedId) patch(S.selectedId, false);
  };
  window.addEventListener("resize", () => {
    updateHeaderHeightVar();
    updateBarHeightVar();
  });

export function selfTest(){
    const enabled = Object.fromEntries(KEYS.map(k => [k, true]));
    const secrets = ["jednotkové ceny"];
    const prev = S.suspicion;
    const cases = [];
    cases.push({ name:"docx path normalization", ok: docxNormalizeZipPath("word/a/../media/x.jpg") === "word/media/x.jpg", type:"docx", includes:"word/media/x.jpg", got:[docxNormalizeZipPath("word/a/../media/x.jpg")] });
    cases.push({ name:"docx relative relationship path", ok: docxRelativeZipPath("word", "word/media/image_001.jpg") === "media/image_001.jpg", type:"docx", includes:"media/image_001.jpg", got:[docxRelativeZipPath("word", "word/media/image_001.jpg")] });
    const dWork = docxMakeWork("„Jan\u00A0Novák–Dvořák“");
    cases.push({
      name: "docx normalized matching helpers",
      ok: dWork.work === "\"Jan Novák-Dvořák\"" && dWork.toSrc.length === dWork.work.length,
      type: "docx",
      includes: "\"Jan Novák-Dvořák\"",
      got: [dWork.work]
    });
    const dSoft = docxMakeWork("Václav\u00ADské");
    cases.push({
      name: "docx soft hyphen work strip",
      ok: dSoft.work === "Václavské" && dSoft.src === "Václav\u00ADské",
      type: "docx",
      includes: "Václavské",
      got: [dSoft.work]
    });
    cases.push({ name:"pdf ICC profile present", ok: SRGB_ICC_PROFILE_BASE64.length > 100 && base64ToUint8Array(SRGB_ICC_PROFILE_BASE64).length > 400, type:"pdfa", includes:"sRGB ICC", got:[String(base64ToUint8Array(SRGB_ICC_PROFILE_BASE64).length)] });
    cases.push({ name:"movie 70% slower", ok: Math.abs(movieEffectiveSpeed() - 0.3 * MOVIE_SPEED) < 1e-9 && MOVIE_SLOWDOWN === 0.3, type:"movie", includes:"0.3", got:[String(MOVIE_SLOWDOWN), String(movieEffectiveSpeed())] });
    cases.push({ name:"marquee helpers", ok: typeof initActionMarquees === "function" && typeof startTextMarquee === "function", type:"movie", includes:"fns", got:[typeof initActionMarquees, typeof startTextMarquee] });
    const expect = (name, text, sus, type, includes) => {
      S.suspicion = sus;
      const hits = detect(text, enabled, secrets);
      const ok = hits.some(h => h.type===type && String(h.value).includes(includes));
      cases.push({ name, ok, type, includes, got: hits.filter(h=>h.type===type).map(h=>h.value) });
    };
    const expectNone = (name, text, sus, type) => {
      S.suspicion = sus;
      const hits = detect(text, enabled, secrets);
      const bad = hits.filter(h => h.type===type);
      cases.push({ name, ok: bad.length===0, type, includes:"∅", got: bad.map(h=>h.value) });
    };
    expect("rc slash", "rodné číslo 780312/0006", "medium", "rc", "780312/0006");
    expect("katastr parcela", "pozemek parc. č. 123/4 v obci", "medium", "katastr", "123/4");
    expect("katastr LV", "zapsáno na LV 456", "medium", "katastr", "456");
    expect("katastr ku", "v k.ú. Nové Město, obec Praha", "medium", "katastr", "Nové Město");
    expect("zahr iban SK", "IBAN: SK31 1200 0000 1987 4263 7541", "medium", "zahr_iban", "SK31");
    expect("zahr iban DE", "účet DE89370400440532013000", "medium", "zahr_iban", "DE89");
    expectNone("zahr iban bad checksum", "SK00 1200 0000 1987 4263 7541", "medium", "zahr_iban");
    expect("swift label", "SWIFT: KOMBCZPP", "medium", "zahr_iban", "KOMBCZPP");
    expect("pas", "Cestovní pas č. 12345678", "medium", "doklady_extra", "12345678");
    expect("rp", "Řidičský průkaz č. EB 123456", "medium", "doklady_extra", "123456");
    expect("rp space", "předložil ŘP č. EB 123456", "medium", "doklady_extra", "123456");
    expect("casefile czech start", "spis ČTÚ 123/2024 v řízení", "medium", "casefile", "ČTÚ 123/2024");
    expect("ztp", "průkaz ZTP/P č. 654321", "medium", "doklady_extra", "654321");
    expect("ico label", "IČO: 00000205", "medium", "ico", "00000205");
    expect("namesti", "se sídlem Václavské náměstí 1, 110 00 Praha 1", "medium", "address", "náměstí");
    expect("ticket", "ticket CBUAIS-5164", "medium", "ticket", "CBUAIS-5164");
    cases.push({
      name: "onomastic registry top surnames positive detection",
      ok: ["Novák", "Nováková", "Svoboda", "Svobodová", "Dvořák", "Dvořáková", "Černý", "Černá", "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Marek", "Pospíšil", "Pokorný", "Hájek", "Král", "Jelínek", "Růžička", "Beneš", "Fiala", "Sedláček", "Doležal", "Zeman", "Kolář", "Navrátil", "Čermák", "Vaněk", "Urban", "Blažek", "Kříž", "Kovář", "Holub"].every(isOnomasticName),
      type: "onomastic",
      includes: "top surnames",
      got: ["Novák", "Svobodová", "Dvořák", "Kovář"].map(n => [n, isOnomasticName(n)])
    });
    cases.push({
      name: "onomastic registry non-names negative rejection",
      ok: ["smlouva", "faktura", "auto", "dnes", "strom", "projekt", "software", "objednatel", "korun", "podle"].every(w => !isOnomasticName(w)),
      type: "onomastic",
      includes: "non-names rejected",
      got: ["smlouva", "auto", "faktura"].map(w => [w, isOnomasticName(w)])
    });
    cases.push({
      name: "looksName integration with onomastic registry",
      ok: looksName("Novák") && looksName("Kovář") && looksName("Nováková") && looksName("Svoboda"),
      type: "onomastic",
      includes: "looksName onomastic",
      got: [looksName("Novák"), looksName("Kovář")]
    });
    expect("declined", "sešli jsme se s Novákem.", "medium", "name", "Novákem");
    expectNone("geographic phrase Černá Hora is not a person", "Černá Hora is a country.", "medium", "name");
    expectNone("geographic inflection Černé Hory is not a person", "Jednání se týká Černé Hory.", "medium", "name");
    expect("person surname Hora is preserved", "Jednání vedl Jan Hora.", "medium", "name", "Jan Hora");
    cases.push({
      name: "standalone common term rejected as person name",
      ok: isLikelyNonPersonName("Termín", "Termín", 0, 6),
      type: "name",
      includes: "Termín excluded",
      got: [String(isLikelyNonPersonName("Termín", "Termín", 0, 6))]
    });
    expectNone("geographic phrase Cervena Voda is not a person", "Červená Voda je obec.", "medium", "name");
    expectNone("water management collocations dulni vody is not a person", "Zpráva zmiňuje důlní vody jako samostatnou kategorii vypouštěných vod.", "medium", "name");
    expectNone("combined user case Cervena Voda and dulni vody", "Pořád app dělá chyby, např. v této větě identifikuje \"vody\" jako osobu. Zpráva zmiňuje   důlní   vody jako samostatnou kategorii   vypouštěných   vod. podobně si myslí, že \"Červená Voda\" je osoba.", "medium", "name");
    expect("person surname Voda with title is preserved", "Ing. Petr Voda podepsal zápis.", "medium", "name", "Ing. Petr Voda");
    expect("czech surname cerny", "sešel se s Janem Černým.", "medium", "name", "Černým");
    expect("czech surname svoboda", "jednání vedl Petr Svoboda.", "medium", "name", "Petr Svoboda");
    expect("czech surname novotna", "podepsala Jana Novotná.", "medium", "name", "Jana Novotná");
    expect("czech post-nominal title", "kontakt: Ing. Petr Svoboda, MBA schválil plán", "medium", "name", "Petr Svoboda, MBA");
    expect("czech quote name", "zástupce „Jan Novák“ podepsal", "medium", "name", "Jan Novák");
    expect("czech system diacritics", "aplikace Účetnictví a systém Pošta", "medium", "system", "Pošta");
    expect("initials", "podepsal J. Novák", "medium", "name", "J. Novák");
    // Ticket 02: Desambiguace větných verzálek a kontextové triggery
    expectNone("sentence start apelativum Nový", "Nový přístup byl zvolen.", "medium", "name");
    expectNone("sentence start apelativum Starý", "Starý stavební zákon pozbyl platnosti.", "medium", "name");
    expectNone("sentence start apelativum Podle", "Podle žalobce došlo k prodlení.", "medium", "name");
    expectNone("sentence start apelativum Bílá", "Bílá technika byla dodána.", "medium", "name");
    expect("sentence start multi-word name", "Petr Nový podepsal smlouvu.", "medium", "name", "Petr Nový");
    expectNone("homonym apelativum kovář", "zručný kovář vyrobil mříž", "medium", "name");
    expect("role trigger full name", "svědek Jiří Kovář vypověděl", "medium", "name", "Jiří Kovář");
    expect("role trigger lone surname", "svědek Kovář vypověděl", "medium", "name", "Kovář");
    expect("administrative trigger foreign name", "obžalovaný John Smith, nar. 1980, bytem v Praze", "medium", "name", "John Smith");
    // Ticket 06: Strukturní hranice textu a slovesná desambiguace (ADR-0005)
    cases.push({
      name: "administrative verb schvalil not person",
      ok: (() => {
        const h = detect("Schválil: PhDr. JUDr. Vítězslav Urbanec, Ph.D.", enabled, secrets).filter(x => x.type === "name");
        return !h.some(x => /Schválil/i.test(x.value)) && h.some(x => /Urbanec/.test(x.value));
      })(),
      type: "name",
      includes: "Urbanec without Schválil",
      got: detect("Schválil: PhDr. JUDr. Vítězslav Urbanec, Ph.D.", enabled, secrets).map(x => x.value)
    });
    cases.push({
      name: "passive participle omluveni not person",
      ok: (() => {
        const h = detect("Omluveni: Ing. Radim Mžyk", enabled, secrets).filter(x => x.type === "name");
        return !h.some(x => /Omluveni/i.test(x.value)) && h.some(x => /Mžyk/.test(x.value));
      })(),
      type: "name",
      includes: "Mžyk without Omluveni",
      got: detect("Omluveni: Ing. Radim Mžyk", enabled, secrets).map(x => x.value)
    });
    expectNone("agenda noun poradu not person", "Poradu zahájil předseda ČBÚ.", "medium", "name");
    expectNone("agenda noun porada not person", "Zápis z porady ředitelů.", "medium", "name");
    expect("administrative trigger forward name", "Schválil: PhDr. JUDr. Vítězslav Urbanec, Ph.D.", "medium", "name", "Vítězslav Urbanec");
    expect("administrative trigger omluveni forward name", "Omluveni: Ing. Radim Mžyk", "medium", "name", "Radim Mžyk");
    expect("verbal origin surname preserved Pospisil", "Jednání vedl Jan Pospíšil.", "medium", "name", "Jan Pospíšil");
    expect("verbal origin surname preserved Navratil", "Dohodu podepsal Petr Navrátil.", "medium", "name", "Petr Navrátil");
    cases.push({
      name: "meeting minutes header labels and agenda vocabulary excluded from person names",
      ok: (() => {
        const docSnippet = "Zápis z porady ředitelů č. 32 SBS 51822/2026\nze dne 14. září 2026\nZapsal: Ing. Mgr. Jiří Fröhlich\nSchválil: PhDr. JUDr. Vítězslav Urbanec, Ph.D.\nPřítomni: Ing. Martin Štemberka, Ph.D., Ing. Mgr. Jiří Fröhlich, Ing. Dušan Havel, MPA\nOmluveni: Ing. Radim Mžyk\nPoradu zahájil předseda ČBÚ.";
        const hits = detect(docSnippet, enabled, []);
        const forbidden = ["schválil", "omluven", "omluveni", "poradu", "porady", "zapsal", "přítomni"];
        return hits.filter(h => h.type === "name").every(h => !forbidden.some(f => h.value.toLowerCase().includes(f)));
      })(),
      type: "name",
      includes: "clean meeting minutes",
      got: detect("Zapsal: Ing. Mgr. Jiří Fröhlich\nSchválil: PhDr. JUDr. Vítězslav Urbanec, Ph.D.\nOmluveni: Ing. Radim Mžyk\nPoradu zahájil předseda ČBÚ.", enabled, []).filter(h => h.type === "name").map(h => h.value)
    });
    expect("ip", "server 10.12.8.4 uvnitř", "medium", "ip", "10.12.8.4");
    expect("host", "viz https://ais.internal/ticket/1", "medium", "host", "ais.internal");
    expect("geo", "stanoviště 50.087465, 14.421253", "medium", "geo", "50.087465");
    expect("el plate", "SPZ EL 1234", "medium", "spz", "EL 1234");
    expectNone("contract date", "V Praze dne 11. 9. 2026", "high", "dob");
    expectNone("iso ticket", "norma ISO-9001", "high", "ticket");
    expectNone("phone as rc high", "částka 777123456 bez rodného", "high", "rc");
    expect("sig serial", "Sériové číslo certifikátu: 5A:3F:12:00:9B:EE", "medium", "sigcert", "5A:3F:12:00:9B:EE");
    expect("sig dn serial", "CN=Jan Novák, serialNumber=ICA-10614293", "medium", "sigcert", "ICA-10614293");
    expect("sig fingerprint", "Otisk (SHA-256): 3b1c4d5e6f7089aabbccddeeff00112233445566778899aabbccddeeff0011", "medium", "sigcert", "3b1c4d5e6f7089aabbccddeeff00112233445566778899aabbccddeeff0011");
    expect("sig pdf contents", "/Contents<308206...deadbeef>", "medium", "sigcert", "/Contents<308206...deadbeef>");
    expect("sig stamp serial short", "Sériové č. cert.: 17265563", "medium", "sigcert", "17265563");
    expect("sig stamp signer", "Podpisující: PhDr., JUDr. Vítězslav Urbanec Ph.D", "medium", "sigcert", "Vítězslav Urbanec");
    expect("stacked titles name", "Podepsal PhDr., JUDr. Vítězslav Urbanec Ph.D.", "medium", "name", "Vítězslav Urbanec");
    expectNone("sig ca name kept", "Certifikát vydal: PostSignum Qualified Certification Authority", "high", "name");
    expectNone("sig level kept", "Typ podpisu: Kvalifikovaný elektronický podpis", "high", "name");
    cases.push({ name:"signature annot helper", ok: isSignatureAnnot({ fieldType:"Sig", rect:[0,0,100,40] }) && !isSignatureAnnot({ fieldType:"Tx", subtype:"Widget" }), type:"sigcert", includes:"annot", got:["ok"] });
    // Ticket 03: Dokumentová mezipaměť entit a pádová propagace
    cases.push({
      name: "entity propagation cache interface available",
      ok: typeof createEntityPropagationCache === "function" && typeof EntityPropagationCache === "function",
      type: "propagation",
      includes: "EntityPropagationCache",
      got: [typeof createEntityPropagationCache]
    });
    const cachePdm = typeof createEntityPropagationCache === "function" ? createEntityPropagationCache("test", []).generateParadigm("Petr Kovář") : [];
    cases.push({
      name: "dokumentová mezipaměť entit paradigm generation for 7 cases",
      ok: Array.isArray(cachePdm) &&
          ["Kovář", "Kováře", "Kovářovi", "Kovářem"].every(f => cachePdm.includes(f)) &&
          ["Petr Kovář", "Petra Kováře", "Petrem Kovářem"].every(f => cachePdm.includes(f)),
      type: "propagation",
      includes: "7-case paradigm",
      got: cachePdm.slice(0, 8)
    });
    const uninflPdm = typeof createEntityPropagationCache === "function" ? createEntityPropagationCache("test", []).generateParadigm("Marie Svoboda") : [];
    cases.push({
      name: "dokumentová mezipaměť entit uninflected surname paradigm",
      ok: Array.isArray(uninflPdm) &&
          ["Svoboda", "Marie Svoboda", "paní Svoboda"].some(f => uninflPdm.includes(f)),
      type: "propagation",
      includes: "uninflected paradigm",
      got: uninflPdm.slice(0, 8)
    });
    const propDocText = "Podle výpovědi Kováře došlo k nehodě. Obžalovaný Ing. Petr Kovář, nar. 1978, však tvrdil opak. Později bylo doručeno Kovářovi a jednal s Kovářem.";
    const propHits = detect(propDocText, enabled, []);
    const propNameHits = propHits.filter(h => h.type === "name");
    const kovarKeys = new Set(propNameHits.map(h => h.entityKey));
    const rProp = bindReplacer("pseudo", "cs", propHits);
    const propOut = apply(propDocText, propHits, "pseudo", "cs");
    cases.push({
      name: "bidirectional entity propagation unifies entityKey and pseudonyms",
      ok: propNameHits.length >= 4 &&
          kovarKeys.size === 1 &&
          propNameHits.some(h => h.value === "Kováře" && (h.reasons || []).includes("propagation")) &&
          propNameHits.some(h => /Petr Kovář/.test(h.value)) &&
          propNameHits.some(h => h.value === "Kovářovi" && (h.reasons || []).includes("propagation")) &&
          propNameHits.some(h => h.value === "Kovářem" && (h.reasons || []).includes("propagation")) &&
          propOut.includes("[OSOBĚ_") &&
          propOut.includes("[OSOBOU_") &&
          propNameHits.some(h => h.value === "Kovářovi" && rProp(h).startsWith("[OSOBĚ_")) &&
          propNameHits.some(h => h.value === "Kovářem" && rProp(h).startsWith("[OSOBOU_")),
      type: "propagation",
      includes: "bidirectional unified entityKey",
      got: propNameHits.map(h => h.value + ":" + h.entityKey + ":" + rProp(h))
    });
    const overlapHits = [
      { id:1, start:0, end:12, value:"Jan Novák", type:"name", accept:true, score:0.9, entityKey:"name|jan" },
      { id:2, start:4, end:7, value:"Nov", type:"name", accept:true, score:0.99, entityKey:"name|nov" },
      { id:3, start:20, end:24, value:"CBUA", type:"ticket", accept:true, score:0.5, entityKey:"ticket|cbua" }
    ];
    const overlapResolved = topHits(overlapHits);
    const overlapOut = apply("Jan Novák .... CBUA", overlapHits, "pseudo", "cs");
    cases.push({
      name:"overlap resolver is shared by replacement",
      ok: overlapResolved.length === 2 &&
          overlapResolved[0].id === 1 &&
          overlapResolved[1].id === 3 &&
          !overlapOut.includes("Nov"),
      type:"overlap",
      includes:"topHits",
      got:[overlapResolved.map(h => h.id).join(","), overlapOut]
    });
    S.suspicion = "medium";
    const prevSys = S.systems, prevProj = S.projects;
    S.systems = "AIS SBS | SYSTÉM\neSpis | INTEGRACE\nSAMO2 | MODUL";
    S.projects = "CBUAIS | PROJEKT\nORION | PROJEKT";
    const sampleHits = detect(SAMPLE, enabled, secrets);
    const replaced = apply(SAMPLE, sampleHits, "pseudo", "cs");
    const gloss = buildGlossary(sampleHits, "pseudo", "cs", false);
    const byKey = new Map();
    sampleHits.filter(h=>h.accept && h.type==="name").forEach(h => {
      const list = byKey.get(h.entityKey)||[]; list.push(h.value); byKey.set(h.entityKey, list);
    });
    const janVals = [...byKey.values()].find(arr => arr.some(v => /Jan Novák/i.test(v))) || [];
    cases.push({ name:"name title shares key", ok: janVals.some(v => /Ing\.\s*Jan Novák/i.test(v)), type:"name", includes:"Ing. Jan Novák", got: janVals });
    const nameTok = new Map();
    const rNames = bindReplacer("pseudo", "cs", sampleHits);
    sampleHits.filter(h=>h.accept && h.type==="name").forEach(h => nameTok.set(h.value, rNames(h)));
    cases.push({ name:"name title same token", ok: nameTok.get("Jan Novák") && nameTok.get("Jan Novák")===nameTok.get("Ing. Jan Novák"), type:"name", includes:"same token", got: [...nameTok.entries()].map(([k,v])=>k+":"+v) });
    const extra = "Jan Novák volal Novákovi a sešel se s Novákem. J. Novák i Ing. Jan Novák.";
    const extraHits = detect(extra, enabled, []);
    const rExtra = bindReplacer("pseudo", "cs", extraHits);
    const extraToks = extraHits.filter(h=>h.type==="name").map(h => rExtra(h));
    cases.push({
      name: "declined+initials share token",
      ok: extraToks.length >= 4 &&
          extraToks.every(t => /_001\]$/.test(t)) &&
          extraToks.some(t => t.startsWith("[OSOBA_")) &&
          extraToks.some(t => t.startsWith("[OSOBĚ_")) &&
          extraToks.some(t => t.startsWith("[OSOBOU_")),
      type: "name",
      includes: "one person stable suffix",
      got: extraHits.filter(h=>h.type==="name").map(h=>h.value+":"+h.entityKey+":"+rExtra(h))
    });
    cases.push({
      name: "declined token preserves case with post-nominal title",
      ok: (() => {
        const r = bindReplacer("pseudo", "cs", [{ id: 1, type: "name", value: "Janem Novákem, MBA", accept: true, entityKey: "name|jan novak" }]);
        return r({ id: 1, type: "name", value: "Janem Novákem, MBA", accept: true, entityKey: "name|jan novak" }) === "[OSOBOU_001]";
      })(),
      type: "name",
      includes: "[OSOBOU_001]",
      got: [bindReplacer("pseudo", "cs", [{ id: 1, type: "name", value: "Janem Novákem, MBA", accept: true, entityKey: "name|jan novak" }])({ id: 1, type: "name", value: "Janem Novákem, MBA", accept: true, entityKey: "name|jan novak" })]
    });
    cases.push({
      name: "geographic phrase Černé Hory not corrupted when Jan Hora present",
      ok: (() => {
        const h = detect("Jednání vedl Jan Hora. Výsledky přišly z Černé Hory.", enabled, secrets);
        return h.some(x => x.type === "name" && x.value.includes("Jan Hora")) &&
               !h.some(x => x.type === "name" && (x.value === "Hory" || x.value === "Černé Hory"));
      })(),
      type: "name",
      includes: "Jan Hora kept, Hory excluded",
      got: detect("Jednání vedl Jan Hora. Výsledky přišly z Černé Hory.", enabled, secrets).map(x => x.value)
    });
    cases.push({
      name: "standalone month duben not added as person when Jan Duben present",
      ok: (() => {
        const h = detect("Tuto smlouvu uzavřel Jan Duben dne 15. dubna. Termín plnění je stanoven na duben.", enabled, secrets);
        return h.some(x => x.type === "name" && x.value.includes("Jan Duben")) &&
               !h.some(x => x.type === "name" && x.value === "duben");
      })(),
      type: "name",
      includes: "Jan Duben kept, duben excluded",
      got: detect("Tuto smlouvu uzavřel Jan Duben dne 15. dubna. Termín plnění je stanoven na duben.", enabled, secrets).map(x => x.value)
    });
    const sysText = "Projekt CBUAIS, systém AIS SBS, integrace eSpis, eSpis, modul SAMO2, AIS SBS.";
    const sysHits = detect(sysText, enabled, []);
    const rSys = bindReplacer("pseudo", "cs", sysHits);
    const espis = sysHits.filter(h => /espis/i.test(h.value) || /eSpis/.test(h.value));
    const espisTok = Array.from(new Set(espis.map(h => rSys(h))));
    cases.push({ name:"eSpis phrase+dict one token", ok: espis.length>=1 && espisTok.length===1, type:"system", includes:"eSpis", got: espis.map(h=>h.value+":"+h.entityKey+":"+rSys(h)) });
    const ais = sysHits.filter(h => /AIS SBS/i.test(h.value));
    const aisTok = Array.from(new Set(ais.map(h => rSys(h))));
    cases.push({ name:"AIS SBS phrase+dict one token", ok: ais.length>=1 && aisTok.length===1, type:"system", includes:"AIS SBS", got: ais.map(h=>h.value+":"+h.entityKey+":"+rSys(h)) });
    const icoDic = sampleHits.filter(h => h.type==="ico" || h.type==="dic");
    const firm = icoDic.filter(h => String(h.value).includes("25596641") || String(h.value).includes("CZ25596641"));
    const firmTok = Array.from(new Set(firm.map(h => rNames(h))));
    cases.push({ name:"ico+dic same org token", ok: firm.length>=2 && firmTok.length===1, type:"ico", includes:"25596641", got: firm.map(h=>h.value+":"+rNames(h)) });
    const applyTok = {};
    sampleHits.filter(h=>h.accept && h.type==="name").forEach(h => { applyTok[h.entityKey] = rNames(h); });
    const glossTok = {};
    gloss.filter(g => g.type==="name").forEach(g => { (glossTok[g.token] = glossTok[g.token]||[]).push(g); });
    const janToken = rNames(sampleHits.find(h => h.value==="Jan Novák"));
    const janGloss = gloss.filter(g => g.type==="name" && /Jan/.test(g.originalPreview||""));
    cases.push({ name:"glossary matches apply", ok: janGloss.length>=1 && janGloss.every(g => g.token===janToken), type:"name", includes:janToken, got: janGloss.map(g=>g.token+":"+g.originalPreview) });
    cases.push({ name:"status not mid-word", ok: !/odstraněny\)e/.test(replaced) && !/n\)epřipraven/.test(replaced), type:"status", includes:"word-boundary", got: [replaced.split("\n").filter(l=>/Stav|hotfix|nasazen|rollback|plánovan/i.test(l)).join(" | ")] });
    const t2hits = detect(SAMPLE + "\nOpakovaný ticket CBUAIS-5164.", enabled, secrets);
    const rT = bindReplacer("pseudo", "cs", t2hits);
    const same = t2hits.filter(h => h.value==="CBUAIS-5164").map(h => rT(h));
    cases.push({ name:"repeated ticket same token", ok: same.length>=2 && same.every(t => t===same[0]), type:"ticket", includes:"CBUAIS-5164", got: same });
    const testGlyphs = [
      { start: 0, end: 1, str: "N", x: 10, y: 100, w: 8, h: 12 },
      { start: 1, end: 2, str: "o", x: 18, y: 100, w: 7, h: 12 },
      { start: 2, end: 3, str: "v", x: 25, y: 100, w: 7, h: 12 },
      { start: 3, end: 4, str: "á", x: 32, y: 100, w: 7, h: 12 },
      { start: 4, end: 5, str: "k", x: 39, y: 100, w: 7, h: 12 }
    ];
    const testQuads = pdfWordQuads(testGlyphs);
    cases.push({
      name: "word quads exact contour with vertical inset",
      ok: testQuads.length === 1 && testQuads[0].x === 10 && testQuads[0].w === 36 && testQuads[0].y > 100 && testQuads[0].h < 12,
      type: "quads",
      includes: "vertical inset",
      got: [JSON.stringify(testQuads[0])]
    });
    const diffSample = "Termín: do 15. 12. 2026. Ing. Jan Novák z odboru schválil plán činnosti odboru.";
    const diffHits = [
      { id: 101, start: 30, end: 39, value: "Jan Novák", type: "name", accept: true }
    ];
    const diffRes = getRedactionDiff(diffSample, diffHits, "box", "cs");
    cases.push({
      name: "redaction diff preserves adjacent lines",
      ok: diffRes.removedList.length === 1 &&
          diffRes.removedList[0].value === "Jan Novák" &&
          diffRes.textAfter.includes("Termín: do 15. 12. 2026") &&
          diffRes.textAfter.includes("činnosti odboru") &&
          !diffRes.textAfter.includes("Jan Novák"),
      type: "diff",
      includes: "clean adjacent",
      got: [diffRes.textAfter]
    });
    const morphText = "Objednatel Ing. Jan Novák uzavřel smlouvu. Plnění bylo poskytnuto panu Janu Novákovi a sešli se s Janem Novákem. Osobou je také pan Novák a paní Nováková.";
    const morphHits = detect(morphText, enabled, []);
    const rMorph = bindReplacer("pseudo", "cs", morphHits);
    const morphNameHits = morphHits.filter(h => h.type === "name");
    cases.push({
      name: "czech pseudonym tokens preserve common grammatical cases",
      ok: morphNameHits.length >= 4 &&
          morphNameHits.some(h => /Jan Novák/.test(h.value) && rMorph(h) === "[OSOBA_001]") &&
          morphNameHits.some(h => /Janu Novákovi/.test(h.value) && rMorph(h) === "[OSOBĚ_001]") &&
          morphNameHits.some(h => /Janem Novákem/.test(h.value) && rMorph(h) === "[OSOBOU_001]"),
      type: "morphology",
      includes: "OSOBA_001, OSOBĚ_001, OSOBOU_001",
      got: morphNameHits.map(h => h.value + ":" + rMorph(h))
    });
    cases.push({
      name: "pdf sanitized text layer verifier ready",
      ok: typeof verifySanitizedPdfText === "function",
      type: "pdf-sanitize",
      includes: "verifier",
      got: [typeof verifySanitizedPdfText]
    });
    cases.push({
      name: "text decoding windows-1250 preserves czech diacritics",
      ok: decodeTextBuffer(new Uint8Array([0x50, 0xf8, 0xed, 0x6c, 0x69, 0x9a])) === "Příliš",
      type: "encoding",
      includes: "Příliš",
      got: [decodeTextBuffer(new Uint8Array([0x50, 0xf8, 0xed, 0x6c, 0x69, 0x9a]))]
    });
    cases.push({
      name: "text decoding utf8 with bom",
      ok: decodeTextBuffer(new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x68, 0x6f, 0x6a])) === "Ahoj",
      type: "encoding",
      includes: "Ahoj",
      got: [decodeTextBuffer(new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x68, 0x6f, 0x6a]))]
    });
    cases.push({
      name: "text decoding utf16le with bom",
      ok: decodeTextBuffer(new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x68, 0x00, 0x6f, 0x00, 0x6a, 0x00])) === "Ahoj",
      type: "encoding",
      includes: "Ahoj",
      got: [decodeTextBuffer(new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x68, 0x00, 0x6f, 0x00, 0x6a, 0x00]))]
    });
    cases.push({
      name: "binary buffer detection",
      ok: isBinaryBuffer(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])) &&
          !isBinaryBuffer(new Uint8Array([0x41, 0x68, 0x6f, 0x6a])) &&
          !isBinaryBuffer(new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x68, 0x00])),
      type: "binary-detect",
      includes: "true/false",
      got: [String(isBinaryBuffer(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])))]
    });
    cases.push({
      name: "rtf text extraction with czech diacritics",
      ok: extractRtfText("{\\rtf1\\ansi\\ansicpg1250{\\*\\generator App}\\pard Smlouva o d\\'edle.\\par \\ldblquote Objednatel\\rdblquote : Jan Nov\\'e1k\\bullet Hotovo\\par}").includes("Smlouva o díle.") &&
          extractRtfText("{\\rtf1\\ansi\\ansicpg1250{\\*\\generator App}\\pard Smlouva o d\\'edle.\\par \\ldblquote Objednatel\\rdblquote : Jan Nov\\'e1k\\bullet Hotovo\\par}").includes("Jan Novák") &&
          extractRtfText("{\\rtf1\\ansi\\ansicpg1250{\\*\\generator App}\\pard Smlouva o d\\'edle.\\par \\ldblquote Objednatel\\rdblquote : Jan Nov\\'e1k\\bullet Hotovo\\par}").includes("„Objednatel“") &&
          !extractRtfText("{\\rtf1\\ansi\\ansicpg1250{\\*\\generator App}\\pard Smlouva o d\\'edle.\\par \\ldblquote Objednatel\\rdblquote : Jan Nov\\'e1k\\bullet Hotovo\\par}").includes("generator"),
      type: "rtf-extract",
      includes: "Smlouva o díle.",
      got: [extractRtfText("{\\rtf1\\ansi\\ansicpg1250{\\*\\generator App}\\pard Smlouva o d\\'edle.\\par \\ldblquote Objednatel\\rdblquote : Jan Nov\\'e1k\\bullet Hotovo\\par}")]
    });
    cases.push({
      name: "image file recognition",
      ok: isImageFile("sken.png", "image/png") && isImageFile("faktura.jpg", "") && !isImageFile("dokument.pdf", "application/pdf"),
      type: "image-detect",
      includes: "true",
      got: [String(isImageFile("sken.png", "image/png"))]
    });
    cases.push({
      name: "court decisions profile whitelist (§ 4 odst. 3 vyhl. 403/2022 Sb.)",
      ok: (() => {
        const text =
          "Krajský soud v Ostravě rozhodl ve věci žalobce Petr Svoboda, bytem v Ostravě. " +
          "Předseda senátu JUDr. Karel Novák, v. r. Dále citován rozsudek ESLP ve věci Novák proti České republice.";
        const hits = detect(text, { name: true, address: true }, [], { profile: "court" });
        const ostravaSeat = hits.find(h => h.start < 30 && h.value.includes("Ostrav"));
        const ostravaHome = hits.find(h => h.start > 50 && h.value.includes("Ostrav"));
        const judge = hits.find(h => /Karel Novák/i.test(h.value));
        const plaintiff = hits.find(h => /Petr Svoboda/i.test(h.value));
        const eslpNovak = hits.find(h => h.start > 80 && /Novák/i.test(h.value));
        return (!ostravaSeat || ostravaSeat.whitelisted === true || ostravaSeat.accept === false) &&
               Boolean(ostravaHome && ostravaHome.accept === true && !ostravaHome.whitelisted) &&
               Boolean(judge && (judge.whitelisted === true || judge.accept === false)) &&
               Boolean(plaintiff && plaintiff.accept === true && !plaintiff.whitelisted) &&
               Boolean(!eslpNovak || eslpNovak.whitelisted === true || eslpNovak.accept === false);
      })(),
      type: "court-profile",
      includes: "court-whitelist",
      got: ["court profile rules verified"]
    });
    cases.push({
      name: "fp sentence-start apelativa suppression",
      ok: (() => {
        const sentences = [
          "Nový přístup byl zvolen.",
          "Starý zákoník práce pozbyl platnosti.",
          "Podle vyjádření žalobce došlo k prodlení.",
          "Bílá technika byla dodána."
        ];
        return sentences.every(s => detect(s, { name: true }, []).filter(h => h.type === "name").length === 0);
      })(),
      type: "name",
      includes: "sentence-start FP suppression",
      got: ["suppressed"]
    });

    cases.push({
      name: "sentence-start multi-word name preserved",
      ok: (() => {
        const h = detect("Petr Nový podepsal smlouvu.", { name: true }, []);
        return h.some(x => x.type === "name" && x.value === "Petr Nový");
      })(),
      type: "name",
      includes: "Petr Nový",
      got: ["detected"]
    });

    cases.push({
      name: "homonym apelativa vs role triggers",
      ok: (() => {
        const ap1 = detect("zručný kovář vyrobil mříž", { name: true }, []);
        const ap2 = detect("nad městem kroužil holub", { name: true }, []);
        const ap3 = detect("venku vládla tuhá zima", { name: true }, []);
        const tr1 = detect("svědek Jiří Kovář vypověděl", { name: true }, []);
        const tr2 = detect("pan Holub doložil plnou moc", { name: true }, []);
        return ap1.length === 0 && ap2.length === 0 && ap3.length === 0 &&
               tr1.some(h => h.value === "Jiří Kovář") &&
               tr2.some(h => /Holub/.test(h.value));
      })(),
      type: "name",
      includes: "homonymy desambiguation",
      got: ["homonyms resolved"]
    });

    cases.push({
      name: "inflection and entity propagation cache with declension",
      ok: (() => {
        const text = "smlouva s Janem Pavlem byla uzavřena. Později předáno Pavlovi. Podle názoru Pavla nedošlo k pochybení.";
        const hits = detect(text, { name: true }, []);
        const names = hits.filter(h => h.type === "name");
        const keys = new Set(names.map(h => h.entityKey));
        const pseudo = apply(text, hits, "pseudo", "cs");
        return names.length >= 3 && keys.size === 1 &&
               /\[OSOBOU_0*1\]/.test(pseudo) && /\[OSOBĚ_0*1\]/.test(pseudo) && /\[OSOBA_0*1\]/.test(pseudo);
      })(),
      type: "name",
      includes: "propagation and 7-case tokens",
      got: ["propagation verified"]
    });

    cases.push({
      name: "foreign and uninflected names near triggers",
      ok: (() => {
        const text = "obžalovaný John Smith, nar. 1980 byl přítomen. svědkyně Marie Svoboda, bytem v Praze vypovídala.";
        const hits = detect(text, { name: true, address: true }, []);
        return hits.some(h => h.type === "name" && h.value.includes("John Smith")) &&
               hits.some(h => h.type === "name" && h.value.includes("Marie Svoboda"));
      })(),
      type: "name",
      includes: "foreign names detected",
      got: ["foreign names verified"]
    });

    cases.push({
      name: "ocr fuzzy tolerance near triggers",
      ok: (() => {
        const ocrActiveText = "obžalovaný Dv0řák, nar. 1980 se nedostavil.";
        const activeHits = detect(ocrActiveText, { name: true }, [], { ocrActive: true });
        const inactiveHits = detect(ocrActiveText, { name: true }, [], { ocrActive: false });
        const shortHits = detect("svědek N0vák vypověděl.", { name: true }, [], { ocrActive: true });
        const hasFuzzy = activeHits.some(h => h.type === "name" && /Dv0řák/.test(h.value) && (h.reasons || []).includes("ocr:fuzzy"));
        const noInactive = !inactiveHits.some(h => h.type === "name" && /Dv0řák/.test(h.value));
        const noShort = !shortHits.some(h => h.type === "name" && /N0vák/.test(h.value));
        return hasFuzzy && noInactive && noShort;
      })(),
      type: "name",
      includes: "ocr fuzzy tolerance",
      got: ["ocr fuzzy verified"]
    });
    S.systems = prevSys; S.projects = prevProj;
    S.suspicion = prev;
    cases.push({
      name:"movie deterministic setup",
      ok: Array.isArray(MOVIE_SCRIPT) && MOVIE_SCRIPT.length === 31 && MOVIE_SCRIPT.every(step => typeof step.setup === "function"),
      type:"movie", includes:"setup", got:[String(MOVIE_SCRIPT.length), String(MOVIE_SCRIPT.filter(step => typeof step.setup === "function").length)]
    });
    cases.push({
      name:"movie no snapshots",
      ok: typeof MOVIE_SNAPSHOTS === "undefined" && typeof movieGoTo === "function",
      type:"movie", includes:"no snapshots", got:[typeof MOVIE_SNAPSHOTS, typeof movieGoTo]
    });
    cases.push({
      name:"movie step 12/13 select previews",
      ok: MOVIE_SCRIPT[11] && MOVIE_SCRIPT[12] &&
          typeof MOVIE_SCRIPT[11].setup === "function" && typeof MOVIE_SCRIPT[12].setup === "function" &&
          /movieShowSelectMenu/.test(String(MOVIE_SCRIPT[11].setup)) &&
          /movieShowSelectMenu/.test(String(MOVIE_SCRIPT[12].setup)),
      type:"movie", includes:"profiles+modes", got:[String(!!MOVIE_SCRIPT[11]), String(!!MOVIE_SCRIPT[12])]
    });
    const transitionalSteps = new Set([0, 16, 26, 30]);
    cases.push({
      name:"movie highlight specs present",
      ok: MOVIE_SCRIPT.every((step, idx) => transitionalSteps.has(idx) || typeof step.highlight === "function" || !!step.highlight || !!step.preHighlight),
      type:"movie", includes:"highlight", got:[String(MOVIE_SCRIPT.filter((step, idx) => !transitionalSteps.has(idx) && !(typeof step.highlight === "function" || step.highlight || step.preHighlight)).length)]
    });
    cases.push({
      name:"movie navigation keys isolated",
      ok: /if \(S\.movie\)/.test(String(document.onkeydown || "")),
      type:"movie", includes:"ArrowLeft/ArrowRight/Space/Escape", got:["listener installed"]
    });
    const failed = cases.filter(c => !c.ok);
    return { ok: failed.length===0, failed, n: cases.length };
  }


  if (typeof window !== "undefined") {
    window.isOnomasticName = isOnomasticName;
    window.initOnomasticRegistry = initOnomasticRegistry;
    window.createOnomasticTrie = createOnomasticTrie;
    window.detect = detect;
    window.hitEvidence = hitEvidence;
    window.I18N = I18N;
    window.EntityPropagationCache = EntityPropagationCache;
    window.createEntityPropagationCache = createEntityPropagationCache;
    window.expandCzechNameMorphology = expandCzechNameMorphology;
    window.declinedPersonTokenBase = declinedPersonTokenBase;
    window.applyCourtProfileRules = applyCourtProfileRules;
    window.filterCourtDecisionsWhitelist = filterCourtDecisionsWhitelist;
    window.isSentenceStart = isSentenceStart;
    window.isCzechVerbOrParticiple = isCzechVerbOrParticiple;
    window.apply = apply;
    window.legalOf = legalOf;
    window.buildAudit = buildAudit;
    window.exportProtocolPdf = exportProtocolPdf;
    window.exportTextPdf = exportTextPdf;
    window.groupHitsIntoEntities = groupHitsIntoEntities;
    window.showConfirm = showConfirm;
    window.S = S;
  }
  if (typeof queueMicrotask === "function") {
    queueMicrotask(initOnomasticRegistry);
  } else if (typeof setTimeout === "function") {
    setTimeout(initOnomasticRegistry, 0);
  } else {
    initOnomasticRegistry();
  }
  if (typeof location !== "undefined" && /(?:\?|&)selftest=1\b/.test(location.search||"")) {
    const r = selfTest();
    if (typeof window !== "undefined") window.__selfTestResult = r;
    console.log("Znečitelně selftest", r);
    if (!r.ok) console.warn(r.failed);
  }
  applyTheme();
  paint();
  if (typeof canFetchLocalAssets === "function") {
    canFetchLocalAssets().then(supported => {
      S.ocrSupported = !!supported;
      if (!supported && !S.text) paintLanding();
    }).catch(() => {
      S.ocrSupported = false;
      if (!S.text) paintLanding();
    });
  }
