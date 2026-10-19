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
Konzistentní zástupný identifikátor přiřazený entitě (např. `[OSOBA_001]`, `[OSOBĚ_001]`, `[OSOBOU_001]`), který zachovává přirozené české skloňování, vztahy a plynulost textu bez vyzrazení identity.
_Avoid_: Maska, Náhrada, Zástupný symbol, Hash, Rigidní strojová značka

**Anonymizace**:
Nevratné odstranění nebo začernění nálezu v dokumentu tak, aby původní údaj nebyl rekonstruovatelný ani z textové, ani z vizuální vrstvy.
_Avoid_: Znečitelnění (mimo vlastní název aplikace), Začernění (pouze jako vizuální podoba), Cenzura, Skrytí, Promazání

**Sanitizovaný export**:
Výsledný vygenerovaný soubor, z něhož byly fyzicky odstraněny všechny potvrzené citlivé údaje a volitelně i skrytá metadata.
_Avoid_: Očištěný soubor, Finální soubor, Výstup

**Dekonflikce nálezů**:
Automatické vyřešení překrývajících se rozsahů nálezů upřednostněním delšího nebo specifičtějšího úseku textu.
_Avoid_: Sloučení nálezů, Odstranění duplicit

**Profil publikace**:
Přednastavená sada detekčních pravidel a chování (např. Registr smluv, GDPR, Příprava pro AI, Justiční rozhodnutí dle vyhlášky č. 403/2022 Sb.), určující citlivost, výchozí čištění metadat a globální režim zpracování dokumentu.
_Avoid_: Šablona, Nastavení, Exportní předvolba

**Režim zpracování**:
Globální způsob transformace nálezů v dokumentu vymezený profilem publikace (buď plná Anonymizace, nebo Pseudonymizace).
_Avoid_: Metoda, Akce, Režim výstupu

**Stav schválení**:
Přezkum dokumentu uživatelem před exportem (např. ruční kontrola, princip čtyř očí nebo zrychlené schvalování) potvrzující správnost navržených zásahů.
_Avoid_: Validace, Povolení, Stav úlohy

**Auditní protokol**:
Strojově čitelný záznam o provedené anonymizaci obsahující kryptografické hashe a maskované nálezy bez přítomnosti původních surových citlivých hodnot.
_Avoid_: Log, Protokol o změnách, Historie úprav

**AI balíček**:
Ucelený exportní archiv (ZIP) pro jazykové modely obsahující jak pseudonymizovaný text dokumentu, tak strukturovaný přehled rolí, systémů a kroků procesu bez úniku identit.
_Avoid_: Exportní archiv, Kontejner, Datový balík

**Dávková fronta**:
Uspořádaný seznam více dokumentů určených k postupnému zpracování a hromadnému exportu, v němž se exportují výhradně dokumenty se stavem Schváleno.
_Avoid_: Fronta souborů, Playlist, Dávka

**Vizuální razítko podpisu**:
Grafické zobrazení elektronického podpisu v dokumentu, u něhož se anonymizuje pouze jméno podepsané osoby, zatímco autorita, datum a certifikační metadata zůstávají zachována.
_Avoid_: Elektronický podpis (pro vizuální prvek), Razítko, Podpisová pečeť

**Projektový slovník**:
Sada interních názvů systémů, kódových označení projektů a organizačních jednotek zadaná v nastavení nebo načtená ze souboru jednorázově pro dané sezení bez trvalého ukládání v prohlížeči.
_Avoid_: Uživatelské nastavení, Globální slovník, Interní databáze

**Dokumentová mezipaměť entit**:
Celo-dokumentová paměť potvrzených entit s jejich úplným pádovým svazkem, sloužící k obousměrnému dohledání zkrácených a skloňovaných tvarů bez lokálních kontextových indicií.
_Avoid_: Entity Cache, Globální registr nálezů

**Onomastický registr**:
Frekvenčně vážená databáze vlastních jmen integrovaná v aplikaci, sloužící k deterministickému ověřování a doplňování personálních nálezů.
_Avoid_: Jmenný slovník, Seznam osob, Gazetteer

**Administrativní návěští**:
Strukturní zarážka v úředních a správních dokumentech (např. *Zapsal:*, *Schválil:*, *Přítomni:*, *Omluveni:*, *Odpovídá:*, *Termín:*), která uvozuje agendovou rubriku a slouží jako dopředný kontextový spouštěč pro následující personální údaje, ale sama je z nálezu striktně vyloučena.
_Avoid_: Hlavička, Titulek, Popisek pole, Prefiks jména

**Slovesná desambiguace**:
Morfologické odlišení minulých a trpných slovesných participií (např. *schválil*, *omluven*, *zahájil*) od homonymních českých příjmení slovesného původu (*Pospíšil*, *Navrátil*) prostřednictvím Onomastického registru a syntaktických valenčních vazeb.
_Avoid_: Blacklist sloves, Zakázaná slova, Hardcoded filtrace

**Rychlý režim**:
Vizuální zobrazení uživatelského rozhraní optimalizované pro přímočaré procházení a revizi nalezených údajů v textu s kompaktním ovládáním; jeho aktivace nijak neobchází povinnost formálního schválení dokumentu před exportem.
_Avoid_: Zrychlený režim, Expresní režim, Zjednodušený export

**Zrychlené schvalování**:
Explicitní volba v nastavení dokumentu umožňující export i bez provedení kroků ruční kontroly nebo principu čtyř očí; její využití je vždy zaznamenáno v auditním protokolu.
_Avoid_: Obcházení kontroly, Automatické schválení, Skip review

**Zákonný důvod anonymizace**:
Právní titul (např. ochrana osobních údajů dle GDPR, obchodní tajemství, bankovní tajemství, utajovaná informace nebo jiný zákonem stanovený důvod), na jehož základě je nález začerněn či pseudonymizován; je evidován v auditním protokolu a provázán se všemi výskyty téže entity v dokumentu.
_Avoid_: Zákonný důvod znečitelnění, Důvod začernění, Právní status, Právní štítek

**Předávací balíček sezení**:
Kryptograficky zabezpečený exportní soubor zachycující rozpracovaný stav dokumentu včetně volitelného zapouzdření původního binárního podkladu dokumentu, potvrzené nálezy a auditní záznam, určený pro bezpečné předání druhému kontrolorovi v rámci principu čtyř očí a umožňující identický sanitizovaný export v původním formátu bez trvalého ukládání v prohlížeči.
_Avoid_: Uložená relace, Session backup, Projektový soubor, Stav úlohy

**Ovládací lišta**:
Trvalý pruh uživatelského rozhraní sdružující klíčové ovládací prvky pro schvalování, přepínání náhledu a nevratný export dokumentu, jehož výchozí poloha je v horní části obrazovky pod záhlavím s možností přesunu do spodní části.
_Avoid_: Button bar, Toolbar, Lišta tlačítek, Spodní lišta, Plovoucí lišta

**Pevný layout dokumentu**:
Formát dokumentu (zejména PDF), v němž jsou pozice a rozměry slov vázány na absolutní souřadnice stránky a neumožňují přelévání textu (*text reflow*), kvůli čemuž je náhrada citlivých údajů striktně omezena původními rozměry nálezu.
_Avoid_: Pevný formát, Statický dokument, Nepohyblivý text, Vizuální layout






