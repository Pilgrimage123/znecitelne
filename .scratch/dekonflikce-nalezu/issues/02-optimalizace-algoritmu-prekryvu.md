# 02: Optimalizace algoritmu vyhledávání překryvů

**What to build:** Vysoce efektivní a robustní vyhodnocení překryvů v resolveHits bez degradace výkonu na rozsáhlých dokumentech se stovkami nálezů, zachovávající všechny doménové invarianty a deterministické uspořádání.

**Blocked by:** 01: Exekutivní testovací sada rozhraní dekonflikce v test.js

**Status:** completed

- [x] Algoritmus dekonflikce efektivně filtruje kolidující rozsahy bez zbytečné kvadratické zátěže.
- [x] Všechny existující i nově přidané exekutivní testy v `test.js` a in-browser testy v `znecitelne.html` procházejí beze změny chování.
- [x] Výstupní pole nálezů je vždy deterministicky seřazeno vzestupně podle počátečního offsetu.
- [x] `node test.js` projde s nulovými chybami.
