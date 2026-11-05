import { PARAMETERS, NUMBER_WORDS } from "../modules/itgc-password/data/sapParameters";

const REQUIREMENT_WORDS = /\b(must|shall|should|required|requires|minimum|maximum|at least|at most|no more than|not exceed)\b/i;
const KEY_PATTERN = /\b([a-z]+\/[a-z0-9_]+(?:\/[a-z0-9_]+)?)\b/g;

// Splits the document into clauses, keeping the clause reference (§n) from
// any leading numbering so each test attribute can cite its policy source.
export function splitClauses(text) {
  const lines = String(text)
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const clauses = [];
  lines.forEach((line, li) => {
    const m = line.match(/^\s*(\d+(?:\.\d+)*)[.)]?\s+/);
    const ref = m ? `§${m[1]}` : `Line ${li + 1}`;
    const body = m ? line.slice(m[0].length) : line;
    body
      .split(/(?<=[.;])\s+(?=[A-Za-z0-9])/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => clauses.push({ ref, text: s }));
  });
  return clauses;
}

function numbersIn(lower) {
  const out = [];
  for (const m of lower.matchAll(/\d+(?:\.\d+)?/g)) {
    // ignore digits that are part of a version label such as "v2.1"
    if (/v$/.test(lower.slice(Math.max(0, m.index - 1), m.index))) continue;
    out.push({ value: Number(m[0]), start: m.index, end: m.index + m[0].length });
  }
  // Spelled-out numbers only count when the clause has no digits, so phrases
  // like "differ from the previous one by at least 3" resolve to 3, not 1.
  if (out.length) return out;
  for (const w of Object.keys(NUMBER_WORDS)) {
    for (const m of lower.matchAll(new RegExp(`\\b${w}\\b`, "g"))) {
      out.push({ value: NUMBER_WORDS[w], start: m.index, end: m.index + w.length });
    }
  }
  return out;
}

// The number closest to the matched phrase (before or after it). This is what
// lets "at least 1 uppercase letter and 2 lowercase letters" map 1 -> upper
// and 2 -> lower, instead of dropping the second requirement.
function nearestNumber(nums, pos, len) {
  let best = null;
  let bestDist = Infinity;
  for (const n of nums) {
    const dist = n.end <= pos ? pos - n.end : n.start >= pos + len ? n.start - (pos + len) : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }
  return best;
}

function matchParameters(lower) {
  const hits = [];
  for (const p of PARAMETERS) {
    let pos = lower.indexOf(p.key);
    let len = p.key.length;
    if (pos < 0) {
      if (p.exclude?.some((w) => lower.includes(w))) continue;
      for (const s of p.syn) {
        const i = lower.indexOf(s);
        if (i >= 0 && (pos < 0 || i < pos)) {
          pos = i;
          len = s.length;
        }
      }
    }
    if (pos >= 0) hits.push({ param: p, pos, len });
  }
  // Explicit parameter names that are not in the knowledge base
  for (const m of lower.matchAll(KEY_PATTERN)) {
    if (!hits.some((h) => h.param.key === m[1])) {
      const dir = /at most|maximum|no more than|not exceed|within|<=|≤/.test(lower)
        ? "max"
        : /at least|minimum|no less than|>=|≥/.test(lower)
        ? "min"
        : "eq";
      hits.push({
        param: { key: m[1], label: `Custom parameter ${m[1]}`, unit: "", dir, severity: "Medium", syn: [], risk: "Configuration differs from the approved policy." },
        pos: m.index,
        len: m[1].length,
        custom: true,
      });
    }
  }
  return hits;
}

function convertUnit(value, unit, lower) {
  if (unit === "seconds") {
    if (/\bhours?\b/.test(lower)) return { value: value * 3600, note: `${value} hour(s) converted to seconds` };
    if (/\bminutes?\b|\bmins?\b/.test(lower)) return { value: value * 60, note: `${value} minute(s) converted to seconds` };
  }
  if (unit === "days" && /\bweeks?\b/.test(lower)) return { value: value * 7, note: `${value} week(s) converted to days` };
  return { value, note: null };
}

/**
 * Reads policy text and returns:
 *  - attributes: measurable requirements mapped to SAP parameters (A1..An)
 *  - unmapped:   requirement statements with no system-testable threshold
 *  - stats:      counts used in the processing log
 */
export function parsePolicy(text) {
  const clauses = splitClauses(text);
  const attributes = [];
  const unmapped = [];
  const seen = new Set();
  let requirementCount = 0;

  clauses.forEach((clause) => {
    const lower = clause.text.toLowerCase();
    const isRequirement = REQUIREMENT_WORDS.test(lower);
    if (isRequirement) requirementCount++;

    const nums = numbersIn(lower);
    const hits = matchParameters(lower);
    let mappedHere = 0;

    hits.forEach((h) => {
      if (seen.has(h.param.key)) return;
      let value;
      let note = null;
      if (h.param.dir === "eq" && !nums.length && h.param.key === "login/no_automatic_user_sapstar") {
        value = 1; // "SAP* must be disabled"
      } else {
        // "login/xyz = 14" - an explicit key takes the number right after it
        const after = h.custom || lower.startsWith(h.param.key, h.pos)
          ? nums.find((x) => x.start >= h.pos + h.len && x.start - (h.pos + h.len) <= 15)
          : null;
        const n = after || nearestNumber(nums, h.pos, h.len);
        if (!n) return;
        ({ value, note } = convertUnit(n.value, h.param.unit, lower));
      }
      seen.add(h.param.key);
      mappedHere++;
      attributes.push({
        id: `A${attributes.length + 1}`,
        key: h.param.key,
        label: h.param.label,
        unit: h.param.unit,
        op: h.param.dir,
        value,
        severity: h.param.severity,
        zeroDisables: !!h.param.zeroDisables,
        zeroMeaning: h.param.zeroMeaning || null,
        risk: h.param.risk,
        custom: !!h.custom,
        clauseRef: clause.ref,
        clause: clause.text,
        conversion: note,
      });
    });

    if (isRequirement && mappedHere === 0 && !hits.some((h) => seen.has(h.param.key))) {
      unmapped.push({ ref: clause.ref, text: clause.text });
    }
  });

  const words = String(text).split(/\s+/).filter(Boolean).length;
  return { attributes, unmapped, stats: { words, clauses: clauses.length, requirements: requirementCount } };
}
