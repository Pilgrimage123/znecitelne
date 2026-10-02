# Changelog
## 2026-10-02

- PDF: added a secure Unicode text-layer export using a bundled Noto Sans font.
- PDF: the generated text layer contains only anonymized text and is verified by reopening the output with PDF.js before export is accepted.
- PDF: if the Unicode text layer cannot be created or verified, the app falls back to the isolated raster PDF and explicitly warns that the output is not searchable/copyable.


## 2026-10-02

- Security: disabled the legacy true-redact PDF path because mutating a
  PDFDocument loaded from the source does not prove removal of unreachable
  source objects. Secure PDF export now fails closed to the isolated raster
  constructor.
- Added a PDF security preflight rejecting AcroForm/signature/embedded-code
  surfaces and multiple PDF revisions.
- Added regression gates covering the secure-export invariant.

- Applied ai27 harmony/debug patch: unified effective-hit selection for UI/export, isolated batch-export transient state, and made the PDF worker file:// fallback safe.
- Added the local PDF worker to build/test asset gates and aligned the detector ruleset to `2026.10.02-ai27`.
- Offline libraries remain mandatory distribution assets; PDF/A-2b remains a declaration requiring external preflight.
- This entry records only changes actually applied in this commit.
