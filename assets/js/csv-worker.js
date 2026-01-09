(() => {
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === "\"") {
          if (text[i + 1] === "\"") {
            field += "\"";
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === "\"") {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    const headers = rows.shift() || [];
    const cleanedRows = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
    return { headers, rows: cleanedRows };
  }

  self.onmessage = event => {
    const data = event.data || {};
    const id = data.id;
    const facilityTexts = data.facilityTexts;
    if (!id || !Array.isArray(facilityTexts)) {
      return;
    }
    try {
      const facilities = facilityTexts.map(parseCSV);
      self.postMessage({
        id,
        ok: true,
        payload: { facilities },
      });
    } catch (error) {
      self.postMessage({
        id,
        ok: false,
        error: error && error.message ? error.message : "Worker failed",
      });
    }
  };
})();
