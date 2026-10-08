# 03: Sjednocení exportních volání a odstranění redundantního řazení

**What to build:** Konzistentní spotřeba rozhraní dekonflikce napříč celou aplikací (textový replacer, PDF export, DOCX, XLSX a UI přehledy), odstranění duplicitního třídění tam, kde modul již garantuje seřazený výstup, a sjednocení volání na canonical fasády.

**Blocked by:** 01: Exekutivní testovací sada rozhraní dekonflikce v test.js

**Status:** completed

- [x] Exportní místa a helpery (`bindReplacer`, `buildGlossary`, `apply`, `xlsxToText`, atd.) nepoužívají redundantní `sort()` a `slice()` tam, kde je garantován vzestupný pořádek.
- [x] Všechna volání v UI a exportech jednoznačně využívají správnou fasádu modulu (`effectiveHits` pro schválené / export, `visibleHits` pro UI).
- [x] Zpětná kompatibilita pro `topHits` je zachována v testech i v kanonické implementaci.
- [x] `node test.js` projde s nulovými chybami.
