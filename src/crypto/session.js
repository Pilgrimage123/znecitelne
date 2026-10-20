// Session Transfer Package (.znecitelne-session)
// Implements client-side AES-GCM + PBKDF2 encryption/decryption for Four-Eyes review (ADR-0008)

const FORMAT_ID = "znecitelne-session";
const FORMAT_VERSION = 2;
const PBKDF2_ITERATIONS = 100000;

export function bufferToBase64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export function base64ToBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password, saltBytes, usage) {
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usage
  );
}

export async function exportSession(state, password, options = {}) {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required for encrypting session");
  }
  const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
  const targetVersion = options.version !== undefined ? options.version : FORMAT_VERSION;
  const useCompression = targetVersion >= 2 && !!(flate && flate.zlibSync);

  const subtle = globalThis.crypto.subtle;
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveKey(password, salt, ["encrypt"]);

  const sourceBuf = state.sourceBuf ? (state.sourceBuf instanceof Uint8Array ? state.sourceBuf : new Uint8Array(state.sourceBuf)) : null;

  // Payload: state to serialize
  const payload = {
    doc: {
      fileName: state.fileName,
      kind: state.kind,
      text: state.text,
      pages: state.pages,
      reviewed: state.reviewed,
      approvalState: state.approvalState || (state.reviewed ? "approved" : "unreviewed"),
      cellMap: state.cellMap,
      sigDetected: state.sigDetected,
      sourceBuf: sourceBuf ? bufferToBase64(sourceBuf) : null
    },
    hits: state.hits,
    seen: Array.from(state.seen || []),
    profile: state.profile,
    replaceMode: state.replaceMode,
    lang: state.lang,
    legalReason: state.legalReason,
    operator: state.operator || "",
    auditTrail: state.auditTrail || []
  };

  const enc = new TextEncoder();
  let plaintextBytes = enc.encode(JSON.stringify(payload));

  if (useCompression) {
    plaintextBytes = flate.zlibSync(plaintextBytes);
  }

  const cipherBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes
  );

  const envelope = {
    format: FORMAT_ID,
    version: targetVersion,
    compression: useCompression ? "zlib" : "none",
    timestamp: new Date().toISOString(),
    kdf: {
      algorithm: "PBKDF2",
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
      salt: bufferToBase64(salt)
    },
    cipher: {
      algorithm: "AES-GCM",
      iv: bufferToBase64(iv),
      data: bufferToBase64(cipherBuffer)
    }
  };

  return JSON.stringify(envelope, null, 2);
}

export async function importSession(envelopeJsonOrObj, password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required for decrypting session");
  }
  const envelope = typeof envelopeJsonOrObj === "string" ? JSON.parse(envelopeJsonOrObj) : envelopeJsonOrObj;
  if (!envelope || envelope.format !== FORMAT_ID) {
    throw new Error("Invalid session format: expected " + FORMAT_ID);
  }
  if (envelope.version !== 1 && envelope.version !== 2) {
    throw new Error("Unsupported session version: " + envelope.version);
  }

  const saltBytes = new Uint8Array(base64ToBuffer(envelope.kdf.salt));
  const ivBytes = new Uint8Array(base64ToBuffer(envelope.cipher.iv));
  const cipherBytes = base64ToBuffer(envelope.cipher.data);

  const key = await deriveKey(password, saltBytes, ["decrypt"]);

  const subtle = globalThis.crypto.subtle;
  let decryptedBuffer;
  try {
    decryptedBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      cipherBytes
    );
  } catch (err) {
    throw new Error("Decryption failed: incorrect password or corrupted data");
  }

  let decryptedBytes = new Uint8Array(decryptedBuffer);

  const isCompressed = envelope.compression === "zlib" || (envelope.version === 2 && envelope.compression !== "none");
  if (isCompressed) {
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || null;
    if (!flate || (!flate.unzlibSync && !flate.inflateSync)) {
      throw new Error("Decompression failed: fflate library is missing");
    }
    try {
      decryptedBytes = flate.unzlibSync(decryptedBytes);
    } catch (_) {
      try {
        decryptedBytes = flate.inflateSync(decryptedBytes);
      } catch (decompErr) {
        throw new Error("Decompression failed: " + (decompErr.message || String(decompErr)));
      }
    }
  }

  const dec = new TextDecoder("utf-8");
  const jsonStr = dec.decode(decryptedBytes);
  const data = JSON.parse(jsonStr);

  if (data && data.doc && data.doc.sourceBuf && typeof data.doc.sourceBuf === "string") {
    data.doc.sourceBuf = new Uint8Array(base64ToBuffer(data.doc.sourceBuf));
  }

  return data;
}
