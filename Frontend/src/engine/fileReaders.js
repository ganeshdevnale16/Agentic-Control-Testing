import * as XLSX from "xlsx";

export const isPolicyFile = (name) => /\.(docx|txt|md|pdf)$/i.test(name);
export const isExtractFile = (name) => /\.(xlsx|xls|csv)$/i.test(name);
export const isImageFile = (file) => file.type?.startsWith("image/");

// ── Policy documents ──────────────────────────────────────────────────────
export async function readPolicyText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser.js");
    const lib = mammoth.default || mammoth;
    const { value } = await lib.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Rebuild lines from text items using their vertical position
      let lastY = null;
      let line = "";
      const lines = [];
      content.items.forEach((it) => {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(line);
          line = "";
        }
        line += it.str;
        lastY = y;
      });
      lines.push(line);
      pages.push(lines.join("\n"));
    }
    return pages.join("\n");
  }
  return file.text();
}

// ── Parameter extracts (manual upload) ────────────────────────────────────
const COL_TESTS = {
  param: [/^parname$/i, /^(profile )?parameter( name)?$/i, /^param/i, /^name$/i, /^key$/i],
  value: [/^parvalue$/i, /^(current )?value$/i, /value/i, /setting/i],
  state: [/^parstate$/i, /^status$/i, /state/i, /active/i],
  host: [/^hostname$/i, /host/i, /server/i, /instance/i],
  date: [/^pardate$/i, /date/i, /changed/i],
  system: [/^systemid$/i, /^sid$/i, /^system$/i],
};

function findCol(headers, tests, taken) {
  for (const re of tests) {
    const i = headers.findIndex((h, idx) => !taken.has(idx) && re.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

export async function readExtract(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: false });

  // Header row = first row in the top 15 that names both a parameter and a value
  let h = 0;
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const cells = aoa[i].map((c) => String(c).trim());
    if (cells.some((c) => /param|name|key/i.test(c)) && cells.some((c) => /val|setting/i.test(c))) {
      h = i;
      break;
    }
  }
  const headers = (aoa[h] || []).map((c) => String(c).trim());
  const taken = new Set();
  const cols = {};
  for (const k of ["param", "value", "state", "host", "date", "system"]) {
    cols[k] = findCol(headers, COL_TESTS[k], taken);
    if (cols[k] >= 0) taken.add(cols[k]);
  }
  if (cols.param < 0) cols.param = 0;
  if (cols.value < 0) cols.value = Math.min(1, headers.length - 1);

  const get = (r, k) => (cols[k] >= 0 ? String(r[cols[k]] ?? "").trim() : "");
  let rows = aoa
    .slice(h + 1)
    .map((r, i) => ({
      n: h + i + 2,
      host: get(r, "host") || "Extract",
      system: get(r, "system"),
      date: get(r, "date"),
      state: get(r, "state"),
      param: get(r, "param"),
      value: get(r, "value"),
    }))
    .filter((r) => r.param);

  const hasState = cols.state >= 0 && rows.some((r) => /^(a|active|1|yes|true|x)$/i.test(r.state));
  rows = rows.map((r) => ({ ...r, active: hasState ? /^(a|active|1|yes|true|x)$/i.test(r.state) : true }));

  return {
    rows,
    sheetName,
    fileName: file.name,
    headers,
    mapping: Object.fromEntries(Object.entries(cols).map(([k, i]) => [k, i >= 0 ? headers[i] : null])),
    hasState,
  };
}
