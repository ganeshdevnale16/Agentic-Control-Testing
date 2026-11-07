import { DATE_RE_G, IFSC_RE_G, PHONE_RE_G, clean, findHeader, mapColumns, normPhone, num, parseDate, preamble, rowsFrom, yes } from "./util";
import { sheetKind } from "./readers";

// Text between two headings (case-insensitive), newlines flattened
function between(text, start, end) {
  const s = text.search(start);
  if (s < 0) return "";
  const rest = text.slice(s);
  const e = end ? rest.slice(1).search(end) : -1;
  return clean(e >= 0 ? rest.slice(0, e + 1) : rest);
}
const line = (text, label) => clean((text.match(new RegExp(`^\\s*${label}\\s*[:\\-]?\\s*(.+)$`, "im")) || [])[1] || "");
const phones = (t) => (t.match(PHONE_RE_G) || []).map(normPhone);

// ── VCRF (PDF / Word / text) ─────────────────────────────────────────────
export function parseVcrf(text, name) {
  const ref = (text.match(/\bVCR-\d{4}-\d{3,5}\b/) || [])[0] || name;
  const letterLine = line(text, "Request letter dated");
  const changeSec = between(text, /change details/i, /documents attached/i);
  const docsSec = between(text, /documents attached/i, /callback record|document check/i);
  const cbSec = between(text, /callback record/i, /SAP update/i);
  const dcSec = between(text, /document check/i, /SAP update/i);
  const sapSec = between(text, /SAP update/i, /vendor master snapshot|authori[sz]ed contact/i);
  const masterSec = between(text, /vendor master snapshot|authori[sz]ed contact \(/i, /prepared by/i);

  const ifsc = changeSec.match(IFSC_RE_G) || [];
  const acct = (changeSec.match(/account number\s+(\S+)\s+(\S+)/i) || []).slice(1);
  const holder = (changeSec.match(/account holder\s+(.+)$/i) || [])[1] || "";
  const cbDates = cbSec.match(DATE_RE_G) || [];
  const cbTime = (cbSec.match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
  const sapDates = sapSec.match(DATE_RE_G) || [];
  const sapTime = (sapSec.match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
  const sapUser = (sapSec.match(/\b(XK02|FK02|BP)\s+([A-Z]{2,}\d{1,3})\b/) || [])[2] || (sapSec.match(/changed by\s+.*?\b([A-Z]{2,}\d{1,3})\b/i) || [])[1] || "";
  const cbBody = cbSec.replace(/^.*?performed by/i, "");
  const vendorName = line(text, "Vendor name");
  // Account holder line holds old + new values; new = second half if repeated
  const half = holder ? clean(holder.slice(Math.ceil(holder.length / 2))) : "";

  return {
    ref,
    file: name,
    raw: text,
    vendorCode: line(text, "Vendor code"),
    vendorName,
    changeType: line(text, "Type of change"),
    letterDate: parseDate(letterLine),
    receivedVia: /email/i.test(letterLine) ? "Email" : /post|courier|hand/i.test(letterLine) ? "Post / by hand" : "Not stated",
    receivedOn: parseDate((letterLine.match(/received.*?(\d{1,2}-[A-Za-z]{3}-\d{4})/) || [])[1]),
    signedBy: line(text, "Signed by(?: \\(as per letter\\))?"),
    letterPhone: normPhone(phones(line(text, "Contact number on request letter"))[0] || ""),
    oldIfsc: ifsc[0] || "",
    newIfsc: ifsc[1] || "",
    oldAcct: acct[0] || "",
    newAcct: acct[1] || "",
    newHolder: half,
    holderLine: clean(holder),
    docs: {
      letter: /request letter|letterhead/i.test(docsSec),
      letterhead: /letterhead/i.test(docsSec),
      cheque: /cancell?ed cheque|cancell?ed check/i.test(docsSec),
    },
    sender: (line(text, "Request received from").match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || "",
    docCheck: dcSec
      ? {
          when: parseDate((dcSec.match(DATE_RE_G) || [])[0], (dcSec.match(/\b(\d{1,2}:\d{2})\b/) || [])[1]),
          items: [...(dcSec.match(/cancell?ed cheque attached/gi) || []), ...(dcSec.match(/request letter[^.]*?attached/gi) || [])].map(clean),
          by: (dcSec.match(/([A-Z][a-z]+ [A-Z]\.?)\s*\(([A-Z]{2,}\d{1,3})\)/) || [])[1] || "",
          byUser: (dcSec.match(/\(([A-Z]{2,}\d{1,3})\)/) || [])[1] || "",
          presenceOnly: !/(match|agree|compar|name check|domain|signatory check)/i.test(dcSec.replace(/^document check[^)]*\)/i, "")),
        }
      : null,
    callback: {
      when: parseDate(cbDates[0], cbTime),
      number: phones(cbSec)[0] || "",
      source: /request\s*letter|letter|email/i.test(cbBody.split(/mr\.|ms\.|mrs\./i)[0]) ? "Vendor request letter" : /master|onboarding/i.test(cbBody) ? "Vendor master" : "Not stated",
      person: clean((cbBody.match(/\b(?:Mr|Ms|Mrs|Dr)\.?\s+[A-Z][\w.\s()]+?(?=\s+(?:Change|Confirmed|Not|Outcome|Rejected))/) || [])[0] || ""),
      outcome: /confirmed/i.test(cbSec) ? "Change confirmed" : /reject|not confirmed/i.test(cbSec) ? "Not confirmed" : "",
      by: (cbSec.match(/([A-Z][a-z]+ [A-Z]\.?\s*\(([A-Z]{2,}\d{1,3})\))/) || [])[1] || "",
      byUser: (cbSec.match(/\(([A-Z]{2,}\d{1,3})\)/) || [])[1] || "",
    },
    sap: {
      txn: (sapSec.match(/\b(XK02|FK02|BP)\b/) || [])[1] || "",
      user: sapUser,
      when: parseDate(sapDates[0], sapTime),
      changeDoc: (sapSec.match(/\bCD-?\d+\b/) || [])[0] || "",
    },
    master: { phone: phones(masterSec)[0] || "", email: (masterSec.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || "", contact: (masterSec.match(/telephone\s+email\s+(.+?)\s+\+?\d/i) || [])[1] || "" },
    preparedBy: line(text, "Prepared by"),
    dms: line(text, "Filed in DMS"),
  };
}

// ── Excel evidence: one or many workbooks, sheets recognised by content ──
export function parseSheetEvidence(doc, into) {
  for (const sheet of doc.sheets) {
    const kind = sheetKind(sheet);
    const src = `${doc.name} › ${sheet.name}`;
    if (kind === "sensitive") {
      const h = findHeader(sheet.aoa, [/field/i, /sensitive/i]);
      if (!h) continue;
      const c = mapColumns(h.headers, { field: [/field name/i, /^field$/i], desc: [/desc/i], sensitive: [/sensitive/i], dual: [/dual|fk08|confirm/i], block: [/block/i] });
      into.sensitive = rowsFrom(sheet.aoa, h, c).map((r) => ({ ...r, sensitive: yes(r.sensitive), dual: yes(r.dual), block: yes(r.block) }));
      into.sensitiveMeta = { src, file: doc.name, sheet: sheet.name, lines: preamble(sheet.aoa, h) };
    } else if (kind === "access") {
      const h = findHeader(sheet.aoa, [/user id/i]);
      if (!h) continue;
      const c = mapColumns(h.headers, { user: [/user id/i], name: [/^name$/i, /name/i], dept: [/dep/i], roles: [/role/i], change: [/xk02|fk02|change vendor/i], pay: [/f110|payment/i], confirm: [/fk08|confirm/i], validTo: [/valid/i] });
      into.access = rowsFrom(sheet.aoa, h, c).map((r) => ({ ...r, change: yes(r.change), pay: yes(r.pay), confirm: yes(r.confirm) }));
      into.accessMeta = { src, file: doc.name, sheet: sheet.name, cols: c, lines: preamble(sheet.aoa, h) };
    } else if (kind === "calendar") {
      const h = findHeader(sheet.aoa, [/run date|date/i, /executed|run by|user/i]);
      if (!h) continue;
      const c = mapColumns(h.headers, { date: [/run date/i, /date/i], day: [/^day$/i], runId: [/run id|id/i], by: [/executed|run by|user/i], vendors: [/vendor/i], amount: [/amount|inr|value/i] });
      into.calendar = rowsFrom(sheet.aoa, h, c).map((r) => ({ ...r, when: parseDate(r.date), vendors: num(r.vendors), amount: num(r.amount) })).filter((r) => r.when);
      into.calendarMeta = { src, file: doc.name, sheet: sheet.name, width: h.headers.filter(Boolean).length, lines: preamble(sheet.aoa, h) };
    } else if (kind === "changes") {
      const h = findHeader(sheet.aoa, [/vendor/i, /field changed/i]);
      if (!h) continue;
      const c = mapColumns(h.headers, { sno: [/s\.?\s?no|^#$/i], code: [/vendor code|vendor no/i], name: [/vendor name/i], field: [/field changed/i], oldV: [/old/i], newV: [/new/i], by: [/changed by|user/i], on: [/changed on|date/i], vcrf: [/vcrf|request ref/i], remark: [/remark|review/i] });
      const pre = preamble(sheet.aoa, h);
      const period = (pre.join(" ").match(/\((\d{1,2}-[A-Za-z]{3}-\d{4})\s*(?:to|-|–)\s*(\d{1,2}-[A-Za-z]{3}-\d{4})\)/) || []).slice(1);
      const prep = pre.find((l) => /prepared by/i.test(l)) || "";
      into.changes = rowsFrom(sheet.aoa, h, c).map((r) => ({ ...r, when: parseDate(r.on), isBank: /bank|ifsc|account/i.test(r.field) }));
      const rowOf = (re) => sheet.aoa.findIndex((r) => re.test(r.map(clean).join(" "))) + 1;
      into.changesMeta = {
        src,
        file: doc.name,
        sheet: sheet.name,
        cols: c,
        sourceRow: rowOf(/^source/i),
        preparedRow: rowOf(/prepared by/i),
        hasParameters: /parameter|variant|record count|run log/i.test(pre.join(" ")),
        lines: pre,
        title: pre[0] || sheet.name,
        week: (pre[0]?.match(/week\s*(\d+)/i) || [])[1] || "",
        from: parseDate(period[0]),
        to: parseDate(period[1]),
        source: pre.find((l) => /source/i.test(l)) || "",
        preparedBy: clean((prep.match(/prepared by\s*:?\s*([^|(]+)/i) || [])[1] || ""),
        sentOn: parseDate((prep.match(/sent.*?(\d{1,2}-[A-Za-z]{3}-\d{4})/i) || [])[1], (prep.match(/(\d{1,2}:\d{2})/) || [])[1]),
        manualFilter: /filtered|manual|excel/i.test(pre.join(" ")),
      };
    } else if (kind === "signoff") {
      const kv = {};
      const kvRow = {};
      sheet.aoa.forEach((r, i) => {
        const k = clean(r[0]);
        const v = clean(r[1]);
        if (k && v && !/^item$/i.test(k)) {
          kv[k.toLowerCase()] = v;
          kvRow[k.toLowerCase()] = i + 1;
        }
      });
      const rowFor = (re) => Object.entries(kvRow).find(([k]) => re.test(k))?.[1] || 0;
      const get = (re) => Object.entries(kv).find(([k]) => re.test(k))?.[1] || "";
      into.signoff = {
        src,
        file: doc.name,
        sheet: sheet.name,
        dateRow: rowFor(/review date/),
        signoffRow: rowFor(/^sign-?off/),
        week: get(/week/),
        count: num(get(/number of changes|changes in report/)),
        bankVerified: num(get(/bank.*verified/)),
        exceptions: get(/exceptions/),
        comment: get(/comment/),
        reviewer: get(/^reviewed by|^reviewer$/),
        date: parseDate(get(/review date|date/)),
        signoff: get(/sign-?off|approv/),
        signedOn: parseDate(get(/sign-?off|approv/), (get(/sign-?off|approv/).match(/(\d{1,2}:\d{2})/) || [])[1]),
      };
    }
  }
  return into;
}

// ── Cancelled cheque (scanned attachment) ────────────────────────────────
export function parseCheque(text, name) {
  const t = String(text || "");
  const holder = clean((t.match(/^\s*For\s+(.+)$/im) || [])[1] || "");
  const acct = (t.match(/A\/c\s*No\.?\s*([\d\s]{6,})/i) || [])[1] || "";
  return {
    file: name,
    raw: t,
    vcrfRef: (t.match(/\bVCR-\d{4}-\d{3,5}\b/) || [])[0] || "",
    vendorCode: (t.match(/vendor\s+(\d{5,})/i) || [])[1] || "",
    bank: clean((t.match(/^\s*([A-Z ]+BANK)\s*$/m) || [])[1] || ""),
    branch: clean((t.match(/^(.*Branch.*)$/im) || [])[1] || ""),
    ifsc: (t.match(IFSC_RE_G) || [])[0] || "",
    account: acct.replace(/\s/g, ""),
    accountType: clean((t.match(/A\/c\s*No\.?\s*[\d\s]+(.*)$/im) || [])[1] || ""),
    holder,
    signatory: clean((t.match(/^\s*([A-Z]\.\s?[A-Z][a-z]+)\s*$/m) || [])[1] || ""),
    cancelled: /cancell?ed/i.test(t),
    dms: clean((t.match(/(FIN\/MDM\/[\w/-]+)/) || [])[1] || ""),
    attachmentLine: clean((t.match(/^(Attachment \d+ to VCRF.*)$/im) || [])[1] || ""),
  };
}

export const emptyEvidence = () => ({ vcrfs: [], cheques: [], files: [] });
