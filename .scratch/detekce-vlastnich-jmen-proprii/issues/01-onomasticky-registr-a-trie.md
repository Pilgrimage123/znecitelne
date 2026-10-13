# 01: Onomastický registr a kompaktní paměťové trie

**What to build:**
Vytvoření kurátorovaného onomastického registru nejčastějších českých jmen a příjmení (podle dat MVČR), jeho komprese do úsporného DEFLATE payloadu pomocí existující knihovny `fflate`, a implementace asynchronní inicializace klientského trie / rychlého prefixového automatu při startu aplikace v `znecitelne.html`.

**Blocked by:** None (může začít okamžitě)

**Status:** ready

- [ ] Vygenerovat reprezentativní slovník top frekventovaných českých křestních jmen a příjmení v normalizované podobě.
- [ ] Zkomprimovat slovník přes `fflate` a uložit jako kompaktní base64 řetězec v `znecitelne.html`.
- [ ] Implementovat odlehčenou datovou strukturu trie / look-up pro $\mathcal{O}(L)$ ověřování bez paměťového přetížení prohlížeče.
- [ ] Integrovat inicializaci do startovací sekvence aplikace bez blokování hlavního vlákna UI.
