# 05: Testovací brána a lingvistické regresní testy v test.js

**What to build:**
Doplnění komplexní testovací sady do `test.js` verifikující správnost záchytu a desambiguace proprií napříč českou flexí, větnými pozicemi, OCR fuzzy tolerancí a výjimkami z vyhlášky č. 403/2022 Sb.

**Blocked by:** 01, 02, 03, 04

**Status:** closed

- [x] Přidat testy na potlačení FP u počátečních verzálek (např. *„Nový stavební zákon...“*, *„Podle žalobce...“*, *„Bílá technika...“*).
- [x] Přidat testy na správné zachycení homonymních příjmení s kontextovým spouštěčem (např. *„svědek Jiří Kovář“* $\rightarrow$ detekováno, *„zručný kovář opravil...“* $\rightarrow$ ignorováno).
- [x] Přidat testy na obousměrnou propagaci entit a skloňované pseudonymizační tokeny dle ADR-0003.
- [x] Přidat testy na Profil publikace Justiční rozhodnutí (zachování soudců a sídel soudů, anonymizace účastníků).
- [x] Ověřit průchodnost `npm test` a dodržení nulové síťové komunikace (Zero-Network).
