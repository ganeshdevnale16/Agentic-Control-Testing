// Small helpers shared by the Non-FS engine. No browser APIs here so the
// engine can be unit-tested in Node.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export const DATE_RE = /\b(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{4})\b/;
export const DATE_RE_G = new RegExp(DATE_RE.source, "g");
export const PHONE_RE_G = /\+?\s?91[\s-]?\d{5}[\s-]?\d{5}|\b\d{5}[\s-]\d{5}\b/g;
export const IFSC_RE_G = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;

// "16-Sep-2026" (+ optional "15:40") → Date, or null
export function parseDate(s, time) {
  if (s instanceof Date) return s;
  const m = String(s ?? "").match(DATE_RE);
  if (!m) {
    const iso = String(s ?? "").match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (!iso) return null;
    return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  }
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const d = new Date(+m[3], mon, +m[1]);
  const t = String(time ?? "").match(/(\d{1,2}):(\d{2})/);
  if (t) d.setHours(+t[1], +t[2]);
  return d;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}-${MON[d.getMonth()]}-${d.getFullYear()}` : "–");
export const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "–");

export const digits = (s) => String(s ?? "").replace(/\D/g, "");
// Compare phone numbers on their last 10 digits
export const samePhone = (a, b) => !!a && !!b && digits(a).slice(-10) === digits(b).slice(-10);
export const normPhone = (s) => {
  const d = digits(s).slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : String(s ?? "").trim();
};

export const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export const yes = (s) => /^(y|yes|true|x|1|active)$/i.test(clean(s));
export const num = (s) => {
  const n = Number(String(s ?? "").replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const lastDigits = (s, n = 3) => digits(s).slice(-n);

const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
export const wordToNum = (w) => (/^\d+$/.test(w) ? +w : WORD_NUM[String(w).toLowerCase()] ?? null);

// Find the header row in an array-of-arrays: the first row (top 20) where every
// test matches at least one cell. Returns { index, headers } or null.
export function findHeader(aoa, tests, minCells = 3) {
  for (let i = 0; i < Math.min(20, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => clean(c));
    if (cells.filter(Boolean).length < minCells) continue;
    if (tests.every((re) => cells.some((c) => re.test(c)))) return { index: i, headers: cells };
  }
  return null;
}

// Map logical column keys to indexes using ordered regex lists
export function mapColumns(headers, spec) {
  const taken = new Set();
  const out = {};
  for (const [key, tests] of Object.entries(spec)) {
    out[key] = -1;
    for (const re of tests) {
      const i = headers.findIndex((h, idx) => !taken.has(idx) && re.test(h));
      if (i >= 0) {
        out[key] = i;
        taken.add(i);
        break;
      }
    }
  }
  return out;
}

export function rowsFrom(aoa, header, cols) {
  return aoa
    .slice(header.index + 1)
    .map((r, i) => {
      const o = { __row: header.index + i + 2 };
      for (const [k, idx] of Object.entries(cols)) o[k] = idx >= 0 ? clean(r[idx]) : "";
      return o;
    })
    .filter((o) => Object.entries(o).some(([k, v]) => k !== "__row" && v));
}

// Text of the rows above the header (titles, "Prepared by", etc.)
export const preamble = (aoa, header) =>
  aoa
    .slice(0, header ? header.index : 6)
    .map((r) => r.map(clean).filter(Boolean).join(" "))
    .filter(Boolean);

export const plural = (n, w, p) => `${n} ${n === 1 ? w : p || `${w}s`}`;
