# Výhradně lokální zpracování bez síťové komunikace (Zero-Network Offline Processing)

## Kontext a rozhodnutí

Uživatelé v české státní správě, samosprávě a regulovaných odvětvích zpracovávají dokumenty s vysokým stupněm utajení, osobními údaji (GDPR) nebo obchodním tajemstvím. Odesílání těchto dat do cloudových služeb nebo vzdálených API (včetně cloudových velkých jazykových modelů / LLM) představuje nepřijatelné právní a bezpečnostní riziko.

Rozhodli jsme se, že veškeré zpracování dokumentů – včetně extrakce textu, optického rozpoznávání znaků (OCR), regexové a morfologické detekce i generování sanitizovaných souborů – probíhá výhradně v paměti webového prohlížeče na koncovém zařízení uživatele. Aplikace nesmí odesílat žádná zpracovávaná data, telemetrii ani diagnostické metriky na vzdálené servery.

## Důsledky

- **Právní a bezpečnostní jistota**: Uživatelé a organizace mají 100% jistotu, že citlivá data neopustí jejich zařízení ani vnitřní síť.
- **Dostupnost v air-gap prostředí**: Aplikace je plně funkční v izolovaných sítích bez přístupu k internetu za předpokladu přítomnosti lokálních runtime knihoven a modelů (`./lib/*`).
- **Kompromis v možnostech AI**: Detekce a zpracování se musí spoléhat na deterministická pravidla, slovníky, regulární výrazy a lokální algoritmy (např. českou lemmatizaci a Tesseract OCR) namísto pokročilých cloudových neuronových sítí.
