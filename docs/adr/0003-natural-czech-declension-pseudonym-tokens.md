# Přirozené české skloňování pseudonymizačních tokenů

## Kontext a rozhodnutí

Běžné mezinárodní anonymizační a pseudonymizační nástroje používají rigidní neměnné značky (např. `[PERSON_1]`, `<ENTITY_01>`). V češtině – flektivním jazyce se sedmi pády – však nahrazení skloňovaného jména neměnným tokenem zásadně poškozuje syntaktickou stavbu věty (např. *"smlouva s [OSOBA_1]"* místo *"s [OSOBOU_1]"*). Takto degradovaný text zhoršuje čitelnost pro lidské kontrolory i schopnost jazykových modelů (LLM) správně chápat větné vazby, sémantiku a role.

Rozhodli jsme se, že pseudonymizační tokeny v českém jazyce musí zachovávat přirozené gramatické skloňování odpovídající pádu nahrazovaného jména (např. `[OSOBA_001]`, `[OSOBĚ_001]`, `[OSOBOU_001]`). Propojení výskytů k jedné reálné entitě je garantováno společným číselným identifikátorem a vazbou na stejný klíč entity.

## Důsledky

- **Jazyková plynulost**: Výsledný pseudonymizovaný text se čte přirozeně a zachovává správnou českou gramatiku a pády.
- **Kvalita pro AI**: Jazykové modely neztrácejí syntaktický kontext a správně interpretují podmět, předmět i předložkové vazby.
- **Implementační nároky**: Systém musí udržovat morfologická pravidla flexe a pádových koncovek pro česká jména a odpovídající generátory tvarů tokenů.
