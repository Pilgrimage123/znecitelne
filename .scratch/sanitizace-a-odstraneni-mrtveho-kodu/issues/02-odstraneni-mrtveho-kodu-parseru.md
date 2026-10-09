# 02: Odstranění mrtvých funkcí PDF in-stream parseru a DOCX přejmenovávání

**What to build:** Vyčištěná a zmenšená klientská aplikace zbavená více než 260 řádků historického opuštěného kódu (starý PDF in-stream tokenizer, funkce pro přejmenovávání médií v DOCX a nepoužívané ořezávání podpisových polí v PDF), při zachování plné stability všech existujících funkcí a exportů.

**Blocked by:** 01: Zpřísnění a oprava testovací brány PDF exportu v test.js

**Status:** completed

- [x] Z kanonické aplikace jsou zcela odstraněny nevolané funkce binárního PDF parseru (`pdfTokenize`, `pdfDecodeStringToken`, `pdfBytesToLatin1`, `pdfConcatU8`, `parseToUnicodeCMap`, `pdfDecodeBytesToText`, `pdfInspectFont`, `pdfFindTargetRanges`).
- [x] Z DOCX exportéru jsou odstraněny nepotřebné funkce přejmenovávání médií (`docxBuildSensitiveMediaRename`, `docxApplyPartRenames`).
- [x] Z PDF modulu je odstraněna mrtvá funkce `stripPdfSignatureFields`.
- [x] V `test.js` jsou zavedeny negativní testovací kontroly ověřující nepřítomnost těchto odstraněných funkcí v kanonické aplikaci.
- [x] `npm run build` a `npm test` úspěšně projdou bez varování či chyb.
