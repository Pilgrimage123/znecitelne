import { PII_KEYS, ORG_KEYS, KEYS, RULES, LABEL, TICKET_STOP, STATUS_GENERIC, PUBLIC, FIRST_NAMES, TITLES, NAMES } from "./rules.js";
import { stripTitle, isOnomasticName, initOnomasticRegistry } from "./onomastic.js";
import {
  stemNamePart, isCzechVerbOrParticiple, looksName, nameKey, canonToken,
  systemCore, accountKey, nameInitial, clusterNameKeys, isLikelyNonPersonName,
  isSentenceStart, declinedPersonTokenBase, RE_AGENDA_APELATIVA, ROLE_WORDS_SET,
  RE_CZECH_SURNAMES
} from "./morphology.js";
import { createEntityPropagationCache, expandCzechNameMorphology, alignDictEntity } from "./propagation.js";

export function digits(s){ return String(s).replace(/[^\d]/g, ""); }
  export function parseRC(raw){
    const m = String(raw).trim().match(/^(\d{2})(\d{2})(\d{2})\s*\/?\s*(\d{3,4})$/);
    if (!m) return null;
    let month = +m[2];
    if (month >= 71) month -= 70; else if (month >= 51) month -= 50; else if (month >= 21) month -= 20;
    const day = +m[3];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const yy = +m[1];
    const d = m[1]+m[2]+m[3]+m[4];
    if (d.length === 10) {
      const mod = Number(d.slice(0, 9)) % 11;
      const last = +d[9];
      if (mod === 10 ? last !== 0 : last !== mod) return null;
    }
    if (d.length !== 9 && d.length !== 10) return null;
    const year = d.length === 9 ? 1900 + yy : (yy < 54 ? 2000 + yy : 1900 + yy);
    const dim = [31, (year%4===0&&year%100!==0)||year%400===0?29:28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1];
    if (day > dim) return null;
    return true;
  }
  export function pageOf(start, pagesList){
    const pList = pagesList || ((typeof globalThis !== 'undefined' && globalThis.S && globalThis.S.pages) || (typeof S !== 'undefined' && S.pages) || []);
    if (!pList || !pList.length) return 1;
    for (const p of pList) if (start >= p.start && start < p.end) return p.n;
    return pList[pList.length-1].n;
  }
  export function toBytes(buf){
    if (!buf) return new Uint8Array(0);
    if (buf instanceof Uint8Array) return buf;
    if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
    if (buf.buffer) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return new Uint8Array(buf);
  }
  export function isValidICO(raw){
    const d = digits(raw); if (d.length !== 8 || /^0+$/.test(d)) return false;
    const w = [8,7,6,5,4,3,2]; let sum = 0;
    for (let i=0;i<7;i++) sum += w[i]*+d[i];
    return (11 - (sum % 11)) % 10 === +d[7];
  }
  export function isValidDIC(raw){
    const s = String(raw).replace(/\s+/g,"").toUpperCase();
    const m = s.match(/^CZ(\d{8,10})$/); if (!m) return false;
    return m[1].length === 8 ? isValidICO(m[1]) : !!parseRC(m[1]);
  }
  export function ibanOk(iban){
    const s = iban.replace(/\s+/g,"").toUpperCase();
    if (!/^CZ\d{22}$/.test(s)) return false;
    const rearr = s.slice(4)+s.slice(0,4);
    let rem = 0;
    for (const ch of rearr) {
      const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0)-55) : ch;
      for (const d of v) rem = (rem * 10 + +d) % 97;
    }
    return rem === 1;
  }
  // --- Fáze 2: cizí IBAN (délky podle zemí) a SWIFT/BIC ---
  export const IBAN_LEN = {AD:24,AE:23,AL:28,AT:20,AZ:28,BA:20,BE:16,BG:22,BH:22,BR:29,BY:28,CH:21,CR:22,CY:28,DE:22,DK:18,DO:28,EE:20,EG:29,ES:24,FI:18,FO:18,FR:27,GB:22,GE:22,GI:23,GL:18,GR:27,GT:28,HR:21,HU:28,IE:22,IL:23,IQ:23,IS:26,IT:27,JO:30,KW:30,KZ:20,LB:28,LC:32,LI:21,LT:20,LU:20,LV:21,MC:27,MD:24,ME:22,MK:19,MR:27,MT:31,MU:30,NL:18,NO:15,PK:24,PL:28,PS:29,PT:25,QA:29,RO:24,RS:22,SA:24,SC:31,SE:24,SI:19,SK:24,SM:27,TL:23,TN:24,TR:26,UA:29,VA:22,VG:24,XK:20};
  export const SWIFT_CC = new Set(Object.keys(IBAN_LEN).concat(["CZ","US","CA","JP","CN","HK","SG","AU","NZ","IN","ZA","MX","KR","TH","MY","ID","RU"]));
  export function ibanForeignOk(iban){
    const s = String(iban).replace(/\s+/g,"").toUpperCase();
    const cc = s.slice(0,2);
    if (cc === "CZ" || IBAN_LEN[cc] !== s.length) return false;
    const rearr = s.slice(4)+s.slice(0,4);
    let rem = 0;
    for (const ch of rearr) {
      const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0)-55) : ch;
      for (const d of v) rem = (rem * 10 + +d) % 97;
    }
    return rem === 1;
  }

export function isPublic(text){ const l = String(text||"").toLocaleLowerCase("cs"); return PUBLIC.some(k => l.includes(k) || (l.length >= 6 && k.includes(l))); }
  export function tokenizeCtx(s){
    return String(s||"").toLocaleLowerCase("cs").split(/[^\p{L}\p{N}+./]+/u).filter(Boolean);
  }
  export function ctxSlice(text, start, end, win=40, bias="both"){
    const left = bias==="right" ? 0 : (bias==="left" ? (typeof win==="number"?win:40) : (typeof win==="number"?win:40));
    const right = bias==="left" ? 10 : (typeof win==="number"?win:40);
    return (text.slice(Math.max(0,start-left), start) + " " + text.slice(end, end+right)).toLocaleLowerCase("cs");
  }
  export function matchNeedles(c, needles){
    const tokens = tokenizeCtx(c);
    return needles.filter(n => {
      const needle = String(n).toLocaleLowerCase("cs");
      if (!needle) return false;
      if (/[ .č]/.test(needle) && needle.length > 3) return c.includes(needle);
      return tokens.includes(needle) || tokens.some(tok => tok === needle || tok.replace(/\.$/,"") === needle);
    });
  }
  export function ctxHas(text, start, end, needles, win=40, bias="both"){
    return matchNeedles(ctxSlice(text, start, end, win, bias), needles).length > 0;
  }

  export function ctxWhich(text, start, end, needles, win=40, bias="both"){
    return matchNeedles(ctxSlice(text, start, end, win, bias), needles);
  }
  export function isContractDateCtx(text, start, end, win=48){
    const c = (text.slice(Math.max(0,start-win), start) + " " + text.slice(end, end+win)).toLocaleLowerCase("cs");
    const born = /nar(?:\.|ozen|ozena)|datum narození|birth/.test(c);
    if (born) return false;
    return /(?:v\s+\p{Ll}+\s+dne|\bdne\b|uzavřen|uzavrena|podeps|platnost|vyhotoven|vystaven)/u.test(c);
  }
  export function makeWork(text){
    const src = String(text ?? "").normalize("NFC");
    let work = "";
    const toSrc = [];
    for (let i = 0; i < src.length; i++) {
      const c = src.charCodeAt(i);
      if (c===0x00AD || c===0x200B || c===0x200C || c===0x200D || c===0x2060 || c===0xFEFF) continue;
      let ch = src[i];
      if (c===0x00A0 || c===0x202F || c===0x2007 || c===0x2009 || c===0x200A) ch = " ";
      else if (c===0x2013 || c===0x2014 || c===0x2212 || c===0x2010 || c===0x2011 || c===0x2012 || c===0x2015 || c===0xFE58 || c===0xFE63 || c===0xFF0D) ch = "-";
      else if (c===0x201E || c===0x201C || c===0x201D || c===0x00AB || c===0x00BB) ch = '"';
      else if (c===0x201A || c===0x2018 || c===0x2019) ch = "'";
      work += ch;
      toSrc.push(i);
    }
    return { src, work, toSrc };
  }
  export function mapSpan(toSrc, start, end){
    if (!toSrc.length) return { start:0, end:0 };
    const s = toSrc[Math.min(Math.max(0,start), toSrc.length-1)];
    const last = toSrc[Math.min(Math.max(0,end-1), toSrc.length-1)];
    return { start:s, end:last+1 };
  }
  export function parseDict(raw){
    return String(raw||"").split(/\n/).map(line => {
      const s = line.trim();
      if (!s || s.startsWith("#")) return null;
      const parts = s.split("|");
      const name = (parts[0]||"").trim();
      const kind = (parts[1]||"").trim().toUpperCase();
      if (!name) return null;
      return { name, kind };
    }).filter(Boolean);
  }
  export function dictRe(name){
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp("(?<![\\p{L}\\p{N}])"+esc+"(?![\\p{L}\\p{N}])", "giu");
  }
  const URL_TOKEN_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'\u00AD\u200B]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\.(?:cz|sk|com|net|org|eu|io)\/[^\s<>"'\u00AD\u200B]*/gi;
  export function urlSpans(text){
    const spans = [];
    let m; const re = new RegExp(URL_TOKEN_RE.source, URL_TOKEN_RE.flags);
    while ((m = re.exec(text))) {
      if (m.index === re.lastIndex) re.lastIndex++;
      spans.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
    return spans;
  }
  export function spanInUrl(spans, start, end){
    return spans.find(u => start < u.end && end > u.start) || null;
  }
  export function trimUrlValue(h, src){
    let s = h.start, e = h.end;
    while (e>s) {
      const c = src[e-1];
      const seg = src.slice(s, e);
      if (/[.,;:!?]/.test(c)) { e--; continue; }
      if (c===")" && (seg.match(/\(/g)||[]).length < (seg.match(/\)/g)||[]).length) { e--; continue; }
      if (c==="]" && (seg.match(/\[/g)||[]).length < (seg.match(/\]/g)||[]).length) { e--; continue; }
      break;
    }
    while (s<e && /[(\[\s]/.test(src[s]||"")) s++;
    if (e<=s) return h;
    h.start = s; h.end = e; h.value = src.slice(s,e);
    return h;
  }
  export function trimHitValue(h, src){
    if (h.type === "host") return trimUrlValue(h, src);
    let v = h.value, s = h.start, e = h.end;
    while (e>s && /[.,;:)\]\s“”’‘»"']/.test(src[e-1]||"")) e--;
    while (s<e && /[(\[\s„‚«"']/.test(src[s]||"")) s++;
    if (e<=s) return h;
    h.start = s; h.end = e; h.value = src.slice(s,e);
    return h;
  }
  export function findAll(text, re, type, validate, group){
    const flags = (re.flags.includes("g") ? re.flags : re.flags+"g") + (re.flags.includes("d") ? "" : "d");
    const out = []; const r = new RegExp(re.source, flags);
    let m; while ((m = r.exec(text))) {
      let value = m[0], start = m.index;
      if (group && m[group] != null) {
        const g = m[group];
        if (m.indices && m.indices[group]) {
          start = m.indices[group][0];
        } else {
          const rel = m[0].indexOf(g);
          start = m.index + (rel >= 0 ? rel : 0);
        }
        value = g;
      }
      if (validate && !validate(value, text, start, m)) continue;
      out.push({ type, value, start, end: start+value.length, reasons: [], confidence: "medium" });
      if (m.index === r.lastIndex) r.lastIndex++;
    }
    return out;
  }
  export function scoreHit(h){
    let s = 0;
    const rs = h.reasons || [];
    const has = (p) => rs.some(r => r===p || r.startsWith(p+":"));
    if (has("checksum")) s += 50;
    if (has("iban")) s += 50;
    if (has("label")) s += 40;
    if (has("dict")) s += 45;
    if (has("trigger:official")) s += 50;
    if (has("trigger:role")) s += 35;
    if (has("titled")) s += 25;
    if (has("gazetteer") || has("onomastic")) s += 28;
    if (has("context")) s += 20;
    if (has("format")) s += 10;
    if (has("declined")) s += 16;
    if (has("initials")) s += 14;
    if (has("prefix-list")) s += 22;
    if (has("private-range")) s += 30;
    if (h.type==="email" && has("format")) s += 20;
    if (h.type==="ticket" && has("format")) s += 12;
    if (h.confidence === "high") s += 6;
    s += Math.min(18, Math.max(0, (h.end-h.start)-2));
    const prio = { rc:7, email:7, account:6, ico:6, dic:6, ticket:6, credential:6, phone:4, datovka:4, idcard:3, katastr:4, zahr_iban:6, doklady_extra:4, address:4, name:3, dob:2, host:5, ip:5, geo:3, spz:3 };
    s += prio[h.type] || 1;
    return s;
  }
  export function finalizeHit(h, src){
    trimHitValue(h, src);
    const sc = scoreHit(h);
    h.score = sc;
    h.confidence = (h.confidence === "high" || sc >= 48) ? "high" : "medium";
    return h;
  }
  export function projectPrefixes(dictRaw){
    const dict = dictRaw != null ? dictRaw : ((typeof globalThis !== 'undefined' && globalThis.S && globalThis.S.projects) || (typeof S !== 'undefined' && S.projects) || '');
    const set = new Set();
    parseDict(dict).forEach(d => {
      const pref = (d.name.split(/[\s-]/)[0]||"").toUpperCase();
      if (pref.length >= 2) set.add(pref);
    });
    return set;
  }

  // Conservative post-processing for Czech person-name candidates.
  // Exact-phrase filtering avoids a global surname blacklist.

export function detect(text, enabled, secrets, options){
    const bag = []; const bagMap = new Map();
    const { src, work, toSrc } = makeWork(text || "");
    const t = work;
    const sState = (typeof globalThis !== "undefined" && globalThis.S) || (typeof S !== "undefined" ? S : null) || {};
    const sus = (options && options.suspicion) || sState.suspicion || "medium";
    const win = sus === "high" ? 70 : sus === "low" ? 28 : 40;
    const lift = (h) => {
      const mapped = mapSpan(toSrc, h.start, h.end);
      const raw = Object.assign({}, h, { start: mapped.start, end: mapped.end, value: src.slice(mapped.start, mapped.end) });
      finalizeHit(raw, src);
      return raw;
    };
    const push = (h) => {
      if (!h || !h.value || !h.value.trim()) return;
      const mapped = (h.start < src.length && src.slice(h.start, h.end) === h.value) ? finalizeHit(h, src) : lift(h);
      if (!mapped.value || !mapped.value.trim()) return;
      const k = mapped.type+"|"+mapped.start+"|"+mapped.end;
      const existing = bagMap.get(k);
      if (existing) {
        existing.reasons = Array.from(new Set([].concat(existing.reasons || [], mapped.reasons || [])));
        if (mapped.confidence === "high") existing.confidence = "high";
        if (mapped.accept) existing.accept = true;
        return;
      }
      bagMap.set(k, mapped);
      bag.push(mapped);
    };
    const add = (hits, extraReasons) => {
      hits.forEach(h => {
        if (extraReasons && extraReasons.length) h.reasons = (h.reasons||[]).concat(extraReasons);
        push(h);
      });
    };

    if (enabled.rc) {
      add(findAll(t, /\b\d{2}(?:0[1-9]|1[0-2]|2[1-9]|3[0-2]|5[1-9]|6[0-2]|7[1-9]|8[0-2])(?:0[1-9]|[12]\d|3[01])\s*\/\s*\d{3,4}\b/g, "rc", v => parseRC(v.replace(/\s+/g,""))), ["checksum","format"]);
      add(findAll(t, /(?<![\/=?&%.@#-])\b\d{9,10}\b(?![\/=?&%.@#-])/g, "rc", (v,f,i) => {
        if (!parseRC(v)) return false;
        const needles = sus === "low"
          ? ["rodné číslo","rodne cislo","r.č.","r. č.","rč","birth number","nar."]
          : ["rodné číslo","rodne cislo","r.č","rč","birth","nar.","narozen"];
        return ctxHas(f,i,i+v.length, needles, win, "left");
      }).map(h => {
        const why = ctxWhich(t,h.start,h.end, ["rodné číslo","rodne cislo","r.č.","rč","nar.","narozen","birth"], win, "left");
        h.reasons = ["checksum"].concat(why.length ? ["context:"+why[0]] : []);
        return h;
      }));
    }
    if (enabled.ico) {
      add(findAll(t, /(?:IČO|IČ)[:\s]*(\d{8})/gi, "ico", v => isValidICO(v.replace(/\D/g,"")), 1).map(h => {
        h.reasons = ["checksum","label:IČO"];
        return h;
      }));
      add(findAll(t, /(?<![\/=?&%.@#-])\b\d{8}\b(?![\/=?&%.@#-])/g, "ico", (v,f,i) => {
        if (!isValidICO(v)) return false;
        const nearLabel = /IČO|IČ/i.test(f.slice(Math.max(0,i-16), i));
        if (nearLabel) return true;
        if (sus === "high") return ctxHas(f,i,i+8,["ičo","ico","identifikační","identifikacni","společnost","s.r.o","s. r. o","a.s"], win);
        if (sus === "low") return ctxHas(f,i,i+8,["ičo","ico","identifikační číslo","identifikacni cislo"], win);
        return ctxHas(f,i,i+8,["ičo","ico","identifikač","ič"], win);
      }).map(h => {
        const why = ctxWhich(t,h.start,h.end,["ičo","ico","identifikační","ič"], win);
        h.reasons = ["checksum"].concat(why.length?["context:"+why[0]]:[]).concat(/IČO|IČ/i.test(t.slice(Math.max(0,h.start-16),h.start))?["label:IČO"]:[]);
        return h;
      }));
    }
    if (enabled.dic) add(findAll(t, /\bCZ\s?\d{8,10}\b/gi, "dic", isValidDIC), ["checksum","format"]);
    if (enabled.account) {
      add(findAll(t, /\bCZ\d{2}(?:\s?\d{4}){5}\b/gi, "account", ibanOk), ["iban","checksum"]);
      add(findAll(t, /(?<![=?&%.@#-])\b\d{1,6}-\d{2,10}\/\d{4}\b(?![=?&%.@#-])/g, "account"), ["format"]);
      add(findAll(t, /(?<![=?&%.@#-])\b\d{6,16}\/\d{4}\b(?![=?&%.@#-])/g, "account", (v,f,i) => {
        if (parseRC(v.replace("/",""))) return false;
        if (sus === "high") return ctxHas(f,i,i+v.length,["účet","ucet","account","iban","bank","číslo účtu"], win);
        const needles = sus === "low"
          ? ["číslo účtu","cislo uctu","účet","ucet","iban","bankovní účet"]
          : ["účet","ucet","account","iban","bank"];
        return ctxHas(f,i,i+v.length, needles, win);
      }).map(h => {
        const why = ctxWhich(t,h.start,h.end,["účet","ucet","iban","bank","account"], win);
        h.reasons = ["format"].concat(why.length?["context:"+why[0]]:[]);
        return h;
      }));
    }
    if (enabled.phone) add(findAll(t, /(?<![\/=?&%.@#-])(?:(?:\+|00)420[\s-]*)?(?:(?:\d{3}[\s-]){2}\d{3}|\d{9})(?![\/=?&%.@#-])/g, "phone", (v,f,i) => {
      const d = v.replace(/\D/g,"");
      if (d.length===12 && d.startsWith("420")) { return true; }
      if (d.length===11 && d.startsWith("420")) return false;
      if ((d.length===12 || d.length===14) && d.startsWith("00420")) return true;
      if (d.length!==9 || !/^[2-9]/.test(d)) return false;
      if (parseRC(d) && ctxHas(f,i,i+v.length,["rodn","r.č","rč","nar."], win)) return false;
      if (v.trim().startsWith("+") || v.trim().startsWith("00") || /[\s-]/.test(v)) return true;
      if (sus === "low") return ctxHas(f,i,i+v.length,["tel","telefon","mobil","phone","kontakt"], win);
      return ctxHas(f,i,i+v.length,["tel","telefon","mobil","phone","kontakt"], win);
    }).map(h => {
      const d = h.value.replace(/\D/g,"");
      h.reasons = ["format"];
      if (d.startsWith("420") || h.value.includes("+")) h.reasons.push("label:+420");
      const why = ctxWhich(t,h.start,h.end,["tel","telefon","mobil","phone","kontakt"], win);
      if (why.length) h.reasons.push("context:"+why[0]);
      return h;
    }));
    if (enabled.email) add(findAll(t, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "email"), ["format"]);
    if (enabled.address) {
      add(findAll(t, /(?:se sídlem|se sidlem|bytem|adresa|sídlo|sidlo)[:\s]+([^\n]{8,90})/gi, "address", (v) => /\d/.test(v), 1).map(h => {
        h.reasons = ["label:adresa","gazetteer"];
        const cut = h.value.split(/\s{2,}|\t/)[0];
        if (cut && cut.length >= 8) { h.value = cut; h.end = h.start + cut.length; }
        return h;
      }));
      add(findAll(t, /(?<!\p{L})(?:bytem|trvale bytem|bydlištěm|se sídlem|sídlo|adresa)\s+(?:v\s+|ve\s+)?([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+)?)(?!\p{L})/giu, "address", (v) => !/^(?:České|Slovenské|roce|dne)\b/i.test(v), 1).map(h => {
        h.reasons = ["label:adresa","context:bytem"];
        return h;
      }));
      add(findAll(t, /(?<!\p{L})(?:v|ve)\s+(Praze|Brně|Ostravě|Plzni|Olomouci|Liberci|Českých Budějovicích|Hradci Králové|Ústí nad Labem|Pardubicích|Zlíně|Kladně|Mostě|Opavě|Karviné|Jihlavě|Teplicích|Děčíně|Karlových Varech|Chomutově|Mladé Boleslavi|Prostějově|Přerově|České Lípě|Třebíči|Třinci|Táboře|Znojmě|Příbrami|Chebu|Kolíně|Trutnově|Písku|Kroměříži|Šumperku|Vsetíně|Hodoníně|Novém Jičíně|Uherském Hradišti|Břeclavi|Litoměřicích|Sokolově|Havlíčkově Brodě|Chrudimi|Strakonicích|Klatovech|Jičíně)(?!\p{L})/giu, "address", null, 1).map(h => {
        h.reasons = ["gazetteer:city"];
        return h;
      }));
      add(findAll(t, /\p{Lu}[\p{L}.]+(?:\s+\p{Lu}[\p{L}.]+)*\s+(?:náměstí|nám\.|namesti|třída|trida|ulice|nábřeží|nabrezi|alej|sady)\s+\d{1,4}(?:\s*\/\s*\d{1,4})?/giu, "address"), ["gazetteer"]);
      add(findAll(t, /\p{Lu}\p{Ll}+(?:ova|ová|ská|cká|ního|kého)?\s+\d{1,4}\s*\/\s*\d{1,4}/gu, "address"), ["format"]);
      if (sus !== "low") {
        add(findAll(t, /\p{Lu}\p{Ll}+(?:ova|ová|ská|cká|ního|kého)\s+\d{1,4}\b/gu, "address", (v,f,i) =>
          ctxHas(f,i,i+v.length,["ulice","bytem","adresa","sídlo","sidlo","se sídlem"], win)
        ), ["format","context"]);
      }
      add(findAll(t, /\b\d{3}\s?\d{2}\b/g, "address", (v,f,i) => {
        const n=+v.replace(/\s/g,"");
        if (n<10000 || n>79999) return false;
        const needles = sus === "low"
          ? ["psč","psc","adresa","ulice","obec","bytem","sídlo","sidlo"]
          : ["psč","psc","adresa","ulice","obec","bytem","sídlo","sidlo","praha","brno"];
        return ctxHas(f,i,i+v.length, needles, win) || /\b\d{3}\s?\d{2}\s+\p{Lu}/u.test(f.slice(i, i+v.length+24));
      }).map(h => {
        const why = ctxWhich(t,h.start,h.end,["psč","psc","adresa","bytem","sídlo","praha","brno"], win);
        h.reasons = ["format"].concat(why.length?["context:"+why[0]]:[]);
        return h;
      }));
    }
    if (enabled.dob) add(findAll(t, /\b(?:0?[1-9]|[12]\d|3[01])\.\s*(?:0?[1-9]|1[0-2])\.\s*(?:19|20)\d{2}\b/g, "dob", (v,f,i) => {
      if (isContractDateCtx(f,i,i+v.length, win)) return false;
      if (sus === "high") return ctxHas(f,i,i+v.length,["nar","narozen","narozena","datum narození","birth","dob"], win);
      const needles = sus === "low" ? ["narozen","nar.","datum narození","birth"] : ["nar","narozen","birth","dob"];
      return ctxHas(f,i,i+v.length, needles, win);
    }).map(h => {
      const why = ctxWhich(t,h.start,h.end,["nar.","narozen","datum narození","birth"], win);
      h.reasons = ["format"].concat(why.length?["context:"+why[0]]:[]);
      return h;
    }));
    if (enabled.idcard) add(findAll(t, /(?<![\/=?&%.@#-])\b\d{9}\b(?![\/=?&%.@#-])/g, "idcard", (v,f,i) => {
      if (parseRC(v) && ctxHas(f,i,i+9,["rodn","r.č","rč","nar."], win)) return false;
      if (sus === "low") return ctxHas(f,i,i+9,["občanský průkaz","obcansky prukaz","pas","doklad totožnosti","passport"], win);
      return ctxHas(f,i,i+9,["občansk","průkaz","pas","doklad","passport","op"], win);
    }).map(h => {
      const why = ctxWhich(t,h.start,h.end,["průkaz","pas","doklad","passport","op"], win);
      h.reasons = ["format"].concat(why.length?["context:"+why[0]]:[]);
      return h;
    }));
    if (enabled.sigcert) {
      add(findAll(t, /(?:sériové\s+č[ií]slo(?:\s+certifikátu)?|sériové\s+č\.?\s*cert\.?|seriove\s+cislo|serial\s*number|serialnumber|s\/n)\s*[:=]?\s*([0-9A-Fa-f]{2}(?:[:\s-]?[0-9A-Fa-f]{2}){3,19}|[0-9A-Fa-f]{6,40}|\d{6,12})/giu, "sigcert", null, 1).map(h => {
        h.reasons = ["label:sériové číslo","cert-serial"];
        return h;
      }));
      add(findAll(t, /(?:podpisuj[íi]c[íi]|podepisuj[íi]c[íi]|podepsal(?:\/a)?|signed\s+by)\s*[:=]\s*([^\n]{3,80})/giu, "sigcert", v => {
        const s = String(v||"").trim();
        if (!s || /^(čb[uú]|organizace|postsignum)/i.test(s)) return false;
        return /\p{L}{3,}/u.test(s);
      }, 1).map(h => {
        h.reasons = ["label:podpisující","visible-stamp"];
        return h;
      }));
      add(findAll(t, /\bserialNumber\s*=\s*([A-Za-z0-9][A-Za-z0-9\/. -]{2,38}[A-Za-z0-9])(?=\s*[,\n]|$)/g, "sigcert", null, 1), ["label:serialNumber","dn"]);
      add(findAll(t, /(?:otisk(?:\s*\(?(?:sha-?1|sha-?256|sha-?384|sha-?512|md5)\)?)?|fingerprint|thumbprint|digest)\s*[:=]?\s*((?:[0-9A-Fa-f]{2}[:\s]){15,63}[0-9A-Fa-f]{2}|[0-9A-Fa-f]{32,128})/giu, "sigcert", null, 1).map(h => {
        h.reasons = ["label:otisk","hash"];
        return h;
      }));
      if (sus !== "low") {
        add(findAll(t, /\b[0-9A-Fa-f]{32}\b|\b[0-9A-Fa-f]{40}\b|\b[0-9A-Fa-f]{64}\b|\b[0-9A-Fa-f]{128}\b/g, "sigcert", (v,f,i) => {
          if (sus === "high") return ctxHas(f,i,i+v.length,["podpis","certifikát","otisk","hash","fingerprint","thumbprint","signature"], 90);
          return ctxHas(f,i,i+v.length,["otisk","fingerprint","thumbprint","hash"], 60);
        }), ["format","hash-length"]);
      }
      add(findAll(t, /\/(?:Contents|ByteRange)\s*[<\[][^\n]{6,4000}?[>\]]/g, "sigcert"), ["format","pdf-sig-structure"]);
      add(findAll(t, /-----BEGIN PKCS7-----[\s\S]{0,20000}?-----END PKCS7-----/g, "sigcert"), ["format","pkcs7-blob"]);
    }
    if (enabled.datovka) {
      add(findAll(t, /(?:datov\p{L}*\s+schrán\p{L}*|dat\.?\s*schránk\p{L}*|IDDS|ID\s*DS|datovka)\W{0,4}([a-z0-9]{7})\b/giu, "datovka", v => /\d/.test(v) && /[a-z]/i.test(v), 1), ["label:datovka","format"]);
      if (sus === "high") {
        add(findAll(t, /\b[a-z0-9]{7}\b/gi, "datovka", (v,f,i) => /\d/.test(v) && /[a-z]/i.test(v) && ctxHas(f,i,i+7,["schrán","schrank","datov","idds"], win)), ["context","format"]);
      }
    }
    if (enabled.spz) {
      add(findAll(t, /\b[1-9][A-ZÁ]{1,2}\s?\d{4}\b/g, "spz", (v,f,i) => {
        if (sus === "low") return ctxHas(f,i,i+v.length,["spz","registrační značka","vozidlo","rz"], win);
        if (sus === "high") return true;
        return ctxHas(f,i,i+v.length,["spz","vozid","značk","plate"], win) || true;
      }).map(h => { h.reasons = ["format"]; return h; }));
      add(findAll(t, /\b(?:EL|AK|EB|EE)\s?\d{2,4}\b/g, "spz", (v,f,i) => sus==="high" || ctxHas(f,i,i+v.length,["spz","vozid","značk","elektro"], win)), ["format"]);
    }
    if (enabled.name) {
      const isOcr = Boolean((options && (options.ocrActive || options.ocr)) || sState.ocrActive);
      function levenshteinDist1(a, b) {
        const al = a.length, bl = b.length;
        if (Math.abs(al - bl) > 1) return false;
        if (al === bl) {
          let diff = 0;
          for (let i = 0; i < al; i++) {
            if (a[i] !== b[i]) {
              diff++;
              if (diff > 1) return false;
            }
          }
          return diff <= 1;
        }
        const [shorter, longer] = al < bl ? [a, b] : [b, a];
        let i = 0, j = 0, diff = 0;
        while (i < shorter.length && j < longer.length) {
          if (shorter[i] !== longer[j]) {
            diff++;
            if (diff > 1) return false;
            j++;
          } else {
            i++;
            j++;
          }
        }
        return true;
      }
      function fuzzyMatchKnownName(cand) {
        if (!cand || cand.length < 6) return false;
        const candLow = cand.toLocaleLowerCase("cs");
        if (!ONOMASTIC_TRIE) initOnomasticRegistry();
        for (const name of NAMES) {
          if (name.length < 6) continue;
          if (Math.abs(name.length - candLow.length) > 1) continue;
          if (levenshteinDist1(candLow, name)) return true;
        }
        return false;
      }

      const titlePat = TITLES.map(tp => tp.split("").map(c => "["+c.toUpperCase()+c.toLowerCase()+"]").join("")).join("|");
      const postTitles = "Ph\\.?D\\.?|CSc\\.?|DrSc\\.?|DiS\\.?|MBA|LL\\.?M\\.?|MPA|DSc\\.?|Th\\.?D\\.?";
      const rawTitledHits = findAll(t, new RegExp("(?<![\\p{L}\\p{N}])(?:"+titlePat+")\\.?,?\\s+(?:(?:"+titlePat+")\\.?,?\\s+)*(?:(?!(?:"+titlePat+")\\b)(?!\\p{Lu}\\p{Ll}*:)\\p{Lu}\\p{Ll}+)(?:[ \\t]+(?:(?!(?:"+titlePat+")\\b)(?!\\p{Lu}\\p{Ll}*:)\\p{Lu}\\p{Ll}+)){0,3}(?:\\s*,\\s*(?:"+postTitles+"))?(?!\\s+(?:"+titlePat+")\\b)","gu"), "name").map(h => {
        let val = h.value;
        const postMatch = val.match(/,\s*(?:Ph\.?D\.?|CSc\.?|DrSc\.?|DiS\.?|MBA|LL\.?M\.?|MPA|DSc\.?|Th\.?D\.?)$/i);
        const postStr = postMatch ? postMatch[0] : "";
        const prePost = postMatch ? val.slice(0, val.length - postStr.length) : val;
        const words = prePost.split(/([ \t]+)/);
        let trimmed = false;
        while (words.length > 1) {
          const lastWord = words[words.length - 1];
          if (/^[ \t]+$/.test(lastWord)) { words.pop(); continue; }
          const low = lastWord.toLocaleLowerCase("cs").replace(/[.,;:!?]/g, "");
          if (isCzechVerbOrParticiple(low) || (RE_AGENDA_APELATIVA.test(low) && !NAMES.has(low) && !isOnomasticName(low))) {
            words.pop();
            trimmed = true;
          } else {
            break;
          }
        }
        if (trimmed) {
          const newVal = words.join("") + postStr;
          h.end = h.start + newVal.length;
          h.value = newVal;
        }
        return h;
      });
      add(rawTitledHits, ["titled"]);
      add(findAll(t, /(?<![\p{L}\p{N}])\p{Lu}\.\s+\p{Lu}\p{Ll}{2,}(?![\p{L}\p{N}])/gu, "name", v => looksName(v.split(/\s+/).pop()||"")), ["initials"]);
      add(findAll(t, /(?<![\p{L}\p{N}])\p{Lu}\p{Ll}{2,}(?:ová|á)\s+roz\.\s+\p{Lu}\p{Ll}{2,}/gu, "name"), ["format","label:roz"]);
      add(findAll(t, /(?<![\p{L}\p{N}])\p{Lu}\p{Ll}{3,}(?:ovi|em|ové)(?![\p{L}\p{N}])/gu, "name", v => looksName(v)), ["declined"]);
      const roleWords = new Set(["v","dne","na","pro","při","the","this","zástupce","ředitel","ředitelka","objednatel","zhotovitel","jednatel","jednatelka","předseda","předsedkyně","místopředseda","starosta","starostka","primátor","primátorka","ministr","ministryně","náměstek","náměstkyně","kupující","prodávající","žalobce","žalovaná","žalovaný","dlužník","věřitel","správce","vlastník","žadatel","zapsal","zapsala","schválil","schválila","omluven","omluvena","omluveni","přítomen","přítomna","přítomni","odpovídá","zpracoval","zpracovala","zpracuje","porada","poradu","poradě","porady","termín"]);

      // Procedural and social role triggers (Ticket 02)
      function ciPat(s) {
        return s.split('').map(c => {
          const up = c.toUpperCase(), low = c.toLowerCase();
          return up !== low ? '[' + up + low + ']' : c;
        }).join('');
      }

      const roleWordsList = [
        'žalobce', 'žalobci', 'žalobcem', 'žalobkyně', 'žalobkyni', 'žalobkyní',
        'žalovaný', 'žalovaného', 'žalovanému', 'žalovaným', 'žalovaná', 'žalované', 'žalovanou',
        'svědek', 'svědka', 'svědkovi', 'svědkem', 'svědkyně', 'svědkyni', 'svědkyní',
        'obžalovaný', 'obžalovaného', 'obžalovanému', 'obžalovaným', 'obžalovaná', 'obžalované', 'obžalovanou',
        'poškozený', 'poškozeného', 'poškozenému', 'poškozeným', 'poškozená', 'poškozené', 'poškozenou',
        'jednatel', 'jednatele', 'jednateli', 'jednatelem', 'jednatelka', 'jednatelky', 'jednatelce', 'jednatelku', 'jednatelkou',
        'pan', 'pana', 'panu', 'panem', 'paní',
        'zapsal', 'zapsala', 'schválil', 'schválila', 'schváleno',
        'omluven', 'omluvena', 'omluveni', 'omluveno',
        'přítomen', 'přítomna', 'přítomni',
        'odpovídá', 'zpracoval', 'zpracovala', 'zpracuje'
      ];
      const roleTriggersPattern = roleWordsList.map(ciPat).join('|');
      const namePartPattern = '\\p{Lu}[\\p{L}\x27-]+';
      const namePhrasePattern = namePartPattern + '(?:[ \\t]+' + namePartPattern + '){0,3}(?:\\s*,\\s*(?:' + postTitles + '))?';

      // 1. Procedural and social role triggers
      const roleRe = new RegExp('(?<![\\p{L}\\p{N}])(' + roleTriggersPattern + ')(?![\\p{L}\\p{N}])(?:\\s*[:=]\\s*|\\s+)(?:(?:' + titlePat + ')\\.?,?\\s+)*(' + namePhrasePattern + ')(?![\\p{L}\\p{N}])', 'gu');
      let rm;
      while ((rm = roleRe.exec(t)) !== null) {
        const fullMatch = rm[0];
        const rawName = rm[2];
        if (!rawName || isPublic(rawName)) continue;
        const nameClean = rawName.replace(/,.*$/, "").trim();
        const words = nameClean.split(/\s+/);
        const firstLow = (words[0]||"").toLocaleLowerCase("cs");
        if (roleWords.has(firstLow)) continue;
        const nameOffsetInMatch = fullMatch.lastIndexOf(rawName);
        const nStart = rm.index + nameOffsetInMatch;
        const nEnd = nStart + rawName.length;
        const isMulti = words.length >= 2;
        const isFuzzy = isOcr && words.length === 1 && !NAMES.has(words[0].toLocaleLowerCase("cs")) && fuzzyMatchKnownName(words[0]);
        push({
          type: "name",
          value: rawName,
          start: nStart,
          end: nEnd,
          reasons: isFuzzy ? ["ocr:fuzzy", "trigger:role"] : ["trigger:role"],
          confidence: isMulti || isFuzzy ? "high" : "medium",
          accept: true
        });
      }

      // 2. Administrative marker triggers
      const adminMarkersPattern = '(?:[Nn][Aa][Rr]\\.|[Nn][Aa][Rr][Oo][Zz][Ee][Nn](?:[aeyáí]|ého|ému|ým)?|[Bb][Yy][Tt][Ee][Mm]|[Tt][Rr][Vv][Aa][Ll][Ee]\\s+[Bb][Yy][Tt][Ee][Mm]|[Rr]\\.?\\s*[Čč]\\.?|[Rr][Oo][Dd][Nn][Éé](?:[Hh][Oo])?\\s+[Čč][Íí][Ss][Ll][Oo])';

      // Case A: Name preceding admin marker, e.g. "John Smith, nar. 1980" or "John Smith, bytem v Praze"
      const adminFollowRe = new RegExp('(?<![\\p{L}\\p{N}])(' + namePhrasePattern + ')\\s*,\\s*(?:' + adminMarkersPattern + ')(?![\\p{L}\\p{N}])', 'gu');
      let afm;
      while ((afm = adminFollowRe.exec(t)) !== null) {
        const rawName = afm[1];
        if (!rawName || isPublic(rawName)) continue;
        const words = rawName.replace(/,.*$/, "").trim().split(/\s+/);
        const firstLow = (words[0]||"").toLocaleLowerCase("cs");
        if (roleWords.has(firstLow)) continue;
        const isFuzzy = isOcr && words.length === 1 && !NAMES.has(words[0].toLocaleLowerCase("cs")) && fuzzyMatchKnownName(words[0]);
        push({
          type: "name",
          value: rawName,
          start: afm.index,
          end: afm.index + rawName.length,
          reasons: isFuzzy ? ["ocr:fuzzy", "trigger:official"] : ["trigger:official"],
          confidence: "high",
          accept: true
        });
      }

      // Case B: Admin marker preceding name, e.g. "narozen: Petr Novák"
      const adminLeadRe = new RegExp('(?:[Nn][Aa][Rr]\\.|[Nn][Aa][Rr][Oo][Zz][Ee][Nn](?:[aeyáí]|ého|ému|ým)?)\\s*[:=]?\\s*(?:(?:' + titlePat + ')\\.?,?\\s+)*(' + namePhrasePattern + ')(?![\\p{L}\\p{N}])', 'gu');
      let alm;
      while ((alm = adminLeadRe.exec(t)) !== null) {
        const rawName = alm[1];
        if (!rawName || isPublic(rawName)) continue;
        if (/^\d/.test(rawName)) continue;
        const words = rawName.replace(/,.*$/, "").trim().split(/\s+/);
        const firstLow = (words[0]||"").toLocaleLowerCase("cs");
        if (roleWords.has(firstLow)) continue;
        const isFuzzy = isOcr && words.length === 1 && !NAMES.has(words[0].toLocaleLowerCase("cs")) && fuzzyMatchKnownName(words[0]);
        const nameIdx = alm.index + alm[0].lastIndexOf(rawName);
        push({
          type: "name",
          value: rawName,
          start: nameIdx,
          end: nameIdx + rawName.length,
          reasons: isFuzzy ? ["ocr:fuzzy", "trigger:official"] : ["trigger:official"],
          confidence: "high",
          accept: true
        });
      }

      // 3. Dedicated OCR fuzzy scan near triggers for OCR-defective tokens (Ticket 05)
      if (isOcr) {
        const ocrRolePattern = roleWordsList.map(ciPat).join('|');
        const ocrAdminPattern = adminMarkersPattern;
        const ocrCombPattern = '(?:' + ocrRolePattern + '|' + ocrAdminPattern + ')';
        const ocrScanRe = new RegExp('(?<![\\p{L}\\p{N}])(' + ocrCombPattern + ')(?![\\p{L}\\p{N}])', 'gu');
        let osm;
        while ((osm = ocrScanRe.exec(t)) !== null) {
          const trigStart = osm.index;
          const trigEnd = trigStart + osm[0].length;
          const trigWord = osm[1].toLocaleLowerCase("cs");
          const isRoleTrig = roleWords.has(trigWord) || roleWordsList.some(rw => trigWord.startsWith(rw));
          const trigReason = isRoleTrig ? "trigger:role" : "trigger:official";

          // Window after trigger
          const afterSlice = t.slice(trigEnd, Math.min(t.length, trigEnd + 50));
          const afterTokenRe = /(?:(?:\s*[:=]\s*|\s+)(?:(?:prof|doc|mudr|judr|phdr|rndr|ing|arch|mgr|bc)\.?\s*)*)\b([\p{L}\p{N}]{6,})\b/giu;
          let atm;
          while ((atm = afterTokenRe.exec(afterSlice)) !== null) {
            const tok = atm[1];
            if (roleWords.has(tok.toLocaleLowerCase("cs"))) continue;
            if (fuzzyMatchKnownName(tok)) {
              const tokStart = trigEnd + atm.index + atm[0].lastIndexOf(tok);
              const tokEnd = tokStart + tok.length;
              push({
                type: "name",
                value: tok,
                start: tokStart,
                end: tokEnd,
                reasons: ["ocr:fuzzy", trigReason],
                confidence: "high",
                accept: true
              });
            }
          }

          // Window before trigger
          const beforeSlice = t.slice(Math.max(0, trigStart - 50), trigStart);
          const beforeTokenRe = /\b([\p{L}\p{N}]{6,})\b(?:\s*,\s*|\s*)$/giu;
          let btm;
          while ((btm = beforeTokenRe.exec(beforeSlice)) !== null) {
            const tok = btm[1];
            if (roleWords.has(tok.toLocaleLowerCase("cs"))) continue;
            if (fuzzyMatchKnownName(tok)) {
              const tokStart = Math.max(0, trigStart - 50) + btm.index;
              const tokEnd = tokStart + tok.length;
              push({
                type: "name",
                value: tok,
                start: tokStart,
                end: tokEnd,
                reasons: ["ocr:fuzzy", trigReason],
                confidence: "high",
                accept: true
              });
            }
          }
        }
      }

      add(findAll(t, new RegExp("(?<![\\p{L}\\p{N}])(?!\\p{Lu}\\p{Ll}*:)\\p{Lu}\\p{Ll}{2,}[ \\t]+(?!\\p{Lu}\\p{Ll}*:)\\p{Lu}\\p{Ll}{2,}(?:\\s*,\\s*(?:"+postTitles+"))?(?![\\p{L}\\p{N}])", "gu"), "name", (v) => {
        const clean = v.replace(/,.*$/, "").trim();
        const p = clean.split(/[ \t]+/);
        const first = (p[0]||"").toLocaleLowerCase("cs");
        const second = (p[1]||"").toLocaleLowerCase("cs");
        if (roleWords.has(first) || roleWords.has(second)) return false;
        if (isCzechVerbOrParticiple(first) || isCzechVerbOrParticiple(second)) return false;
        if ((RE_AGENDA_APELATIVA.test(first) && !NAMES.has(first) && !isOnomasticName(first)) ||
            (RE_AGENDA_APELATIVA.test(second) && !NAMES.has(second) && !isOnomasticName(second))) return false;
        if (sus === "low") return (NAMES.has(first) || looksName(p[0])) && looksName(p[1]);
        if (sus === "high") return true;
        return NAMES.has(first) || looksName(p[0]) || looksName(p[1]);
      }).map(h => {
        h.reasons = ["format"];
        return h;
      }).filter(h => !isPublic(h.value)));
    }
    if (enabled.secrets) (secrets||[]).forEach(p => { p=p.trim(); if (p.length<3) return; add(findAll(t, dictRe(p), "secrets"), ["dict"]); });
    const ticketHits = [];
    const prefList = projectPrefixes();
    if (enabled.ticket) {
      findAll(t, /\b[A-Z][A-Z0-9]{1,9}-\d{2,7}\b/g, "ticket", v => {
        const pref = v.split("-")[0];
        return pref.length >= 2 && !TICKET_STOP.has(pref);
      }).forEach(h => {
        const pref = h.value.split("-")[0];
        h.reasons = ["format"];
        if (prefList.has(pref)) h.reasons.push("prefix-list");
        h.confidence = prefList.has(pref) || pref.length>=4 ? "high" : "medium";
        push(h);
        ticketHits.push(h);
      });
    }
    if (enabled.incident) add(findAll(t, /\b(?:HD|INC|CHG|REQ|RITM|PRB)\s*[-:]?\s*\d{3,7}\b/gi, "incident"), ["format"]);
    if (enabled.casefile) {
      add(findAll(t, /(?<!\p{L})(?:č\.?\s*j\.?|čj\.?|sp\.?\s*zn\.?)\s*(?:[I-IV]+\.\s*)?(?:(?:[A-Za-z0-9Á-Ž.-]+)\s+){0,3}\d+\/\d+(?:-\d+)?(?!\p{L})/giu, "casefile"), ["label:č.j."]);
      add(findAll(t, /(?<![\p{L}\p{N}])[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,8}\s+\d{3,6}\/\d{4}(?![\p{L}\p{N}])/gu, "casefile", (v,f,i) => {
        if (/^(?:ZÁKON|VYHL|NAŘ)\b/i.test(v)) return false;
        if (sus === "low") return ctxHas(f,i,i+v.length,["řízení","rizeni","spis","č.j","čj","sbs"], win);
        return true;
      }), ["format"]);
    }
    const dictPush = (raw, type) => {
      parseDict(raw).forEach(d => {
        if (!d.name || d.name.length < 2) return;
        findAll(t, dictRe(d.name), type).forEach(h => {
          h.tokenClass = d.kind || "";
          h.reasons = ["dict"];
          h.confidence = "high";
          push(h);
        });
      });
    };
    if (enabled.system) {
      dictPush((options && options.systems != null) ? options.systems : (sState.systems || ""), "system");
      add(findAll(t, /(?:systém|system|aplikace|modul|rozhraní|integrace|platforma)\s+[\p{L}\p{N}][\p{L}\p{N}./-]{1,32}/giu, "system", (v,f,i) => {
        const name = v.replace(/^(?:systém|system|aplikace|modul|rozhraní|integrace|platforma)\s+/i, "");
        const dictNames = parseDict((options && options.systems != null) ? options.systems : (sState.systems || "")).map(d => d.name.toLocaleLowerCase("cs"));
        if (dictNames.some(n => n && (name.toLocaleLowerCase("cs")===n || n.includes(name.toLocaleLowerCase("cs"))))) return false;
        if (TICKET_STOP.has(name.toUpperCase().replace(/\.$/,""))) return false;
        if (sus === "low") return ctxHas(f,i,i+v.length,["intern","nasaz","prod","test","integr"], win);
        return name.length >= 3;
      }).map(h => { h.reasons = ["label:systém"]; return h; }));
    }
    if (enabled.project) {
      dictPush((options && options.projects != null) ? options.projects : (sState.projects || ""), "project");
      const prefixes = new Set(ticketHits.map(h => (h.value.split("-")[0]||"").toUpperCase()).filter(p => p.length>=3 && !TICKET_STOP.has(p)));
      prefList.forEach(p => prefixes.add(p));
      prefixes.forEach(pref => {
        findAll(t, new RegExp("(?<![\\p{L}\\p{N}])"+pref.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![\\p{L}\\p{N}])","g"), "project", (v,f,i) => {
          return !ticketHits.some(th => i >= th.start && i < th.end);
        }).forEach(h => { h.tokenClass = "PROJEKT"; h.reasons = ["prefix-list"]; h.confidence = "medium"; push(h); });
      });
    }
    if (enabled.orgunit) dictPush((options && options.orgs != null) ? options.orgs : (sState.orgs || ""), "orgunit");
    if (enabled.status) {
      add(findAll(t, /(?:hotfix(?:\s+nasazen[oaíy]?\s+na\s+produkci)?|rollback|outage|go-?live|nasazen[oaíy]?\s+na\s+produkci|v\s+produkci|produkční\s+(?:vad[ay]|stav|prostředí)(?:\s+v\s+[^\s,.;]{1,32})?|prod(?:ukce)?\s+(?:down|incident))/gi, "status").map(h => {
        h.statusKind = /incident|outage|vad/i.test(h.value) ? "incident" : /hotfix|go-?live|nasazen|release|verz/i.test(h.value) ? "release" : "prod";
        h.reasons = ["format"];
        return h;
      }));
    }
    if (enabled.host) {
      add(findAll(t, /\b(?:https?:\/\/)[^\s<>"']+/gi, "host", (v) => {
        try {
          const u = new URL(v.replace(/[),.;]+$/,""));
          const host = u.hostname.toLowerCase();
          if (/\.(internal|intranet|corp|local|lan)$/.test(host)) return true;
          if (/(^|\.)(intranet|internal|mailhost|vpn)\./.test(host)) return true;
          const dict = parseDict(((options && options.systems != null) ? options.systems : (sState.systems || "")) + "\n" + ((options && options.projects != null) ? options.projects : (sState.projects || ""))).map(d => d.name.toLocaleLowerCase("cs"));
          return dict.some(n => n.length>=3 && host.includes(n.replace(/\s+/g,"").toLowerCase()));
        } catch (_) { return false; }
      }), ["format"]);
      add(findAll(t, /\b[a-z0-9][a-z0-9.-]{2,60}\.(?:internal|intranet|corp|local|lan)\b/gi, "host"), ["format"]);
    }
    if (enabled.ip) add(findAll(t, /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g, "ip", v => {
      return v.split(".").every(p => +p>=0 && +p<=255);
    }), ["private-range","format"]);
    if (enabled.credential) {
      add(findAll(t, /\b(?:sk-live-[A-Za-z0-9]{8,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._\-]{12,})\b/g, "credential"), ["format"]);
      add(findAll(t, /(?:heslo|password|passwd|secret|api[_-]?key)\s*[:=]\s*(\S{6,80})/gi, "credential", null, 1), ["label:secret"]);
    }
    if (enabled.geo) add(findAll(t, /\b-?\d{1,2}\.\d{4,8}\s*,\s*-?\d{1,3}\.\d{4,8}\b/g, "geo", (v,f,i) => {
      const m = v.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      if (!m) return false;
      const lat=+m[1], lon=+m[2];
      if (lat<48 || lat>51.2 || lon<12 || lon>19) return sus==="high" && ctxHas(f,i,i+v.length,["gps","souřad","coord","lat"], win);
      return true;
    }), ["format"]);

    // --- Fáze 2: katastrální údaje (parcely, LV, k.ú.) ---
    if (enabled.katastr) {
      // parc. č. 123/4, st. parc. 55, p. č. 12, parcelní číslo 7/1
      add(findAll(t, /(?:\b(?:st\.\s*)?parc(?:\.|el(?:a|y|u|ou|e)?)|\bp\.\s?č\.|\bparceln[íi]\s+čísl[oa])\s*(?:č\.|čís\.|číslo|č)?\s*(\d{1,5}(?:\s?\/\s?\d{1,4})?)\b/giu, "katastr", null, 1), ["label:parcela","format"]);
      // LV 456, L.V. 12, list vlastnictví č. 456
      add(findAll(t, /\b(?:LV|L\.\s?V\.)\s*(?:č\.\s*)?(\d{1,6})\b/g, "katastr", null, 1), ["label:LV","format"]);
      add(findAll(t, /\blist(?:u|em|y|ech)?\s+vlastnictví\s*(?:č\.\s*)?(\d{1,6})\b/giu, "katastr", null, 1), ["label:LV","format"]);
      // k.ú. Nové Město, katastrální území Vinohrady
      add(findAll(t, /(?:\b[Kk]\.\s?ú\.|\b[Kk]at\.\s?úz(?:emí|\.)|\bkatastrální(?:ho|m|mu)?\s+území)[ \t]+(\p{Lu}[\p{L}-]+(?:[ \t]+(?:(?:nad|pod|u|na|v|ve|při)[ \t]+)?\p{Lu}[\p{L}-]+){0,2})/gu, "katastr", null, 1), ["label:k.ú.","gazetteer"]);
    }

    // --- Fáze 2: zahraniční IBAN a SWIFT/BIC ---
    if (enabled.zahr_iban) {
      // cizí IBAN (ne CZ – ten řeší kategorie „account“), ověřený mod-97 a délkou země
      add(findAll(t, /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, "zahr_iban", v => ibanForeignOk(v)), ["iban","checksum"]);
      // SWIFT/BIC s popiskem
      add(findAll(t, /\b(?:SWIFT|Swift|swift|BIC|Bic|bic)(?:\s*\/\s*(?:SWIFT|Swift|BIC|Bic))?(?:\s+kód|\s+code)?\s*[:=]?\s*([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/g, "zahr_iban", v => SWIFT_CC.has(v.slice(4,6)), 1), ["label:SWIFT","format"]);
      // SWIFT/BIC bez přímého popisku – jen v kontextu (u nízké citlivosti vypnuto)
      if (sus !== "low") {
        add(findAll(t, /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g, "zahr_iban", (v,f,i) => SWIFT_CC.has(v.slice(4,6)) && /\d|^[A-Z]{8}$/.test(v) && ctxHas(f,i,i+v.length,["swift","bic","swift/bic"], win)), ["context","format"]);
      }
    }

    // --- Fáze 2: další doklady (cestovní pas, řidičský průkaz, ZTP) ---
    if (enabled.doklady_extra) {
      // cestovní pas: nutný popisek + číslice
      add(findAll(t, /(?:cestovn\p{L}*\s+(?:pas|doklad)\p{L}*|čísl[oa]\s+pasu|č\.\s*pasu|\bpas\s+(?:č\.|číslo)|passport(?:\s+(?:no\.?|number|nr\.?))?)\s*[:=]?\s*(?:č\.|číslo|no\.?)?\s*[:=]?\s*([A-Z0-9]{6,9})\b/giu, "doklady_extra", v => /\d/.test(v), 1), ["label:pas","format"]);
      // řidičský průkaz: série + číslo (EB 123456) u popisku
      add(findAll(t, /(?:řidičsk\p{L}*\s+(?:průkaz|licenc)\p{L}*|(?<![\p{L}\p{N}])ŘP(?![\p{L}\p{N}])|driv(?:ing|er'?s)\s+licen[cs]e)\s*(?:č\.|číslo|no\.?)?\s*[:=]?\s*((?:[A-Z]{1,2}\s?\d{6,8})|\d{8,9})\b/giu, "doklady_extra", null, 1), ["label:ŘP","format"]);
      add(findAll(t, /\b[A-Z]{2}\s?\d{6}\b/g, "doklady_extra", (v,f,i) => ctxHas(f,i,i+v.length,["řidičsk","řp","driving licen","driver's licen"], win)), ["context","format"]);
      // průkaz ZTP, ZTP/P
      add(findAll(t, /\bZTP(?:\s*\/\s*P)?\s*(?:průkaz\p{L}*\s*)?(?:č\.|číslo|č)?\s*[:=]?\s*((?:[A-Z]{1,3}\s?)?\d{5,9})\b/gu, "doklady_extra", null, 1), ["label:ZTP","format"]);
    }

    const urlTokens = urlSpans(src);
    if (urlTokens.length) {
      const survivors = [];
      const consumedUrls = new Set();
      bag.forEach(h => {
        const u = spanInUrl(urlTokens, h.start, h.end);
        if (!u) { survivors.push(h); return; }
        if (!enabled.host) return;
        const key = u.start+"|"+u.end;
        if (consumedUrls.has(key)) return;
        consumedUrls.add(key);
        const wholeUrl = finalizeHit({
          type: "host",
          value: src.slice(u.start, u.end),
          start: u.start,
          end: u.end,
          reasons: ["format","url-guard"]
        }, src);
        survivors.push(wholeUrl);
      });
      bag.length = 0;
      bag.push(...survivors);
    }

    // Remove known non-person phrases before overlap resolution, so a false
    // positive cannot suppress another detection based on score or span size.
    for (let i = bag.length - 1; i >= 0; i--) {
      const h = bag[i];
      if (
        h.type === "name" &&
        isLikelyNonPersonName(h.value, src, h.start, h.end, h.reasons)
      ) {
        bag.splice(i, 1);
      }
    }

    bag.sort((a,b)=>a.start-b.start || (b.end-a.start)-(a.end-a.start));
    const merged = [];
    const rank = (h) => scoreHit(h)*10 + (h.end-h.start);
    for (const h of bag) {
      const last = merged[merged.length-1];
      if (last && h.start < last.end) {
        if (h.type===last.type) {
          const hDict = !!(h.tokenClass || (h.reasons||[]).includes("dict"));
          const lDict = !!(last.tokenClass || (last.reasons||[]).includes("dict"));
          if (hDict && !lDict && h.end<=last.end) {
            last.start = h.start; last.end = h.end; last.value = src.slice(h.start,h.end);
            last.tokenClass = h.tokenClass || last.tokenClass;
            last.reasons = Array.from(new Set([].concat(last.reasons||[], h.reasons||[])));
            continue;
          }
          if (h.end>last.end) { last.end=h.end; last.value=src.slice(last.start,last.end); last.reasons = Array.from(new Set([].concat(last.reasons||[], h.reasons||[]))); if (h.tokenClass && !last.tokenClass) last.tokenClass = h.tokenClass; }
          continue;
        }
        const numeric = {rc:1,ico:1,dic:1,account:1,phone:1,idcard:1,zahr_iban:1,doklady_extra:1};
        if (numeric[h.type] && numeric[last.type]) {
          if (rank(h) > rank(last)) merged[merged.length-1] = h;
          continue;
        }
        if (h.end <= last.end) continue;
        if (rank(h) > rank(last) && h.start <= last.start) {
          merged[merged.length-1] = h;
          continue;
        }
        if (h.start < last.end && h.start > last.start) {
          merged.push(h);
          continue;
        }
        continue;
      }
      merged.push(h);
    }
    const clustered = merged.map((h, idx) => {
      let entityKey;
      if (h.type==="name") entityKey = "name|"+nameKey(h.value);
      else if (h.type==="ico") entityKey = "org|"+digits(h.value);
      else if (h.type==="dic") {
        const d = digits(h.value);
        entityKey = d.length===8 ? "org|"+d : "dic|"+h.value.toLocaleLowerCase("cs");
      } else if (h.type==="account") entityKey = accountKey(h.value);
      else if (h.type==="system" || h.type==="project") {
        const core = h.type==="system" ? systemCore(h.value) : h.value;
        entityKey = (h.tokenClass||h.type)+"|"+canonToken(core||h.value);
      } else {
        entityKey = (h.tokenClass||h.type)+"|"+canonToken(h.value);
      }
      const row = Object.assign({}, h, {
        id: idx+1,
        accept: true,
        page: h.page || pageOf(h.start),
        entityKey,
        reasons: Array.from(new Set(h.reasons||[]))
      });
      if (row.type==="system" || row.type==="project" || row.type==="orgunit") alignDictEntity(row, src);
      return row;
    });
    clusterNameKeys(clustered);
    expandCzechNameMorphology(src, clustered);
    const prof = (options && options.profile) || sState.profile || "publicai";
    if (prof === "court") {
      applyCourtProfileRules(src, clustered);
    }
    return clustered;
  }

  export function applyCourtProfileRules(text, hits){
    if (!text || !Array.isArray(hits) || hits.length === 0) return hits;

    // -------------------------------------------------------------------------
    // Tier 1: Názvy a sídla rozhodujících soudů (§ 4 odst. 3 písm. a)
    // -------------------------------------------------------------------------
    const RE_COURT_SEAT = /(?:(?:[Úú]stavní|[Nn]ejvyšší\s+správní|[Nn]ejvyšší|[Vv]rchní|[Kk]rajský|[Oo]kresní|[Mm]ěstský|[Oo]bvodní)(?:ho|mu|m)?\s+[Ss]oud(?:u|em)?)(?:\s+(?:[Vv]|[Vv]e|[Pp]ro)\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+(?:\s+(?:nad|pod)\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+)?(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+)?(?:\s*[-–]\s*[\p{L}\-]+)?(?:\s+\d+)?)?(?:\s*,\s*pobočk[a-y]\s+v\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+)?/gu;

    const courtSpans = [];
    let mCourt;
    while ((mCourt = RE_COURT_SEAT.exec(text)) !== null) {
      courtSpans.push({ start: mCourt.index, end: mCourt.index + mCourt[0].length });
    }

    courtSpans.forEach(span => {
      hits.forEach(h => {
        if (h.start >= span.start && h.end <= span.end) {
          h.accept = false;
          h.whitelisted = true;
          if (!h.reasons) h.reasons = [];
          if (!h.reasons.includes("whitelist:court-seat")) {
            h.reasons.push("whitelist:court-seat");
          }
        }
      });
    });

    // -------------------------------------------------------------------------
    // Tier 2: Rozhodující soudci a státní zástupci (§ 4 odst. 3 písm. d)
    // -------------------------------------------------------------------------
    const RE_OFFICIAL_ROLE_PREFIX = /(?:(?:předsed(?:a|ové|ovi|u|ou|y|e)|předsedkyn(?:ě|i|í|ou)|místopředsed(?:a|ové|ovi|u|ou|y|e)|místopředsedkyn(?:ě|i|í|ou))\s+senátu|(?:soudc(?:e|i|em|ové|ů|ům|ích)|soudkyn(?:ě|i|í|ou)|samosoudc(?:e|i|em|ové|ů|ům|ích)|samosoudkyn(?:ě|i|í|ou))(?:\s+(?:zpravodaj(?:e|i|em)?|zpravodajk(?:a|y|e|u|ou)))?|(?:asistent(?:ka|ky|ce|ku|kou)?|asistenti?)\s+soudce|vyšší(?:ho|mu|m)?\s+soudní(?:ho|mu|m)?\s+úřední(?:k|ka|kovi|kem|ci|ků|kům)|vyšší\s+soudní\s+úřednic(?:e|i|í)|státní(?:ho|mu|m)?\s+zástupc(?:e|i|em|ů|ům|ích)|státní\s+zástupkyn(?:ě|i|í|ou))(?:\s*,\s*|\s+(?:JUDr\.|Mgr\.|Ing\.|doc\.|prof\.|PhDr\.|JUDr|Mgr|Ing|Bc\.|RNDr\.)|\s+)*$/iu;

    const RE_PARTY_ROLE_PREFIX = /(?<!\p{L})(?:žalobc|žalovan|obžalovan|poškozen|svěd(?:ek|k)|obviněn|odsouzen|stěžovatel|navrhovatel|odpůrc|účastní|dlužní|úpadc)[a-záčďéěíňóřšťúůýž]*(?:\s*,\s*|\s+(?:JUDr\.|Mgr\.|Ing\.|doc\.|prof\.|PhDr\.|Bc\.)|\s+)*$/iu;

    const RE_SIGNATURE_SUFFIX = /^\s*,?\s*(?:v\.\s*r\.|v\.r\.|vlastní\s+rukou)(?!\p{L})/iu;

    const whitelistedEntityKeys = new Set();
    const partyEntityKeys = new Set();

    hits.forEach(h => {
      if (h.type !== "name") return;
      const pre = text.slice(Math.max(0, h.start - 80), h.start).trim();
      const post = text.slice(h.end, Math.min(text.length, h.end + 30));

      const isParty = RE_PARTY_ROLE_PREFIX.test(pre);
      if (isParty) {
        if (h.entityKey) partyEntityKeys.add(h.entityKey);
        return;
      }

      const isOfficialPre = RE_OFFICIAL_ROLE_PREFIX.test(pre);
      const isSignaturePost = RE_SIGNATURE_SUFFIX.test(post);

      if (isOfficialPre || isSignaturePost) {
        h.accept = false;
        h.whitelisted = true;
        if (!h.reasons) h.reasons = [];
        if (!h.reasons.includes("whitelist:court-official")) {
          h.reasons.push("whitelist:court-official");
        }
        if (h.entityKey) whitelistedEntityKeys.add(h.entityKey);
      }
    });

    hits.forEach(h => {
      if (h.type !== "name") return;
      if (h.entityKey && whitelistedEntityKeys.has(h.entityKey) && !partyEntityKeys.has(h.entityKey)) {
        h.accept = false;
        h.whitelisted = true;
        if (!h.reasons) h.reasons = [];
        if (!h.reasons.includes("whitelist:court-official")) {
          h.reasons.push("whitelist:court-official");
        }
      }
    });

    // -------------------------------------------------------------------------
    // Tier 3: Citace judikatury a odborné literatury (§ 4 odst. 3 písm. e)
    // -------------------------------------------------------------------------
    const RE_CASE_CITATIONS = /(?<!\p{L})(?:(?:rozsudek|nález|usnesení|stanovisko|rozhodnutí)\s+(?:ESLP|Soudního dvora|SDEU|Ústavního soudu|ÚS|Nejvyššího soudu|NS|Nejvyššího správního soudu|NSS)(?:\s+(?:ze dne|dne)\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4})?(?:\s*,\s*(?:sp\.\s*zn\.|č\.\s*j\.)\s*[^\n,;]+)?(?:\s+ve věci\s+[^\n,;.]+)?|ve věci\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-.]*(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-.]*)*\s+proti\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-.]*(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-.]*)*|(?:sp\.\s*zn\.|č\.\s*j\.)\s*(?:[I-IV]\.\s*ÚS\s+\d+\/\d+|\d+\s+[A-Za-z]+\s+\d+\/\d+))(?!\p{L})/giu;

    const citationSpans = [];
    let mCit;
    while ((mCit = RE_CASE_CITATIONS.exec(text)) !== null) {
      citationSpans.push({ start: mCit.index, end: mCit.index + mCit[0].length });
    }

    const RE_COMMENTATORS = /(?<!\p{L})[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\p{L}\-]+,\s*[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]\.(?:\s*a\s+kol\.)?/gu;
    let mComm;
    while ((mComm = RE_COMMENTATORS.exec(text)) !== null) {
      citationSpans.push({ start: mComm.index, end: mComm.index + mComm[0].length });
    }

    citationSpans.forEach(span => {
      hits.forEach(h => {
        if (h.start >= span.start && h.end <= span.end) {
          h.accept = false;
          h.whitelisted = true;
          if (!h.reasons) h.reasons = [];
          if (!h.reasons.includes("whitelist:court-citation")) {
            h.reasons.push("whitelist:court-citation");
          }
        }
      });
    });

    return hits;
  }

  export function filterCourtDecisionsWhitelist(text, hits){
    return applyCourtProfileRules(text, hits);
  }
  export function tokenBase(h, lang){
    if (h.tokenClass) return h.tokenClass;
    return LABEL[lang][h.type] || h.type.toUpperCase();
  }
  export function nextSuffix(type, n){
    if (type==="system" || type==="project" || type==="orgunit") {
      if (n <= 26) return String.fromCharCode(64 + n);
    }
    return String(n).padStart(3, "0");
  }

export function makeReplacer(mode, lang){
    const counters = {}; const map = new Map();
    return (h) => {
      if (h.type==="status" && (mode==="label" || mode==="pseudo" || mode==="xxxx")) {
        const kind = h.statusKind || "prod";
        return STATUS_GENERIC[lang][kind] || STATUS_GENERIC[lang].prod;
      }
      if (mode==="box") return "█".repeat(Math.max(4, Math.min(24, h.value.length)));
      if (mode==="xxxx") return "X".repeat(Math.max(4, h.value.length));
      const base = tokenBase(h, lang);
      if (mode==="label") return "["+base+"]";
      const key = h.entityKey || ((h.tokenClass||h.type)+"|"+canonToken(h.value));
      if (!map.has(key)) {
        counters[base]=(counters[base]||0)+1;
        map.set(key, { base, suffix: nextSuffix(h.type, counters[base]) });
      }
      const token = map.get(key);
      const formBase = declinedPersonTokenBase(token.base, h, lang);
      return "["+formBase+"_"+token.suffix+"]";
    };
  }
  export function bindReplacer(mode, lang, hits){
    const replacer = makeReplacer(mode, lang);
    effectiveHits(hits).forEach(h => { replacer(h); });
    return replacer;
  }
  export function buildGlossary(hits, mode, lang, publicOnly){
    const replacer = bindReplacer(mode, lang, hits);
    const rows = [];
    const seen = new Set();
    effectiveHits(hits).forEach(h => {
      const token = replacer(h);
      const k = h.type+"|"+h.value.toLocaleLowerCase("cs");
      if (seen.has(k)) return;
      seen.add(k);
      rows.push(publicOnly
        ? { token, type: h.type, length: h.value.length }
        : { token, type: h.type, originalPreview: h.value.slice(0,8)+(h.value.length>8?"…":""), length: h.value.length });
    });
    return rows;
  }
  /**
   * Dekonflikce nálezů (Deep Module):
   * Vyřeší překrývající se rozsahy nálezů v textu/dokumentu podle hierarchie priorit:
   * 1. Stav schválení (accept) – schválené mají přednost před neschválenými
   * 2. Délka rozsahu (end - start) – delší a specifičtější nález vyhrává nad podslovem
   * 3. Skóre detektoru (score) – vyšší spolehlivost detekce
   * 4. Počáteční offset (start) – dřívější výskyt v textu
   * 5. ID nálezu – deterministický tiebreaker pro nerozhodné případy
   *
   * @param {Array<object>} hits - Vstupní nálezy
   * @param {object} [options]
   * @param {boolean} [options.acceptedOnly=false] - Zpracovat pouze schválené nálezy (pro exporty a náhrady)
   * @returns {Array<object>} Nepřekrývající se nálezy seřazené vzestupně podle start offsetu
   */
  export function resolveHits(hits, { acceptedOnly = false } = {}){
    const source = (hits || []).filter(h =>
      h &&
      Number.isFinite(h.start) &&
      Number.isFinite(h.end) &&
      h.end > h.start &&
      (!acceptedOnly || Boolean(h.accept))
    );
    const ordered = source.slice().sort((a, b) => {
      const accA = Boolean(a.accept);
      const accB = Boolean(b.accept);
      if (accA !== accB) return accA ? -1 : 1;

      const lenA = a.end - a.start;
      const lenB = b.end - b.start;
      if (lenA !== lenB) return lenB - lenA;

      const scoreA = Number(a.score) || 0;
      const scoreB = Number(b.score) || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      if (a.start !== b.start) return a.start - b.start;

      const idA = a.id ?? 0;
      const idB = b.id ?? 0;
      if (typeof idA === "number" && typeof idB === "number") return idA - idB;
      return String(idA).localeCompare(String(idB));
    });
    const chosen = [];
    for (const h of ordered) {
      let low = 0, high = chosen.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (chosen[mid].end > h.start) {
          high = mid;
        } else {
          low = mid + 1;
        }
      }
      if (low < chosen.length && chosen[low].start < h.end) continue;
      chosen.splice(low, 0, h);
    }
    return chosen;
  }
  export function effectiveHits(hits){
    return resolveHits(hits, { acceptedOnly: true });
  }
  export function visibleHits(hits, _sel){
    return resolveHits(hits, { acceptedOnly: false });
  }
  export function topHits(hits){
    return effectiveHits(hits);
  }
  export function apply(text, hits, mode, lang){
    const replacer = bindReplacer(mode, lang, hits);
    const accepted = effectiveHits(hits);
    if (!accepted.length) return text;
    const pieces = [];
    let lastIdx = 0;
    for (let i = 0; i < accepted.length; i++) {
      const h = accepted[i];
      const s = Math.max(lastIdx, Math.min(text.length, h.start));
      if (s > lastIdx) {
        pieces.push(text.slice(lastIdx, s));
      }
      pieces.push(replacer(h));
      lastIdx = Math.max(lastIdx, Math.min(text.length, h.end));
    }
    if (lastIdx < text.length) {
      pieces.push(text.slice(lastIdx));
    }
    return pieces.join("");
  }
