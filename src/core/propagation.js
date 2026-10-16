import {
  stemNamePart, looksName, nameKey, declineCzechSurname, generateCzechNameForms,
  isLikelyNonPersonName, isCzechVerbOrParticiple, RE_AGENDA_APELATIVA, ROLE_WORDS_SET,
  systemCore, canonToken
} from "./morphology.js";
import { stripTitle, isOnomasticName } from "./onomastic.js";
import { FIRST_NAMES, TITLES, NAMES } from "./rules.js";
import { pageOf, parseDict } from "./detector.js";

export class EntityPropagationCache {
    constructor(text, hits) {
      this.text = text || "";
      this.hits = hits ? hits : [];
      this.entities = new Map();
      this.init();
    }

    init() {
      this.collectConfirmedEntities();
    }

    isConfirmedEntity(h) {
      if (h.type !== "name") return false;
      const clean = String(h.value || "").replace(/,.*$/, "").trim();
      const parts = clean.split(/\s+/).map(stripTitle).filter(Boolean)
        .filter(p => {
          const low = p.toLocaleLowerCase("cs").replace(/[.,]/g, "");
          return !TITLES.includes(low) && !ROLE_WORDS_SET.has(low) && !isCzechVerbOrParticiple(low) && !(RE_AGENDA_APELATIVA.test(low) && !NAMES.has(low) && !isOnomasticName(low));
        });
      if (parts.length === 1) {
        const low = parts[0].toLocaleLowerCase("cs").replace(/[.,]/g, "");
        if (isCzechVerbOrParticiple(low) || (RE_AGENDA_APELATIVA.test(low) && !NAMES.has(low) && !isOnomasticName(low))) return false;
        return isOnomasticName(parts[0]) || NAMES.has(low);
      }
      if (parts.length >= 2) {
        if (h.reasons && h.reasons.some(r => r.startsWith("trigger:") || r === "dict" || r === "titled")) return true;
        const low0 = parts[0].toLocaleLowerCase("cs").replace(/[.,]/g, "");
        const low1 = parts[parts.length - 1].toLocaleLowerCase("cs").replace(/[.,]/g, "");
        const s0 = typeof stemNamePart === "function" ? stemNamePart(low0) : low0;
        const s1 = typeof stemNamePart === "function" ? stemNamePart(low1) : low1;
        return NAMES.has(low0) || isOnomasticName(low0) || NAMES.has(s0) || isOnomasticName(s0) ||
               NAMES.has(low1) || isOnomasticName(low1) || NAMES.has(s1) || isOnomasticName(s1);
      }
      return false;
    }

    isPrimaryHit(h) {
      if (!h || h.type !== "name") return false;
      const clean = String(h.value || "").replace(/,.*$/, "").trim();
      const parts = clean.split(/\s+/).map(stripTitle).filter(Boolean)
        .filter(p => {
          const low = p.toLocaleLowerCase("cs").replace(/[.,]/g, "");
          return !TITLES.includes(low) && !ROLE_WORDS_SET.has(low) && !isCzechVerbOrParticiple(low) && !(RE_AGENDA_APELATIVA.test(low) && !NAMES.has(low) && !isOnomasticName(low));
        });
      if (h.reasons && h.reasons.some(r => r.startsWith("trigger:") || r === "titled")) {
        return parts.length >= 1;
      }
      return parts.length >= 2;
    }

    collectConfirmedEntities() {
      const names = this.hits.filter(h => h.type === "name");
      names.forEach(h => {
        if (!this.isConfirmedEntity(h)) return;
        const key = h.entityKey || ("name|" + nameKey(h.value));
        if (!this.entities.has(key)) {
          this.entities.set(key, {
            entityKey: key,
            baseName: h.value,
            forms: new Set(),
            sourceHits: []
          });
        }
        const ent = this.entities.get(key);
        ent.sourceHits.push(h);
        this.generateParadigm(h.value).forEach(f => ent.forms.add(f));
      });
    }

    registerEntity(hit) {
      if (!hit || hit.type !== "name") return null;
      const key = hit.entityKey || ("name|" + nameKey(hit.value));
      if (!this.entities.has(key)) {
        this.entities.set(key, {
          entityKey: key,
          baseName: hit.value,
          forms: new Set(),
          sourceHits: []
        });
      }
      const ent = this.entities.get(key);
      ent.sourceHits.push(hit);
      this.generateParadigm(hit.value).forEach(f => ent.forms.add(f));
      return ent;
    }

    getEntities() {
      return Array.from(this.entities.values());
    }

    generateParadigm(nameVal) {
      return generateCzechNameForms(nameVal);
    }

    scan(triggerHit = null) {
      if (triggerHit) this.registerEntity(triggerHit);
      if (!this.entities.size) return [];

      const existingSpans = this.hits.map(h => ({ start: h.start, end: h.end, hit: h })).sort((a, b) => a.start - b.start);
      const newHits = [];

      const findOverlapping = (start, end) => {
        let low = 0, high = existingSpans.length - 1, first = existingSpans.length;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (existingSpans[mid].end > start) {
            first = mid;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
        const res = [];
        for (let i = first; i < existingSpans.length && existingSpans[i].start < end; i++) {
          if (existingSpans[i].end > start) res.push(existingSpans[i]);
        }
        return res;
      };

      const insertSpan = (span) => {
        let low = 0, high = existingSpans.length;
        while (low < high) {
          const mid = (low + high) >> 1;
          if (existingSpans[mid].start < span.start) low = mid + 1;
          else high = mid;
        }
        existingSpans.splice(low, 0, span);
      };

      const multiWordMap = new Map();
      const singleWordMap = new Map();
      const multiWordForms = [];
      const singleWordForms = [];

      for (const [key, ent] of this.entities.entries()) {
        for (const f of ent.forms) {
          if (!f || f.length < 3) continue;
          if (f.includes(" ")) {
            const lower = f.toLocaleLowerCase("cs");
            if (!multiWordMap.has(lower)) {
              multiWordMap.set(lower, key);
              multiWordForms.push(f);
            }
          } else {
            if (!singleWordMap.has(f)) {
              singleWordMap.set(f, key);
              singleWordForms.push(f);
            }
          }
        }
      }

      multiWordForms.sort((a, b) => b.length - a.length);
      singleWordForms.sort((a, b) => b.length - a.length);

      const passes = [];
      if (multiWordForms.length > 0) {
        const escMulti = multiWordForms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        const multiRe = new RegExp("(?<![\\p{L}\\p{N}])(?:" + escMulti + ")(?![\\p{L}\\p{N}])", "giu");
        passes.push({ re: multiRe, map: multiWordMap, isMulti: true });
      }
      if (singleWordForms.length > 0) {
        const escSingle = singleWordForms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        const singleRe = new RegExp("(?<![\\p{L}\\p{N}])(?:" + escSingle + ")(?![\\p{L}\\p{N}])", "gu");
        passes.push({ re: singleRe, map: singleWordMap, isMulti: false });
      }

      for (const { re, map, isMulti } of passes) {
        let m;
        while ((m = re.exec(this.text)) !== null) {
          const matchedText = m[0];
          const key = isMulti ? map.get(matchedText.toLocaleLowerCase("cs")) : map.get(matchedText);
          if (!key) continue;

          const start = m.index;
          const end = start + matchedText.length;
          const overlapping = findOverlapping(start, end);
          if (overlapping.length > 0) {
            overlapping.forEach(s => {
              if (s.hit && s.hit.type === "name") {
                s.hit.entityKey = key;
                if (!this.isPrimaryHit(s.hit)) {
                  if (!s.hit.reasons) s.hit.reasons = [];
                  if (!s.hit.reasons.includes("propagation")) s.hit.reasons.push("propagation");
                  s.hit.confidence = "high";
                  s.hit.accept = true;
                }
              }
            });
            continue;
          }
          if (isLikelyNonPersonName(matchedText, this.text, start, end)) continue;
          const newHit = {
            type: "name",
            value: matchedText,
            start,
            end,
            reasons: ["propagation"],
            confidence: "high",
            entityKey: key,
            accept: true,
            page: pageOf(start)
          };
          insertSpan({ start, end, hit: newHit });
          newHits.push(newHit);
        }
      }

      const formToKey = new Map();
      for (const [key, ent] of this.entities.entries()) {
        for (const f of ent.forms) {
          if (!f) continue;
          const lowerForm = f.toLocaleLowerCase("cs");
          if (!formToKey.has(lowerForm)) {
            formToKey.set(lowerForm, key);
          }
        }
      }

      this.hits.forEach(h => {
        if (h.type === "name") {
          const valClean = String(h.value || "").replace(/,.*$/, "").trim().toLocaleLowerCase("cs");
          const matchedKey = formToKey.get(valClean);
          if (matchedKey && h.entityKey !== matchedKey) {
            h.entityKey = matchedKey;
            if (!this.isPrimaryHit(h)) {
              if (!h.reasons) h.reasons = [];
              if (!h.reasons.includes("propagation")) h.reasons.push("propagation");
              h.confidence = "high";
              h.accept = true;
            }
          }
        }
      });

      return newHits;
    }

    propagate(triggerHit = null) {
      const newHits = this.scan(triggerHit);
      if (newHits.length) {
        let maxId = this.hits.reduce((max, h) => Math.max(max, h.id || 0), 0);
        newHits.forEach(h => { h.id = ++maxId; this.hits.push(h); });
        this.hits.sort((a, b) => a.start - b.start);
      }
      return this.hits;
    }
  }

  export function createEntityPropagationCache(text, hits) {
    return new EntityPropagationCache(text, hits);
  }

  export function expandCzechNameMorphology(text, hits, triggerHit = null) {
    if (!text || !hits || !hits.length) return hits;
    const cache = createEntityPropagationCache(text, hits);
    return cache.propagate(triggerHit);
  }
  export function alignDictEntity(h, src, options){
    const s = options || ((typeof globalThis !== 'undefined' && globalThis.S) || (typeof S !== 'undefined' ? S : null)) || {};
    const sys = (options && options.systems != null) ? options.systems : (s.systems || "");
    const proj = (options && options.projects != null) ? options.projects : (s.projects || "");
    const orgs = (options && options.orgs != null) ? options.orgs : (s.orgs || "");
    const dicts = parseDict(sys + "\n" + proj + "\n" + orgs).filter(d => d.name && d.name.length >= 2);
    if (!dicts.length) return h;
    const val = h.value || "";
    const low = val.toLocaleLowerCase("cs");
    let best = null;
    dicts.forEach(d => {
      const needle = d.name.toLocaleLowerCase("cs");
      const i = low.indexOf(needle);
      if (i<0) return;
      if (!best || needle.length>best.needle.length) best = { d, i, needle, len: d.name.length };
    });
    if (!best) {
      if (h.type==="system" || h.type==="project") {
        const core = systemCore(val);
        if (core && core!==val) h.entityKey = (h.tokenClass||h.type)+"|"+canonToken(core);
      }
      return h;
    }
    h.tokenClass = best.d.kind || h.tokenClass;
    h.entityKey = (h.tokenClass||h.type)+"|"+canonToken(best.d.name);
    const prefix = val.slice(0, best.i).trim();
    const suffix = val.slice(best.i+best.len).trim();
    const okPrefix = !prefix || /^(?:systém|system|aplikace|modul|rozhraní|integrace|platforma)$/i.test(prefix);
    if (okPrefix && !suffix && best.i>=0) {
      const ns = h.start + best.i;
      const ne = ns + best.len;
      if (ne>ns && ne<= (src?src.length:ne)) {
        h.start = ns; h.end = ne; h.value = (src||val).slice(ns, ne);
        if (!src) h.value = val.slice(best.i, best.i+best.len);
      }
    }
    return h;
  }
