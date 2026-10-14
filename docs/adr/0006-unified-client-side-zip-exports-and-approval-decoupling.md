# Jednotné klientské ZIP exporty, oddělení schvalování a ergonomie UI

## Kontext a rozhodnutí

V původním řešení docházelo při exportu AI balíčku a dávkové fronty ke spouštění mnoha po sobě jdoucích stahování jednotlivých souborů (až 4 soubory u AI balíčku a desítky souborů u dávky), což moderní webové prohlížeče vyhodnocovaly jako nevyžádané stahování a blokovaly jej. Zároveň byl Rychlý režim (`quickMode`) provázán s obcházením schvalovacího procesu (`reviewSkipped`), v pravém panelu se duplikoval náhled změn (`#resultPane`) a akční lišta byla přetížena 10 nesourodými tlačítky včetně svislého dokování rozbíjejícího layout.

Rozhodli jsme se pro tato architektonická opatření:
1. **Jednotné klientské ZIP balení (`fflate`)**: AI balíček i hromadný export z dávkové fronty jsou přímo v paměti prohlížeče komprimovány do jediného ZIP archivu (`-ai-pack.zip`, `znecitelne-davka.zip`), čímž je eliminována jakákoli blokace stahování a garantována integrita výstupu včetně souhrnného auditu.
2. **Oddělení ergonomie od schvalovacího stavu**: Rychlý režim (`quickMode`) je striktně vizuální zobrazení pro přímočaré procházení nálezů s možností okamžitého přepnutí v liště. Povinnost schválení dokumentu před exportem (`reviewed`) zůstává zachována, dokud si uživatel vědomě neaktivuje Zrychlené schvalování (`fastApprove`).
3. **Jediný zdroj pravdy pro náhled změn**: Odstraněn duplicitní statický panel `#resultPane` v postranní liště; náhled znečitelněného textu je soustředěn do interaktivního přepínače „Preview změn“ v hlavním pracovním prostoru.
4. **Konzistence entit u právních důvodů**: Nastavení zákonného důvodu znečitelnění se automaticky propaguje na všechny výskyty stejné identity (`entityKey`) napříč dokumentem.
5. **Ergonomická horizontální lišta a exportní dialog**: Odstraněno svislé dokování lišty (`left`/`right`); druhotné administrativní exporty (`Audit JSON`, `Protokol o znečitelnění`) jsou přesunuty do exportního dialogu a hromadné akce jsou sjednoceny do kompaktního segmentovaného bloku.

## Důsledky

- **Spolehlivost exportu**: 100% úspěšnost stažení kompletních balíčků a dávek na jedno kliknutí bez bezpečnostních zásahů prohlížeče v offline i online prostředí.
- **Bezpečnost a procesní čistota**: Uživatelé v Rychlém režimu ani na mobilních zařízeních již nemohou neúmyslně vyexportovat nezkontrolovaný dokument.
- **Čistší a přehlednější rozhraní**: Zmenšení svislého i vodorovného zahlcení obrazovky, rychlejší orientace v dokumentu a odstranění layoutových chyb.
