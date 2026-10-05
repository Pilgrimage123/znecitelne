# Changelog

## 2026-10-05

- Audit souladu s metodikou nevratnosti a úplnosti začernění (porovnání se specifikací „Co upravit“):
  - **A.1 (Nový dokument, nevratnost):** NASAZENO. PDF export je stavěn striktně z čistého `PDFDocument.create()` vkládáním rastrových obrázků stran (`embedJpg`). Původní `copyPages` a mutace načteného PDF jsou zakázány; `exportPdfTrueRedact` bezpečně selhává do izolovaného rastrového konstruktoru (`assertSecurePdfBytes`).
  - **A.2 (Podpisová pole a certifikáty):** ROZPRACOVÁNO. Systém identifikuje podpisové anotace i razítka (`pageSignatureMeta`), v současnosti však zakrývá přednostně detekované jméno. Pro úplnou eliminaci nepřímé identifikace (sériové číslo certifikátu) je zařazeno celoplošné začernění celého obdélníku razítka / vypnutí vykreslování podpisových polí.
  - **A.3 (Kontrola výstupu před vydáním):** ČÁSTEČNĚ NASAZENO. `assertSecurePdfBytes` striktně odmítá `/AcroForm`, `/Sig`, `/EmbeddedFiles`, `/JavaScript`, `/JS` i vícenásobné revize (`%%EOF`). Do plánu zařazeno rozšíření o kontrolu počtu objektů a ověření prázdné textové vrstvy.
  - **B.4 (Celé jméno a tituly za čárkou):** ROZPRACOVÁNO. Detekce zachycuje tituly před jménem a křestní jména s příjmením; zařazeno rozšíření o post-nominální tituly (`, Ph.D.`, `, MPA`) a víceslovná jména.
  - **B.5 (Zalomení řádku u jmen):** ROZPRACOVÁNO. Zařazeno vícedílné obdélníkové krytí na každý zasažený řádek při přechodu textu.
  - **B.6 (Skloňování – kmen / lemmatizace):** V PLÁNU. Zařazeno kmenové vyhledávání po prvním nálezu / integrace lemmatizace (MorphoDiTa/UDPipe).
  - **B.7 & B.8 (Pravidla a výška boxu):** NASAZENO. Výpočet obdélníků upraven na přesné obrysy nalezených slov (word quads) namísto celé výšky řádku; aplikováno mírné svislé zúžení (vertical inset), které eliminuje dotyk s diakritikou a sousedními řádky („Termín: do…“, „o činnosti odboru“).
  - **C (Zachování textu – mupdf.js):** V PLÁNU. Odmítnuta nebezpečná in-place editace pdf-lib; zvažována integrace WASM mupdf.js s přesným quad ohraničením.
  - **D.9 & D.10 (Proces schválení a kontrola před a po):** NASAZENO. Před exportem probíhá automatické porovnání textu před a po redakci s detailním výpisem všech odstraněných slov ke schválení operátorem a garancí nepoškození okolních řádků. Do testovací sady zařazen regresní test na zachování sousedních řádků.

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
