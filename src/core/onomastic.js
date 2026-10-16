import { NAMES } from "./rules.js";

export function stripTitle(token){
    return String(token||"").replace(/[.,;:()„“”‚‘’»«"']/gu,"").trim();
  }

  // --- Onomastický registr a kompaktní paměťové trie (ADR-0004) ---
  export const ONOMASTIC_PAYLOAD_B64 = "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";

  export function createOnomasticTrie() {
    const root = Object.create(null);
    return {
      root,
      insert(w) {
        if (!w) return;
        let node = root;
        for (let i = 0; i < w.length; i++) {
          const ch = w[i];
          let next = node[ch];
          if (!next) {
            next = Object.create(null);
            node[ch] = next;
          }
          node = next;
        }
        node.$ = 1;
      },
      has(w) {
        if (!w) return false;
        let node = root;
        for (let i = 0; i < w.length; i++) {
          node = node[w[i]];
          if (!node) return false;
        }
        return Boolean(node && node.$ === 1);
      }
    };
  }

  export let ONOMASTIC_TRIE = null;

  export function getOnomasticTrie() {
    if (!ONOMASTIC_TRIE) initOnomasticRegistry();
    return ONOMASTIC_TRIE;
  }

  export function initOnomasticRegistry() {
    if (ONOMASTIC_TRIE) return ONOMASTIC_TRIE;
    try {
      const flate = (typeof window !== "undefined" && window.fflate) || (typeof fflate !== "undefined" ? fflate : null);
      if (!flate || !flate.inflateSync) return null;
      const bin = (typeof atob === "function") ? atob(ONOMASTIC_PAYLOAD_B64) : Buffer.from(ONOMASTIC_PAYLOAD_B64, "base64").toString("binary");
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const decomp = flate.inflateSync(u8);
      const text = flate.strFromU8 ? flate.strFromU8(decomp) : (new TextDecoder("utf-8")).decode(decomp);
      const trie = createOnomasticTrie();
      const words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        const w = words[i].trim();
        if (w) {
          trie.insert(w);
          NAMES.add(w);
        }
      }
      ONOMASTIC_TRIE = trie;
      return ONOMASTIC_TRIE;
    } catch (err) {
      console.warn("Failed to initialize Onomastic Registry:", err);
      return null;
    }
  }

  export function isOnomasticName(token) {
    if (!token) return false;
    const t = stripTitle(token);
    if (!t) return false;
    const low = t.toLocaleLowerCase("cs");
    if (!ONOMASTIC_TRIE) initOnomasticRegistry();
    if (ONOMASTIC_TRIE && ONOMASTIC_TRIE.has(low)) return true;
    return NAMES.has(low);
  }
