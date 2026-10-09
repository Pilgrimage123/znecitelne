# 03: Sjednocení doménové terminologie Dávkové fronty v lokalizaci a UI

**What to build:** Plný soulad uživatelského rozhraní s doménovým modelem popsaným v GLOSSARY.md nahrazením zakázaného termínu „Fronta souborů“ za kanonický termín „Dávková fronta“, a odstranění zbytečných a slepých DOM manipulací s neexistujícími CSS třídami.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] V českém lokalizačním objektu a v zobrazeném rozhraní je použit kanonický název „Dávková fronta“ v přísném souladu s GLOSSARY.md.
- [x] V klientském skriptu jsou odstraněny osiřelé manipulace s neexistujícími CSS třídami `.marquee-active`, `.marquee` a `.doc-preview`.
- [x] In-browser autotesty a validace buildu reflektují očištěný stav a hlásí 100% úspěch.
