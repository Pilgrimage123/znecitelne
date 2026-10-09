# Spec: Sanitizace kódové báze, odstranění mrtvého kódu a náprava nekonzistencí

Status: ready-for-agent

## Problem Statement

Aplikace pro lokální anonymizaci a pseudonymizaci dokumentů obsahuje historické vrstvy kódu, které vznikly během předchozích architektonických změn (např. přechod na rastrový dual-layer PDF export dle ADR-0001 a True Media Lockdown u DOCX). V kódové bázi zůstalo přes 250 řádků zcela nevolaného a neudržovaného kódu (starý PDF in-stream parser, DOCX přejmenovávání médií, PDF odstraňování podpisových polí). 

Kromě toho testovací sada v `test.js` obsahuje nefunkční (prázdný) regulární výraz, který vytváří falešný pocit bezpečí, terminologie uživatelského rozhraní v češtině je v přímém rozporu se závazným doménovým slovníkem (`GLOSSARY.md`), a v klientském skriptu existují osiřelé JavaScriptové manipulace s CSS třídami, k nimž chybí stylové definice.

Tato situace zvyšuje kognitivní zátěž vývojářů a AI agentů, ztěžuje navigaci v monolitickém souboru, zvětšuje riziko skrytých regresí a narušuje integritu doménového modelu.

## Solution

Provést cílenou sanitizaci a refaktoring kódové báze:
1. Odstranit veškeré identifikované bloky mrtvého kódu z kanonické aplikace bez narušení funkčnosti.
2. Odstranit osiřelé JavaScriptové manipulace s neexistujícími CSS třídami (`.marquee`, `.marquee-active`, `.doc-preview`).
3. Opravit kontrolní mechanismus v testovacím runneru (`test.js`), aby skutečně ověřoval tělo funkce pro export PDF a zabránil znovuzavedení nebezpečných struktur.
4. Sjednotit doménovou terminologii v lokalizačním slovníku (zejména nahrazení zakázaného spojení „Fronta souborů“ za „Dávková fronta“ dle doménového glosáře).
5. Propojit dávkovou ingestaci (`ingestDocumentBatch`) se zpracováním fronty v UI, čímž se odstraní duplicita v načítání více dokumentů.

## User Stories

1. Jako vývojář chci mít z kódové báze odstraněn starý nevolaný PDF tokenizer a in-stream parser, abych nebyl maten opuštěnými funkcemi při úpravách sanitizovaného PDF exportu.
2. Jako bezpečnostní auditor chci mít jistotu, že z DOCX exportéru jsou odstraněny nepoužívané funkce na přejmenovávání citlivých médií, protože aplikace uplatňuje striktní úplné odstranění všech médií.
3. Jako vývojář chci mít odstraněnou mrtvou funkci na odstraňování podpisových polí z PDF, aby v kódu nezůstávaly artefakty z doby před zavedením čisté syntézy nového PDF.
4. Jako kontrolor kvality chci, aby testovací sada v `test.js` obsahovala funkční a striktní regulární výraz pro ověření `exportPdfTrueRedact`, aby test nemohl tiše a falešně projít při prázdné shodě.
5. Jako uživatel v české státní správě chci v uživatelském rozhraní vidět správný a sjednocený termín „Dávková fronta“ namísto zakázaného „Fronta souborů“, aby byla zachována shoda s metodickým a doménovým slovníkem.
6. Jako vývojář chci odstranit zbytečné volání funkcí pracujících s neexistujícími CSS třídami animací a náhledů, aby klientský běh neprováděl slepé manipulace s DOMem.
7. Jako uživatel chci, aby vkládání a otevírání více dokumentů najednou využívalo standardizované rozhraní pro dávkovou ingestaci se strukturovanými chybami, aby selhání jednoho poškozeného dokumentu nezablokovalo načtení ostatních validních položek.
8. Jako správce repozitáře chci, aby kvalita a integrita aplikace byla trvale garantována automatickým spuštěním `npm test` bez nutnosti externích síťových závislostí.

## Implementation Decisions

### 1. Odstranění mrtvého kódu v exportních a parserových modulech
- V kanonické aplikaci se zcela odstraní funkce starého binárního PDF tokenizeru a in-stream náhrad:
  - Odstranit funkce pro tokenizaci PDF, dekódování stringů/bajtů do latinky a textu, inspekci písem a vyhledávání cílových rozsahů v textech streamů.
  - Odstranit DOCX media rename funkce (`docxBuildSensitiveMediaRename`, `docxApplyPartRenames`), které ztratily opodstatnění po zavedení True Media Lockdown.
  - Odstranit funkci `stripPdfSignatureFields`, která není volána při generování nového PDF dokumentu přes rastrový export.

### 2. Očištění osiřelých DOM a CSS manipulací
- Odstranit zbytečné přepínání neexistující třídy `.doc-preview` na elementu `document.body`.
- Odstranit nebo dočistit slepé manipulační rutiny pracující s `.action-marquee` a `.marquee-active`, případně zachovat pouze čisté zobrazení textu bez chybějících CSS klíčových snímků.

### 3. Náprava testovacího rozhraní v testovacím modulu
- Opravit regulární výraz v testovacím souboru, který kontroluje tělo funkce `exportPdfTrueRedact`. Nahradit chybně escapovaný výraz korektní syntaxí a ověřit, že funkce skutečně deleguje na izolovaný rastrový export a nevolá přímé načítání původního PDF souboru.
- Přidat do testovacího ověřovacího procesu negativní kontrolu zajišťující, že se smazaný mrtvý kód (např. starý PDF tokenizer) znovu neobjeví v distribučním souboru.

### 4. Sjednocení terminologie dle doménového glosáře
- V českém lokalizačním objektu nahradit klíč popisku fronty hodnotou „Dávková fronta“ v přesném souladu s `GLOSSARY.md`.
- Prověřit související texty a hlášky týkající se dávkového zpracování, aby striktně respektovaly doménový slovník.

### 5. Propojení dávkového rozhraní ingestace
- Přepracovat obsluhu příjmu více dokumentů ve frontě tak, aby využívala existující kanonické rozhraní `ingestDocumentBatch`, které garantuje jednotné zpracování, neměnné výsledné objekty dokumentů a izolaci chyb u poškozených souborů.

## Testing Decisions

- **Co tvoří dobrý test:** Testy musí testovat vnější doménové chování a celistvost artefaktů, nikoli nepodstatné interní proměnné.
- **Kvalitativní brána (`node test.js`):**
  - Statické ověření nepřítomnosti zastaralých / nebezpečných funkcí.
  - Exekutivní jednotkové testy v odděleném kontextu prověřující funkčnost dekonflikce nálezů a doménové ingestace dokumentů.
  - Funkční ověření, že testy selžou, pokud by `exportPdfTrueRedact` začal načítat původní PDF dokument.
- **Předchozí praxe (Prior Art):**
  - Existující ověřovací schéma v `test.js` a testy dekonflikce nálezů zavedené v předchozích krocích.

## Out of Scope

- Kompletní rozpad monolitického souboru na desítky ES modulů s bundlerem (vyžaduje samostatný architektonický zásah a redesign celého projektu).
- Změna algoritmu pro PDF rastrování (přechod na vyšší DPI nebo vektorové začerňování je předmětem budoucího samostatného ADR).
- Přepisování celého objektu stavu aplikace `S` do Reduxu / stavového automatu.

## Further Notes

- Všechny úpravy musí striktně zachovat offline funkčnost aplikace bez stahování knihoven z internetu (v souladu s ADR-0002).
- Build validační krok `npm run build` a testovací skript `npm test` musí po provedení úprav projít se 100% úspěšností.
