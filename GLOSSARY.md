# Znečitelně

Jednotný kontext pro lokální klientskou anonymizaci a pseudonymizaci citlivých údajů v dokumentech před jejich zveřejněním nebo předáním do AI modelů.

## Jazyk domény

**Dokument**:
Logická jednotka zpracovávaného obsahu (text, stránky nebo buňky) načtená ze vstupního souboru do aplikačního stavu.
_Avoid_: Soubor (pro logický obsah), File, Úloha

**Nález**:
Konkrétní výskyt potenciálně citlivého údaje v dokumentu identifikovaný detektorem nebo uživatelem.
_Avoid_: Hit, Match, Detekce, Incident

**Entita**:
Sjednocená reálná entita (např. konkrétní fyzická osoba nebo firma), která může mít v dokumentu více nálezů v různých tvarech či pádech.
_Avoid_: Objekt, Záznam, Výskyt

**Pseudonymizační token**:
Konzistentní zástupný identifikátor přiřazený entitě (např. `[OSOBA_1]`, `[OSOBĚ_1]`, `[OSOBOU_1]`), který zachovává přirozené české skloňování, vztahy a plynulost textu bez vyzrazení identity.
_Avoid_: Maska, Náhrada, Zástupný symbol, Hash, Rigidní strojová značka

**Znečitelnění**:
Nevratné odstranění nebo začernění nálezu v dokumentu tak, aby původní údaj nebyl rekonstruovatelný ani z textové, ani z vizuální vrstvy.
_Avoid_: Začernění (pouze jako vizuální podoba), Cenzura, Skrytí, Promazání

**Sanitizovaný export**:
Výsledný vygenerovaný soubor, z něhož byly fyzicky odstraněny všechny potvrzené citlivé údaje a volitelně i skrytá metadata.
_Avoid_: Očištěný soubor, Finální soubor, Výstup

**Dekonflikce nálezů**:
Automatické vyřešení překrývajících se rozsahů nálezů upřednostněním delšího nebo specifičtějšího úseku textu.
_Avoid_: Sloučení nálezů, Odstranění duplicit

**Profil publikace**:
Přednastavená sada detekčních pravidel a chování (např. Registr smluv, GDPR, Příprava pro AI), určující citlivost, výchozí čištění metadat a globální režim zpracování dokumentu.
_Avoid_: Šablona, Nastavení, Exportní předvolba

**Režim zpracování**:
Globální způsob transformace nálezů v dokumentu vymezený profilem publikace (buď plné Znečitelnění, nebo Pseudonymizace).
_Avoid_: Metoda, Akce

**Stav schválení**:
Přezkum dokumentu uživatelem před exportem (např. ruční kontrola, princip čtyř očí nebo zrychlené schvalování) potvrzující správnost navržených zásahů.
_Avoid_: Validace, Povolení, Stav úlohy

**Auditní protokol**:
Strojově čitelný záznam o provedené anonymizaci obsahující kryptografické hashe a maskované nálezy bez přítomnosti původních surových citlivých hodnot.
_Avoid_: Log, Protokol o změnách, Historie úprav

**AI balíček**:
Ucelený exportní soubor pro jazykové modely obsahující jak pseudonymizovaný text dokumentu, tak strukturovaný přehled rolí, systémů a kroků procesu bez úniku identit.
_Avoid_: Exportní archiv, Kontejner, Datový balík

**Dávková fronta**:
Uspořádaný seznam více dokumentů určených k postupnému zpracování a hromadnému exportu, v němž se exportují výhradně dokumenty se stavem Schváleno.
_Avoid_: Fronta souborů, Playlist, Dávka

**Vizuální razítko podpisu**:
Grafické zobrazení elektronického podpisu v dokumentu, u něhož se anonymizuje pouze jméno podepsané osoby, zatímco autorita, datum a certifikační metadata zůstávají zachována.
_Avoid_: Elektronický podpis (pro vizuální prvek), Razítko, Podpisová pečeť

**Projektový slovník**:
Externí soubor s interními názvy systémů, kódovými označeními projektů a organizačních jednotek, který se do aplikace načítá jednorázově pro dané sezení bez trvalého ukládání v prohlížeči.
_Avoid_: Uživatelské nastavení, Globální slovník, Interní databáze
