# Nevratný export PDF (Dual-Layer Sanitized PDF)

## Kontext a rozhodnutí

Při začerňování citlivých údajů v PDF hrozí v běžných nástrojích kritický bezpečnostní únik: citlivý text zůstává v podkladové textové vrstvě pod vizuálním černým obdélníkem a lze jej snadno zkopírovat nebo extrahovat.

Rozhodli jsme se, že exportované PDF nesmí nikdy zachovávat původní obsahové streamy. Export probíhá nevratným sloučením dvou vrstev:
1. **Rastrový podklad**: Stránka je vykreslena do rastru s fyzicky vyčerněnými oblastmi citlivých nálezů.
2. **Čistá textová vrstva**: Nad rastr je vložena nově syntetizovaná textová vrstva (s nulovou opacitou) obsahující výhradně neschválená / bezpečná slova na původních souřadnicích pro zachování vyhledatelnosti a přístupnosti.

Před uložením je exportovaný soubor validován stream-inspektorem, který ověřuje nulový výskyt zakázaných řetězců.

## Důsledky

- **Bezpečnost**: Původní citlivá data a skrytá metadata jsou fyzicky zničena a nelze je žádným způsobem rekonstruovat.
- **Použitelnost**: Výsledné PDF zůstává fulltextově prohledávatelné (OCR/výběr myší) pro bezpečný zbytek textu.
- **Kompromis**: Vektorové prvky v podkladu jsou rastrované, což mírně zvyšuje velikost souboru oproti čistě vektorovému PDF.
