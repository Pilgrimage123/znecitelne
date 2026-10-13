# 03: Dokumentová mezipaměť entit a pádová propagace

**What to build:**
Refaktoring stávajícího mechanismu `expandCzechNameMorphology` na plnohodnotnou Dokumentovou mezipaměť entit (Entity Propagation Cache). Jakmile je personální entita potvrzena (shodou v onomastickém registru nebo přes kontextový trigger), vygeneruje se kompletní svazek jejích 7 pádových tvarů a obousměrným průchodem dokumentem se dohledají všechny skloňované i zkrácené výskyty příjmení a provážou na jednotný přirozeně skloňovaný pseudonymizační token dle ADR-0003.

**Blocked by:** 01, 02

**Status:** closed

- [x] Vytvořit správce Dokumentové mezipaměti entit shromažďujícího ověřené personální entity s jejich variantami.
- [x] Vylepšit generátor pádových paradigmat pro česká jména a příjmení (mužské i ženské vzory, přechýlené i nepřechýlené varianty).
- [x] Provést obousměrné dohledání izolovaných tvarů jmen a příjmení v textu a sjednotit jejich `entityKey`.
- [x] Zajistit, aby v režimu Pseudonymizace byly všem nálezům entity přiřazeny správně skloňované pseudonymizační tokeny (`[OSOBA_N]`, `[OSOBĚ_N]`, `[OSOBOU_N]`) dle ADR-0003.
