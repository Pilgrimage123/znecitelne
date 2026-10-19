# Omezení expanze tokenů a layoutová dekonflikce v PDF

## Kontext a rozhodnutí

Při pseudonymizaci v PDF naráží systém na fundamentální omezení pevného layoutu: text se nepřelévá (*text reflow*). Původní implementace rozšiřovala rámeček pseudonymizačního tokenu doprava podle délky textu tokenu (např. `[FYZICKÁ_OSOBA_001]` místo krátkého jména), což vedlo k přemazání následujících slov i k překrytí sousedních polí. Zároveň volání `indexOf` při posunu offsetů způsobovalo kolaps vícenásobných výskytů téhož údaje na jediné souřadnice a nezohledňovalo účaří (*baseline*).

Rozhodli jsme se:
1. **Sledování výskytů (occurrence tracking)**: Nálezy na stránce jsou párovány deterministicky v lokálním okně offsetu se záznamem obsazených indexů, čímž se vylučuje překrytí opakovaných údajů na prvním výskytu.
2. **Striktní ohraničení šířky v PDF**: Pseudonymizační pole v PDF nesmí horizontálně expandovat za hranici původního textu (`boxW`). Pro delší tokeny se uplatňuje adaptivní zúžení, zkrácený formát a oříznutí.
3. **Vizuální dekonflikce sousedních nálezů**: Nálezy na témže řádku oddělené pouze mezerou se vizuálně slučují do jednoho souvislého bloku, aby nedocházelo k překryvu vycpávek (*padding bleeding*).
4. **Zarovnání na účaří a adaptivní podklad**: Text náhrady je vázán na `baselineY` řádku a podklad přebírá barvu z okolí nálezu namísto ostré bílé plochy.

## Důsledky

- **Vizuální integrita**: Okolní text zůstává čitelný a nepoškozený, nálezy se vzájemně nepřekrývají.
- **Typografická přirozenost**: Text nepůsobí jako vertikálně poskočený a ladí s podkladem.
- **Kompromis u dlouhých tokenů**: V PDF musí být zobrazení pseudonymizačního tokenu kompaktnější nebo horizontálně kondenzované oproti plynulým formátům (DOCX).
