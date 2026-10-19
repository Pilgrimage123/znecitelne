export let MOVIE_TIMER = null;
  let MOVIE_PENDING = null;
  let MOVIE_TITLE_TIMER = null;
  let MOVIE_PAUSED = false;
  export let MOVIE_SPEED = 1;
  export const MOVIE_SLOWDOWN = 0.3;
  export function movieEffectiveSpeed(){ return MOVIE_SPEED * MOVIE_SLOWDOWN; }

  export function initActionMarquees(_root){
    /* Cleaned: text overflow handled via responsive CSS */
  }
  export function startTextMarquee(_chip){
    /* Cleaned: chip wrapping handled via responsive CSS */
  }

  let MOVIE_PREV = null;

  function movieCaption(cs, en){ return S.lang === "en" ? en : cs; }

  const MOVIE_SCRIPT_BASIC = [
    {
      setup: () => {},
      chapter: () => movieCaption("Kapitola 1 — Proč Znečitelně", "Chapter 1 — Why Znečitelně"),
      caption: () => movieCaption(
        "Běžné černé zvýraznění ve Wordu pro anonymizaci nestačí. Veřejná AI si pod ním text, včetně jmen a interních ticketů, snadno přečte.",
        "Black highlighting in Word is not anonymization. A public AI still reads the text under it — tickets and names included."
      ),
      holdMs: 7500
    },
    {
      setup: () => {},
      caption: () => movieCaption(
        "Aplikace je plně bezpečná. Žádná data se nikam neodesílají, veškerá detekce a začernění probíhá lokálně přímo ve vašem prohlížeči.",
        "The application is completely safe. Nothing is uploaded; all detection and redaction runs locally directly in your browser."
      ),
      highlight: "privacy",
      holdMs: 7500
    },
    {
      chapter: () => movieCaption("Kapitola 2 — Vzorová smlouva", "Chapter 2 — Sample contract"),
      caption: () => movieCaption(
        "Pro ukázku si načteme fiktivní smlouvu. Na ní si ukážeme, jak se automaticky vyhledávají rodná čísla, IČO nebo bankovní účty.",
        "We load a fictitious contract to show how birth numbers, company IDs and bank accounts are automatically detected."
      ),
      preHighlight: "btnSample",
      highlight: () => ["rc", "ico", "account"].map(t => {
        const x = S.hits.find(k => k.type === t);
        return x ? $("orig").querySelector(`[data-id="${x.id}"]`) : null;
      }).filter(Boolean),
      setup: async () => {
        const enc = new TextEncoder().encode(SAMPLE);
        await ingest("smlouva-vzor.txt", "text", SAMPLE, enc.buffer.slice(enc.byteOffset, enc.byteOffset+enc.byteLength));
        S.movie = true;
      },
      holdMs: 8000
    },
    {
      caption: () => movieCaption(
        "V textu vidíte barevně vyznačené nálezy. Oranžová barva znamená „anonymizovat“ (skrýt), zelená barva znamená „ponechat“ ve veřejném textu.",
        "Hits in the text are color-coded. Orange means 'redact' (hide), green means 'keep' in the public text."
      ),
      setup: () => {
        setDocView("original");
        const h = movieHit(x => x.type === "ico" && /00000205/.test(x.value));
        if (h) patch(h.id, false);
        S.selectedId = null; paintReview();
      },
      highlight: () => [
        $("orig").querySelector(".mk-on"),
        $("orig").querySelector(".mk-off")
      ],
      holdMs: 7500
    },
    {
      caption: () => movieCaption(
        "Práci si můžete urychlit klávesovými zkratkami: J a K pro listování mezi nálezy, R pro začernění a P pro ponechání nálezu.",
        "Speed up your work with shortcuts: J and K to navigate hits, R to redact, and P to keep the hit."
      ),
      setup: () => {
        setDocView("original");
        const h = movieHit(x => x.accept && x.type === "name") || movieHit(x => x.accept);
        if (h) select(h.id);
      },
      highlight: () => [$("orig").querySelector(".mk-sel"), "btnR", "btnK", "qhR", "qhK"],
      holdMs: 7000
    }
  ];

  const MOVIE_SCRIPT_ADVANCED = [
    {
      chapter: () => movieCaption("Kapitola 3 — Osobní údaje", "Chapter 3 — Personal data"),
      caption: () => movieCaption(
        "Aplikace je chytrá: rodná čísla rovnou ověřuje pomocí kontrolního součtu.",
        "Birth numbers are verified via a checksum."
      ),
      setup: () => {
        setDocView("original");
        const h = movieHit(x => x.type === "rc" && x.accept) || movieHit(x => x.type === "rc");
        if (h) select(h.id);
      },
      highlight: () => [$("orig").querySelector(".mk-sel"), "#inspector .layer-note"],
      holdMs: 7000
    },
    {
      caption: () => movieCaption(
        "Všimněte si, že stejná osoba má v celém textu jeden stejný zástupný token, i když je jinde uvedena s titulem, iniciálou nebo v jiném pádě.",
        "Notice that the same person shares one token throughout the text, even if cited with a title, initial, or declined form."
      ),
      setup: () => {
        setDocView("preview");
        const h = movieHit(x => x.type === "name" && /Nov[áa]k/.test(x.value));
        if (h) select(h.id);
      },
      highlight: () => {
        const sel = $("orig").querySelector(".mk-sel");
        if (!sel) return [];
        const tok = sel.textContent.trim();
        return Array.from($("orig").querySelectorAll(".mk-preview")).filter(m => m.textContent.trim() === tok);
      },
      holdMs: 8000
    },
    {
      caption: () => movieCaption(
        "Vždy ale zvažte kontext. Zatímco IČO ministerstva či státního podniku se v Registru smluv běžně nechává, IČO zhotovitele a jeho IBAN je nutné skrýt.",
        "Always consider the context. While a state enterprise IČO is often left in the Register of Contracts, the contractor's IČO and IBAN must be hidden."
      ),
      setup: () => {
        setDocView("original");
        const st = movieHit(x => x.type === "ico" && /00000205/.test(x.value));
        const ic = movieHit(x => x.type === "ico" && /25596641/.test(x.value));
        const ac = movieHit(x => (x.type === "account" || x.type === "iban") && /^CZ\d{2}/i.test(String(x.value).replace(/\s/g, ""))) || movieHit(x => x.type === "account" || x.type === "iban");
        S.selectedId = null; paintReview();
        S.__movieCtx = [st, ic, ac].filter(Boolean).map(x => x.id);
      },
      highlight: () => (S.__movieCtx || []).map(id => $("orig").querySelector(`[data-id="${id}"]`)),
      holdMs: 8500
    },
    {
      chapter: () => movieCaption("Kapitola 4 — Firma a projekt", "Chapter 4 — Firm and project"),
      caption: () => movieCaption(
        "Při sdílení dat s veřejnou AI nestačí skrýt pouze jména. Zvažte také odstranění identifikátorů, jako jsou tickety (např. CBUAIS-5164), názvy systémů nebo stavy produkce.",
        "When sharing data with a public AI, hiding names is not enough. Consider also removing identifiers like tickets (e.g., CBUAIS-5164), system names, or production statuses."
      ),
      setup: () => {
        setDocView("original");
        const h = movieHit(x => x.type === "ticket") || movieHit(x => x.type === "system");
        if (h) select(h.id);
      },
      highlight: () => {
        const m = Array.from($("orig").querySelectorAll(".mk")).filter(e => {
          const h = S.hits.find(x => String(x.id) === e.getAttribute("data-id"));
          return h && ["ticket", "system", "status"].includes(h.type) && e.classList.contains("mk-on");
        });
        const sel = $("orig").querySelector(".mk-sel");
        return sel ? [sel, ...m.filter(e => e !== sel)] : m;
      },
      holdMs: 8500
    },
    {
      caption: () => movieCaption(
        "K tomu slouží režim „konzistentní token“. Ten konkrétní ticket vždy nahradí stejným identifikátorem, například [TICKET_001], a to jednotně v textu, osnově i ve slovníku.",
        "The 'consistent token' mode helps here. It replaces a specific ticket with the same identifier, e.g., [TICKET_001], uniformly in the text, outline, and glossary."
      ),
      setup: () => {
        setDocView("preview");
        const h = movieHit(x => x.type === "ticket");
        S.selectedId = h ? h.id : null; paintReview();
      },
      highlight: () => {
        const m = Array.from($("orig").querySelectorAll(".mk-preview")).filter(e => /TICKET/i.test(e.textContent));
        return m.length ? m : $("orig");
      },
      holdMs: 9000
    },
    {
      setup: () => { closeSettings(); },
      chapter: () => movieCaption("Kapitola 5 — Nastavení podle případu", "Chapter 5 — Settings for the case"),
      caption: () => movieCaption(
        "Kliknutím na ozubené kolo otevřete nastavení.",
        "Click the gear icon to open Settings."
      ),
      highlight: "btnSettings",
      holdMs: 4500
    },
    {
      caption: () => movieCaption(
        "Výběr přednastaveného profilu (Registr smluv, InfZ, Soud, Veřejná AI atd.) za vás automaticky vybere správná pravidla a kategorie.",
        "Selecting a preset profile (Register of Contracts, Info Act, Court, Public AI, etc.) automatically configures the right rules and categories for you."
      ),
      setup: () => { openSettings(); movieShowSelectMenu("profiles"); },
      highlight: "m_selProfile",
      holdMs: 8000
    },
    {
      caption: () => movieCaption(
        "Změnit můžete i způsob nahrazení: kromě konzistentních tokenů lze zvolit nevratné začernění, náhradu znaky XXXX nebo obecnou značku (např. [OSOBA]).",
        "You can change the replacement mode: besides consistent tokens, you can pick irreversible black-boxing, XXXX replacement, or a generic tag (e.g., [PERSON])."
      ),
      setup: () => { openSettings(); movieShowSelectMenu("modes"); },
      highlight: "m_selMode",
      holdMs: 8000
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Jednotlivé kategorie nálezů lze vypínat.",
        "Individual hit categories can be toggled off."
      ),
      highlight: () => Array.from(document.querySelectorAll("#settingsModalMount .cats")),
      holdMs: 5500
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Do vlastního slovníku pak můžete doplňovat konkrétní interní systémy, projekty nebo tajná slova.",
        "You can also add specific internal systems, projects, or secret words to your custom dictionary."
      ),
      highlight: ["m_taSecrets", "m_taSystems", "m_taProjects"],
      holdMs: 6500
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Pokud nahrajete naskenované PDF bez textové vrstvy, zabudované OCR text přečte přímo v prohlížeči. U PDF pak lze prohledávatelnou vrstvu zachovat i po začernění.",
        "If you upload a scanned PDF without a text layer, the built-in OCR reads it directly in the browser. You can also preserve a searchable text layer in PDFs even after redaction."
      ),
      highlight: ["m_chkOcr", "m_chkTrueRedact"],
      holdMs: 9000
    },
    {
      caption: () => movieCaption(
        "Nastavení zase zavřeme — změny se na právě otevřené smlouvě projeví až ve chvíli, kdy je sami upravíte.",
        "Let's close Settings again — changes won't affect the currently open contract until you adjust them yourself."
      ),
      setup: () => { closeSettings(); },
      holdMs: 6000
    },
    {
      setup: () => { closeSettings(); },
      chapter: () => movieCaption("Kapitola 6 — Kontrola a export", "Chapter 6 — Review and export"),
      caption: () => movieCaption(
        "Bezpečnostní mechanismus: bez manuálního zaškrtnutí políčka „Zkontrolováno“ vám aplikace dokument nedovolí exportovat.",
        "Security mechanism: the application won't allow export until you manually check the 'Reviewed' box."
      ),
      highlight: ["chkRev", "btnExp"],
      holdMs: 6500
    },
    {
      caption: () => movieCaption(
        "Výsledný export je nevratný. Vybírat můžete mezi začerněným PDF, souborem Excel zbaveným metadat autora, nebo balíčkem pro AI, který obsahuje slovník bez původních citlivých hodnot.",
        "The resulting export is irreversible. You can choose a redacted PDF, an author-metadata-stripped Excel file, or an AI pack with a glossary excluding original sensitive values."
      ),
      setup: () => { closeSettings(); S.reviewed = true; paintReview(); },
      highlight: ["btnExp", "btnAi"],
      holdMs: 9500
    },
    {
      setup: () => { closeSettings(); openExport(false); },
      caption: () => movieCaption(
        "Tlačítko „Audit JSON“ stáhne technický protokol. Slouží k pozdějšímu formálnímu doložení rozsahu anonymizace, aniž byste si museli ukládat citlivý originál.",
        "The 'Audit JSON' button downloads a technical protocol. It serves as later formal proof of the redaction scope without the need to store the sensitive original."
      ),
      highlight: "btnAudit",
      holdMs: 8500
    },
    {
      setup: () => { if ($("exportModal")) $("exportModal").classList.add("hidden"); closeSettings(); },
      chapter: () => movieCaption("Kapitola 7 — Pokročilé funkce", "Chapter 7 — Advanced functions"),
      caption: () => movieCaption(
        "Následující funkce jsou pokročilé a pro běžnou agendu je nebudete potřebovat. Tlačítkem ⏭️ posunete tutoriál o krok dál, křížkem ✖️ ho ukončíte.",
        "The following functions are advanced and not needed for everyday tasks. Use ⏭️ to jump to the next step, or ✖️ to close the tutorial."
      ),
      highlight: ["movie-btn-skip", "movie-btn-exit"],
      holdMs: 7500
    },
    {
      caption: () => movieCaption(
        "Úpravou citlivosti detekce (nízká/střední/vysoká) určujete přísnost pravidel. Vysoká citlivost najde více dat, ale zvyšuje riziko takzvaných planých poplachů.",
        "Adjusting detection sensitivity (low/medium/high) dictates rule strictness. High sensitivity finds more data but increases the risk of false positives."
      ),
      setup: () => { openSettings(); },
      highlight: "m_selSuspicion",
      holdMs: 8500
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Ovládací lištu si můžete přesunout (nahoru/dolů) podle toho, jak vám to vyhovuje. Na samotnou anonymizaci to nemá vliv.",
        "You can move the toolbar (top/bottom) to whatever is most comfortable for you. It does not affect the redaction itself."
      ),
      highlight: "m_selBarPos",
      holdMs: 7000
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Smazání skrytých metadat souboru a režim PDF, který začerněný text skutečně odstraní a zbytek ponechá jako prohledávatelný text, můžete zapínat a vypínat nezávisle na sobě. Běžně je oboje zapnuto.",
        "You can independently toggle the removal of hidden file metadata and the PDF mode that truly removes redacted text while keeping the rest searchable. Both are enabled by default."
      ),
      highlight: ["m_chkMeta", "m_chkTrueRedact"],
      holdMs: 8500
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Důrazné varování: „Rychlý režim“ a „Zrychlené schvalování“ záměrně skrývají pokročilé prvky a obcházejí nutnost kontroly i vyplnění jména úředníka. Používejte je jen tehdy, pokud přesně víte, co děláte.",
        "Strong warning: 'Quick mode' and 'Accelerated approval' deliberately hide advanced elements and bypass the review requirement and officer name entry. Use only if you know exactly what you are doing."
      ),
      highlight: ["m_chkQuick", "m_chkFast"],
      holdMs: 10500
    },
    {
      setup: () => { openSettings(); },
      caption: () => movieCaption(
        "Zapnutím „Expertního režimu“ si u každého nálezu zobrazíte přesný technický důvod, proč byl detekován (např. kontrolní součet, shoda se slovníkem či vzor). Poskytuje lepší přehled při kontrole.",
        "Enabling 'Expert mode' displays the exact technical reason for each hit (e.g., checksum, dictionary match, or pattern). It provides better oversight during review."
      ),
      highlight: "m_chkExpert",
      holdMs: 9500
    },
    {
      caption: () => movieCaption(
        "Nastavení naposledy zavíráme.",
        "Closing Settings one last time."
      ),
      setup: () => { closeSettings(); },
      holdMs: 3000
    },
    {
      setup: () => { closeSettings(); },
      caption: () => movieCaption(
        "Pozor na hromadné akce „Přijmout vše“ a „Zamítnout vše“. Snadno kvůli nim něco přehlédnete. Tlačítko „Ponechat instituce“ pak hromadně a cíleně odkryje IČO známých úřadů.",
        "Beware of bulk actions 'Accept all' and 'Reject all'. It's easy to miss something with them. The 'Keep public bodies' button specifically reveals the IČO of known authorities."
      ),
      highlight: ["btnAll", "btnNone", "btnOff"],
      holdMs: 9500
    },
    {
      setup: () => { closeSettings(); },
      caption: () => movieCaption(
        "Zaškrtávátko „Druhá kontrola“ se používá u vysoce citlivých dokumentů pro formální potvrzení pravidla „čtyř očí“.",
        "The 'Second review' checkbox is used for highly sensitive documents to formally confirm the 'four eyes' rule."
      ),
      highlight: "chk2",
      holdMs: 7000
    },
    {
      setup: () => { closeSettings(); },
      caption: () => movieCaption(
        "Vlastní soubor nahrajete na úvodní obrazovce tlačítkem „Nový soubor“ nebo pouhým přetažením myší na plochu.",
        "Upload your own file on the start screen using the 'New file' button or simply by drag-and-dropping it onto the area."
      ),
      highlight: "btnNewFile",
      holdMs: 7000
    },
    {
      caption: () => movieCaption(
        "Nyní si můžete vzorovou smlouvu projít sami, nebo rovnou nahrát vlastní dokument. Platí absolutní pravidlo: vaše soubory toto zařízení nikdy neopouští.",
        "You can now review the sample contract yourself, or upload your own document directly. The absolute rule applies: your files never leave this device."
      ),
      setup: () => { closeSettings(); },
      finish: () => { exitMovieTutorial(true); },
      holdMs: 8500
    }
  ];

  const MOVIE_SCRIPT = [...MOVIE_SCRIPT_BASIC, ...MOVIE_SCRIPT_ADVANCED];

  let ACTIVE_MOVIE_SCRIPT = MOVIE_SCRIPT;
  const MOVIE_INERT_SELECTOR = "header.app, #landing, #review, #bar";
  function setMovieInert(on){
    document.querySelectorAll(MOVIE_INERT_SELECTOR).forEach(el => {
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
  }

  function movieClearPulse(){
    document.querySelectorAll(".movie-pulse").forEach(el => el.classList.remove("movie-pulse"));
  }
  function movieResolve(spec){
    let v = typeof spec === "function" ? spec() : spec;
    if (!v) return [];
    if (!Array.isArray(v)) v = [v];
    return v.map(x => {
      if (typeof x !== "string") return x;
      const byId = $(x);
      if (byId) return byId;
      try { return document.querySelector(x); } catch (_) { return null; }
    }).filter(Boolean);
  }

  function movieHit(pred){ return S.hits.find(pred); }
  function movieVisible(el){
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function movieOverlapsCaption(el){
    const c = $("movie-caption-bar").getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return !(r.bottom < c.top || r.top > c.bottom || r.right < c.left || r.left > c.right);
  }
  function movieObstructions(){
    let top = 0, bottom = window.innerHeight;
    ["header.app", "#bar", "#quickHitBar"].forEach(sel => {
      const e = document.querySelector(sel);
      if (!e || e.classList.contains("hidden")) return;
      const pos = getComputedStyle(e).position;
      if (pos !== "sticky" && pos !== "fixed") return;
      const r = e.getBoundingClientRect();
      if (r.height <= 0 || r.width < window.innerWidth * 0.6) return;
      if (r.top + r.height / 2 < window.innerHeight / 2) top = Math.max(top, r.bottom);
      else bottom = Math.min(bottom, r.top);
    });
    return { top, bottom };
  }
  function movieInViewport(el){
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }
  function movieClearlyVisible(el, obs){
    const r = el.getBoundingClientRect();
    let top = 0, bottom = window.innerHeight;
    if (!el.closest("#bar, header.app, #quickHitBar, .modal")) { top = obs.top; bottom = obs.bottom; }
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(p).overflowY) || p.scrollHeight <= p.clientHeight + 1) continue;
      const pr = p.getBoundingClientRect();
      top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom);
    }
    return r.top >= top - 1 && r.bottom <= bottom + 1;
  }
  function movieCovered(el){
    const ctl = $("movie-controls").getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const underControls = !(r.bottom < ctl.top || r.top > ctl.bottom || r.right < ctl.left || r.left > ctl.right);
    return movieOverlapsCaption(el) || underControls;
  }
  function movieReveal(els){
    const cap = $("movie-caption-bar");
    cap.classList.remove("movie-cap-top");
    const first = els[0];
    if (!first || first.closest("#movie-controls, #movie-caption-bar")) return;
    const fixedSel = "#bar, header.app, #quickHitBar";
    const inFixed = !!first.closest(fixedSel);
    const inModal = !!first.closest(".modal");
    const sheet = inModal ? (first.closest(".sheet") || first.closest(".modal")) : null;
    try {
      first.scrollIntoView({ block: inFixed ? "nearest" : "center", inline: "nearest", behavior: "auto" });
    } catch (_) {}
    const pageEls = els.filter(e => !e.closest(fixedSel + ", .modal"));
    const obs = movieObstructions();
    const controlsTop = $("movie-controls").getBoundingClientRect().top;
    const tryOption = (capTop) => {
      cap.classList.toggle("movie-cap-top", capTop);
      const cr = cap.getBoundingClientRect();
      let lo = obs.top + 8, hi = obs.bottom - 8;
      if (capTop) { lo = Math.max(lo, cr.bottom + 8); hi = Math.min(hi, controlsTop - 8); }
      else hi = Math.min(hi, cr.top - 8);
      if (inModal && sheet && sheet.scrollHeight > sheet.clientHeight) {
        if (hi > lo) {
          const rects = els.map(e => e.getBoundingClientRect());
          let t = Math.min(...rects.map(r => r.top)), b = Math.max(...rects.map(r => r.bottom));
          if (b - t > hi - lo) { t = rects[0].top; b = rects[0].bottom; }
          const delta = (t + b) / 2 - (lo + hi) / 2;
          if (Math.abs(delta) > 2) sheet.scrollTop += delta;
        }
      } else if (!inFixed && !inModal && pageEls.length) {
        if (hi > lo) {
          const rects = pageEls.map(e => e.getBoundingClientRect());
          let t = Math.min(...rects.map(r => r.top)), b = Math.max(...rects.map(r => r.bottom));
          if (b - t > hi - lo) { t = rects[0].top; b = rects[0].bottom; }
          const delta = (t + b) / 2 - (lo + hi) / 2;
          if (Math.abs(delta) > 2) window.scrollBy(0, delta);
        }
      }
      const o = movieObstructions();
      return els.filter(e => movieCovered(e)).length * 10 + els.filter(e => !movieClearlyVisible(e, o)).length;
    };
    const s0 = tryOption(false);
    if (s0 === 0) return;
    const s1 = tryOption(true);
    if (s1 < s0) return;
    tryOption(false);
  }
  let MOVIE_HL_TOKEN = 0;
  let MOVIE_GENERATION = 0;
  let MOVIE_TRANSITION_LOCK = false;
  let MOVIE_MENU_TIMER = null;
  let MOVIE_MENU_KIND = null;
  function movieClearSelectMenu(){
    if (MOVIE_MENU_TIMER) clearInterval(MOVIE_MENU_TIMER);
    MOVIE_MENU_TIMER = null;
    MOVIE_MENU_KIND = null;
    const menu = $("movie-select-menu");
    if (!menu) return;
    menu.classList.remove("active");
    menu.setAttribute("aria-hidden", "true");
    menu.innerHTML = "";
  }
  function movieShowSelectMenu(kind){
    movieClearSelectMenu();
    const menu = $("movie-select-menu");
    const root = $("settingsModalMount");
    if (!menu || !root) return;
    const t = i();
    const source = kind === "profiles" ? t.profiles : t.modes;
    const select = root.querySelector(kind === "profiles" ? "#m_selProfile" : "#m_selMode");
    if (!select) return;
    MOVIE_MENU_KIND = kind;
    const entries = Object.entries(source);
    const selected = kind === "profiles" ? S.profile : S.mode;
    const title = kind === "profiles"
      ? (S.lang === "cs" ? "Profil" : "Profile")
      : (S.lang === "cs" ? "Režim náhrady" : "Replacement mode");
    menu.innerHTML = `<div class="movie-select-menu-title">${esc(title)}</div>` +
      entries.map(([k,v], idx) =>
        `<div class="movie-select-option ${k===selected?"is-selected":""}" data-index="${idx}">${esc(v)}</div>`
      ).join("");
    menu.classList.add("active");
    menu.setAttribute("aria-hidden", "false");

    const place = () => {
      const r = select.getBoundingClientRect();
      const mw = Math.min(Math.max(r.width, 240), window.innerWidth - 20);
      let left = Math.max(10, Math.min(r.left, window.innerWidth - mw - 10));
      let top = r.bottom + 4;
      const mh = Math.min(menu.scrollHeight || 360, Math.floor(window.innerHeight * .52));
      if (top + mh > window.innerHeight - 10) top = Math.max(10, r.top - mh - 4);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.width = `${mw}px`;
    };
    place();
    requestAnimationFrame(place);

    let focusIndex = entries.findIndex(([k]) => k === selected);
    if (focusIndex < 0) focusIndex = 0;
    const paintFocus = () => {
      menu.querySelectorAll(".movie-select-option").forEach((el, idx) => {
        el.classList.toggle("is-focus", idx === focusIndex);
      });
    };
    paintFocus();
    const interval = Math.max(900, Math.floor((ACTIVE_MOVIE_SCRIPT[S.movieStepIndex || 0]?.holdMs || 6000) / Math.max(1, entries.length)));
    MOVIE_MENU_TIMER = setInterval(() => {
      if (!S.movie || MOVIE_MENU_KIND !== kind || MOVIE_PAUSED) return;
      focusIndex = (focusIndex + 1) % entries.length;
      paintFocus();
    }, interval);
  }

  function movieHighlight(spec){
    const token = ++MOVIE_HL_TOKEN;
    const cap = $("movie-caption-bar");
    const apply = () => {
      movieClearPulse();
      if (!spec) { cap.classList.remove("movie-cap-top"); return; }
      try { updateHeaderHeightVar(); updateBarHeightVar(); } catch (_) {}
      const toTarget = el => el.matches('input[type="checkbox"]')
        ? (el.closest("label") || el.parentElement || el)
        : el;
      let els = Array.from(new Set(movieResolve(spec).map(toTarget))).filter(movieVisible);
      const menu = $("movie-select-menu");
      if (menu && menu.classList.contains("active")) els.push(menu);
      els = Array.from(new Set(els)).filter(movieVisible);
      if (!els.length) { cap.classList.remove("movie-cap-top"); return; }
      movieReveal(els);
      const seen = els.filter(movieInViewport);
      (seen.length ? seen : els).forEach(el => el.classList.add("movie-pulse"));
    };
    apply();
    if (!spec) return;
    const again = () => { if (token === MOVIE_HL_TOKEN && S.movie) apply(); };
    requestAnimationFrame(() => requestAnimationFrame(again));
    setTimeout(again, 450);
  }
  function movieCancelPlayback(){
    if (MOVIE_TIMER) clearTimeout(MOVIE_TIMER);
    MOVIE_TIMER = null;
    MOVIE_PENDING = null;
  }

  function movieCloseTitleCard(){
    if (MOVIE_TITLE_TIMER) clearTimeout(MOVIE_TITLE_TIMER);
    MOVIE_TITLE_TIMER = null;
    $("movie-title-card").classList.remove("show");
  }

  function movieScheduleTitleClose(ms = 2200){
    if (MOVIE_TITLE_TIMER) clearTimeout(MOVIE_TITLE_TIMER);
    MOVIE_TITLE_TIMER = setTimeout(() => {
      MOVIE_TITLE_TIMER = null;
      if (S.movie) $("movie-title-card").classList.remove("show");
    }, ms);
  }
  function movieSetTimeout(fn, ms){
    const generation = MOVIE_GENERATION;
    MOVIE_PENDING = { fn, remainingMs: ms, generation };
    if (!MOVIE_PAUSED) scheduleMoviePending();
  }
  function scheduleMoviePending(){
    if (!MOVIE_PENDING || MOVIE_PAUSED || !S.movie) return;
    const p0 = MOVIE_PENDING;
    p0.startedAt = Date.now();
    MOVIE_TIMER = setTimeout(() => {
      const p = MOVIE_PENDING;
      MOVIE_PENDING = null;
      MOVIE_TIMER = null;
      if (!p || p.generation !== MOVIE_GENERATION || MOVIE_PAUSED || !S.movie) return;
      p.fn();
    }, Math.max(0, p0.remainingMs / movieEffectiveSpeed()));
  }
  function ensureMovieUI(){
    $("movie-caption-bar").classList.add("active");
    $("movie-controls").classList.add("active");
    document.body.classList.add("movie-active");
    setMovieInert(true);
  }
  function hideMovieUI(){
    movieCloseTitleCard();
    movieClearSelectMenu();
    $("movie-caption-bar").classList.remove("active");
    $("movie-controls").classList.remove("active");
    $("movie-title-card").classList.remove("show");
    document.body.classList.remove("movie-active");
    document.body.classList.remove("movie-paused");
    movieClearPulse();
    setMovieInert(false);
  }

  function movieResetForStep(idx){
    movieClearSelectMenu();
    closeSettings();
    S.profile = "publicai";
    S.mode = "pseudo";
    S.suspicion = "medium";
    S.enabled = Object.fromEntries(KEYS.map(k => [k, true]));
    S.secrets = "jednotkové ceny";
    S.systems = "AIS SBS | SYSTÉM\neSpis | INTEGRACE\nSAMO2 | MODUL";
    S.projects = "CBUAIS | PROJEKT\nORION | PROJEKT";
    S.orgs = "OBÚ | ORGÁN";
    S.stripMeta = true;
    S.includeOutline = true;
    S.publicGlossary = true;
    S.truePdfRedact = true;
    S.expertMode = false;
    S.processAnalysis = false;
    S.quickMode = false;
    S.fastApprove = false;
    S.barPos = "top";
    S.reviewed = false;
    S.secondEyes = false;
    S.selectedId = null;
    S.filter = "all";
    S.seen = new Set();
    S.docView = "original";
    S.hashIn = "";
    S.hashOut = "";
    S.fileName = "";
    S.kind = "text";
    S.sourceBuf = null;
    S.pages = [];
    S.noTextPages = 0;
    S.cellMap = [];
    S.text = "";
    S.hits = [];
    applyQuickMode();
    applyFastApprove();
    applyBarPos();

    if (ACTIVE_MOVIE_SCRIPT !== MOVIE_SCRIPT || idx >= 2) {
      S.fileName = "smlouva-vzor.txt";
      S.kind = "text";
      S.text = SAMPLE;
      S.pages = [{ n:1, start:0, end:SAMPLE.length }];
      runAnalyze(SAMPLE);
    } else {
      paint();
    }
    S.movie = true;
    syncSettingsForms();
  }

  export async function startMovieTutorial(script){
    movieCancelPlayback();
    movieClearSelectMenu();
    movieCloseTitleCard();
    ACTIVE_MOVIE_SCRIPT = (Array.isArray(script) && script.length) ? script : MOVIE_SCRIPT_BASIC;
    S.movie = true;
    S.movieStepIndex = 0;
    MOVIE_GENERATION++;
    S.reviewed = false;
    if (!MOVIE_PREV) MOVIE_PREV = { quick: S.quickMode, fast: S.fastApprove };
    S.quickMode = false; S.fastApprove = false;
    applyQuickMode();
    MOVIE_PAUSED = false;
    document.body.classList.remove("movie-paused");
    MOVIE_SPEED = 1;
    $("movie-btn-speed").textContent = "1×";
    $("movie-btn-playpause").textContent = "⏸️";
    $("movie-btn-back").disabled = true;
    ensureMovieUI();
    await movieGoTo(0);
  }
  function movieShowCaption(step, idx, total){
    const ch = typeof step.chapter === "function" ? step.chapter() : (step.chapter || "");
    const cap = typeof step.caption === "function" ? step.caption() : (step.caption || "");
    $("movie-chapter-label").textContent = ch;
    $("movie-caption-text").textContent = cap;
    const pct = total ? Math.round(((idx + 1) / total) * 100) : 0;
    const fill = $("movie-progress-fill");
    if (fill) fill.style.width = pct + "%";
    const label = $("movie-progress-label");
    if (label) label.textContent = movieCaption(`Krok ${idx + 1} z ${total}`, `Step ${idx + 1} of ${total}`);
    movieCloseTitleCard();
    if (ch) {
      $("movie-title-h").textContent = ch;
      $("movie-title-p").textContent = cap;
      $("movie-title-card").classList.add("show");
      movieScheduleTitleClose(2200);
    }
  }

  async function runMovieStep(generation = MOVIE_GENERATION){
    if (!S.movie || generation !== MOVIE_GENERATION) return;
    const idx = S.movieStepIndex || 0;
    const step = ACTIVE_MOVIE_SCRIPT[idx];
    if (!step) { exitMovieTutorial(true); return; }

    movieResetForStep(idx);
    if (!S.movie || generation !== MOVIE_GENERATION) return;

    movieShowCaption(step, idx, ACTIVE_MOVIE_SCRIPT.length);
    if (step.setup) await step.setup();
    if (!S.movie || generation !== MOVIE_GENERATION || S.movieStepIndex !== idx) return;

    $("movie-btn-back").disabled = idx === 0;
    if (typeof step.highlight !== "function") movieHighlight(step.highlight);
    else if (step.preHighlight) movieHighlight(step.preHighlight);
    else movieClearPulse();

    const go = () => {
      if (!S.movie || generation !== MOVIE_GENERATION || S.movieStepIndex !== idx) return;
      movieHighlight(step.highlight);
      const hold = step.holdMs || 4000;
      movieSetTimeout(() => {
        if (!S.movie || generation !== MOVIE_GENERATION || S.movieStepIndex !== idx) return;
        if (step.finish) {
          step.finish();
          return;
        }
        movieGoTo(idx + 1);
      }, hold);
    };
    go();
  }

  async function movieGoTo(targetIdx){
    if (!S.movie || MOVIE_TRANSITION_LOCK) return;
    const total = ACTIVE_MOVIE_SCRIPT.length;
    const idx = Math.max(0, Math.min(total - 1, Number(targetIdx) || 0));
    MOVIE_TRANSITION_LOCK = true;
    const generation = ++MOVIE_GENERATION;
    movieCancelPlayback();
    movieClearSelectMenu();
    S.movieStepIndex = idx;
    try {
      await runMovieStep(generation);
    } finally {
      if (generation === MOVIE_GENERATION) MOVIE_TRANSITION_LOCK = false;
    }
  }

  function movieTogglePause(){
    if (!S.movie) return;
    MOVIE_PAUSED = !MOVIE_PAUSED;
    document.body.classList.toggle("movie-paused", MOVIE_PAUSED);
    $("movie-btn-playpause").textContent = MOVIE_PAUSED ? "▶️" : "⏸️";
    if (MOVIE_PAUSED) {
      if (MOVIE_TIMER) clearTimeout(MOVIE_TIMER);
      MOVIE_TIMER = null;
      if (MOVIE_PENDING) {
        const elapsedReal = Date.now() - MOVIE_PENDING.startedAt;
        MOVIE_PENDING.remainingMs -= elapsedReal * movieEffectiveSpeed();
        if (MOVIE_PENDING.remainingMs < 0) MOVIE_PENDING.remainingMs = 0;
      }
    } else {
      scheduleMoviePending();
    }
  }
  function movieToggleSpeed(){
    const oldSpeed = movieEffectiveSpeed();
    MOVIE_SPEED = MOVIE_SPEED === 1 ? 1.75 : 1;
    $("movie-btn-speed").textContent = MOVIE_SPEED === 1 ? "1×" : "1,75×";
    if (MOVIE_PENDING && !MOVIE_PAUSED) {
      if (MOVIE_TIMER) clearTimeout(MOVIE_TIMER);
      MOVIE_TIMER = null;
      const elapsedReal = Date.now() - MOVIE_PENDING.startedAt;
      MOVIE_PENDING.remainingMs -= elapsedReal * oldSpeed;
      if (MOVIE_PENDING.remainingMs < 0) MOVIE_PENDING.remainingMs = 0;
      scheduleMoviePending();
    }
  }
  async function movieSkipStep(){
    if (!S.movie || MOVIE_TRANSITION_LOCK) return;
    const idx = S.movieStepIndex || 0;
    if (idx >= ACTIVE_MOVIE_SCRIPT.length - 1) {
      exitMovieTutorial(true);
      return;
    }
    await movieGoTo(idx + 1);
  }
  async function movieBackStep(){
    if (!S.movie || MOVIE_TRANSITION_LOCK) return;
    const idx = S.movieStepIndex || 0;
    if (idx <= 0) return;
    await movieGoTo(idx - 1);
  }

  export function exitMovieTutorial(keepDoc){
    MOVIE_GENERATION++;
    MOVIE_TRANSITION_LOCK = false;
    movieCancelPlayback();
    movieClearSelectMenu();
    S.movie = false;
    if (MOVIE_PREV) {
      S.quickMode = MOVIE_PREV.quick; S.fastApprove = MOVIE_PREV.fast; MOVIE_PREV = null;
      applyQuickMode();
      syncSettingsForms();
    }
    hideMovieUI();
    document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
    if (!keepDoc) reset();
    else paint();
  }


  