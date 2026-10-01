# znecitelne changes

Files:
- server.js — complete replacement for the broken entry-point routing.
- znecitelne.html.patch — focused changes for PDF worker/CMap handling,
  batch-export transient-state cleanup, and canonical redaction overlap
  resolution.

IMPORTANT:
`znecitelne.html.patch` is intentionally a focused patch, not a replacement
for the existing ~6k-line application file. Apply it to the current upstream
`znecitelne.html` after reviewing the surrounding functions.

The patch assumes the existing application already provides:
- pdfWorker()
- makeReplacer()
- doExport()
- existing S/Q batch state
- existing PDF.js initialization

The local CMap change also assumes the offline bundle contains:
  lib/cmaps/

Verify that directory exists before enabling the local CMap path.
