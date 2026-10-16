# Předávací balíček sezení pro princip čtyř očí

## Kontext a rozhodnutí

Při zpracování citlivých dokumentů ve státní správě a justici vyžaduje procesní řád nebo interní předpis kontrolu druhou oprávněnou osobou (princip čtyř očí). Vzhledem k striktnímu zákazu ukládání dat na server či do cloudu (ADR-0002) a absenci trvalého lokálního úložiště nelze rozpracovaný stav předat přes sdílenou databázi.

Rozhodli jsme se zavést standardizovaný formát souboru **Předávací balíček sezení** (`.znecitelne-session`). Balíček obsahuje kompletní aplikační stav rozpracovaného dokumentu (text, potvrzené i zamítnuté nálezy, entity v dokumentové mezipaměti entit, auditní protokol a volitelně původní binární podklad dokumentu `sourceBuf` pro možnost exportu v původním formátu) a je symetricky šifrován na straně klienta algoritmem AES-GCM s klíčem odvozeným přes PBKDF2 ze zadaného hesla. Ve verzi 2 formátu je serializovaný payload před zašifrováním komprimován pomocí algoritmu Deflate/Zlib (`fflate.zlibSync`), což zabraňuje nadměrné velikosti souborů při přenosu binárních dat. Druhý kontrolor po zadání hesla naváže na práci prvního uživatele bez nutnosti opakovat úvodní detekci.

## Důsledky

- **Bezpečnost v tranzitu**: Rozpracovaný dokument lze bezpečně předat e-mailem nebo přes interní úložiště; bez hesla je obsah nečitelný a integrita chráněna autentizačním tagem AES-GCM.
- **Soulad s nulovou stopou**: Aplikace neukládá heslo ani rozpracovaná data do `localStorage` ani na server; po zavření okna je stav v prohlížeči zničen.
- **Oddělení rolí a plný re-export**: Auditní protokol zaznamenává identitu prvního zpracovatele i druhého kontrolora, což splňuje požadavky na auditovatelnost schvalovacího procesu. Díky uchování binárního podkladu může druhý kontrolor vygenerovat identický sanitizovaný export (PDF, DOCX, XLSX).
