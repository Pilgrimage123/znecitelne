# Klientská hybridní detekce vlastních jmen a dokumentová mezipaměť entit

## Kontext a rozhodnutí

Detekce vlastních jmen (proprií) v českém textu naráží na silnou asymetrii mezi rizikem reidentifikace (falešně negativní nálezy – FN) a degradací čitelnosti dokumentu (falešně pozitivní nálezy – FP způsobené pády, přechylováním, homonymií s apelativy a verzálkami na začátku vět). Současně aplikace podle [ADR-0002](./0002-zero-network-offline-processing.md) striktně vyžaduje čistě lokální zpracování v paměti webového prohlížeče bez odesílání dat na externí neuronové či cloudové servery.

Rozhodli jsme se realizovat hybridní lingvistickou pipeline přímo v klientském prostředí prohlížeče (JavaScript):
1. **Asymetrická dvoufázová detekce**: Citlivé zachycení kandidátů kombinací kontextových triggerů (tituly, procesní role, administrativní markery jako „nar.“, „bytem“) a komprimovaného onomastického registru nejfrekventovanějších českých jmen (trie rozbalované pomocí `fflate`).
2. **Lingvistická desambiguace**: Eliminace falešných pozitivních detekcí na počátku vět normalizací a syntaktickým ověřením apelativ a kolokací.
3. **Dokumentová mezipaměť entit**: Obousměrné šíření potvrzených personálních nálezů v plném flektivním pádovém rozsahu napříč dokumentem v souladu s [ADR-0003](./0003-natural-czech-declension-pseudonym-tokens.md).
4. **Profil publikace Justiční rozhodnutí**: Kontextový autoritní whitelist pro zákonné výjimky podle vyhlášky č. 403/2022 Sb. (soudci v rozhodovací pravomoci, sídla soudů a citace judikatury/literatury).

## Důsledky

- **Bezpečnost a offline provoz**: Plná ochrana osobních údajů v souladu s GDPR a resortními předpisy při zachování nulové síťové komunikace (Zero-Network).
- **Výrazné snížení chybovosti**: Eliminace FN u skloňovaných a zkrácených tvarů díky dokumentové mezipaměti entit a potlačení FP u homonym a počátečních verzálek.
- **Paměťová efektivita**: Komprimovaný registr a dynamická morfologická derivace nezatěžují paměť prohlížeče desítkami milionů statických řetězců.
