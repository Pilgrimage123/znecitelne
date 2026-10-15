# Terminologie anonymizace a výchozí horní poloha ovládací lišty

## Kontext a rozhodnutí

Aplikace nese název **Znečitelně**, což slouží jako zapamatovatelná produktová značka. V uživatelském rozhraní, popisech funkcí i v doménovém modelu však dřívější používání slova „znečitelnění“ vyvolávalo terminologickou nejednoznačnost vůči legislativní praxi (např. GDPR / zákon č. 110/2019 Sb., zákon č. 340/2015 Sb. o registru smluv, vyhláška č. 403/2022 Sb.), kde je standardním a očekávaným pojmem **anonymizace** (případně **pseudonymizace**). 

Zároveň byla ovládací lišta tlačítek historicky ve výchozím stavu ukotvena na spodní hraně obrazovky (`barPos: "bottom"`). Při práci s rozsáhlými smlouvami a spisy to vedlo k horší ergonomii, kdy klíčové ovládací prvky a stav zpracování nebyly v zorném poli uživatele bezprostředně po načtení dokumentu.

Rozhodli jsme se pro tato architektonická a doménová opatření:
1. **Divergence značky a doménového jazyka**: Název aplikace zůstává **Znečitelně** (v záhlaví, titulku a systémových metadatech). Všechny uživatelské akce, tlačítka a právní náležitosti jsou sjednoceny na tvary slova **anonymizace / anonymizovat** (*„Anonymizovat“*, *„Vše anonymizovat“*, *„Anonymizovat a exportovat“*, *„Zákonný důvod anonymizace“*, *„Protokol o anonymizaci“*).
2. **Kanonické ukotvení v GLOSSARY.md**: Termín **Anonymizace** je povýšen na kanonický doménový pojem pro nevratné odstranění/začernění údajů. Výraz „znečitelnění“ je zařazen do sekce `_Avoid_` (mimo vlastní název aplikace).
3. **Ponechání anglického standardu „Redact / Redaction“**: V anglické lokalizaci zůstávají zachovány mezinárodně standardizované termíny pro manipulaci s citlivými údaji v dokumentech a PDF (*„Redact and export“*, *„Redaction record“*).
4. **Výchozí poloha lišty nahoře (`top`)**: Pro všechna nová sezení je lišta výchozím způsobem umístěna pod hlavičkou nahoře (`barPos: "top"`). Existující explicitní uživatelská volba v `localStorage` (`znec-barpos`) zůstává respektována.

## Důsledky

- **Právní a terminologická srozumitelnost**: Úředníci, DPO i compliance specialisté pracují s pojmy, které znají ze zákona a metodik.
- **Lepší ergonomie**: Okamžitá viditelnost akčních tlačítek a stavu kontroly nahoře bez nutnosti scrollovat či hledat lištu u spodního okraje okna.
- **Konzistence a stabilita**: Interní strojové identifikátory (klávesa `R`, interní klíč režimu `box`, stavové proměnné) zůstávají stabilní, což eliminuje riziko skrytých regresí.
