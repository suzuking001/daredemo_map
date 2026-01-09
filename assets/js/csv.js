(() => {
  window.App = window.App || {};

  const CACHE_PREFIX = "csv-cache:v1:";
  const CACHE_TTL_MS = 60 * 60 * 1000;

  function getCacheKey(url) {
    return `${CACHE_PREFIX}${url}`;
  }

  function loadCachedCSV(url) {
    try {
      const raw = localStorage.getItem(getCacheKey(url));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        localStorage.removeItem(getCacheKey(url));
        return null;
      }
      const timestamp = Number(parsed.timestamp);
      if (!Number.isFinite(timestamp)) {
        localStorage.removeItem(getCacheKey(url));
        return null;
      }
      if (Date.now() - timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(getCacheKey(url));
        return null;
      }
      if (typeof parsed.data !== "string") {
        localStorage.removeItem(getCacheKey(url));
        return null;
      }
      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  function saveCachedCSV(url, data) {
    try {
      const payload = {
        timestamp: Date.now(),
        data,
      };
      localStorage.setItem(getCacheKey(url), JSON.stringify(payload));
    } catch (error) {
      // Ignore quota or storage errors.
    }
  }

  async function fetchCSV(url, encoding = "shift-jis") {
    const cached = loadCachedCSV(url);
    if (cached) {
      return cached;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
    }
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder(encoding);
    const text = decoder.decode(buffer);
    saveCachedCSV(url, text);
    return text;
  }

  // RFC4180-ish CSV parser with quoted fields support.
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

  window.App.csv = { fetchCSV, parseCSV };
})();
