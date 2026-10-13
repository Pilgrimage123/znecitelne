# 02: Desambiguace větných verzálek a kontextové triggery

**What to build:**
Implementace eliminace falešně pozitivních nálezů na počátku vět (normalizace tokenů za tečkou/interpunkcí a filtrace běžných apelativ, spojek a předložek) a současně zavedení robustní triggerové gramatiky (administrativní markery, procesní role a tituly) pro prioritní záchyt vzácných či cizojazyčných jmen.

**Blocked by:** 01 (využívá onomastický registr)

**Status:** closed

- [x] Implementovat algoritmus detekce větných hranic a nultých pozic ve větných celcích.
- [x] Doplnit normalizaci na malá písmena a blokování falešných personálních nálezů u osamocených apelativ (např. *„Starý...“*, *„Nový...“*, *„Podle...“*), pokud netvoří víceslovnou jmennou frázi ani nejsou uvozena triggerem.
- [x] Implementovat pravidlové triggery pro úřední a procesní kontexty (*nar.*, *bytem*, *r. č.*, *žalobce*, *svědek*, *obžalovaný*).
- [x] Přiřadit triggerovým nálezům patřičnou konfidenci a označení v revizním UI (`[Trigger: role]` / `[Trigger: úřední]`).
