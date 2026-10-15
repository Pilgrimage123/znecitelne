import { toBytes } from "../core/detector.js";

export function decodeTextBuffer(buf){
    const u8 = toBytes(buf);
    if (!u8 || !u8.length) return "";
    if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) {
      return new TextDecoder("utf-8").decode(u8.subarray(3));
    }
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
      return new TextDecoder("utf-16le").decode(u8.subarray(2));
    }
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
      return new TextDecoder("utf-16be").decode(u8.subarray(2));
    }
    if (u8.length >= 4) {
      const checkLen = Math.min(u8.length - (u8.length % 2), 256);
      let zeroOdds = 0, zeroEvens = 0;
      for (let i = 0; i < checkLen; i += 2) {
        if (u8[i] === 0) zeroEvens++;
        if (u8[i + 1] === 0) zeroOdds++;
      }
      const half = checkLen / 2;
      if (zeroOdds / half > 0.8) {
        try {
          return new TextDecoder("utf-16le").decode(u8);
        } catch (_) {}
      } else if (zeroEvens / half > 0.8) {
        try {
          return new TextDecoder("utf-16be").decode(u8);
        } catch (_) {}
      }
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(u8);
    } catch (_) {}
    try {
      return new TextDecoder("windows-1250").decode(u8);
    } catch (_) {}
    try {
      return new TextDecoder("iso-8859-2").decode(u8);
    } catch (_) {
      return new TextDecoder("latin1").decode(u8);
    }
  }

  export function isBinaryBuffer(buf){
    const u8 = toBytes(buf);
    if (!u8 || !u8.length) return false;
    if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return false;
    if (u8.length >= 2 && ((u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF))) return false;
    if (u8.length >= 4) {
      const checkLen = Math.min(u8.length - (u8.length % 2), 256);
      let zeroOdds = 0, zeroEvens = 0;
      for (let i = 0; i < checkLen; i += 2) {
        if (u8[i] === 0) zeroEvens++;
        if (u8[i + 1] === 0) zeroOdds++;
      }
      const half = checkLen / 2;
      if (zeroOdds / half > 0.8 || zeroEvens / half > 0.8) return false;
    }
    const limit = Math.min(u8.length, 8000);
    let ctrl = 0;
    for (let i = 0; i < limit; i++) {
      const b = u8[i];
      if (b === 0) return true;
      if (b < 9 || (b > 13 && b < 32 && b !== 27)) ctrl++;
    }
    return (ctrl / limit) > 0.05;
  }

  export function extractRtfText(rtfStr){
    let raw = String(rtfStr || "");
    let s = "";
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === "{" && raw[i + 1] === "\\") {
        const rest = raw.slice(i + 2);
        if (/^(\*|(?:fonttbl|colortbl|stylesheet|info|pict)\b)/i.test(rest)) {
          let depth = 1;
          i += 2;
          while (i < raw.length && depth > 0) {
            if (raw[i] === "\\") { i += 2; continue; }
            if (raw[i] === "{") depth++;
            else if (raw[i] === "}") depth--;
            i++;
          }
          continue;
        }
      }
      s += raw[i];
      i++;
    }
    s = s.replace(/\\bullet\b ?/gi, "•")
         .replace(/\\endash\b ?/gi, "–")
         .replace(/\\emdash\b ?/gi, "—")
         .replace(/\\ldblquote\b ?/gi, "„")
         .replace(/\\rdblquote\b ?/gi, "“")
         .replace(/\\lquote\b ?/gi, "‘")
         .replace(/\\rquote\b ?/gi, "’")
         .replace(/\\~/g, "\u00A0")
         .replace(/\\_/g, "\u2011");
    s = s.replace(/\\par\b ?/gi, "\n").replace(/\\line\b ?/gi, "\n").replace(/\\tab\b ?/gi, "\t");
    s = s.replace(/\\u(-?\d+)[^\\{}]?/g, (_, c) => {
      let n = parseInt(c, 10);
      if (n < 0) n += 65536;
      return String.fromCharCode(n);
    });
    s = s.replace(/(?:\\'([0-9a-fA-F]{2}))+/g, m => {
      const b = [];
      const re = /\\'([0-9a-fA-F]{2})/g;
      let x;
      while ((x = re.exec(m)) !== null) b.push(parseInt(x[1], 16));
      try {
        return new TextDecoder("windows-1250").decode(new Uint8Array(b));
      } catch (_) {
        return m;
      }
    });
    s = s.replace(/\\\\/g, "\uE000").replace(/\\\{/g, "\uE001").replace(/\\\}/g, "\uE002");
    s = s.replace(/\\([\\{}~])/g, "$1");
    s = s.replace(/\\([a-zA-Z]+)-?\d* ?/g, "");
    s = s.replace(/[{}]/g, "");
    s = s.replace(/\\/g, "");
    s = s.replace(/\uE001/g, "{").replace(/\uE002/g, "}").replace(/\uE000/g, "\\");
    return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }

