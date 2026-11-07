// Readers for the FS credit-sanction pack: credit policy (DoA), walkthrough
// note, LOS role-limit / workflow configuration and the LOS sanction memo.
import { clean, findHeader, mapColumns, parseDate, preamble, rowsFrom } from "../../nfs-vendor-bank/engine/util";

const norm = (s) => clean(String(s ?? "").replace(/[’‘]/g, "'")).toLowerCase();
const num = (s) => {
  const n = parseFloat(String(s ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// ── what kind of file is it? (by content) ───────────────────────────────
export function classifyFs(doc) {
  const t = doc.text || "";
  if (doc.kind === "text") {
    if (/walkthrough note|process walkthrough/i.test(t)) return "note";
    if (/sanction memo/i.test(t) && /approval trail/i.test(t)) return "memo";
    if (/delegation of authority|credit policy/i.test(t) && /sanction/i.test(t)) return "policy";
    return "unknown";
  }
  const names = doc.sheets.map((s) => s.aoa.slice(0, 6).map((r) => r.join(" ")).join(" ")).join(" ");
  if (/control id/i.test(names) && /risk/i.test(names)) return "rcm";
  if (/role limit|max sanction limit|workflow parameter/i.test(names)) return "config";
  return "unknown";
}

export const FS_KIND_LABEL = {
  policy: "Credit policy (DoA)",
  rcm: "Risk and control matrix",
  note: "Walkthrough note",
  config: "LOS role-limit & workflow configuration",
  memo: "Sanction memo with LOS approval trail",
  unknown: "Not recognised",
};

// page of a quote using the "… Page N" footer markers
export function pageOf(raw, quote) {
  const text = String(raw || "");
  const at = norm(text).indexOf(norm(quote));
  if (at < 0) return null;
  const markers = [...text.matchAll(/Page (\d+)\s*$/gm)].map((m) => ({ at: norm(text.slice(0, m.index)).length, page: +m[1] }));
  return markers.filter((m) => m.at <= at).pop()?.page || 1;
}
export const has = (raw, quote) => !!quote && norm(raw).includes(norm(quote));

// numbered clauses "7.3 Committee composition. …"
function clauses(text) {
  const out = {};
  const lines = String(text).split("\n").map((l) => l.trim());
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^(\d{1,2}\.\d{1,2})\s+(.+)$/);
    if (m) {
      cur = m[1];
      out[cur] = m[2];
    } else if (/^\d{1,2}\.\s/.test(l) || /Page \d+$|^DUMMY DATA/i.test(l)) cur = /Page \d+$|^DUMMY DATA/i.test(l) ? cur : null;
    else if (cur && l) out[cur] += ` ${l}`;
  }
  Object.keys(out).forEach((k) => (out[k] = clean(out[k])));
  return out;
}

// ── credit policy ────────────────────────────────────────────────────────
export function parsePolicy(text, name) {
  const t = String(text || "");
  const versions = [...t.matchAll(/^(\d+\.\d+)\s+(Board of Directors|[A-Z][\w ]+?)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s*(.*)$/gm)].map((m) => ({ version: m[1], by: m[2], date: parseDate(m[3]), dateText: m[3], summary: clean(m[4]) }));
  const latest = versions[versions.length - 1] || {};
  const cl = clauses(t);
  const doa = [...t.matchAll(/^(.+?)\s+(Individual|Committee)\s+(Up to [\d.]+|Above [\d.]+(?: and up to [\d.]+)?)\s*$/gm)].map((m) => {
    const lim = m[3];
    const nums = (lim.match(/[\d.]+/g) || []).map(Number);
    return { authority: clean(m[1]), nature: m[2], limitText: lim, from: /^up to/i.test(lim) ? 0 : nums[0], to: /^up to/i.test(lim) ? nums[0] : nums[1] ?? Infinity };
  });
  return {
    name,
    raw: t,
    company: clean(((t.match(/^(.*\bBank\b.*)$/m) || [])[1] || "").split("|")[0]),
    title: clean((t.match(/^(Credit Policy - [^\n]*)$/m) || [])[1] || "Credit Policy"),
    docId: "Credit Policy",
    version: latest.version || (t.match(/Version\s+(\d+(?:\.\d+)?)/i) || [])[1] || "",
    approvedBy: latest.by || "",
    approvalDate: latest.date || null,
    approvalText: latest.dateText || "",
    versions,
    reviewFrequency: clean((t.match(/Review frequency\s+(\w+)/i) || [])[1] || ""),
    reviewDue: parseDate((t.match(/Next review due\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i) || [])[1]),
    reviewDueText: (t.match(/Next review due\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i) || [])[1] || "",
    owner: clean((t.match(/Policy owner\s+(.+)/i) || [])[1] || ""),
    clauses: cl,
    doa,
    basis: /amount of\s+the proposal/i.test(cl["7.1"] || "") ? "proposal" : /exposure/i.test(cl["7.1"] || "") ? "exposure" : "",
  };
}

// ── walkthrough note ─────────────────────────────────────────────────────
export function parseNote(text, name) {
  const t = String(text || "");
  const cl = clauses(t);
  const find = (quote) => {
    if (!has(t, quote)) return null;
    const ref = Object.entries(cl).find(([, v]) => norm(v).includes(norm(quote)))?.[0] || "";
    return { ref, page: pageOf(t, quote) || 1, quote };
  };
  return {
    name,
    raw: t,
    date: parseDate((t.match(/Walkthrough date\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i) || [])[1]),
    performedBy: clean((t.match(/Performed by\s+(.+)/i) || [])[1] || ""),
    representatives: clean((t.match(/Process representatives\s+(.+)/i) || [])[1] || ""),
    sample: clean((t.match(/Sample traced\s+(.+)/i) || [])[1] || ""),
    agreedBy: clean((t.match(/Agreed by process owner:\s*(.+)/i) || [])[1] || ""),
    clauses: cl,
    find,
  };
}

// ── LOS configuration (role limit master + workflow parameters) ─────────
export function parseConfig(doc, into) {
  for (const sheet of doc.sheets) {
    const top = sheet.aoa.slice(0, 6).map((r) => r.join(" ")).join(" ");
    if (/role limit/i.test(top) || /max sanction limit/i.test(top)) {
      const h = findHeader(sheet.aoa, [/role code/i, /limit/i]);
      if (!h) continue;
      const c = mapColumns(h.headers, { row: [/^row$/i], code: [/role code/i], desc: [/role desc/i], type: [/approval type/i], limit: [/limit/i], originate: [/originate/i], approve: [/approve/i], on: [/modified on/i], by: [/modified by/i] });
      into.roles = rowsFrom(sheet.aoa, h, c).filter((r) => r.code).map((r) => ({ ...r, limitN: num(r.limit), canApprove: /^y/i.test(r.approve), canOriginate: /^y/i.test(r.originate), onDate: parseDate(r.on) }));
      into.rolesMeta = { file: doc.name, sheet: sheet.name, cols: c, width: h.headers.filter(Boolean).length, lines: preamble(sheet.aoa, h) };
    } else if (/workflow parameter/i.test(top)) {
      const h = findHeader(sheet.aoa, [/parameter id/i, /value/i]);
      if (!h) continue;
      const c = mapColumns(h.headers, { id: [/parameter id/i], param: [/^parameter$/i], value: [/^value$/i], desc: [/description/i], on: [/modified on/i] });
      into.params = rowsFrom(sheet.aoa, h, c).filter((r) => r.id).map((r) => ({ ...r, onDate: parseDate(r.on) }));
      into.paramsMeta = { file: doc.name, sheet: sheet.name, cols: c, width: h.headers.filter(Boolean).length };
    }
  }
  return into;
}

// ── sanction memo ────────────────────────────────────────────────────────
export function parseMemo(text, name) {
  const t = String(text || "");
  const line = (label) => clean((t.match(new RegExp(`^\\s*${label}\\s+(.+)$`, "im")) || [])[1] || "");
  const proposal = num((t.match(/this proposal\s+([\d.]+)/i) || [])[1]);
  const totalExposure = num((t.match(/Total exposure after this sanction[^:]*:\s*INR\s*([\d.]+)/i) || [])[1]);
  const existing = [...t.matchAll(/^(.+?)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+([\d.]+)\s+([\d.]+)\s*$/gm)].map((m) => ({ facility: clean(m[1]), on: m[2], sanctioned: +m[3], outstanding: +m[4] }));
  const trailSec = t.slice(Math.max(0, t.search(/LOS approval trail/i)));
  const trail = [...trailSec.matchAll(/^(\d)\s+(Proposal created|CAM uploaded|Recommended|Routed to authority|Approved|Returned|Rejected)\s+([A-Z]+\d*)\s+([\s\S]*?)(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}:\d{2})/gm)].map((m) => ({
    step: +m[1],
    action: m[2],
    user: m[3],
    who: clean(m[4]),
    when: parseDate(m[5], m[6]),
    whenText: `${m[5]} ${m[6]}`,
  }));
  const rule = clean((trailSec.match(/Rule:\s*([^\n]+(?:\n[A-Z_]{3,})?)/) || [])[1] || "");
  return {
    name,
    raw: t,
    ref: (t.match(/Sanction Memo\s*-\s*([A-Z]{2,}-[A-Z]{2,}-\d{4}-\d+)/i) || [])[1] || "",
    generated: clean((t.match(/Generated from[^\n]*/) || [])[0] || ""),
    borrower: line("Borrower"),
    rating: line("Internal rating"),
    proposal,
    totalExposure,
    existing,
    deviations: /deviations:\s*none/i.test(t) ? "None" : clean((t.match(/Deviations:\s*([^.|\n]+)/i) || [])[1] || ""),
    trail,
    rule,
    routedTo: (rule.match(/->\s*([A-Z_]+)/) || [])[1] || "",
    sanctionLetter: clean((t.match(/sanction letter\s+([A-Z/\d]+)/i) || [])[1] || ""),
  };
}
