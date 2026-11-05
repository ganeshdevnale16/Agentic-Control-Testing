import { DATE_RE, clean, parseDate, wordToNum } from "./util";

const ROLE_RE = /^(.*?\b(?:Executive|Lead|Controller|Payable|Receivable|Manager|Head|Officer|Team|Accountant|Analyst|Owner|Approver|Reviewer|Basis|Admin(?:istrator)?))\s+(.+)$/;

function field(text, label) {
  const m = text.match(new RegExp(`^\\s*${label}\\s*[:\\-]?\\s*(.+)$`, "im"));
  return m ? clean(m[1]) : "";
}

// Subject of "the <Role> shall <verb>" inside a clause
function subjectOf(clause, verbRe) {
  const m = clause.match(new RegExp(`[Tt]he ([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,3}) shall (?:\\w+ )?${verbRe}`));
  return m ? m[1] : "";
}

export function parseSop(text, name) {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^DUMMY DATA/i.test(l) && !/\|\s*SOP.*Page \d+$/i.test(l) && !/Page \d+$/.test(l));

  // ── header block ───────────────────────────────────────────────────────
  const titleLine = lines.find((l) => /standard operating procedure/i.test(l)) || lines[0] || name;
  const docId = (text.match(/\b(SOP[-\s]?[A-Z]{2,}[-\s]?\d+)\b/) || [])[1] || "";
  const version = field(text, "Version") || (text.match(/\bv(\d+(?:\.\d+)?)\b/) || [])[1] || "";
  const approvedBy = field(text, "Approved by");
  const approvalDate = parseDate(field(text, "Approval date") || field(text, "Effective date"));
  const reviewDue = parseDate(field(text, "Next review(?: due)?(?: date)?"));
  const owner = field(text, "Process owner");
  const preparedBy = field(text, "Prepared by");

  // ── numbered sections ──────────────────────────────────────────────────
  const sections = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^(\d{1,2}(?:\.\d{1,2})?)\.?\s+(.+)$/);
    if (m && !DATE_RE.test(l.slice(0, 12))) {
      const isSub = m[1].includes(".") && !m[1].endsWith(".");
      const colon = m[2].match(/^([A-Z][\w /&-]{2,40}):\s*(.*)$/);
      cur = {
        num: m[1],
        title: isSub ? (colon ? colon[1] : "") : m[2],
        text: isSub ? (colon ? colon[2] : m[2]) : "",
        sub: isSub,
      };
      sections.push(cur);
    } else if (cur) cur.text += (cur.text ? " " : "") + l;
  }
  sections.forEach((s) => (s.text = clean(s.text)));
  const top = sections.filter((s) => !s.sub);
  const rolesTop = top.find((s) => /^roles?\b/i.test(s.title));
  const clauses = sections.filter((s) => s.text && s !== rolesTop && !/^(purpose|scope|definitions?)\b/i.test(s.title));
  const ref = (s) => (s ? `${s.num}${s.title && s.sub ? ` ${s.title}` : ""}` : "");
  const find = (re) => clauses.find((s) => re.test(`${s.title} ${s.text}`));

  // ── roles table ────────────────────────────────────────────────────────
  const roles = [];
  const rolesSec = rolesTop;
  if (rolesSec) {
    const start = lines.findIndex((l) => l.startsWith(`${rolesSec.num}`) && /role/i.test(l));
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^\d{1,2}(\.\d)?\.?\s/.test(l)) break;
      if (/^role\s+responsibilit/i.test(l)) continue;
      const m = l.match(ROLE_RE);
      if (m) roles.push({ role: clean(m[1]), resp: clean(m[2]) });
      else if (roles.length) roles[roles.length - 1].resp += ` ${l}`;
    }
  }

  // ── facts the design assessment needs ──────────────────────────────────
  const req = find(/letterhead|request.*(submit|letter)/i);
  const vcrf = find(/prepare.*(VCRF|change request form)/i);
  const callback = find(/call ?back|call the vendor/i);
  const update = find(/update.*(SAP|system)|\bXK02\b|\bFK02\b/i);
  const reviewSec = top.find((s) => /review/i.test(s.title)) || find(/weekly|sign off|sign-off/i);
  const reviewText = reviewSec ? clauses.filter((s) => s.num === reviewSec.num || s.num.startsWith(`${reviewSec.num}.`)).map((s) => s.text).join(" ") : "";
  const excSec = top.find((s) => /exception|discrepanc|escalat/i.test(s.title));
  const recSec = top.find((s) => /record|retention/i.test(s.title)) || find(/retain/i);
  const scopeSec = top.find((s) => /scope/i.test(s.title));

  const cbText = callback?.text || "";
  let callbackSource = "unspecified";
  if (/(vendor master|master data|onboarding|independent(ly)? (sourced|obtained)|on file|existing record)/i.test(cbText)) callbackSource = "master";
  if (/(number|contact)[^.]{0,80}(request letter|in the letter|on the letter|request email|provided in the request)/i.test(cbText)) callbackSource = "letter";

  const all = clauses.map((s) => s.text).join(" ");
  const independentApproval = /(approv\w+|authoris\w+)[^.]{0,60}(before|prior to)[^.]{0,40}(update|change)|dual control|four[-\s]?eyes|maker[-\s]?checker|\bFK08\b|second (person|user)|independent(ly)? (review|approv|check)/i.test(all);
  const paymentDays = (text.match(/payment runs?\s*\(([^)]+)\)/i) || [])[1] || "";
  const reviewDay = (reviewText.match(/every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) || [])[1] || "";
  const reviewFrequency = /weekly|every (mon|tue|wed|thu|fri)/i.test(reviewText) ? "Weekly" : /monthly/i.test(reviewText) ? "Monthly" : /daily/i.test(reviewText) ? "Daily" : "";
  const retentionYears = wordToNum((all.match(/retain\w*\s+for\s+(\w+)\s+years?/i) || [])[1] || "");

  const facts = {
    request: {
      ref: ref(req),
      letterhead: /letterhead/i.test(req?.text || ""),
      signatory: /authori[sz]ed signatory/i.test(req?.text || ""),
      cheque: /cancelled cheque|cancelled check/i.test(req?.text || ""),
    },
    vcrf: { ref: ref(vcrf), preparer: subjectOf(vcrf?.text || "", "prepare") },
    callback: { ref: ref(callback), text: cbText, source: callbackSource, performer: subjectOf(cbText, "call"), recordsDetail: /date.*time.*number/i.test(cbText) },
    update: { ref: ref(update), text: update?.text || "", performer: subjectOf(update?.text || "", "update"), txn: ((update?.text || "").match(/\b(XK02|FK02|BP|XK01|FK01)\b/) || [])[1] || "" },
    independentApproval,
    review: {
      ref: reviewSec ? reviewSec.num : "",
      text: reviewText,
      frequency: reviewFrequency,
      day: reviewDay,
      preparer: subjectOf(reviewText, "extract"),
      reviewer: subjectOf(reviewText, "verify") || subjectOf(reviewText, "review"),
      toExcel: /to excel|in excel|spreadsheet/i.test(reviewText),
      completeness: /(complete(ness)?|record count|reconcil|tie[-\s]?out|system[-\s]generated|locked)/i.test(reviewText),
      signOff: /sign(s|ed)? off|sign-off/i.test(reviewText),
    },
    paymentDays,
    exceptions: { ref: excSec ? excSec.num : "", text: excSec ? clauses.filter((s) => s.num === excSec.num || s.num.startsWith(`${excSec.num}.`)).map((s) => s.text).join(" ") : "" },
    retentionYears,
    retentionRef: recSec ? recSec.num : "",
    scope: scopeSec?.text || "",
    masterContactMaintained: /(contact|telephone|phone)[^.]{0,80}(maintained|recorded|captured)[^.]{0,40}(vendor master|master)/i.test(all),
  };
  facts.exceptions.vague =
    !!facts.exceptions.text && !/(within \d+|\d+\s*(working )?days|escalat|block|hold|investigat|timeline|root cause)/i.test(facts.exceptions.text);

  return {
    name,
    title: clean(titleLine.replace(/^standard operating procedure:\s*/i, "")),
    docId,
    version,
    approvedBy,
    approvalDate,
    reviewDue,
    owner,
    preparedBy,
    roles,
    sections,
    facts,
    company: lines.find((l) => /\b(pvt|private|ltd|limited|inc|llp)\b/i.test(l) && !/\|/.test(l)) || "",
  };
}
