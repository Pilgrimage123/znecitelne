# Strukturní hranice textu a slovesná desambiguace v personálních nálezech

## Kontext a rozhodnutí

Při zpracování úředních a správních dokumentů (zejména zápisů z porad, protokolů a rozhodnutí) docházelo k systémovému chybnému označování obecných slov (např. *schválil*, *omluven*, *poradu*) za personální nálezy (typ `name`, token `[OSOBA]`). Analýza odhalila trojici kořenových příčin:
1. **Zploštění vertikální struktury PDF**: Extrakce textu z PDF slučovala samostatné vizuální řádky formulářů a záhlaví do jediné mezery (`join(" ")`), což zrušilo větné předěly i hranice polí.
2. **Překročení strukturních zarážek regulárními výrazy jmen**: Regulární výrazy pro titulovaná jména nekriticky absorbovaly následující kapitalizovaná slova na novém řádku nebo před dvojtečkou (např. *Zapsal: Ing. Fröhlich Schválil:*).
3. **Morfologická homonymie českých sloves a příjmení**: Minulá slovesa (*schválil, zahájil*) a pasivní participia (*omluven, přítomen*) mají totožné koncovky jako příjmení slovesného původu (*Pospíšil, Navrátil*). Dosavadní heuristika `looksName` nekriticky akceptovala jakékoliv slovo s koncovkou `-il` jako příjmení. Následná Dokumentová mezipaměť entit tyto chybné tvary flektivně odvodila a nekontrolovaně rozšířila po celém dokumentu.

Rozhodli jsme se zavést systémová architektonická opatření:
1. **Zachování vertikálních řádkových zlomů při extrakci PDF**: Detekce změny souřadnice Y v transformační matici položek a vkládání znaku nového řádku `\n` při přechodu na nový vizuální řádek.
2. **Izolace jmenných frází a zarážka dvojtečkou (Delimiter Guard)**: Zákaz přechodu přes konce řádků (`\n`) v rámci víceslovných jmen a striktní zákaz absorpce slov bezprostředně následovaných dvojtečkou `:` do personálního nálezu.
3. **Slovesná desambiguace přes Onomastický registr**: Asymetrické lingvistické pravidlo – slova vykazující morfologii slovesných participií (minulá l-participia a pasivní participia) jsou považována za slovesa/predikáty a odmítnuta jako jména, pokud jejich kmen není evidován v paměťovém Onomastickém registru (`ONOMASTIC_TRIE` / `NAMES`).
4. **Kmenové flektivní vzorce pro agendová apelativa**: Nahrazení plochých slovníků kmenovými vzorci (např. `porad-`, `jednán-`, `usnesen-`, `úkol-`), které pokrývají kompletní deklinaci v singuláru i plurálu na začátku vět.
5. **Administrativní návěští jako dopředné triggery**: Formalizace sekčních návěští (*Zapsal:*, *Schválil:*, *Přítomni:*, *Omluveni:*, *Odpovídá:*, *Zpracuje:*) jako kontextových spouštěčů pro jména následující za nimi, přičemž samotné návěští zůstává striktně vně nálezu.
6. **Vstupní síto Dokumentové mezipaměti entit**: Zákaz propagace jednoslovných kandidátů na příjmení bez pozitivního ověření v Onomastickém registru nebo bez jednoznačného kontextového spouštěče.

## Důsledky

- **Vysoká přesnost (potlačení FP)**: Úřední rubriky, participia a agendové pojmy se již nikdy nestanou chybným nálezem `[OSOBA]`.
- **Zachování plné citlivosti (nulový nárůst FN)**: Skutečná příjmení slovesného původu (*Pospíšil, Navrátil*) zůstávají spolehlivě detekována díky Onomastickému registru.
- **Odolnost vůči kaskádovým chybám**: Dokumentová mezipaměť entit je chráněna před kontaminací obecnými apelativy.
