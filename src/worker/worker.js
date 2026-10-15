// Web Worker pipeline for async background processing (ADR-0002, ADR-0010)

export const WORKER_SOURCE = `
(function() {
  self.onmessage = async function(e) {
    const { id, action, payload } = e.data || {};
    try {
      if (action === "ping") {
        self.postMessage({ id, ok: true, result: "pong" });
      } else if (action === "detect") {
        const { text, enabled, secrets, options } = payload;
        const hits = typeof self.detect === "function" ? self.detect(text, enabled, secrets, options) : [];
        self.postMessage({ id, ok: true, result: hits });
      } else if (action === "propagate") {
        const { text, hits, triggerHit } = payload;
        const result = typeof self.expandCzechNameMorphology === "function"
          ? self.expandCzechNameMorphology(text, hits, triggerHit)
          : hits;
        self.postMessage({ id, ok: true, result });
      } else if (action === "verifyPdf") {
        const { bytes, activeHits } = payload;
        const result = typeof self.verifySanitizedPdfText === "function"
          ? self.verifySanitizedPdfText(bytes, activeHits)
          : true;
        self.postMessage({ id, ok: true, result });
      } else {
        self.postMessage({ id, ok: false, error: "Unknown worker action: " + action });
      }
    } catch (err) {
      self.postMessage({ id, ok: false, error: err.message || String(err) });
    }
  };
})();
`;

export function createBlobWorker(workerCoreCode = "") {
  if (typeof window === "undefined" || typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    return null;
  }
  try {
    const fullSource = workerCoreCode + "\n" + WORKER_SOURCE;
    const blob = new Blob([fullSource], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.__blobUrl = url;
    return worker;
  } catch (err) {
    console.warn("Could not instantiate Blob Web Worker; using synchronous main thread fallback:", err);
    return null;
  }
}
