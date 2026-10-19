# Integrovaná pracovní lišta, entitní revize a adaptivní rozvržení

## Kontext a rozhodnutí

Uživatelské rozhraní aplikace Znečitelně se postupným rozvojem analytických schopností (onomastika, skloňování, detekce systémů a razítek) stalo roztříštěným a zatíženým vysokou kognitivní zátěží:
1. Na obrazovce soupeřilo až pět různých ovládacích lišt (`header.app`, `#queueBar`, `#toolbar`, fixní `#bar` a plovoucí `#quickHitBar`), které zabíraly cenný vertikální prostor a mátly uživatele.
2. Uživatel procházel plochý seznam desítek surových nálezů, i když většina z nich představovala tutéž reálnou entitu v různých pádech a tvarech.
3. Přepínače zobrazení dokumentu byly nekonzistentně rozptýleny mezi ovládací lištu a záhlaví textu.
4. Nastavení aplikace bylo duplikováno mezi rozbalovací sekcí `<details>` na úvodní obrazovce a modálním dialogem, s desítkami prvků bez logického členění.
5. Starý „Rychlý režim“ (`quickMode`) fungoval jako uměle odseknutá druhá aplikace namísto přirozeného responzivního chování.
6. V textech přetrvávaly výrazy, které doménový slovník `GLOSSARY.md` zapovídá (*Soubor*, *Hit*, *Začernění*).

Rozhodli jsme se pro tato architektonická a designová opatření:

1. **Sjednocená třízónová Pracovní lišta**: Nahradit roztříštěné lišty jedinou integrovanou Pracovní lištou v horní části obrazovky rozdělenou do 3 zón:
   - *Zóna kontextu (vlevo)*: Název dokumentu s typem formátu, kompaktní rozevírací přepínač dávkové fronty (`Dokument 1 ze 3 ▾`) a tlačítka pro otevření nového či zavření stávajícího dokumentu.
   - *Zóna stavu schválení (střed)*: Kompaktní indikátor zbývajících nálezů a rizik s jednoznačným přepínačem schválení dokumentu (`[ ] Schválit dokument` / `[✓] Schváleno`).
   - *Zóna akcí a systému (vpravo)*: Sdružené akční tlačítko `[ Sanitizovaný export ▾ ]` s rozbalovací nabídkou (*AI balíček (ZIP)*, *Předat pro 4 oči*, *Auditní protokol JSON*) a systémové ikony (režim zobrazení, nastavení, jazyk).
2. **Entitní seskupení v revizním panelu**: Primární prezentace nálezů v revizi je organizována na úrovni reálných Entit (např. *Mgr. Jan Novák · 6 výskytů ve 3 pádech*) s progresivním rozbalením větných kontextů a možností hromadného schválení/vyřazení celé entity jedním kliknutím, s možností přepnutí na lineární seznam nálezů pro detailní audit.
3. **Kontextové přepínače v záhlaví dokumentu**: Přepínání pohledů (`[ Text originálu | Náhled změn | Vizuální PDF ]`) a přidání ručního výběru je přemístěno přímo do záhlaví plochy dokumentu.
4. **Inteligentní asistenční karty**: Suchá řádková varování jsou nahrazena asistenčními kartami (Smart Action Banners) s přímou nápravnou akcí (např. spuštění OCR u skenů bez textové vrstvy, přezkum razítka podpisu).
5. **Jedno strukturované Nastavení a čistá Úvodní obrazovka**: Odstraněn duplicitní formulář v `<details>` na úvodní stránce. Nastavení je soustředěno do dialogového okna se třemi logickými záložkami (*Profil publikace a citlivost*, *Projektové slovníky*, *Dokumentové formáty a zabezpečení*). Úvodní obrazovka staví na dominantní ploše pro přetažení dokumentu s integrovaným výběrem.
6. **Adaptivní responzivní rozvržení namísto umělého Rychlého režimu**: Na desktopu komfortní dvousloupcové rozvržení; na úzkých a mobilních displejích přechod do plné šířky dokumentu se spodním vysouvacím panelem (bottom drawer) pro aktivní entitu/nález.
7. **Předexportní auditní panel (Pre-flight Audit)**: Sanitizovaný export poskytuje přehlednou rekapitulaci provedených zásahů, zákonných důvodů a kryptografických kontrolních součtů SHA-256 před nevratným uložením.
8. **Terminologická očista**: Aktualizován `GLOSSARY.md` (zavedena *Pracovní lišta* a *Entitní seskupení*), všechny texty v UI sjednoceny na kanonický doménový jazyk.

## Důsledky

- **Výrazné snížení kognitivní zátěže**: Uživatel se orientuje v jednotkách reálných entit namísto desítek izolovaných výskytů, což urychluje revizi o desítky procent a snižuje chybovost.
- **Prostorová elegance a stabilita**: Jednořádková Pracovní lišta se sdruženým exportem eliminuje přetékání a zalamování ovládacích prvků na jakékoliv šířce okna.
- **Odstranění duplicit v kódu a DOMu**: Likvidace paralelního Rychlého režimu, rozpadlých lišt a dvojího renderování nastavení zjednodušuje kódovou bázi a usnadňuje údržbu.
- **Soulad s právní a auditní praxí**: Předexportní auditní přehled a terminologická čistota dávají úřadům i compliance pracovníkům jistotu o správnosti a nevratnosti provedených zásahů.
