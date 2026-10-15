# Modulární zdrojový kód v src/ a sestavovací skript build.js

## Kontext a rozhodnutí

Původní architektura aplikace byla soustředěna do jediného monolitického souboru `znecitelne.html` (přes 480 kB), který kombinoval HTML šablony, CSS styly, I18N překlady, binární payload onomastického slovníku, lingvistickou a detekční logiku, formátové parsery (PDF, DOCX, XLSX, RTF, ODT) i interaktivní UI. Testovací sada v `test.js` musela kód křehce vyřezávat pomocí řetězcových řezů `slice(indexOf, indexOf)` a spouštět jej v izolovaných kontextech `node:vm`, což vedlo k vysoké křehkosti testů a ztěžovalo refaktoring.

Rozhodli jsme se rozdělit aplikační logiku do standardních ES modulů v adresáři `src/`:
- `src/core/`: čisté lingvistické a detekční jádro (`detector.js`, `morphology.js`, `onomastic.js`, `propagation.js`, `rules.js`),
- `src/formats/`: formátové moduly (`pdf.js`, `docx.js`, `xlsx.js`, `rtf.js`, `odt.js`),
- `src/crypto/`: kryptografické operace (`session.js`),
- `src/worker/`: obsluha Web Workeru (`worker.js`),
- `src/ui/`: uživatelské rozhraní a tutoriály (`app.js`, `movie.js`).

Sestavovací skript `build.js` v čistém Node.js (bez externích npm balíčků typu Webpack/Rollup) skládá distribuční soubor `znecitelne.html` tak, že veškerý kód vkládá přímo jako inline skripty. Tím je zachována stoprocentní funkčnost při přímém otevření přes protokol `file:///` i přes lokální HTTP server. Testovací sada `test.js` přímo importuje jednotlivé ES moduly bez `node:vm`.

## Důsledky

- **Vysoká stabilita a testovatelnost**: Jednotkové testy v `test.js` přímo importují čisté funkce ze `src/` se statickou kontrolou syntaxe a okamžitou odezvou.
- **Zachování offline distribuce (Zero-Network)**: Výsledkem sestavení je stále samostatně otevřitelný kanonický soubor `znecitelne.html` doplněný o lokální knihovny v `./lib/`.
- **Snadná údržba**: Každá doménová a formátová komponenta má jasně ohraničenou zodpovědnost a samostatný soubor.
