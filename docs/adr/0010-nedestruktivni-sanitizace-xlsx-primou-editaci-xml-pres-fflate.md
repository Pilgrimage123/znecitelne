# Nedestruktivní sanitizace sešitů XLSX přímou editací XML přes fflate

## Kontext a rozhodnutí

Původní implementace exportu sanitizovaných tabulek XLSX využívala komunitní verzi knihovny SheetJS (`xlsx.full.min.js`). Knihovna při novém zápisu sešitu (`XLSX.write`) kompletně přegenerovala interní strukturu souboru a zahodila veškeré vizuální formátování buněk, šířky sloupců, sloučené buňky, podmíněné formátování, vložené grafy i vzorce, což vedlo k nepřijatelné degradaci úředních a smluvních tabulkových příloh.

Rozhodli jsme se opustit generování výstupních sešitů přes SheetJS a namísto toho aplikovat přístup analogický zpracování DOCX:
1. Vstupní soubor XLSX je pomocí knihovny `fflate` rozbalen jako ZIP archiv.
2. Anonymizace a pseudonymizace se provádí přímou editací XML stromů:
   - v centrální tabulce sdílených řetězců `xl/sharedStrings.xml`,
   - v buňkách s přímými texty (`inlineStr`) napříč jednotlivými listy `xl/worksheets/sheet*.xml`.
3. V souboru `docProps/core.xml` a v rozšířených vlastnostech jsou sanitována metadata o autorech a historii změn.
4. Výsledný archiv je zabalen zpět pomocí `fflate` bez přepočtu nebo ztráty stylování.
5. Knihovna SheetJS je ponechána výhradně jako čtecí vrstva pro rychlou extrakci surového textu před detekcí.

## Důsledky

- **100% zachování layoutu**: Všechny grafy, barvy, podmíněné formátování, šířky sloupců i vzorce zůstávají ve výstupním souboru netknuty.
- **Sjednocení architektury formátů**: DOCX i XLSX exporty nyní využívají identický model in-place modifikace ZIP archivu a XML uzlů přes `fflate`.
- **Rychlost a paměťová úspornost**: Přímá manipulace s XML řetězci je řádově rychlejší a méně paměťově náročná než kompletní objektový re-export sešitu.
