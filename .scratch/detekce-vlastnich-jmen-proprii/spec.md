# Spec: Detekce vlastních jmen v českém anonymizačním systému (Minimalizace FN a FP)

Status: ready-for-agent

## Problem Statement

Uživatelé v české státní správě, justici, samosprávě i komerčním sektoru potřebují spolehlivě anonymizovat a pseudonymizovat dokumenty před jejich veřejným publikováním nebo předáním do jazykových modelů. Identifikace českých vlastních jmen (proprií) však představuje kritickou asymetrickou výzvu:

1. **Právní a bezpečnostní riziko nezachycených jmen (falešně negativní nálezy – FN)**: Nezaznamenání skutečného jména osoby představuje přímé porušení GDPR (nařízení EU 2016/679), zákona č. 110/2019 Sb. o zpracování osobních údajů i resortních předpisů (např. vyhlášky Ministerstva spravedlnosti č. 403/2022 Sb.). Vede k bezprostřednímu riziku reidentifikace subjektu a úniku osobních údajů.
2. **Degradace čitelnosti a sémantiky při nadměrné detekci (falešně pozitivní nálezy – FP)**: Chybné označení běžných apelativ (např. řemesel *Kovář*, barev *Černý*, ročních období *Zima*, názvů zákonů či běžných slov na začátku vět *Nový*, *Starý*, *Podle*) za osobní jména nevratně ničí srozumitelnost textu a znemožňuje jeho další věcné a analytické využití.
3. **Morfologická specifika češtiny**: Čeština jako flektivní jazyk disponuje sedmi pády, nepravidelnou deklinací s kmenovými alternacemi a zánikem vkladných vokálů (*Pavel* $\rightarrow$ *Pavla*, *Pes* $\rightarrow$ *Psa*), produktivním přechylováním (*Novák* $\rightarrow$ *Nováková*), novým nárůstem nepřechýlených ženských příjmení v úředním diskurzu (*paní Smith*, *Jana Novák*), četnou homonymií proprií s obecnou slovní zásobou a ztrátou diskriminační schopnosti velkých písmen na počátku vět.
4. **Striktní provozní omezení (Zero-Network Offline)**: V souladu s architektonickým rozhodnutím ADR-0002 musí veškeré zpracování probíhat výhradně v paměti webového prohlížeče bez odesílání dat do cloudu či na externí servery. Nelze nasadit těžké vícegigabytové neuronové sítě ani serverové jazykové modely.

## Solution

Řešením je klientská hybridní lingvistická pipeline provozovaná čistě v paměti webového prohlížeče (v souladu s ADR-0004 a ADR-0002), která kombinuje deterministické onomastické registry, pravidlovou kontextovou gramatiku, syntaktickou desambiguaci větných počátků a celo-dokumentovou mezipaměť entit:

1. **Komprimovaný onomastický registr a rychlé paměťové trie**: Integrovaná frekvenční databáze nejčastějších českých jmen a příjmení (odvozená z databází MVČR), uložená v úsporném komprimovaném binárním payloadu a při inicializaci rozbalená do paměťového trie pro deterministické ověřování v konstantním čase.
2. **Pravidlové kontextové spouštěče (Triggery)**: Deterministická gramatika zachycující neznámá a cizí jména na základě jejich strukturního okolí – akademických a vědeckých titulů (*Ing.*, *Mgr.*, *JUDr.*, *Ph.D.*), procesních a sociálních rolí (*žalobce*, *svědek*, *obžalovaný*, *poškozený*, *jednatel*, *pan/paní*) a úředních markerů (*nar.*, *bytem*, *trvale bytem*, *r. č.*).
3. **Desambiguace počátečních verzálek vět**: Normalizační a ověřovací algoritmus na větných hranicích, který blokuje označení osamocených apelativ za jména, pokud netvoří víceslovnou jmennou frázi, nejsou uvozena triggerem, nebo již nejsou potvrzena v dokumentu.
4. **Dokumentová mezipaměť entit (Entity Propagation Cache)**: Dvoufázové obousměrné šíření potvrzených entit napříč celým dokumentem. Jakmile je entita potvrzena s vysokou mírou spolehlivosti, dynamický generátor odvodí její kompletní sedmipádové paradigma a dohledá veškeré skloňované i zkrácené výskyty, které prováže na jednotný přirozeně skloňovaný pseudonymizační token (v souladu s ADR-0003).
5. **Profil publikace „Justiční rozhodnutí“**: Dedikovaný profil publikace implementující autoritní whitelist zákonných výjimek dle vyhlášky č. 403/2022 Sb. (soudci a státní zástupci v rozhodovací pravomoci, sídla rozhodujících soudů v záhlaví, bibliografické citace judikatury a odborné literatury).
6. **Fuzzy tolerance digitalizačních chyb**: Omezené vyrovnávání typických záměn znaků z OCR (Levenshteinova vzdálenost $d \le 1$) aktivované výhradně pro dokumenty procházející optickým rozpoznáváním znaků u řetězců o délce alespoň 6 znaků.

## User Stories

1. Jako pověřenec pro ochranu osobních údajů (DPO) chci, aby systém zachytil česká jména ve všech sedmi pádech (např. *s panem Pavlem Novákem*, *výpověď Karla Dvořáka*), aby nedošlo k nezákonnému úniku identit v nepřímých pádech.
2. Jako uživatel zpracovávající smlouvy chci, aby věty začínající běžnými slovy a názvy předpisů (např. *„Nový přístup k řízení...“*, *„Starý občanský zákoník...“*, *„Podle vyjádření žalobce...“*) nebyly chybně označovány za osobní jména, aby dokument zůstal srozumitelný.
3. Jako právní zástupce chci, aby homonymní příjmení odpovídající běžným apelativům (např. *Kovář*, *Holub*, *Zima*, *Němec*) byla rozpoznána jako jména pouze v propriálním kontextu (*„svědek Jiří Kovář vypověděl“*) a nebyla začerňována v obecném významu (*„byl to zručný kovář“*).
4. Jako úředník pracující s naskenovanými spisy chci, aby neobvyklá, cizojazyčná nebo přepisem deformovaná jména (např. *John Smith*, *Al-Mansoor*, *Müller*) byla bezpečně identifikována, pokud jsou uvedena s úředním markerem (*nar.*, *bytem*, *r. č.*) nebo procesní rolí (*obžalovaný*).
5. Jako soudní vyšší úředník chci mít možnost zvolit Profil publikace „Justiční rozhodnutí“, aby se v souladu s vyhláškou č. 403/2022 Sb. nezastírala jména soudců a státních zástupců v záhlaví a podpisu rozhodnutí.
6. Jako soudní vyšší úředník chci, aby v Profilu publikace „Justiční rozhodnutí“ zůstalo zachováno sídlo rozhodujícího soudu (např. *„Krajský soud v Ostravě“*), ale totožný název města byl řádně anonymizován, pokud označuje bydliště účastníka řízení.
7. Jako soudní asistent chci, aby v soudních rozhodnutích zůstaly plně čitelné citace judikatury mezinárodních i vnitrostátních soudů (ESLP, ÚS, NS, NSS) a autorů odborné komentářové literatury (*„Švestka, J. a kol.“*), aby nedošlo k poškození právní argumentace.
8. Jako operátor revizního rozhraní chci, aby nálezy zachycené kontextovým triggerem měly v uživatelském rozhraní zřetelný odznak původu (`[Trigger: role]` nebo `[Trigger: úřední]`), abych mohl rychle posoudit důvod jejich zachycení.
9. Jako uživatel v režimu Zrychleného schvalování chci, aby nálezy z triggerů s jednoznačnými úředními markery měly vysokou konfidenci a výchozí stav schválení (accept: true), aby proces schvalování nebyl zbytečně zdržován.
10. Jako analytik připravující AI balíček chci, aby se po identifikaci plného jména na první straně dokumentu (např. *„obžalovaný Ing. Petr Kovář, nar. 1978“*) automaticky dohledaly i všechny zkrácené a skloňované tvary v celém textu (*„Kováře“*, *„Kovářovi“*) a byly nahrazeny přirozeně skloňovanými pseudonymizačními tokeny (`[OSOBA_001]`, `[OSOBĚ_001]`, `[OSOBOU_001]`) dle ADR-0003.
11. Jako operátor anonymizace chci, aby systém spolehlivě zvládal novodobá nepřechýlená ženská příjmení v úředním diskurzu (*paní Smith*, *Jana Novák*, *Marie Svoboda*) a neselhal na jejich nesklonnosti v nepřímých pádech.
12. Jako bezpečnostní auditor v air-gap prostředí chci, aby veškerá onomastická data a algoritmy fungovaly 100% offline přímo v prohlížeči bez jakéhokoli síťového volání a bez stahování externích modelů.
13. Jako uživatel pracující se skenovanými PDF s nekvalitním OCR chci, aby drobná optická poškození textu v okolí úředních markerů (např. záměna *cl* za *d* nebo *rn* za *m*) byla kompenzována fuzzy párováním, aniž by docházelo k falešným poplachům u běžného digitálního textu.
14. Jako správce kódové báze chci, aby paměťová náročnost onomastického registru v klientském běhu nepřekročila jednotky megabajtů a aplikace naběhla v řádu desítek milisekund bez zamrznutí uživatelského rozhraní.
15. Jako vývojář chci mít jednotné a testovatelné rozhraní pro detekci a dokumentovou propagaci entit, které mohu v automatizovaných testech ověřovat proti pestré škále lingvistických scénářů.

## Implementation Decisions

### 1. Architektura modulů a hranice zpracování
- Detekční logika vlastních jmen bude strukturována do tří provázaných fází v rámci klientského zpracování:
  1. **Hrubá detekce a triggerová extrakce**: Souběžné vyhodnocení onomastického paměťového trie a pravidlové gramatiky kontextových spouštěčů.
  2. **Syntaktická a větná desambiguace**: Vyfiltrování falešných pozitiv na základě větných hranic, normalizovaných apelativ a zakázaných syntaktických kolokací.
  3. **Dokumentová mezipaměť entit (Entity Propagation Cache)**: Dvoufázový obousměrný průchod dokumentem generující plný flektivní svazek pádů pro každou potvrzenou entitu a sjednocující pádové pseudonymizační tokeny.

### 2. Onomastický registr a kompaktní paměťové trie
- Sestavení frekvenčního lexikonu nejčastějších českých křestních jmen a příjmení na základě národních onomastických statistik MVČR.
- Lexikální báze bude uložena v úsporném komprimovaném binárním formátu (DEFLATE) jako base64 řetězec přímo v distribučním balíčku aplikace.
- Při startu aplikace proběhne asynchronní dekomprese pomocí vestavěné knihovny bez blokování vykreslování a naplnění prefixového stromu (trie) optimalizovaného pro okamžité vyhledávání.

### 3. Větná desambiguace a pravidla pro verzálky
- Identifikace větných předělů pomocí koncové interpunkce (tečka, otazník, vykřičník, uvozovky, odrážky a konce odstavců).
- Token na nulté pozici věty je převeden na malá písmena a porovnán se slovníkem běžných apelativ, spojek, předložek a částic.
- Izolované slovo na začátku věty je zablokováno a vyřazeno z personálních nálezů, pokud:
  - bezprostředně nenásleduje další kapitalizované slovo tvořící víceslovnou jmennou frázi (typ *Petr Nový*),
  - není uvozeno procesní rolí nebo akademickým titulem,
  - nebylo dříve evidováno s vysokou spolehlivostí v Dokumentové mezipaměti entit.

### 4. Kontextová triggerová gramatika
- Zavedení deterministických vzorců pro zachycení neznámých proprií ve vysoce specifických kontextech:
  - **Administrativní markery**: *nar.*, *narozen(a)*, *bytem*, *trvale bytem*, *r. č.*, *rodné číslo*.
  - **Procesní a sociální role**: *žalobce*, *žalovaná*, *svědek*, *svědkyně*, *obžalovaný*, *obžalovaná*, *poškozený*, *poškozená*, *jednatel*, *jednatelka*, *pan*, *paní*.
  - **Akademické a profesní tituly**: Pre-nominální tituly (*Ing.*, *Mgr.*, *JUDr.*, *MUDr.*, *doc.*, *prof.*) i post-nominální hodnosti (*Ph.D.*, *CSc.*, *LL.M.*, *MBA*).
- Nálezy zachycené přes administrativní markery a tituly získávají vysokou konfidenci a výchozí stav schváleno (`accept: true`). Nálezy zachycené přes samostatné procesní role získávají střední konfidenci s příznakem triggeru v revizním rozhraní.

### 5. Dokumentová mezipaměť entit a morfologická expanze
- Každá potvrzená personální entita je dekomponována na kmenové složky.
- Dynamický pádový generátor odvodí 7 pádových forem v singuláru i plurálu včetně přechýlených variant a kmenových alternací.
- Sekundární průchod textem identifikuje i osamocené výskyty skloňovaných příjmení v nepřímých pádech (např. *s panem Kovářem*, *podle výpovědi Kováře*), které by samotné v izolovaném kontextu nebyly bezpečně detekovány.
- Všem provázaným nálezům entity je přiřazen jednotný klíč entity a v režimu Pseudonymizace odpovídající skloňovaný pseudonymizační token dle ADR-0003.

### 6. Profil publikace „Justiční rozhodnutí“
- Do aplikačního přepínače profilů publikace přibude volba *Justiční rozhodnutí (vyhl. 403/2022 Sb.)*.
- V tomto profilu bude aktivní trojstupňový kontextový autoritní whitelist:
  1. *Soudci a státní zástupci*: Ochrana jmen uvedených v záhlaví, senátu či podpisové doložce ve spojení s výkonem rozhodovací pravomoci (§ 4 odst. 3 písm. d). Jména účastníků řízení zůstávají chráněna k anonymizaci.
  2. *Sídla rozhodujících soudů*: Zachování názvů měst v kolokaci s rozhodujícím soudem (§ 4 odst. 3 písm. a), nikoli však v adrese účastníka.
  3. *Citace literatury a judikatury*: Ponechání bibliografických odkazů na odbornou literaturu a mezinárodní judikaturu (§ 4 odst. 3 písm. e).

### 7. OCR fuzzy tolerance
- Fuzzy porovnávání řetězců (Levenshteinova vzdálenost $d \le 1$) se aktivuje výhradně u dokumentů procházejících OCR vrstvou nebo při detekci absence nativní textové vrstvy.
- Fuzzy tolerance se uplatňuje pouze na řetězce o délce 6 a více znaků v bezprostředním okolí kontextových triggerů.

## Testing Decisions

### Co tvoří dobrý test
Testy musí ověřovat výhradně vnější doménové chování a sémantickou správnost záchytu a pseudonymizace, nikoli interní proměnné nebo soukromé implementační detaily prefixového stromu. Test ověřuje, zda pro daný vstupní český text systém vytvoří správné nálezy, korektně potlačí falešná pozitiva, sjednotí klíče entit a vygeneruje správné pádové tvary pseudonymizačních tokenů.

### Testovací rozhraní (Testing Seams)
Jediným a nejvyšším testovacím rozhraním pro tuto funkcionalitu je pipeline zpracování dokumentu:
- **Kanonické analytické rozhraní**: Funkce přijímající normalizovaný text dokumentu a konfigurační volby (aktivní typy nálezů, zvolený profil publikace, příznak OCR) a vracející seznam dekonfliktovaných nálezů se všemi atributy (`type`, `value`, `start`, `end`, `entityKey`, `reasons`, `confidence`, `accept`).
- Všechny unit a integrační testy lingvistických jevů budou volány přímo přes toto nejvyšší analytické rozhraní v testovacím runneru.

### Moduly a scénáře k testování
1. **Potlačení falešných pozitiv u počátečních verzálek vět**:
   - Věty začínající běžnými apelativy, spojkami a přídavnými jmény (*„Nový přístup byl zvolen.“*, *„Starý zákoník práce pozbyl platnosti.“*, *„Podle vyjádření žalobce došlo k prodlení.“*).
   - Oproti tomu správné zachycení víceslovného jména na začátku věty (*„Petr Nový podepsal smlouvu.“*).
2. **Homonymie s apelativy**:
   - Ponechání obecných podstatných jmen bez anonymizace (*„zručný kovář vyrobil mříž“*, *„nad městem kroužil holub“*, *„venku vládla tuhá zima“*).
   - Anonymizace týchž slov v propriálním kontextu (*„svědek Jiří Kovář“*, *„pan Holub doložil plnou moc“*).
3. **Pádová flexe a Dokumentová mezipaměť entit**:
   - Detekce plného jména v nominativu a následné spolehlivé zachycení izolovaných tvarů v genitivu, dativu a instrumentálu (*„smlouva s Janem Pavlem“*, *„předáno Pavlovi“*, *„podle názoru Pavla“*).
   - Ověření shody klíčů entit a přiřazení gramatických pseudonymizačních tokenů (`[OSOBA_1]`, `[OSOBĚ_1]`, `[OSOBOU_1]`) dle ADR-0003.
4. **Profil publikace Justiční rozhodnutí (vyhl. 403/2022 Sb.)**:
   - Zachování jména předsedy senátu v záhlaví a podpisu rozhodnutí.
   - Zachování názvu města v názvu soudu (*„Krajský soud v Plzni“*), ale znečitelnění stejného města v bydlišti žalovaného (*„bytem v Plzni“*).
   - Zachování citací autorů odborné literatury a rozsudků ESLP.
5. **Cizojazyčná a nepřechýlená jména s triggery**:
   - Záchyt jmen typu *John Smith*, *Marie Svoboda* uvozených administrativním markerem *nar.* nebo *bytem*.
6. **OCR fuzzy tolerance**:
   - Záchyt jména s drobnou záměnou znaků při aktivním OCR příznaku a délce nad 6 znaků.
7. **Integrita a nulová síťová komunikace**:
   - Statické a běhové ověření nulového síťového provozu a dodržení ADR-0002.

### Předchozí praxe v repozitáři (Prior Art)
Architektura testů navazuje na existující testovací sadu v automatizovaném runneru `test.js`, který využívá izolovaný Node.js VM kontext pro spouštění klientských funkcí nad extrahovaným skriptem bez nutnosti prohlížečového DOMu.

## Out of Scope

- Odesílání textů do cloudových velkých jazykových modelů (LLM) nebo vzdálených API (přísně zakázáno dle ADR-0002).
- Zpracování cizojazyčných textů bez české gramatické stavby (systém se zaměřuje na český jazyk s možností cizích jmen v českém kontextu).
- Manuální editace onomastického slovníku koncovým uživatelem v UI (pro uživatelské výjimky slouží existující Projektový slovník).
- Trénování vlastních neuronových modelů v běhu aplikace.

## Further Notes

- Řešení plně respektuje a doplňuje stávající architektonická rozhodnutí:
  - [ADR-0001: Dual-Layer Sanitized PDF](file:///c:/Users/kocnaro/.gemini/antigravity/scratch/znecitelne/docs/adr/0001-dual-layer-sanitized-pdf.md)
  - [ADR-0002: Zero-Network Offline Processing](file:///c:/Users/kocnaro/.gemini/antigravity/scratch/znecitelne/docs/adr/0002-zero-network-offline-processing.md)
  - [ADR-0003: Natural Czech Declension Pseudonym Tokens](file:///c:/Users/kocnaro/.gemini/antigravity/scratch/znecitelne/docs/adr/0003-natural-czech-declension-pseudonym-tokens.md)
  - [ADR-0004: Client-Side Hybrid Propria Detection and Entity Cache](file:///c:/Users/kocnaro/.gemini/antigravity/scratch/znecitelne/docs/adr/0004-client-side-hybrid-propria-detection.md)
- Všechny termíny důsledně dodržují kanonický slovník [GLOSSARY.md](file:///c:/Users/kocnaro/.gemini/antigravity/scratch/znecitelne/GLOSSARY.md).
