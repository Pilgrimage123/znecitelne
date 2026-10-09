# 04: Zapojení kanonické dávkové ingestace do fronty v UI

**What to build:** Jednotné a robustní zpracování více vstupních dokumentů ve frontě skrze existující kanonické rozhraní `ingestDocumentBatch`, které garantuje jednotnou tvorbu neměnných dokumentů a bezpečné zachycení chyb u poškozených souborů.

**Blocked by:** 02: Odstranění mrtvých funkcí PDF in-stream parseru a DOCX přejmenovávání, 03: Sjednocení doménové terminologie Dávkové fronty v lokalizaci a UI

**Status:** completed

- [x] Obsluha načítání více dokumentů (`onFiles`) využívá přímo funkci `ingestDocumentBatch` namísto manuálního a izolovaného plnění objektů.
- [x] V případě vložení poškozeného souboru je zobrazeno srozumitelné lokalizované hlášení, přičemž zbylé validní dokumenty jsou do dávkové fronty úspěšně zařazeny.
- [x] Jednotkové a integrační testy v `test.js` i validační běh `npm test` kompletně projdou.
