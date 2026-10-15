// Session Transfer Package (.znecitelne-session)
// Implements client-side AES-GCM + PBKDF2 encryption/decryption for Four-Eyes review (ADR-0008)

const FORMAT_ID = "znecitelne-session";
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 100000;

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64) {
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

export async function exportSession(state, password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required for encrypting session");
  }
  const subtle = globalThis.crypto.subtle;
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveKey(password, salt, ["encrypt"]);

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
      sigDetected: state.sigDetected
    },
    hits: state.hits,
    seen: Array.from(state.seen || []),
    profile: state.profile,
    replaceMode: state.replaceMode,
    lang: state.lang,
    legalReason: state.legalReason,
    auditTrail: state.auditTrail || []
  };

  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(JSON.stringify(payload));

  const cipherBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes
  );

  const envelope = {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
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
  if (envelope.version !== FORMAT_VERSION) {
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

  const dec = new TextDecoder("utf-8");
  const jsonStr = dec.decode(decryptedBuffer);
  const data = JSON.parse(jsonStr);

  return data;
}
