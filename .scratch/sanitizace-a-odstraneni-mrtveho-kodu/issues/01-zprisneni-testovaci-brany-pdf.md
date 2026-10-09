# 01: Zpřísnění a oprava testovací brány PDF exportu v test.js

**What to build:** Spolehlivé a funkční ověřování implementace PDF exportu v automatizované testovací sadě, které skutečně zachytí jakékoli volání původního PDF souboru v modulu nevratného exportu, a zavedení negativních kontrolních testů bránících znovuzavedení mrtvých a opuštěných funkcí do kódové báze.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Regulární výraz ověřující `exportPdfTrueRedact` v `test.js` není prázdný (`null`), korektně extrahuje tělo funkce a selže, pokud tělo obsahuje `PDFDocument.load(source`.
- [x] Běh `node test.js` projde se 100% úspěšností.
