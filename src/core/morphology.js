import { NAMES, FIRST_NAMES, TITLES, PUBLIC } from "./rules.js";
import { stripTitle, isOnomasticName, initOnomasticRegistry } from "./onomastic.js";

export function stemNamePart(token){
    const t = stripTitle(token).toLocaleLowerCase("cs");
    if (NAMES.has(t) || isOnomasticName(t)) return t;
    if (/ov(?:á|ou|é|ých|ými|ým)$/u.test(t)) return t.replace(/ov(?:á|ou|é|ých|ými|ým)$/u, "");
    if (/(?:n|l|t|v|m|ch|sk|ck)(?:ého|ému|ým|ném|ných|nými)$/u.test(t)) {
      return t.replace(/(?:ého|ému|ým|ném|ných|nými)$/u, "ý");
    }
    const decl = t.replace(/(?:ovi|ovým|ovými|ových|ové|ama|ami|ách|ům|em|ou|u|e|a)$/u, "");
    if (decl !== t && decl.length >= 3) {
      if (/ov$/u.test(decl) && decl.length >= 4) return decl.replace(/ov$/u, "");
      if (decl.length >= 3 && /[lkc]$/.test(decl)) {
        const alt = decl.slice(0, -1) + "e" + decl.slice(-1);
        if (NAMES.has(alt) || isOnomasticName(alt)) return alt;
      }
      return decl;
    }
    if (/ová$/u.test(t)) return t.replace(/ová$/u, "");
    return t;
  }
  export const RE_AGENDA_APELATIVA = /^(?:porad|jednán|zasedán|program|úkol|kontrol|předpis|zpráv|usnesen|rozhodnut|přehled|vývoj|činnost|řízení|hlášenk)[a-záčďéěíňóřšťúůýž]*$/iu;
  export const RE_PAST_L_PARTICIPLE = /^[a-záčďéěíňóřšťúůýž]{3,}(?:il|ila|ilo|ili|ily|al|ala|alo|ali|aly|el|ela|elo|eli|ely|ěl|ěla|ělo|ěli|ěly|ul|ula|ulo|uli|uly|l|la|lo|li|ly)$/iu;
  export const RE_PASSIVE_PARTICIPLE = /^[a-záčďéěíňóřšťúůýž]{3,}(?:en|ena|eno|eni|eny|án|ána|áno|áni|ány|t|ta|to|ti|ty)$/iu;
  export const ADMIN_VERB_STEMS = /^(?:schvál|omluv|zaps|zaháj|projedn|informov|odpovíd|zprac|předlož|odroč|přeruš|rozhod|zamít|ulož|usnes|zvol|stanov|vyzv|vyhotov|podeps)[a-záčďéěíňóřšťúůýž]*$/iu;

  export function isCzechVerbOrParticiple(word) {
    if (!word) return false;
    const st = typeof stripTitle === "function" ? stripTitle(word) : word;
    const low = st.toLocaleLowerCase("cs").replace(/[.,;:!?]/g, "").trim();
    const hasName = (typeof NAMES !== "undefined" && NAMES && NAMES.has(low)) ||
                    (typeof isOnomasticName === "function" && isOnomasticName(low));
    if (hasName) return false;
    if (typeof ADMIN_VERB_STEMS !== "undefined" && ADMIN_VERB_STEMS.test(low)) return true;
    if (typeof RE_PAST_L_PARTICIPLE !== "undefined" && RE_PAST_L_PARTICIPLE.test(low)) return true;
    if (typeof RE_PASSIVE_PARTICIPLE !== "undefined" && RE_PASSIVE_PARTICIPLE.test(low) && /^(?:o|po|za|z|před|při|od|u|do|vy|na|roz|pře|se)/i.test(low)) return true;
    return false;
  }

  export const RE_CZECH_SURNAMES = /(?:ová|ský|cká|cký|ek|ík|ák|ář|íř|ec|áč|ič|ný|ná|lý|lá|tý|tá|vý|vá|chý|chá|mý|má|eš|oš|uš|iš|ů|íl|ír|ka|da|ra|la|ta|va)$/iu;
  export function looksName(token){
    if (!token) return false;
    const t = stripTitle(token);
    if (!t) return false;
    const low = t.toLocaleLowerCase("cs");
    if (NAMES.has(low) || isOnomasticName(low)) return true;
    if (/^\p{Lu}\.$/u.test(t)) return true;
    if (isCzechVerbOrParticiple(low)) return false;
    if (RE_AGENDA_APELATIVA.test(low) && !NAMES.has(low) && !isOnomasticName(low)) return false;
    const stem = stemNamePart(t);
    if (NAMES.has(stem) || isOnomasticName(stem)) return true;
    if (isCzechVerbOrParticiple(stem)) return false;
    return RE_CZECH_SURNAMES.test(t) || RE_CZECH_SURNAMES.test(stem);
  }
  export const ROLE_WORDS_SET = new Set([
    "pan", "pana", "panu", "panem", "paní", "slečna", "slečně", "slečnu", "slečnou",
    "obžalovaný", "obžalovaná", "obžalovaného", "obžalovanému", "obžalovaným", "obžalované", "obžalovanou",
    "svědek", "svědka", "svědkovi", "svědkem", "svědkyně", "svědkyni", "svědkyní",
    "žalobce", "žalobci", "žalobcem", "žalobkyně", "žalobkyni", "žalobkyní",
    "žalovaný", "žalovaného", "žalovanému", "žalovaným", "žalovaná", "žalované", "žalovanou",
    "poškozený", "poškozeného", "poškozenému", "poškozeným", "poškozená", "poškozené", "poškozenou",
    "jednatel", "jednatele", "jednateli", "jednatelem", "jednatelka", "jednatelky", "jednatelce", "jednatelku", "jednatelkou"
  ]);
  export function nameKey(value){
    const parts = String(value||"").split(/\s+/).map(stripTitle).filter(Boolean)
      .filter(p => {
        const low = p.toLocaleLowerCase("cs").replace(/[.,]/g,"");
        return !TITLES.includes(low) && !ROLE_WORDS_SET.has(low);
      });
    const stemmed = parts.map(stemNamePart).filter(p => p.length>1);
    if (!stemmed.length) return canonToken(value);
    return stemmed.join(" ");
  }
  export function canonToken(s){
    return String(s||"").toLocaleLowerCase("cs").replace(/[^\p{L}\p{N}]+/gu,"");
  }
  export function systemCore(value){
    return String(value||"").replace(/^(?:systém|system|aplikace|modul|rozhraní|integrace|platforma)\s+/i, "").trim();
  }
  export function accountKey(raw){
    const s = String(raw||"").replace(/\s+/g,"").toUpperCase();
    if (/^CZ\d{22}$/.test(s)) {
      const bank = s.slice(4,8);
      const acc = (s.slice(8).replace(/^0+/, "") || "0");
      return "account|"+bank+"|"+acc;
    }
    const m = s.match(/^(?:(\d{1,6})-)?(\d{2,16})\/(\d{4})$/);
    if (m) {
      const acc = ((m[1]||"").padStart(6,"0") + m[2].padStart(10,"0")).replace(/^0+/, "") || "0";
      return "account|"+m[3]+"|"+acc;
    }
    return "account|"+canonToken(raw);
  }
  export function nameInitial(value){
    const m = String(value||"").match(/(?<![\p{L}\p{N}])(\p{Lu})\.(?=\s|$)/u);
    return m ? m[1].toLocaleLowerCase("cs") : "";
  }
  export function isSameCzechSurname(sur, stem) {
    if (!sur || !stem) return false;
    if (sur === stem) return true;
    const surForms = declineCzechSurname(sur).map(nameKey);
    if (surForms.includes(stem)) return true;
    const stemForms = declineCzechSurname(stem).map(nameKey);
    if (stemForms.includes(sur)) return true;
    return false;
  }

  export function clusterNameKeys(hits){
    const names = hits.filter(h => h.type==="name");
    const full = names.filter(h => nameKey(h.value).split(" ").length>=2);
    const shorts = names.filter(h => nameKey(h.value).split(" ").length<2);
    shorts.forEach(s => {
      const stem = nameKey(s.value);
      if (!stem) return;
      const initial = nameInitial(s.value);
      const cands = full.filter(f => {
        const words = nameKey(f.value).split(" ").filter(Boolean);
        const sur = words[words.length-1] || "";
        if (!isSameCzechSurname(sur, stem)) return false;
        if (initial) return (words[0]||"").charAt(0)===initial;
        return true;
      });
      const keys = Array.from(new Set(cands.map(f => f.entityKey)));
      if (keys.length===1) s.entityKey = keys[0];
    });
    return hits;
  }

  export function declineCzechFirstName(first) {
    if (!first) return [];
    const low = first.toLocaleLowerCase("cs");
    const forms = new Set([first]);
    const knownMasc = {
      jan: ["Jan", "Jana", "Janu", "Janovi", "Janem"],
      petr: ["Petr", "Petra", "Petru", "Petrovi", "Petrem"],
      pavel: ["Pavel", "Pavla", "Pavlu", "Pavlovi", "Pavlem"],
      karel: ["Karel", "Karla", "Karlu", "Karlovi", "Karlem"],
      josef: ["Josef", "Josefa", "Josefu", "Josefovi", "Josefem"],
      tomáš: ["Tomáš", "Tomáše", "Tomášovi", "Tomášem", "Tomáši"],
      tomas: ["Tomáš", "Tomáše", "Tomášovi", "Tomášem", "Tomáši"],
      jiří: ["Jiří", "Jiřího", "Jiřímu", "Jiřím"],
      jiri: ["Jiří", "Jiřího", "Jiřímu", "Jiřím"],
      lukáš: ["Lukáš", "Lukáše", "Lukášovi", "Lukášem", "Lukáši"],
      lukas: ["Lukáš", "Lukáše", "Lukášovi", "Lukášem", "Lukáši"],
      ondřej: ["Ondřej", "Ondřeje", "Ondřejovi", "Ondřejem"],
      martin: ["Martin", "Martina", "Martinu", "Martinovi", "Martinem"],
      michal: ["Michal", "Michala", "Michalovi", "Michalem"],
      marek: ["Marek", "Marka", "Marku", "Markovi", "Markem"],
      zdeněk: ["Zdeněk", "Zdeňka", "Zdeňkovi", "Zdeňkem"]
    };
    for (const [nom, list] of Object.entries(knownMasc)) {
      if (list.map(x => x.toLocaleLowerCase("cs")).includes(low)) {
        list.forEach(f => forms.add(f));
        return Array.from(forms);
      }
    }
    if (/i[eé]$/u.test(low)) {
      const stem = first.slice(0, -1);
      [first, stem + "i", stem + "í"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("a")) {
      const stem = first.slice(0, -1);
      [first, stem + "y", stem + "e", stem + "ě", stem + "u", stem + "o", stem + "ou", stem + "i", stem + "ovi"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("el") && low.length > 3) {
      const stem = first.slice(0, -2) + "l";
      [first, stem + "a", stem + "u", stem + "ovi", stem + "em"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("ek") && low.length > 3) {
      const stem = first.slice(0, -2) + "k";
      [first, stem + "a", stem + "u", stem + "ovi", stem + "em"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    [first, first + "a", first + "u", first + "ovi", first + "em", first + "e", first + "i"].forEach(f => forms.add(f));
    return Array.from(forms);
  }

  export function declineCzechSurname(sur) {
    if (!sur) return [];
    const forms = new Set([sur]);
    const low = sur.toLocaleLowerCase("cs");

    if (low.endsWith("ý")) {
      const stem = sur.slice(0, -1);
      [stem + "ého", stem + "ému", stem + "ým", stem + "ém", stem + "í", stem + "ých", stem + "ými", stem + "á", stem + "é", stem + "ou"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("á") && !low.endsWith("ová")) {
      const stem = sur.slice(0, -1);
      [stem + "é", stem + "ou", stem + "ých", stem + "ým", stem + "ými", stem + "ý", stem + "ého", stem + "ému", stem + "ém"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("í")) {
      const stem = sur.slice(0, -1);
      [stem + "ího", stem + "ímu", stem + "ím", stem + "ích", stem + "ími"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("ová")) {
      const stem = sur.slice(0, -3);
      [sur, sur.slice(0,-1)+"é", sur.slice(0,-1)+"ou", sur.slice(0,-1)+"ých", sur.slice(0,-1)+"ým", sur.slice(0,-1)+"ými"].forEach(f => forms.add(f));
      declineCzechSurname(stem).forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("a")) {
      const stem = sur.slice(0, -1);
      [sur, stem + "y", stem + "ovi", stem + "u", stem + "o", stem + "ou", stem + "ě", stem + "e", stem + "ová", stem + "ové", stem + "ovou", stem + "ových", stem + "ovým", stem + "ovými"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("ek") && low.length > 3) {
      const stem = sur.slice(0, -2) + "k";
      [sur, stem + "a", stem + "u", stem + "ovi", stem + "em", stem + "e", stem + "i", stem + "ová", stem + "ové", stem + "ovou", stem + "ových", stem + "ovým", stem + "ovými"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (low.endsWith("ec") && low.length > 3) {
      const stem = sur.slice(0, -2) + "c";
      [sur, stem + "e", stem + "i", stem + "ovi", stem + "em", stem + "ová", stem + "ové", stem + "ovou", stem + "ových", stem + "ovým", stem + "ovými"].forEach(f => forms.add(f));
      return Array.from(forms);
    }
    if (/[cčšžřjďťň]$/iu.test(low)) {
      [sur, sur + "e", sur + "i", sur + "ovi", sur + "em", sur + "ů", sur + "ům", sur + "ích", sur + "ová", sur + "ové", sur + "ovou", sur + "ových", sur + "ovým", sur + "ovými"].forEach(f => forms.add(f));
      return Array.from(forms);
    }

    [sur, sur + "a", sur + "u", sur + "ovi", sur + "em", sur + "e", sur + "i", sur + "ů", sur + "ům", sur + "ech", sur + "y", sur + "ová", sur + "ové", sur + "ovou", sur + "ových", sur + "ovým", sur + "ovými"].forEach(f => forms.add(f));

    if (/(?:ovi|ovým|ovými|ových|ové|em|ou|u|e|a)$/u.test(low)) {
      let nomStem = null;
      if (low.endsWith("ovi")) nomStem = sur.slice(0, -3);
      else if (low.endsWith("em")) nomStem = sur.slice(0, -2);
      else if (low.endsWith("ou")) nomStem = sur.slice(0, -2) + "a";
      else if (low.endsWith("e") && /[cčšžřjďťň]e$/iu.test(low)) nomStem = sur.slice(0, -1);
      else if (low.endsWith("a") && low.length > 3) nomStem = sur.slice(0, -1);
      if (nomStem && nomStem !== sur && nomStem.length >= 3) {
        declineCzechSurname(nomStem).forEach(f => forms.add(f));
        if (/[lkc]$/i.test(nomStem)) {
          const alt = nomStem.slice(0, -1) + "e" + nomStem.slice(-1);
          declineCzechSurname(alt).forEach(f => forms.add(f));
          if (typeof declineCzechFirstName === "function") {
            declineCzechFirstName(alt).forEach(f => forms.add(f));
          }
        }
      }
    }

    return Array.from(forms);
  }

  export function generateCzechNameForms(nameVal) {
    const raw = String(nameVal || "").replace(/,.*$/, "").trim();
    const parts = raw.split(/\s+/).map(stripTitle).filter(Boolean)
      .filter(p => {
        const low = p.toLocaleLowerCase("cs").replace(/[.,]/g, "");
        return !TITLES.includes(low) && !ROLE_WORDS_SET.has(low) && !isCzechVerbOrParticiple(low) && !(RE_AGENDA_APELATIVA.test(low) && !NAMES.has(low) && !isOnomasticName(low));
      });
    if (!parts.length) return [];
    const forms = new Set();
    const courtesies = ["pan", "pana", "panu", "panem", "paní", "slečna", "slečně", "slečnu", "slečnou"];

    if (parts.length >= 2) {
      const first = parts[0];
      const sur = parts[parts.length - 1];
      const firstForms = declineCzechFirstName(first);
      const surForms = declineCzechSurname(sur);

      for (const f of firstForms) {
        for (const s of surForms) {
          forms.add(f + " " + s);
        }
      }
      const init = first[0].toUpperCase() + ".";
      for (const s of surForms) {
        forms.add(init + " " + s);
      }
      for (const c of courtesies) {
        const cCap = c.charAt(0).toUpperCase() + c.slice(1);
        for (const s of surForms) {
          forms.add(c + " " + s);
          forms.add(cCap + " " + s);
        }
        forms.add(c + " " + sur);
        forms.add(cCap + " " + sur);
      }
      for (const s of surForms) {
        if (s.length >= 3) forms.add(s);
      }
      for (const f of firstForms) {
        forms.add(f + " " + sur);
      }
    } else {
      const single = parts[0];
      const surForms = declineCzechSurname(single);
      for (const s of surForms) forms.add(s);
      for (const c of courtesies) {
        const cCap = c.charAt(0).toUpperCase() + c.slice(1);
        for (const s of surForms) {
          forms.add(c + " " + s);
          forms.add(cCap + " " + s);
        }
      }
    }
    return Array.from(forms).filter(f => f && f.length >= 3);
  }


  export function isLikelyNonPersonName(value, src, start, end, reasons){
    if (!value || !src) return false;
    if (reasons && reasons.some(r => r.startsWith("trigger:") || r === "ocr:fuzzy" || r === "titled")) return false;

    const normalize = s => s
      .normalize("NFC")
      .toLocaleLowerCase("cs")
      .replace(/[.,;:!?]/g, "")
      .replace(/[\(\)\[\]"]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Use the source span when it is valid, so offsets and candidate text
    // cannot silently drift apart during post-processing.
    const candidate = Number.isInteger(start) && Number.isInteger(end) &&
      start >= 0 && end > start && end <= src.length
      ? src.slice(start, end)
      : value;
    const name = normalize(candidate || value);

    // Common standalone words that must not be treated as person names.
    // Never blacklist common surnames globally.
    const commonWords = new Set([
      "termín",
      "smlouva",
      "objednatel",
      "zhotovitel",
      "dodavatel",
      "odběratel",
      "kupující",
      "prodávající",
      "pondělí",
      "úterý",
      "středa",
      "čtvrtek",
      "pátek",
      "sobota",
      "neděle",
      "leden",
      "únor",
      "březen",
      "duben",
      "květen",
      "červen",
      "červenec",
      "srpen",
      "září",
      "říjen",
      "listopad",
      "prosinec",
      "porada",
      "poradu",
      "poradě",
      "porady",
      "zasedání",
      "jednání",
      "program",
      "kontrola",
      "úkol",
      "úkoly",
      "schválil",
      "schválila",
      "schváleno",
      "omluven",
      "omluvena",
      "omluveni",
      "omluveno",
      "zapsal",
      "zapsala",
      "přítomen",
      "přítomna",
      "přítomni",
      "odpovídá",
      "zpracoval",
      "zpracovala",
      "zpracuje",
      "uloženo",
      "různé",
      "voda",
      "vody",
      "vodě",
      "vodu",
      "vodou",
      "vodo",
      "vodách",
      "vodám",
      "vodami",
      "vod"
    ]);

    const checkVerb = typeof isCzechVerbOrParticiple === "function" ? isCzechVerbOrParticiple : () => false;
    const checkAgenda = (w) => (typeof RE_AGENDA_APELATIVA !== "undefined" && RE_AGENDA_APELATIVA) ? RE_AGENDA_APELATIVA.test(w) : false;
    const checkName = (w) => (typeof NAMES !== "undefined" && NAMES && NAMES.has(w)) || (typeof isOnomasticName === "function" && isOnomasticName(w));

    if (!name.includes(" ") && (commonWords.has(name) || checkVerb(name) || (checkAgenda(name) && !checkName(name)))) return true;

    // Water & environmental collocations (e.g. "důlní vody", "odpadní vody", "vypouštěných vod")
    const RE_WATER_COLLOCATIONS = /^(?:důlní|důlních|důlním|důlními|odpadní|odpadních|odpadním|odpadními|povrchov[éá]|povrchových|povrchovým|povrchovými|podzemní|podzemních|podzemním|podzemními|pitn[áé]|pitných|pitným|pitnými|užitkov[áé]|užitkových|užitkovým|užitkovými|splaškov[éá]|splaškových|splaškovým|splaškovými|dešťov[éá]|dešťových|dešťovým|dešťovými|minerální|minerálních|minerálním|minerálními|léčiv[éá]|léčivých|léčivým|léčivými|vypouštěn[éá]|vypouštěných|vypouštěným|vypouštěnými|chladicí|chladicích|chladicím|chladicími|průmyslov[éá]|průmyslových|průmyslovým|průmyslovými|stékající|stékajících|technologick[éá]|technologických|provozní|provozních)\s+(?:vod[aeyu]|vodou|vodách|vodám|vodami|vod)$/iu;
    if (RE_WATER_COLLOCATIONS.test(name)) return true;

    // Sentence-initial token desambiguation
    if (Number.isInteger(start) && start >= 0 && isSentenceStart(src, start)) {
      if (!name.includes(" ")) {
        if (SENTENCE_INITIAL_APELATIVA.has(name) || commonWords.has(name) || checkVerb(name) || (checkAgenda(name) && !checkName(name))) return true;
      } else {
        const parts = name.split(" ");
        const isKnownFirstName = (typeof FIRST_NAMES !== "undefined" && FIRST_NAMES) ? FIRST_NAMES.has(parts[0]) : (typeof NAMES !== "undefined" && NAMES ? NAMES.has(parts[0]) : false);
        if ((SENTENCE_INITIAL_APELATIVA.has(parts[0]) || checkVerb(parts[0]) || (checkAgenda(parts[0]) && !checkName(parts[0]))) && (!isKnownFirstName || commonWords.has(parts[1]) || SENTENCE_INITIAL_APELATIVA.has(parts[1]) || checkVerb(parts[1]))) {
          return true;
        }
      }
    }

    // Geographic-name variants and compound municipality names. Keep real names like "Jan Hora" and "Petr Černý".
    const locations = new Set([
      "černá hora", "černé hory", "černé hoře", "černou horu", "černou horou",
      "červená voda", "červené vody", "červené vodě", "červenou vodu", "červenou vodou",
      "bílá voda", "bílé vody", "bílé vodě", "bílou vodu", "bílou vodou",
      "dobrá voda", "dobré vody", "dobré vodě", "dobrou vodu", "dobrou vodou",
      "černá voda", "černé vody", "černé vodě", "černou vodu", "černou vodou",
      "stará voda", "staré vody", "staré vodě", "starou vodu", "starou vodou",
      "suchá voda", "suché vody", "suché vodě", "suchou vodu", "suchou vodou",
      "hojná voda", "hojné vody", "hojné vodě", "hojnou vodu", "hojnou vodou",
      "kutná hora", "kutné hory", "kutné hoře", "kutnou horu", "kutnou horou",
      "krásná hora", "krásné hory", "krásné hoře", "krásnou horu", "krásnou horou",
      "zlaté hory", "zlatých hor", "zlatým horám", "zlatých horách", "zlatými horami",
      "zelená hora", "zelené hory", "zelené hoře", "zelenou horu", "zelenou horou",
      "bílá hora", "bílé hory", "bílé hoře", "bílou horu", "bílou horou",
      "nová ves", "nové vsi", "novou ves", "novou vsí",
      "stará ves", "staré vsi", "starou ves", "starou vsí",
      "dlouhá ves", "dlouhé vsi", "dlouhou ves", "dlouhou vsí",
      "velká ves", "velké vsi", "velkou ves", "velkou vsí",
      "malá ves", "malé vsi", "malou ves", "malou vsí",
      "nové město", "nového města", "novému městu", "novém městě", "novým městem",
      "staré město", "starého města", "starému městu", "starém městě", "starým městem",
      "havlíčkův brod", "havlíčkova brodu", "havlíčkovu brodu", "havlíčkově brodě", "havlíčkovým brodem",
      "český brod", "českého brodu", "českému brodu", "českém brodě", "českým brodem",
      "uherský brod", "uherského brodu", "uherskému brodu", "uherském brodě", "uherským brodem",
      "železný brod", "železného brodu", "železnému brodu", "železném brodě", "železným brodem",
      "vyšší brod", "vyššího brodu", "vyššímu brodu", "vyšším brodě", "vyšším brodem",
      "jindřichův hradec", "jindřichova hradce", "jindřichovu hradci", "jindřichově hradci", "jindřichovým hradcem",
      "hradec králové", "hradce králové", "hradci králové", "hradcem králové",
      "karlovy vary", "karlových var", "karlovým varům", "karlových varech", "karlovými vary",
      "mariánské lázně", "mariánských lázní", "mariánským lázním", "mariánských lázních", "mariánskými lázněmi",
      "františkovy lázně", "františkových lázní", "františkovým lázním", "františkových lázních", "františkovými lázněmi",
      "janské lázně", "janských lázní", "janským lázním", "janských lázních", "janskými lázněmi",
      "mladá boleslav", "mladé boleslavi", "mladou boleslav", "mladou boleslaví",
      "česká lípa", "české lípy", "české lípě", "českou lípu", "českou lípou",
      "česká třebová", "české třebové", "českou třebovou",
      "moravská třebová", "moravské třebové", "moravskou třebovou",
      "české budějovice", "českých budějovic", "českým budějovicím", "českých budějovicích", "českými budějovicemi",
      "vysoké mýto", "vysokého mýta", "vysokému mýtu", "vysokém mýtě", "vysokým mýtem",
      "valašské meziříčí", "valašského meziříčí", "valašskému meziříčí", "valašském meziříčí", "valašským meziříčím",
      "uherské hradiště", "uherského hradiště", "uherskému hradišti", "uherském hradišti", "uherským hradištěm",
      "nový jičín", "nového jičína", "novému jičínu", "novém jičíně", "novým jičínem",
      "dvůr králové", "dvora králové", "dvoru králové", "dvoře králové", "dvorem králové",
      "královo pole", "králova pole", "královu poli", "králově poli", "královým polem",
      "malá strana", "malé strany", "malé straně", "malou stranu", "malou stranou",
      "špindlerův mlýn", "špindlerova mlýna", "špindlerovu mlýnu", "špindlerově mlýně", "špindlerovým mlýnem",
      "pec pod sněžkou", "peci pod sněžkou",
      "rožnov pod radhoštěm"
    ]);

    if (locations.has(name)) return true;

    // General compound toponym pattern: [Adjective] + [Toponymic noun] without first names
    const RE_TOPONYM_ADJECTIVE = /^(?:červen[ýáé]|čern[ýáé]|bíl[ýáé]|modr[ýáé]|zelen[ýáé]|žlut[ýáé]|star[ýáé]|nov[ýáé]|velk[ýáé]|mal[ýáé]|vysok[ýáé]|hlubok[ýáé]|dlouh[ýáé]|krátk[ýáé]|horn[í]|doln[í]|předn[í]|zadn[í]|středn[í]|kutn[áé]|dobr[ýáé]|such[ýáé]|hojn[áé]|krásn[ýáé]|zlat[ýáé]|česk[ýáé]|moravsk[ýáé]|slezsk[ýáé]|hrub[ýáé]|tepl[ýáé]|studen[ýáé]|divok[ýáé]|tich[ýáé])(?:ho|mu|m|ou|ch|mi)?$/iu;
    const RE_TOPONYM_NOUN = /^(?:vod[aeyu]|vodou|vodách|vodám|vodami|vod|hor[aeyu]|hoře|horou|horách|horám|horami|hor|ves|vsi|vsí|měst[oau]|městě|městem|měst|městech|městům|městy|lhot[aeyu]|lhotě|lhotou|lhotách|lhotám|lhot|újezd[au]?|újezdem|újezdě|brod[u]?|brodem|brodě|mýt[oau]|mýtě|mýtem|pol[ei]|polem|polích|údolí|údolím|vrch[u]?|vrchem|vrchu|stran[aeyu]|straně|stranou|lázn[ěí]|lázním|lázních|lázněmi|mlýn[au]?|mlýnem|mlýně|hrádek|hrádku|hrádkem|potok[au]?|potokem|potoku|řek[aeyu]|řece|řekou)$/iu;

    if (name.includes(" ")) {
      const parts = name.split(/\s+/);
      if (parts.length === 2 && RE_TOPONYM_ADJECTIVE.test(parts[0]) && RE_TOPONYM_NOUN.test(parts[1])) {
        const isFirst0 = (typeof FIRST_NAMES !== "undefined" && FIRST_NAMES) ? FIRST_NAMES.has(parts[0]) : (typeof NAMES !== "undefined" && NAMES ? NAMES.has(parts[0]) : false);
        const isFirst1 = (typeof FIRST_NAMES !== "undefined" && FIRST_NAMES) ? FIRST_NAMES.has(parts[1]) : (typeof NAMES !== "undefined" && NAMES ? NAMES.has(parts[1]) : false);
        if (!isFirst0 && !isFirst1) return true;
      }
    }

    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= src.length) {
      if (start > 0) {
        const prefix = src.slice(Math.max(0, start - 40), start);
        if (/(?:\bv\s+)?\b(?:obci?|měst[oau]|městys[ui]?|k\.?\s*ú\.?|katastr|katastrální(?:ho|m|mu)?\s+území|okres[ue]?|kraj[ie]?|povodí|řece?|řek[au]?|potok[au]?)\s+$/iu.test(prefix)) {
          const isFirst0 = (typeof FIRST_NAMES !== "undefined" && FIRST_NAMES) ? FIRST_NAMES.has(name.split(/\s+/)[0]) : false;
          if (!isFirst0) return true;
        }
      }
      const beforeWord = (src.slice(Math.max(0, start - 30), start).trim().split(/\s+/).pop() || "");
      const afterWord = (src.slice(end, Math.min(src.length, end + 30)).trim().split(/\s+/)[0] || "");
      if (beforeWord && (locations.has(normalize(beforeWord + " " + candidate)) || RE_WATER_COLLOCATIONS.test(normalize(beforeWord + " " + candidate)))) return true;
      if (afterWord && (locations.has(normalize(candidate + " " + afterWord)) || RE_WATER_COLLOCATIONS.test(normalize(candidate + " " + afterWord)))) return true;
    }

    return false;
  }

  // --- Desambiguace větných verzálek a kontextové triggery (Ticket 02) ---
  const RE_ABBR_BEFORE = /(?:např|tzv|tj|t\.j|tzn|atd|apod|popř|resp|s\.r\.o|a\.s|v\.o\.s|spol|č|č\.j|čj|sp\.?\s*zn|odst|písm|sb|str|sv|r|nar|hod|min|st|p|ing|mgr|bc|mudr|judr|mvdr|phdr|rndr|pharmdr|thdr|doc|prof)\.$/iu;

  export function isSentenceStart(text, start) {
    if (!text || start <= 0) return true;
    const windowStart = Math.max(0, start - 200);
    const prefix = text.slice(windowStart, start);
    if (windowStart === 0 && /^\s*$/.test(prefix)) return true;
    if (windowStart > 0 && /^\s*$/.test(prefix)) {
      if (!/\S/.test(text.slice(0, windowStart))) return true;
    }
    if (/[\r\n]\s*(?:[•\-*–—]|\d+[\.\)]|[a-zA-Z][\.\)])?\s*$/.test(prefix)) return true;
    if (windowStart === 0 && /^(?:[•\-*–—]|\d+[\.\)]|[a-zA-Z][\.\)])\s*$/.test(prefix.trim())) return true;
    const m = prefix.match(/([.?!…])[\s"'»”’\)]*$/);
    if (!m) return false;
    if (m[1] === "!" || m[1] === "?" || m[1] === "…") return true;
    const dotPos = prefix.lastIndexOf(".");
    const beforeDot = prefix.slice(0, dotPos + 1).trim();
    if (/\b\d+\.$/.test(beforeDot)) return false;
    if (RE_ABBR_BEFORE.test(beforeDot)) return false;
    return true;
  }

  const SENTENCE_INITIAL_APELATIVA = new Set([
    "nový", "nová", "nové", "nového", "novému", "novým", "nových", "novými",
    "starý", "stará", "staré", "starého", "starému", "starým", "starých", "starými",
    "bílá", "bílý", "bílé", "bílého", "bílému", "bílým", "bílých", "bílými",
    "černý", "černá", "černé", "černého", "černému", "černým", "černých", "černými",
    "malý", "malá", "malé", "malého", "malému", "malým", "malých", "malými",
    "velký", "velká", "velké", "velkého", "velkému", "velkým", "velkých", "velkými",
    "svobodný", "svobodná", "svobodné", "svobodného", "svobodnému", "svobodným",
    "veselý", "veselá", "veselé", "veselého", "veselému", "veselým",
    "krátký", "krátká", "krátké", "dlouhý", "dlouhá", "dlouhé",
    "tichý", "tichá", "tiché", "suchý", "suchá", "suché", "mokrý", "mokrá", "mokré",
    "český", "česká", "české", "moravský", "moravská", "moravské", "slovenský", "slovenská",
    "hlavní", "další", "poslední", "první", "druhý", "třetí", "jediný", "celý", "veškerý",
    "podle", "vedle", "kolem", "během", "místo", "proti", "vzhledem", "naproti", "podél",
    "mezi", "před", "přes", "skrz", "kvůli", "včetně", "vyjma", "kromě",
    "jestliže", "pokud", "protože", "poněvadž", "přestože", "ačkoliv", "ačkoli", "avšak", "však",
    "tudíž", "proto", "neboť", "nebo", "anebo", "čili", "ani", "takže", "jakmile", "zatímco",
    "tento", "tato", "toto", "tito", "tyto", "onen", "ona", "ono", "oni", "ony",
    "každý", "každá", "každé", "který", "která", "které", "kteří", "všechen", "všechna", "všichni",
    "kovář", "holub", "zima", "léto", "jaro", "podzim", "vlk", "beran", "jelen", "kos", "vrba",
    "čech", "němec", "polák", "růže", "fiala", "král", "hora", "les", "pole", "potok",
    "smlouva", "dohoda", "zákon", "zákoník", "vyhláška", "nařízení", "směrnice",
    "usnesení", "rozsudek", "nález", "příkaz", "pokyn", "rozhodnutí", "opatření", "stanovisko", "výzva",
    "žaloba", "odvolání", "stížnost", "návrh", "žádost", "podání", "vyjádření", "sdělení",
    "protokol", "zápis", "zpráva", "listina", "dokument", "spis", "řízení",
    "soud", "žalobce", "žalovaná", "žalovaný", "navrhovatel", "odpůrce", "stěžovatel",
    "účastník", "svědek", "znalec", "tlumočník", "obhájce", "zástupce", "zmocněnec",
    "správce", "věřitel", "dlužník", "povinný", "oprávněný",
    "objednatel", "zhotovitel", "kupující", "prodávající", "nájemce", "pronajímatel",
    "dodavatel", "odběratel", "uživatel", "klient", "zákazník",
    "přístup", "postup", "způsob", "systém", "technika", "stavba", "práce",
    "termín", "lhůta", "doba", "den", "měsíc", "rok", "datum",
    "částka", "cena", "platba", "poplatek", "úhrada", "náklad", "náklady", "odměna", "pokuta",
    "ředitel", "vedoucí", "starosta", "primátor", "ministr", "předseda",
    "porada", "poradu", "poradě", "porady", "poradou", "poradám", "poradách", "poradami",
    "zasedání", "jednání", "program", "kontrola", "úkol", "úkoly",
    "schválil", "schválila", "schválili", "schváleno",
    "omluven", "omluvena", "omluveni", "omluveno",
    "zapsal", "zapsala", "zapsáno",
    "přítomen", "přítomna", "přítomni",
    "zahájil", "zahájila", "zahájeno",
    "informoval", "informovala", "informováno",
    "odpovídá", "zpracoval", "zpracovala", "zpracuje", "uloženo", "různé"
  ]);

export { declinedPersonTokenBase } from "./detector.js";
