# Konsolidace Pracovní lišty a eliminace duplicitních ovládacích prvků

## Kontext a rozhodnutí

Uživatelské rozhraní aplikace Znečitelně obsahovalo po zavedení integrované Pracovní lišty (ADR-0012) stále ještě pozůstatky dřívějších rozhraní, které způsobovaly masivní dablovaní tlačítek, vysokou kognitivní zátěž a přeplněnost horní lišty:
1. **Dvojitá lišta nahoře**: Při otevření dokumentu se pod hlavní Pracovní lištou (`header.app`) zobrazoval druhý pruh (`#bar`), kde bylo 100 % tlačítek pouhou duplikací existujících prvků (stav schválení, exportní akce, přepínání zobrazení a hromadné akce).
2. **Mrtvý kód v DOMu**: V kódu byl přítomen element `#toolbar`, do kterého se při každém překreslení generoval skrytý HTML obsah, aniž by byl pro uživatele viditelný.
3. **Přeplněná pravá zóna Pracovní lišty**: V pravé části lišty (`.hdr-actions`) vedle sebe soupeřilo až 7 tlačítek včetně nesouvisejících administrativních funkcí (`[HTML]` pro stažení offline kopie) a duplicitních tlačítek pro otevření dokumentu (`[+ Nový dokument]`).
4. **Roztříštěná Dávková fronta**: Správa dokumentů probíhala paralelně v rozbalovacím seznamu v Pracovní liště a v samostatném pruhu čipů `#queueBar` nad dokumentem.

Rozhodli jsme se pro tato architektonická a designová opatření:

1. **Definitivní odstranění `#bar` a `#toolbar`**:
   - Kompletně zrušit elementy `#bar` a `#toolbar` z DOMu, JS vykreslování i CSS stylů.
   - Ponechat jedinou, stabilní, jednorázově ukotvenou **Pracovní lištu** v horní části obrazovky v souladu s `GLOSSARY.md`.
2. **Úplné odstranění funkce stažení offline HTML aplikace**:
   - Zrušit tlačítko `#btnHtml` z rozhraní i související obslužný kód (`downloadSelf`, `buildSanitizedHtml`, `getCleanExportHtml`). V souladu s `AGENTS.md` a produkční architekturou je jediným kanonickým artefaktem aplikace sestavený soubor `znecitelne.html`.
3. **Odstranění neplatné konfigurace polohy lišty**:
   - Odstranit volbu polohy lišty (`barPos`) z dialogu Nastavení i z interaktivního tutoriálu (`movie.js`), jelikož Pracovní lišta je výhradně a trvale nahoře.
4. **Sjednocení Dávkové fronty výhradně do Pracovní lišty**:
   - Zrušit samostatný vodorovný pruh `#queueBar` nad dokumentem.
   - V levé zóně kontextu dokumentu zachovat rozbalovací přepínač aktivního dokumentu, doplnit kompaktní tlačítko pro přidání dalšího dokumentu do fronty `[+]` a zavření/odebrání aktivního dokumentu `[✕]`.
   - Do rozbalovací nabídky tlačítka `[Sanitizovaný export ▾]` zařadit položku `📁 Exportovat schválené z fronty (ZIP)`, která se aktivuje při více dokumentech ve frontě.
5. **Kanonické ukotvení hromadných akcí v Revizním panelu**:
   - Akce `[Vše anonymizovat]`, `[Ponechat instituce]` a `[Vše ponechat]` se nacházejí výhradně v pravém revizním panelu (`#reviewAside`) nad entitními kartami, kde přímo navazují na filtry.

## Důsledky

- **Maximální vertikální prostor pro dokument**: Odstranění pruhů `#bar` a `#queueBar` uvolnilo cenné řádky vertikálního prostoru pro samotný text a PDF náhled.
- **Odlehčená a vyvážená Pracovní lišta**: Pravá zóna obsahuje pouze primární Sanitizovaný export a 4 systémové ikony (`⚙`, `☾`, `EN`, `?`). Levá zóna elegantně řeší název dokumentu i celou dávkovou frontu.
- **Nulová duplikace ovládacích prvků**: Každá uživatelská akce (schválení, volba zobrazení, hromadné označení, export) má právě jedno jednoznačné a logické umístění.
- **Zjednodušení kódové báze a vyšší výkon**: Likvidace desítek řádků mrtvého DOM kódu, CSS stylů a zbytečných překreslovacích cyklů zrychluje odezvu rozhraní.
