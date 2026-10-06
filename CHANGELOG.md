# Changelog

## 2026-10-06

- Morfologická lemmatizace a skloňování českých jmen (Nápad 1 / B.6):
  - **Generátor pádů a flexe:** Zavedeny funkce `declineCzechFirstName`, `declineCzechSurname` a `generateCzechNameForms` pokrývající všech 7 pádů u maskulin a feminin, přechylování (-ová / -ové / -ovou), přivlastňovací tvary, iniciály i oslovení (pan / paní / pana / panu).
  - **Automatická morfologická expanze:** Detektor v `detect()` po identifikaci osob automaticky provádí druhou fázi expanze (`expandCzechNameMorphology`), která dohledá všechny pádové výskyty a přiřadí jim identický `entityKey` (sjednocený pseudonymní token).
  - **Inspektor a ruční výběr:** V panelu nálezu přidáno tlačítko pro spuštění skloňování na 1 klik a při ručním přidání jména přes „Přidat vlastní výběr textu“ (`btnAdd`) aplikace automaticky nabídne a dohledá všechny jeho pády v dokumentu.

- Robustní načítání souborů, kódování češtiny, OCR obrázků a dávková fronta (Nápad 2 / D):
  - **Detekce kódování a podpora Windows-1250 / ISO-8859-2 (`decodeTextBuffer`):** Zavedena automatická detekce BOM (UTF-8, UTF-16LE, UTF-16BE), striktní UTF-8 a plynulý fallback na Windows-1250 (CP1250) a ISO-8859-2. České znaky (ř, š, č, ž, ý, á, í, é, ě, ú, ů, ť, ď, ň) v souborech TXT, CSV a TSV ze starších státních systémů se již nepoškozují znakem `\uFFFD`, což garantuje bezchybnou detekci entit.
  - **Ochrana před binárním smetím (`isBinaryBuffer`):** Kontrola nulových bajtů a řídicích znaků zabraňuje zahlcení aplikace náhodnými binárními soubory (ZIP, EXE apod.) se srozumitelnou chybovou hláškou.
  - **Nahrávání obrázků a skenů přes OCR (`handleImageFile`):** Přidána přímá podpora pro obrázky (PNG, JPG, JPEG, WEBP, BMP, TIFF). Při zapnutém OCR je obrázek analyzován modelem Tesseract.js a zabalen do jednorázového PDF (přes PDFLib) s textovými souřadnicemi slov, což umožňuje vizuální náhled, začernění a export do PDF.
  - **Rozšíření formátů (XLS, ODS, ODT, RTF):** Podpora pro starší Excel tabulky `.xls` a LibreOffice `.ods` (SheetJS), OpenDocument Text `.odt` (extrakce přes fflate), Rich Text Format `.rtf` (dekódování včetně `\'hh` Windows-1250 sekvencí a unicode `\uN?`) a nápověda pro starý formát `.doc`.
  - **Mammoth záchranná brzda:** Při nedostupnosti nebo chybě knihovny Mammoth v DOCX souborech nastupuje automatická extrakce textu přes `fflate` z `word/document.xml`.
  - **Globální Drag & Drop a podpora celých složek:** Zachycení `dragover` a `drop` na celém okně brání nechtěnému opuštění aplikace v prohlížeči. Podpora rekurzivního načtení všech souborů při přetažení celé složky (`webkitGetAsEntry`).
  - **Oprava zobrazení skenů a správa fronty:** Naskenovaná PDF bez textové vrstvy se již nevyřazují z fronty, ale zobrazí se v náhledu s varováním o chybějící textové vrstvě. Jednotlivé položky ve frontě lze nově kdykoliv odebrat tlačítkem `×`.

- Bezpečný vyhledatelný PDF export (Dual-Layer Sanitized PDF / Nápad 3 / C & A.3):
  - **Čistá textová vrstva nad rastrem:** `exportPdfRaster` zachovává striktní bezpečnostní nevratnost rastrového podkladu na canvasu (černé obdélníky přes všechny nálezy), ale nad obraz vkládá novou textovou vrstvu s nulovou opacitou z bezpečných, nezačerněných souřadnic (`mapPageGlyphs`).
  - **Fyzická eliminace citlivých slov:** Začerněná slova a podpisová pole jsou z textové vrstvy striktně vynechána; nehrozí žádný skrytý text pod začerněním.
  - **Stream verifikace před vydáním:** Do procesu zařazena funkce `verifySanitizedPdfText`, která dekomprimuje PDF streamy a garantuje 0 uniklých citlivých slov v textové vrstvě hotového souboru. Výsledné PDF je plně fulltextově prohledávatelné a přístupné.

## 2026-10-05

- Ošetření specifik Microsoft Wordu, české abecedy, diakritiky a interpunkce (ai31):
  - **DOCX split-runs a speciální elementy:** Rozšířen parser a nahrazovač v XML o zachování a obsluhu `<w:tab/>`, `<w:noBreakHyphen/>`, `<w:softHyphen/>` a `<w:br/>`. Anonymizace rozdělených řetězců funguje spolehlivě i při výskytu pevných spojovníků, podmíněného dělení a tabulátorů. Náhradní tokeny jsou garantovaně vloženy do prvního textového uzlu i při shodách začínajících netextovým elementem.
  - **Normalizace pevných mezer a české typografie:** Zavedeno dvoufázové vyhledávání (přesná shoda + normalizovaná shoda) v DOCX exportu řešící pevné mezery (`\u00A0`), české uvozovky (`„`, `“`, `‚`, `‘`, `»`, `«`) a pomlčky (`–`, `—`, `‑`, `−`), čímž se předchází zbytečnému selhání exportu („nález nenalezen ve struktuře DOCX“).
  - **Unicode NFC normalizace:** Všechny textové vstupy (DOCX, PDF, XLSX, TXT) jsou při načtení normalizovány do NFC, což zabraňuje selhání detektorů na rozložených diakritických znacích (NFD).
  - **Oprava regexů pro českou diakritiku:** Nahrazeno `[\w]` a ASCII `\b` za Unicode lookaroundy `[\p{L}\p{N}]` u systémů a modulů (`systém Pošta`, `aplikace Účetnictví`), spisových značek (`ČTÚ 123/2024`, `ÚOHS`) i dokladů (`ŘP`).
  - **Rozpoznávání českých příjmení a skloňování:** Doplněno rozpoznávání adjektivních příjmení (`-ný/-ná`, `-lý/-lá`, `-tý/-tá`, `-vý/-vá` a pády `-ného/-nému/-ným/-ných`) a maskulin na `-a`, `-eš`, `-oš`, `-il`, `-ál` (`Černý`, `Svoboda`, `Novotná`, `Veselý`, `Kučera`, `Procházka`, `Růžička`, `Pospíšil`, `Beneš`, `Mareš`, `Král`).
  - **Post-nominální tituly:** Detekce celých jmen rozšířena o tituly za jménem s čárkou (`, Ph.D.`, `, MBA`, `, CSc.`, `, DiS.`, `, MPA`).

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
