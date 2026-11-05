import { clean, findHeader, mapColumns, preamble, rowsFrom, parseDate } from "./util";
import { sheetKind } from "./readers";

const COLS = {
  riskId: [/^risk id$/i, /risk (id|ref|no)/i],
  riskDesc: [/risk desc/i, /^risk$/i, /risk/i],
  controlId: [/^control id$/i, /control (id|ref|no)/i],
  controlDesc: [/control desc/i, /control activity/i],
  type: [/control type/i, /^type$/i],
  nature: [/nature/i, /manual|automat/i],
  frequency: [/freq/i],
  owner: [/owner/i],
  assertion: [/assertion/i],
  evidence: [/evidence/i],
  system: [/system|report|ipe/i],
};

// "Preventive (a-c); Detective (d)" → { a: "Preventive", b: …, d: "Detective" }
function letterMap(value, letters) {
  const out = {};
  const parts = String(value || "").split(/;|\n/).map(clean).filter(Boolean);
  if (parts.length <= 1 || !/\([a-h]/i.test(value)) {
    letters.forEach((l) => (out[l] = clean(value)));
    return out;
  }
  for (const p of parts) {
    const m = p.match(/^(.*?)\s*\(([a-h])(?:\s*[-–]\s*([a-h]))?(?:\s*,\s*([a-h]))*\)\s*$/i);
    if (!m) continue;
    const label = clean(m[1]);
    const from = m[2].toLowerCase().charCodeAt(0);
    const to = (m[3] || m[2]).toLowerCase().charCodeAt(0);
    for (let c = from; c <= to; c++) out[String.fromCharCode(c)] = label;
    const extra = p.match(/,\s*([a-h])/gi) || [];
    extra.forEach((e) => (out[e.replace(/[^a-h]/gi, "").toLowerCase()] = label));
  }
  letters.forEach((l) => (out[l] = out[l] || clean(value)));
  return out;
}

// Split "(a) … (b) … (c) …" into lettered activities
export function splitActivities(desc) {
  const parts = String(desc || "").split(/\(([a-h])\)\s*/i);
  if (parts.length < 3) return [{ letter: "a", text: clean(desc) }];
  const out = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ letter: parts[i].toLowerCase(), text: clean(parts[i + 1]) });
  return out;
}

export function parseWalkthrough(doc) {
  if (doc.kind === "text") {
    // Narrative walkthrough notes: keep the text; the RCM is built from the SOP
    return { name: doc.name, source: "narrative", text: doc.text, controls: [], meta: {} };
  }
  const sheet = doc.sheets.find((s) => sheetKind(s) === "rcm") || doc.sheets[0];
  const header = findHeader(sheet.aoa, [/control id/i]);
  if (!header) return { name: doc.name, source: "sheet", controls: [], meta: {} };
  const cols = mapColumns(header.headers, COLS);
  const rows = rowsFrom(sheet.aoa, header, cols).filter((r) => r.controlId);
  const pre = preamble(sheet.aoa, header);
  const proc = pre.find((l) => /process\s*:/i.test(l)) || "";
  const verLine = pre.find((l) => /version|approved/i.test(l)) || "";

  const controls = rows.map((r) => {
    const acts = splitActivities(r.controlDesc);
    const letters = acts.map((a) => a.letter);
    const types = letterMap(r.type, letters);
    const freqs = letterMap(r.frequency, letters);
    return {
      ...r,
      activities: acts.map((a) => ({ ...a, type: types[a.letter], frequency: freqs[a.letter] })),
    };
  });

  return {
    name: doc.name,
    source: "rcm",
    sheet: sheet.name,
    controls,
    meta: {
      company: pre[0] || "",
      process: clean((proc.match(/process\s*:\s*([^|]+)/i) || [])[1] || ""),
      subProcess: clean((proc.match(/sub-?process\s*:\s*([^|]+)/i) || [])[1] || ""),
      version: clean((verLine.match(/version\s*:\s*([^|]+)/i) || [])[1] || ""),
      approvedBy: clean((verLine.match(/approved by\s*:\s*([^|]+)/i) || [])[1] || ""),
      date: parseDate(verLine),
    },
  };
}
