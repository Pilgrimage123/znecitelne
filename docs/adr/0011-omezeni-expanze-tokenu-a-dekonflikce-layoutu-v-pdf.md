# Omezení expanze tokenů a layoutová dekonflikce v PDF (ADR-0011)

## Kontext a problém

Při anonymizaci a pseudonymizaci v PDF naráží systém na fundamentální omezení pevného layoutu (*fixed layout*): text se nepřelévá (*text reflow*). Původní implementace trpěla několika geometrickými a typografickými vadami:

1. **Rovnoměrný odhad šířek znaků v textové položce:** V `mapPageGlyphs` byla šířka položky dělena počtem znaků (`charW = it.width / len`). U proporčního písma (Helvetica, Times atd.) to způsobovalo kumulativní chybu začátku i konce nálezu uvnitř věty v rozsahu 10–19 px. V důsledku toho záplaty neseděly přesně na slovech, část údajů zůstávala odkrytá a okolní text se zbytečně překrýval.
2. **Přetékání paddingu do mezislovních mezer:** Fixní odsazení boxů (min. 5 px dohromady) přesahovalo běžnou mezislovní mezeru (4–5 px při měřítku 1.7), což způsobovalo vzájemné překrývání rámečků těsně sousedících slov (např. *Ing. | Jan | Novák*).
3. **Příliš velká výška boxu překračující řádkování:** Původní vertikální rozsah `baseLine - 1.04*fH` až `baseLine + 0.30*fH` (1.34 em) přesahoval běžné řádkování (1.15–1.22 em), takže záplaty na po sobě jdoucích řádcích se vertikálně překrývaly a ořezávaly descenders (spodní dotahy g, j, p, y) na řádku nad sebou a diakritiku velkých písmen na řádku pod sebou.
4. **Nekonzistentní slučování a pohlcování slov:** Funkce `mergeAdjacentBoxes` měla příliš velký práh (až 13.6 px), který mohl pohltit krátká nesouvisející slova mezi nálezy (např. spojku *a* nebo předložku *v*). Navíc výšku počítala jako `max(boxH)` namísto `maxBottom - minTop`, což při nestejných horních hranách ořezávalo dolní okraj. Zároveň se slučování neuplatňovalo v náhledu `paintPdfVisualOverlays`.
5. **Nekontrastní nebo našedlé záplaty pozadí:** `sampleCanvasBg` vyžadovalo `lum > 140` a padalo na `#ffffff` (bílá záplata v tmavé buňce tabulky) a vzorkování jednotlivých pixelů těsně vedle boxu zachycovalo antialiasing textu, což vedlo k našedlým skvrnám.
6. **Rozbíjení řádkového zlomu v textovém zobrazení:** Tlačítka `pre.doc button.mk` s `display: inline-block`, okrajem 1.5 px, paddingem a `font-weight: 600` zvyšovala výšku řádku o 5 px a posouvala navazující text.

## Rozhodnutí

Rozhodli jsme se zavést následující rigorózní geometrická a typografická pravidla:

1. **Proporční rozdělení šířek znaků (`computeCharWidths`):**
   - V `mapPageGlyphs` se znaky textové položky nedělí rovnoměrně, nýbrž poměrově podle skutečných metrik písma (`ctx.measureText` v Canvasu s fallbackem na standardní typografické váhové poměry znaků).
   - Součet dílčích šířek přesně odpovídá `it.width * scale`, čímž je zaručena sub-pixelová přesnost polohy nálezu na řádku.
2. **Přizpůsobení paddingu mezislovní mezeře a interpunkci:**
   - Horizontální padding je škálován v poměru k výšce písma (`0.12 * fH`).
   - Při kontaktu s přilehlou interpunkcí (čárky, tečky, závorky) se padding striktně zastavuje 0.5 px před ní (`gap - 0.5`), takže interpunkce zůstává plně čitelná a nezakrytá.
   - Mezi dvěma sousedními nálezy na řádku se padding omezuje na maximálně polovinu volné mezery (`gap / 2 - 0.5`), což garantuje minimálně 1px čistou dělící mezeru a nulový překryv v inspekčním režimu.
3. **Kalibrace výšky boxu na standardní řádkování:**
   - Výška boxu je nastavena na rozsah `baseLine - 0.95*fH` až `baseLine + 0.22*fH` (celkem 1.17 em).
   - 0.95 em spolehlivě pokrývá velká písmena s diakritikou (Č, Š, Ř, Á), aniž by zasahovalo do descenderů řádku nad ním.
   - 0.22 em spolehlivě pokrývá descenders (g, j, p, y), aniž by zasahovalo do diakritiky řádku pod ním.
   - Celková výška 1.17 em se spolehlivě vejde do standardního řádkování (1.15–1.25 em).
4. **Konzistentní slučování sousedních boxů (`mergeAdjacentBoxes`):**
   - Sloučená výška je počítána exaktně jako `maxBottom - minTop` s horní hranou `minTop`.
   - Práh sloučení je omezen na čistou mezislovní mezeru `min(6 * scale, 0.38 * fH)`, což zabraňuje pohlcení krátkých slov (*a*, *v*).
   - V interaktivním náhledu v režimu `box` se sousedící schválené nálezy vykreslují jako jeden sloučený blok, identicky jako v exportovaném PDF.
5. **Vzorkování mediánu barvy pozadí (`sampleCanvasBg`):**
   - Vzorky jsou odebírány po celém vnějším obvodu rámečku (2 a 4 px od okrajů).
   - Odstraněna podmínka `lum > 140`; barva je počítána z interkvartilového průměru vzorků seřazených podle jasu (35. až 65. percentil).
   - Antialiasing textu a okrajové linky jsou přirozeně odfiltrovány jako odlehlé hodnoty. Spolehlivě funguje na bílém podkladu, zažloutlém papíru i tmavých hlavičkách tabulek.
6. **Typografické přizpůsobení náhradních tokenů:**
   - Detekce řezu písma (`pdfDetectFontStyle`: tučné, kurzíva) z názvu fontu a jeho promítnutí do náhradního textu.
   - V režimu `xxxx` se počet znaků `X` přizpůsobuje dostupné šířce `boxW` namísto násilného zmenšování písma.
   - U tokenů zavedena podpora pro kompaktní zkracování všech PII i ORG kategorií.
   - Text je zarovnán na `baselineY` a striktně oříznut v rámci `boxW`.
7. **Čistý tok textu v textovém zobrazení:**
   - Značky `pre.doc button.mk` jsou nastaveny na `display: inline`, `padding: 0`, `border: 0`, s podtržením/stínováním přes `box-shadow` a se standardní vahou písma, takže nezpůsobují vertikální uskakování řádků ani posun slov.

## Důsledky

- **Vizuální a typografická integrita:** Nálezy v PDF ani v náhledu se vzájemně nepřekrývají, nezasahují do sousedních řádků a nezakrývají interpunkci.
- **Bezpečnost anonymizace:** Přesné proporční mapování znaků eliminuje riziko nechtěného odkrytí okrajových písmen citlivých údajů.
- **Věrnost předloze:** Podkladové záplaty dokonale splývají s okolní barvou (včetně tmavých a tónovaných ploch) a náhradní text respektuje řez původního písma dokumentu.
