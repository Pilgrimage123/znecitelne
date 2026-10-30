export function extractOdtText(buf){
    const flate = (typeof window !== "undefined" && window.fflate) || (typeof globalThis !== "undefined" && globalThis.fflate) || (typeof fflate !== "undefined" ? fflate : null);
    if (!flate || !flate.unzipSync) throw new Error("fflate není k dispozici");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const files = flate.unzipSync(u8);
    const content = files["content.xml"];
    if (!content) throw new Error("Neplatný ODT: chybí content.xml");
    const xml = new TextDecoder("utf-8").decode(content);
    if (typeof DOMParser === "undefined") {
      const paragraphs = [];
      const reP = /<text:[ph](?:\s[^>]*)?>([\s\S]*?)<\/text:[ph]>/gi;
      let pm;
      while ((pm = reP.exec(xml)) !== null) {
        const pXml = pm[1];
        let pText = pXml
          .replace(/<text:tab\/>/gi, "\t")
          .replace(/<text:line-break\/>/gi, "\n")
          .replace(/<text:s text:c="(\d+)"\/>/gi, (_, c) => " ".repeat(parseInt(c, 10) || 1))
          .replace(/<text:s\/>/gi, " ")
          .replace(/<[^>]+>/g, "");
        if (pText.trim()) paragraphs.push(pText.trim());
      }
      return paragraphs.join("\n\n");
    }
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("Chyba XML v ODT");
    const elements = Array.from(doc.getElementsByTagNameNS("*", "*")).filter(n => {
      const name = n.localName;
      return name === "p" || name === "h";
    });
    return elements.map(el => {
      const parts = Array.from(el.childNodes).map(n => {
        if (n.nodeType === 3) return n.nodeValue || "";
        const name = n.localName;
        if (name === "tab") return "\t";
        if (name === "line-break") return "\n";
        if (name === "s") {
          const count = parseInt(n.getAttributeNS("*", "c") || n.getAttribute("text:c") || "1", 10);
          return " ".repeat(Math.max(1, count));
        }
        return n.textContent || "";
      });
      return parts.join("").trim();
    }).filter(Boolean).join("\n\n");
  }

