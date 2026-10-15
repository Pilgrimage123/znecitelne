export function extractOdtText(buf){
    if (!window.fflate) throw new Error("fflate není k dispozici");
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const files = fflate.unzipSync(u8);
    const content = files["content.xml"];
    if (!content) throw new Error("Neplatný ODT: chybí content.xml");
    const xml = new TextDecoder("utf-8").decode(content);
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

