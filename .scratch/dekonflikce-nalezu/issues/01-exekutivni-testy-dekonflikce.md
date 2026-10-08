# 01: Exekutivní testovací sada rozhraní dekonflikce v test.js

**What to build:** Spustitelná testovací sada v test.js prověřující přes rozhraní modulu resolveHits všechny klíčové doménové invarianty dekonflikce nálezů (přednost schválených nálezů, delší rozsah vyhrává nad kratším podslovem, hraniční dotyky bez falešných kolizí, filtrace neplatných vstupů a deterministický tiebreaker).

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] V test.js je do VM sandboxu načten kód funkcí resolveHits, effectiveHits a visibleHits.
- [x] Test ověřuje, že schválený nález má přednost před delším neschváleným nálezem.
- [x] Test ověřuje, že při shodném stavu schválení vyhrává delší rozsah (např. celé jméno nad částí jména).
- [x] Test ověřuje, že sousední nálezy dotýkající se na hranici (start jednoho se rovná end druhého) nezpůsobí kolizi a oba zůstanou zachovány.
- [x] Test ověřuje vyřazení neplatných nálezů (obrácený rozsah, nečíselné offsety, null/undefined).
- [x] Test ověřuje deterministický tiebreaker pro nerozhodné případy jak u číselných, tak u řetězcových ID.
- [x] `node test.js` projde s nulovými chybami.
