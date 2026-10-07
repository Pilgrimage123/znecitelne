# Changelog

## 2026-10-07

- Oprava chyb při nahrávání souborů a stabilizace načítání:
  - **Ochrana globálního Drag & Drop:** Odstraněna neošetřená chyba `TypeError: e.target.closest is not a function`, ke které docházelo při přetažení souborů na okno prohlížeče (pokud cílem události nebyl prvek typu `Element`, např. `document`).
  - **Líná inicializace OCR pro PDF:** Zrušeno předčasné stahování a spouštění OCR modelu Tesseract při každém nahrání digitálního PDF. Model se nyní inicializuje líně pouze tehdy, pokud je v PDF detekována naskenovaná stránka bez textové vrstvy nebo podpisové razítko. Čištění workeru probíhá v `finally` bloku.
  - **Rozpoznávání formátů a MIME typů:** Doplněna detekce podle MIME typů (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.oasis.opendocument.text`, `application/rtf`) i kontrola magických hlaviček (PDF, ZIP/DOCX, RTF), díky čemuž se soubory bez přípony či s generickým typem již chybně neoznačují jako nepodporovaný binární soubor.
  - **Ochrana před tichým selháním prázdných dokumentů:** Pro všechny textové formáty a kancelářské dokumenty (DOCX, XLSX, ODT, RTF, TXT) je ověřena přítomnost extrahovaného textu. Prázdné dokumenty již nezpůsobují tiché odstranění z fronty nebo pád zpět na úvodní obrazovku bez vysvětlení, ale zobrazí jasnou chybovou hlášku.
  - **Zotavení fronty a bezpečnost prvků:** Při selhání nově přidávaného souboru se aplikace přednostně a bezpečně vrátí na dříve aktivní dokument. Doplněny záložní názvy kategorií v seznamu nálezů a v liště rychlé volby (`qh-label`) a null-guard pro `host` element ve vizuálním PDF režimu.
  - **Doplnění anglické lokalizace pro PDF/A varování (`pdfaFontWarn`):** Přidán chybějící lokalizační řetězec v angličtině, který při výskytu nevložených písem v PDF způsoboval neošetřenou chybu `TypeError: Cannot read properties of undefined (reading 'replace')` a tiché selhání vložení PDF/A metadat.
  - **Korekce oddělovačů, vnořených struktur a závorek v RTF parseru (`extractRtfText`):** Řídicí slova a znaky (`\ldblquote`, `\par` apod.) nyní v souladu se specifikací RTF správně konzumují volitelnou oddělovací mezeru, vnořené skupiny v hlavičkách (`\fonttbl`, `\colortbl` apod.) se bezpečně odstraňují bez ohledu na hloubku zanoření a escapované složené závorky `\{` a `\}` v textu zůstávají zachovány.
  - **Izolace klávesových zkratek v modálních oknech a video tutoriálu (`document.onkeydown`):** Při otevřeném modálním okně (Nastavení, Nápověda, Historie verzí, Přehled funkcí, Export) již klávesy šipek, J/K a R/P neinteragují se skrytým dokumentem v pozadí, klávesa Escape okno bezpečně zavírá a navigace tutoriálu je navázána na `document.onkeydown`.
  - **Normalizace cest v DOCX exportu a ochrana relací:** Cesty v DOCX ZIP archivu se normalizují z Windows zpětných lomítek na dopředná lomítka a při odstranění médií se spolehlivě vyčistí všechny odpovídající relace, což předchází falešnému hlášení o visících relacích (`Dangling DOCX relationship`).
  - **Zpřesnění detekce a zotavení prázdných ZIP dokumentů:** Při nahrání prázdného DOCX/ODT bez přípony již nedochází k chybnému označení souboru jako nepodporovaného binárního souboru a je doplněna detekce tabulek XLSX zabalených bez přípony.

## 2026-10-06

- Morfologická lemmatizace a skloňování českých jmen (Nápad 1 / B.6):
  - **Generátor pádů a flexe:** Zavedeny funkce `declineCzechFirstName`, `declineCzechSurname` a `generateCzechNameForms` pokrývající všech 7 pádů u maskulin a feminin, přechylování (-ová / -ové / -ovou), přivlastňovací tvary, iniciály i oslovení (pan / paní / pana / panu).
  - **Automatická morfologická expanze:** Detektor v `detect()` po identifikaci osob automaticky provádí druhou fázi expanze (`expandCzechNameMorphology`), která dohledá všechny pádové výskyty a přiřadí jim identický `entityKey` (sjednocený pseudonymní token).
  - **Inspektor a ruční výběr:** V panelu nálezu přidáno tlačítko pro spuštění skloňování na 1 klik a při ručním přidání jména přes „Přidat vlastní výběr textu“ (`btnAdd`) aplikace automaticky nabídne a dohledá všechny jeho pády v dokumentu.

- Robustní načítání souborů, kódování češtiny, OCR obrázků a dávková fronta (Nápad 2 / D):
  - **Detekce kódování a podpora Windows-1250 / ISO-8859-2 / UTF-16 (`decodeTextBuffer`):** Zavedena automatická detekce BOM (UTF-8, UTF-16LE, UTF-16BE), UTF-16LE bez BOM, striktní UTF-8 a plynulý fallback na Windows-1250 (CP1250) a ISO-8859-2. České znaky (ř, š, č, ž, ý, á, í, é, ě, ú, ů, ť, ď, ň) v souborech TXT, CSV a TSV ze starších státních systémů se již nepoškozují znakem `\uFFFD`, což garantuje bezchybnou detekci entit.
  - **Ochrana před binárním smetím (`isBinaryBuffer`):** Kontrola nulových bajtů a řídicích znaků zabraňuje zahlcení aplikace náhodnými binárními soubory (ZIP, EXE apod.) se srozumitelnou chybovou hláškou, přičemž jsou bezpečně propuštěny UTF-16 textové soubory s BOM i bez něj.
  - **Nahrávání obrázků a skenů přes OCR (`handleImageFile`):** Přidána přímá podpora pro obrázky (PNG, JPG, JPEG, WEBP, BMP, TIFF). Při zapnutém OCR je obrázek analyzován modelem Tesseract.js a zabalen do jednorázového PDF (přes PDFLib) s textovými souřadnicemi slov, což umožňuje vizuální náhled, začernění a export do PDF. Ošetřena správná validace nastavení OCR (`!S.ocrEnabled || !window.Tesseract`).
  - **Rozšíření formátů (XLS, ODS, ODT, RTF):** Podpora pro starší Excel tabulky `.xls` a LibreOffice `.ods` (SheetJS), OpenDocument Text `.odt` (extrakce odstavců i nadpisů `text:h` s mezerami a tabulátory přes fflate), Rich Text Format `.rtf` (odstranění metadatových skupin `{\\*...}`, mapování české typografie `„ “ – — •` a dekódování `\'hh` Windows-1250 sekvencí) a nápověda pro starý formát `.doc`.
  - **Kompletní extrakce DOCX:** Záchranná brzda přes `fflate` v DOCX extrahuje nejen `word/document.xml`, ale i záhlaví (`header*.xml`), zápatí (`footer*.xml`) a poznámky pod čarou (`footnotes.xml`, `endnotes.xml`), které jsou rovněž chráněny při exportu.
  - **Globální Drag & Drop a čisté načtení složek:** Zachycení `dragover` a `drop` na celém okně brání nechtěnému opuštění aplikace v prohlížeči. Podpora rekurzivního načtení všech souborů při přetažení celé složky s automatickým odfiltrováním systémového a dočasného smetí (`.DS_Store`, `Thumbs.db`, `desktop.ini`, `~$*.docx`).
  - **Spolehlivá správa fronty a zotavení z chyb:** Při selhání vadného souboru se fronta nezasekne na prázdné obrazovce, ale plynule postoupí na další platný soubor ve frontě. Vyřešeno čištění vizuálního PDF režimu (`clearPdfVisual`), které po přepnutí z PDF na jiný typ dokumentu nezanechává skrytý původní text. Ochrana paměti před soubory většími než 100 MB.

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
