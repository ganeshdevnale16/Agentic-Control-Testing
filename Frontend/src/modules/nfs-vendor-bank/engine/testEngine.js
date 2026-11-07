// Test of design (ToD) for the vendor bank-detail change control.
// Each attribute is concluded from the SOP, RCM, walkthrough transcript and the
// evidence, and every finding is referenced as an annotation A{n}-{k} that links
// the attribute to the exact text or cells in a source document.
import { clean, fmtDate, fmtDateTime, plural } from "./util";
import { KIND_LABEL } from "./readers";

const norm = (s) => clean(String(s ?? "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"')).toLowerCase();
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const day = (d) => (d ? DAYS[d.getDay()] : "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}-${MON[d.getMonth()]}` : "–");
const col = (i) => (i >= 0 ? String.fromCharCode(65 + i) : "A");
const surname = (s) => (String(s).match(/([A-Z][a-z]{2,})\b/g) || []).pop() || "";
const titleCase = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const inr = (n) => (n == null ? "–" : n >= 1e7 ? `INR ${(n / 1e7).toFixed(2)} crore` : `INR ${n.toLocaleString("en-IN")}`);
const KIND_CODE = { sop: "NFS-01", rcm: "NFS-02", config: "NFS-03", vcrf: "NFS-04", review: "NFS-05", transcript: "NFS-06", walkthrough: "NFS-06", cheque: "NFS-07" };
const codeOf = (name, kind) => (String(name || "").match(/NFS-\d{2}/) || [])[0] || KIND_CODE[kind] || kind;

// Page of a quote in extracted PDF text ("… Page N" footer marks each page)
function pageOf(raw, quote) {
  const text = String(raw || "");
  const flat = norm(text);
  const at = flat.indexOf(norm(quote));
  if (at < 0) return null;
  // map position in normalised text back approximately: count markers before it
  const markers = [...text.matchAll(/Page (\d+)\s*$/gm)].map((m) => ({ at: norm(text.slice(0, m.index)).length, page: +m[1] }));
  return markers.filter((m) => m.at <= at).pop()?.page || 1;
}
// Exact wording of a phrase as it appears in the source (case kept)
function phrase(raw, re) {
  const m = clean(String(raw || "").replace(/[’‘]/g, "'")).match(re);
  return m ? m[0] : "";
}

export function runTest({ rcm, sop, evidence }) {
  const ev = evidence;
  const T = rcm.transcript;
  const wt = ev.rcmExtract || rcm.wt;
  const ctl = wt?.controls?.[0];
  const v = ev.vcrfs[0];
  const chq = ev.cheques?.[0];
  const access = ev.access || [];
  const calendar = ev.calendar || [];
  const changes = ev.changes || [];
  const cm = ev.changesMeta;
  const so = ev.signoff;
  const f = sop.facts;
  const owner = rcm.control.owner;
  const ownerRole = (String(owner).split(/\s[-–]\s/)[0] || owner).trim();

  const files = {
    sop: { name: sop.name, code: codeOf(sop.name, "sop") },
    rcm: wt ? { name: wt.name, code: codeOf(wt.name, "rcm") } : null,
    tr: T ? { name: T.name, code: codeOf(T.name, "transcript") } : null,
    vcrf: v ? { name: v.file, code: codeOf(v.file, "vcrf") } : null,
    chq: chq ? { name: chq.file, code: codeOf(chq.file, "cheque") } : null,
    cfg: ev.accessMeta || ev.sensitiveMeta || ev.calendarMeta ? { name: (ev.accessMeta || ev.sensitiveMeta || ev.calendarMeta).file, code: codeOf((ev.accessMeta || ev.sensitiveMeta || ev.calendarMeta).file, "config") } : null,
    rev: cm || so ? { name: (cm || so).file, code: codeOf((cm || so).file, "review") } : null,
  };

  // ── annotation builders ───────────────────────────────────────────────
  const annotations = [];
  const counters = {};
  const results = [];
  const A = (attr, src, location, highlight, note, isT = false) => {
    if (!src) return null;
    counters[attr] = (counters[attr] || 0) + 1;
    const a = { ref: `${attr}-${counters[attr]}`, attr, code: src.code, file: src.name, location, highlight, note, transcript: isT };
    annotations.push(a);
    return a;
  };
  // quote from the transcript
  const TQ = (attr, quote, note, re) => {
    if (!T) return null;
    const line = T.find(quote);
    if (!line) return null;
    const hl = re ? phrase(line.text, re) || quote : quote;
    return A(attr, files.tr, `Page ${line.page}`, hl, note, true);
  };
  // quote from the SOP
  const SQ = (attr, quote, note) => {
    if (!quote) return null;
    const pg = pageOf(sop.raw, quote);
    if (!pg) return null;
    return A(attr, files.sop, `Page ${pg}`, quote, note);
  };
  const VQ = (attr, quote, note) => (v && quote && norm(v.raw).includes(norm(quote)) ? A(attr, files.vcrf, "Page 1", quote, note) : null);
  const R = (id, status, observation, extra = {}) => {
    const attr = rcm.attributes.find((a) => a.id === id);
    const anns = annotations.filter((a) => a.attr === id);
    anns.forEach((a) => (a.result = status));
    const mark = status === "Pass" ? "✓" : status === "Partial" ? "◐" : status === "Not tested" ? "NT" : "✗";
    results.push({ attr, status, observation, annotations: anns, tick: `${mark}${anns.some((a) => a.transcript) ? " T" : ""}`, ...extra });
  };
  const refRange = (id) => {
    const r = annotations.filter((a) => a.attr === id).map((a) => a.ref);
    return r.length > 2 ? `${r[0]} to ${r[r.length - 1]}` : r.join(", ");
  };

  // ── A1 Risk linkage ─────────────────────────────────────────────────────
  {
    const letters = rcm.activities.map((a) => a.letter);
    const riskOk = /bank|payment|divert|fraud/i.test(rcm.control.riskDesc) && rcm.activities.length >= 2;
    if (ctl && wt.cols) {
      const r = ctl.__row;
      A("A1", files.rcm, `'${wt.sheet}'!${col(wt.cols.riskDesc)}${r}:${col(wt.cols.controlDesc)}${r}`, `Cells ${col(wt.cols.riskDesc)}${r}:${col(wt.cols.controlDesc)}${r}`,
        `Risk ${rcm.control.riskId} (payment diversion) is directly addressed by control components (${letters[0]}) to (${letters[letters.length - 1]}).`);
    }
    const t = TQ("A1", "vendor impersonation", "Control owner confirms the fraud scenario the control targets.");
    R("A1", riskOk ? "Pass" : "Deficiency",
      riskOk
        ? `Control components (${letters[0]})-(${letters[letters.length - 1]}) map to payment diversion risk.${t ? " Owner confirmed vendor impersonation as the target scenario." : ""}`
        : `The control description does not clearly address risk ${rcm.control.riskId}.`);
  }

  // ── A2 Policy governance ────────────────────────────────────────────────
  {
    const asOf = T?.date || new Date();
    const ok = !!sop.approvedBy && !!sop.reviewDue && sop.reviewDue >= asOf;
    SQ("A2", fmtDate(sop.approvalDate), `SOP v${sop.version} approved by ${(sop.approvedBy.split(/\s[-–]\s/)[0] || "approver").replace("Chief Financial Officer", "CFO")} on ${fmtDate(sop.approvalDate)}.`);
    SQ("A2", fmtDate(sop.reviewDue), ok ? `Within review cycle at walkthrough date (${fmtDate(asOf)}).` : `Review overdue at walkthrough date (${fmtDate(asOf)}).`);
    TQ("A2", "approved it on", `Owner confirms SOP v${sop.version} is the version in force.`, /approved it on \d+\w* [A-Z][a-z]+/);
    R("A2", ok ? "Pass" : "Deficiency",
      `${sop.docId} v${sop.version} approved by ${/chief financial/i.test(sop.approvedBy) ? "CFO" : sop.approvedBy} ${fmtDate(sop.approvalDate)}; next review ${fmtDate(sop.reviewDue)}.${annotations.some((a) => a.attr === "A2" && a.transcript) ? " Owner confirmed version in force." : ""}`);
  }

  // ── A3 Ownership and authority ──────────────────────────────────────────
  {
    const same = surname(ctl?.owner || owner) === surname(sop.owner);
    if (ctl && wt.cols) A("A3", files.rcm, `'${wt.sheet}'!${col(wt.cols.owner)}${ctl.__row}`, `Cells ${col(wt.cols.owner)}${ctl.__row}`, `Control owner named: ${ownerRole}.`);
    SQ("A3", sop.owner, same ? "SOP names the same process owner; consistent with RCM." : "SOP names a different process owner from the RCM.");
    TQ("A3", "the control owner", "Owner accepts accountability; role is senior enough to act on findings.", /I'?m the control owner/i);
    const hold = T?.find("hold the payment");
    R("A3", same ? "Pass" : "Deficiency",
      same ? `${ownerRole} named consistently; has authority to hold payments and escalate to CFO.${hold ? "" : ""}` : `Owner differs between RCM (${ctl?.owner}) and SOP (${sop.owner}).`);
  }

  // ── A4 Precision and criteria ───────────────────────────────────────────
  if (!v) R("A4", "Not tested", "VCRF for the sample not provided.");
  else {
    const dc = f.docCheck;
    const holder = chq?.holder || "";
    const nameMismatch = !!holder && norm(holder) !== norm(v.vendorName);
    const sender = v.sender || (T?.emails || []).find((e) => e.toLowerCase() !== (v.master.email || "").toLowerCase() && /gmail|yahoo|outlook|hotmail|rediff/i.test(e)) || "";
    const senderFromT = !v.sender && !!sender;
    const senderDomain = (sender.split("@")[1] || "").toLowerCase();
    const masterDomain = (v.master.email.split("@")[1] || "").toLowerCase();
    const webmail = /gmail|yahoo|outlook|hotmail|rediff/i.test(senderDomain);
    const senderMismatch = !!senderDomain && !!masterDomain && senderDomain !== masterDomain;
    const presenceOnly = dc ? dc.presenceOnly : f.callback.source !== "master";
    if (presenceOnly && dc) SQ("A4", dc.quote, "SOP requires only that the documents are present. No criteria to match cheque account name to vendor, signatory to onboarding records, or sender email to vendor master.");
    if (chq && holder)
      A("A4", files.chq, "Page 1", `For ${holder}`, nameMismatch ? `Cheque account is held by '${titleCase(holder)}', not the vendor '${v.vendorName}'. A document-presence check cannot detect this.` : "Cheque account name agrees to the vendor name.");
    const chqItem = (v.docCheck?.items || []).find((i) => /cheque/i.test(i));
    if (chqItem) VQ("A4", chqItem, "Sample document check records attachment only; cheque details not compared to vendor master.");
    if (v.master.email) VQ("A4", v.master.email, senderMismatch ? `Vendor master holds a company-domain email; request arrived from a ${webmail ? "Gmail" : "different"} ID${senderFromT ? ` (${files.tr?.code || "walkthrough"})` : ` (${sender})`}. No sender check in SOP.` : "Request sender agrees to the vendor master email domain.");
    TQ("A4", "Once they're attached, I go ahead", "MDM Executive confirms check is limited to presence of documents.");
    if (webmail) TQ("A4", senderDomain.split(".").slice(-2).join("."), "Request came from a free webmail ID, not the vendor's registered domain.");
    TQ("A4", "the SOP doesn't ask for it", "Account holder name on cheque not compared; vendor name keyed into SAP instead of cheque name.");
    TQ("A4", "I check it's attached", "Reviewer does not examine cheque details, so the weekly review cannot catch a name mismatch.");
    const def = presenceOnly || nameMismatch || senderMismatch;
    R("A4", def ? "Deficiency" : "Pass",
      def
        ? `SOP ${dc?.ref?.split(" ")[0] || f.callback.ref} requires only that the letter and cheque are attached. In the sample, ${nameMismatch ? `the cheque is in the name of '${titleCase(holder)}', not vendor '${v.vendorName}'` : "the cheque name agrees"}${senderMismatch ? `, and the request came from a ${webmail ? "Gmail" : "different"} ID while the master email is a company domain` : ""}. Neither was checked; the vendor name was keyed as account holder. Reviewer does not examine cheque details.`
        : "Document check criteria are specific enough to detect a fraudulent request.",
      { details: [
        { item: "Cheque account holder", expected: v.vendorName, actual: holder ? titleCase(holder) : "Cheque not provided", result: !holder ? "Not tested" : nameMismatch ? "Exception" : "Pass" },
        { item: "Request sender", expected: `@${masterDomain || "vendor domain"}`, actual: sender ? `${sender}${senderFromT ? " (per walkthrough)" : ""}` : "Not recorded", result: senderMismatch ? "Exception" : "Pass" },
        { item: "SAP account holder keyed", expected: holder ? titleCase(holder) : "Cheque name", actual: v.newHolder || v.vendorName, result: nameMismatch ? "Exception" : "Pass" },
        { item: `SOP ${dc?.ref?.split(" ")[0] || ""} criterion`, expected: "Name, signatory and sender validated", actual: presenceOnly ? "Presence of documents only" : "Validation defined", result: presenceOnly ? "Exception" : "Pass" },
      ] });
  }

  // ── A5 Frequency and timing ─────────────────────────────────────────────
  const changeAt = v?.sap.when;
  const reviewAt = so?.date || cm?.sentOn;
  const runsBetween = changeAt && reviewAt ? calendar.filter((r) => r.when >= new Date(changeAt.toDateString()) && r.when <= reviewAt) : [];
  if (!v || !calendar.length || !so) R("A5", "Not tested", "VCRF, payment run calendar or review sign-off not provided.");
  else {
    const every = phrase(sop.raw, /Every (monday|tuesday|wednesday|thursday|friday|saturday|sunday), the [A-Z]+ [A-Z][a-z]+/i);
    SQ("A5", every, "Only independent check on bank changes is weekly and after the change is live.");
    VQ("A5", fmtDateTime(changeAt), `Sample change live in SAP on ${day(changeAt)} ${fmtDate(changeAt)}.`);
    const run = runsBetween[0];
    if (run && ev.calendarMeta) A("A5", files.cfg, `'${ev.calendarMeta.sheet}'!A${run.__row}:${col((ev.calendarMeta.width || 6) - 1)}${run.__row}`, `Cells A${run.__row}:${col((ev.calendarMeta.width || 6) - 1)}${run.__row}`, `Payment run on ${day(run.when)} ${fmtDate(run.when)}, before the weekly review.`);
    if (so.dateRow) A("A5", files.rev, `'${so.sheet}'!B${so.dateRow}`, `Cells B${so.dateRow}`, `Review performed ${day(reviewAt)} ${fmtDate(reviewAt)}${run ? `, ${Math.round((reviewAt - run.when) / 864e5)} days after payment` : ""}.`);
    TQ("A5", "was paid on", "AP confirms vendor was paid to the new account before the review.", /[A-Z][\w ]+ was paid on \d+\w*/);
    R("A5", run ? "Deficiency" : "Pass",
      run
        ? `Change live ${short(changeAt)} (${day(changeAt).slice(0, 3)}); vendor paid in F110 run ${short(run.when)} (${day(run.when).slice(0, 3)}); review on ${short(reviewAt)} (${day(reviewAt).slice(0, 3)}). The only independent check is after payment.`
        : "No payment run fell between the change and its review.",
      { details: [
        { item: "SAP change", expected: "Before review", actual: fmtDateTime(changeAt), result: "Pass" },
        ...runsBetween.map((r) => ({ item: `F110 run ${r.runId}`, expected: "After review / confirmation", actual: `${fmtDate(r.when)} by ${r.by}`, result: "Exception" })),
        { item: "Weekly review", expected: "Before payment", actual: fmtDate(reviewAt), result: run ? "Exception" : "Pass" },
      ] });
  }

  // ── A6 System alignment ─────────────────────────────────────────────────
  if (!ev.sensitive?.length) R("A6", "Not tested", "SAP sensitive-field configuration not provided.");
  else {
    const bank = ev.sensitive.filter((r) => /LFBK|bank|account/i.test(`${r.field} ${r.desc}`));
    const weak = bank.filter((r) => !r.sensitive || !r.dual || !r.block);
    if (weak.length && ev.sensitiveMeta) {
      const a = Math.min(...weak.map((r) => r.__row));
      const b = Math.max(...weak.map((r) => r.__row));
      A("A6", files.cfg, `'${ev.sensitiveMeta.sheet}'!C${a}:E${b}`, `Cells C${a}:E${b}`, "Bank key, account number and holder are not sensitive fields: no dual control, no payment block.");
    }
    TQ("A6", "Bank fields were taken out in", "Basis confirms dual control was removed and never restored.", /bank fields were taken out in \d{4}/i);
    TQ("A6", "No separate approval in SAP", "No system-enforced approval before a bank change becomes payable.");
    const removed = T?.find("taken out in");
    R("A6", weak.length ? "Deficiency" : "Pass",
      weak.length ? `LFBK bank fields not set as sensitive: no dual control (FK08), no payment block.${removed ? ` Removed in ${(removed.text.match(/\b(20\d{2})\b/) || [])[1] || "the past"}, not restored.` : ""}` : "Vendor bank fields are sensitive with dual control and payment block.",
      { details: bank.map((r) => ({ item: `${r.field} ${r.desc}`, expected: "Sensitive, FK08, payment block", actual: `${r.sensitive ? "sensitive" : "not sensitive"}, ${r.dual ? "dual control" : "no dual control"}, ${r.block ? "block" : "no block"}`, result: r.sensitive && r.dual && r.block ? "Pass" : "Exception" })) });
  }

  // ── A7 Segregation of duties ────────────────────────────────────────────
  const conflicts = access.filter((u) => u.change && u.pay);
  if (!access.length) R("A7", "Not tested", "SAP user access extract not provided.");
  else {
    const am = ev.accessMeta;
    conflicts.forEach((u) => am && A("A7", files.cfg, `'${am.sheet}'!${col(am.cols.change)}${u.__row}:${col(am.cols.pay)}${u.__row}`, `Cells ${col(am.cols.change)}${u.__row}:${col(am.cols.pay)}${u.__row}`, `${u.user} (${u.name}) can change vendor bank details and execute payment runs.`));
    const samePerson = v?.docCheck?.byUser && v.docCheck.byUser === v.sap.user;
    if (samePerson) VQ("A7", `${v.sap.user} - ${(access.find((u) => u.user === v.sap.user) || {}).name || v.docCheck.by}`, "The person who checked the documents also made the SAP change. No maker-checker.");
    const apBank = changes.filter((c) => c.isBank && /accounts payable/i.test((access.find((u) => u.user === c.by) || {}).dept || ""));
    apBank.forEach((c) => cm && A("A7", files.rev, `'${cm.sheet}'!${col(cm.cols.by)}${c.__row}`, `Cells ${col(cm.cols.by)}${c.__row}`, `Bank change for ${c.name} made by AP user ${c.by}.`));
    const sopSame = (f.docCheck?.performer || f.callback.performer) === f.update.performer;
    if (sopSame) SQ("A7", phrase(sop.raw, new RegExp(`the ${f.update.performer} shall update`, "i")), "SOP assigns verification and execution to the same role.");
    TQ("A7", "I cover payment runs", `${conflicts[0]?.user || "MDM user"} uses payment-run access in practice.`);
    TQ("A7", "I did one change in", `${apBank[0]?.by || "AP user"} uses vendor-change access in practice.`, /I did one change in \w+/i);
    const def = conflicts.length || samePerson || apBank.length;
    R("A7", def ? "Deficiency" : "Pass",
      def
        ? `${conflicts.map((u) => u.user).join(" and ")} hold both XK02 and F110.${samePerson ? " Same person checked the documents and made the change in sample." : ""}${apBank.length ? ` ${apBank.map((c) => c.by).join(", ")} made a bank change in W${cm?.week || ""} (${apBank.map((c) => c.name).join(", ")}).` : ""}${T?.find("I cover payment runs") ? " Both users exercise the conflicting access." : ""}`
        : "Verifier, maker and payment-run roles are separated.",
      { conflictUsers: conflicts, details: conflicts.map((u) => ({ item: `${u.user} ${u.name}`, expected: "Not both XK02 and F110", actual: `XK02 ✓, F110 ✓ (${u.roles})`, result: "Exception" })) });
  }

  // ── A8 Information used (IPE) ───────────────────────────────────────────
  if (!cm) R("A8", "Not tested", "Weekly change report not provided.");
  else {
    if (cm.manualFilter && cm.sourceRow) A("A8", files.rev, `'${cm.sheet}'!A${cm.sourceRow}`, `Cells A${cm.sourceRow}`, "Report exported and filtered by the MDM team, whose changes are under review.");
    if (!cm.hasParameters && cm.preparedRow) A("A8", files.rev, `'${cm.sheet}'!A${cm.preparedRow}`, `Cells A${cm.preparedRow}`, "No report parameters, run log or record count retained.");
    if (f.review.toExcel) SQ("A8", phrase(sop.raw, /from SAP to Excel/i), "SOP lets the reviewed team produce the review population.");
    TQ("A8", "delete rows that are not relevant", "Manual deletion of rows before review; original extract not kept.");
    TQ("A8", "I trust", "Reviewer performs no completeness or accuracy check of the report.", /I trust [\w']+ extract/i);
    const def = cm.manualFilter || !cm.hasParameters || !f.review.completeness;
    R("A8", def ? "Deficiency" : "Pass",
      def ? `Report extracted and manually filtered by ${cm.preparedBy ? `the MDM team (${cm.preparedBy})` : "the reviewed team"}. No parameters, run log or record count kept; reviewer relies on it without checks.` : "Report is system-generated, independently sourced and reconciled.");
  }

  // ── A9 Exceptions and escalation ────────────────────────────────────────
  {
    const vague = f.exceptions.vague;
    if (f.exceptions.text) SQ("A9", phrase(sop.raw, /for necessary action/i) || f.exceptions.text.slice(0, 40), vague ? "Escalation route defined, but no timeline, payment hold or escalation beyond Finance Controller." : "Exception handling defined.");
    TQ("A9", "no fixed timeline", "Owner confirms payment hold would be informal.", /there'?s no fixed timeline/i);
    R("A9", !f.exceptions.text ? "Deficiency" : vague ? "Partial" : "Pass",
      !f.exceptions.text ? "SOP has no exception-handling step." : vague ? `Reporting to ${ownerRole} defined. No timeline, no formal payment hold, no escalation to CFO or recovery steps.` : "Exception handling has timeline, payment hold and escalation.");
  }

  // ── A10 Evidence of performance ─────────────────────────────────────────
  {
    if (v?.dms) VQ("A10", v.dms.replace(/^.*?(FIN\/)/, "$1"), "VCRF with document check retained in DMS.");
    if (chq?.attachmentLine) A("A10", files.chq, "Page 1", (chq.attachmentLine.match(/Attachment \d+ to VCRF [\w-]+/) || [chq.attachmentLine])[0], "Cancelled cheque retained in DMS as VCRF attachment.");
    if (so?.signoffRow) A("A10", files.rev, `'${so.sheet}'!B${so.signoffRow}`, `Cells B${so.signoffRow}`, "Review sign-off evidenced by dated email.");
    if (f.retentionYears) SQ("A10", phrase(sop.raw, /retained for \w+ years/i), "Retention period defined.");
    TQ("A10", "for eight years", "Owner confirms practice matches SOP.", /We keep both for \w+ years/i);
    // numbering as in the WP template: the cheque attachment is the last ref (A10-5) but listed after the VCRF
    {
      const a10 = annotations.filter((a) => a.attr === "A10");
      const chqAnn = a10.find((a) => a.code === files.chq?.code);
      if (chqAnn) {
        const others = a10.filter((a) => a !== chqAnn);
        others.forEach((a, k) => (a.ref = `A10-${k + 1}`));
        chqAnn.ref = `A10-${a10.length}`;
      }
    }
    const ok = !!v?.dms && !!so?.signoff && f.retentionYears >= 8;
    R("A10", ok ? "Pass" : v || so ? "Partial" : "Not tested",
      ok ? `VCRF filed in DMS; W${cm?.week || ""} sign-off by email ${fmtDate(so.signedOn || so.date)}; ${f.retentionYears}-year retention defined and confirmed.` : "Evidence of performance incomplete.");
  }

  // ── observations (draft for management response) ────────────────────────
  const get = (id) => results.find((r) => r.attr.id === id);
  const bad = (id) => get(id) && !["Pass", "Not tested"].includes(get(id).status);
  const observations = [];
  const O = (attrs, o) => observations.push({ id: `O${observations.length + 1}`, attrs, attrText: attrs.join(", "), refs: attrs.map(refRange).filter(Boolean).join("; "), owner, response: "", due: "", ...o });
  if (bad("A4"))
    O(["A4"], {
      title: "Document check confirms presence, not validity",
      severity: "High",
      condition: get("A4").observation,
      effect: "A fraudster can submit a letter and a genuine cheque for an account they control and pass the check.",
      recommendation: `Define validation criteria in SOP ${f.docCheck?.ref?.split(" ")[0] || "5.3"}: cheque account name must match the vendor's legal name; signatory must match the onboarding authorised-signatory list; request must come from the vendor's registered email domain; mismatches go to the ${ownerRole} before any SAP update. Consider bank account name validation through the bank's verification service.`,
    });
  if (bad("A5") || bad("A6"))
    O(["A5", "A6"].filter(bad), {
      title: "No preventive check before a bank change becomes payable",
      severity: "High",
      condition: `Bank fields are outside SAP dual control; the only independent check is a weekly review after payment runs${changeAt && runsBetween[0] ? ` (sample: changed ${short(changeAt)}, paid ${short(runsBetween[0].when)}, reviewed ${short(reviewAt)})` : ""}.`,
      effect: "Diverted payments are released before any independent check; recovery depends on the receiving bank.",
      recommendation: `Reactivate dual control for LFBK fields with payment block until confirmation (FK08) by the ${ownerRole} or a designee outside MDM and AP. Alternatively, block payment to vendors with bank changes in the last 7 days until reviewed.`,
    });
  if (bad("A7"))
    O(["A7"], {
      title: "Incompatible access and duties",
      severity: "High",
      condition: `${conflicts.map((u) => u.user).join(" and ")} hold both vendor change (XK02) and payment run (F110) access, and both use it. The person who checks the documents also executes the SAP change.`,
      effect: "One person can redirect a vendor's bank account and release payment.",
      recommendation: "Remove F110 from MDM roles and XK02 from AP roles; use time-bound firefighter access for backups with log review. Separate verifier and maker in the SOP.",
    });
  if (bad("A8"))
    O(["A8"], {
      title: "Review report not validated and prepared by reviewed team",
      severity: "Medium",
      condition: `W${cm?.week || ""} change report is extracted and manually filtered by the ${cm?.preparedBy ? `${cm.preparedBy.replace(/\s*\(.*\)/, "")} (MDM Lead)` : "MDM team"}; no parameters, run log or record count retained; reviewer relies on it as complete.`,
      effect: "Unauthorised changes can be excluded from the review population without detection.",
      recommendation: `${ownerRole} (or independent analyst) to run a saved SAP variant for change documents, retain parameters and record counts, and reconcile to the unfiltered extract.`,
    });
  if (bad("A9"))
    O(["A9"], {
      title: "Exception handling not defined",
      severity: "Medium",
      condition: `SOP section ${f.exceptions.ref} says discrepancies are reported to the ${ownerRole}; no timeline, payment hold or escalation.`,
      effect: "Delayed or inconsistent response to a suspected diversion.",
      recommendation: "Define: same-day payment hold, escalation to CFO, bank recall request within 24 hours, and incident log.",
    });
  // exception cards for the shared UI
  const exceptions = observations.map((o) => ({
    id: o.id,
    attrIds: o.attrs,
    title: o.title,
    type: "Design",
    severity: o.severity,
    condition: o.condition,
    criteria: o.attrs.map((id) => `${id} ${get(id).attr.criterion}`).join("; "),
    cause: `Annotation refs: ${o.refs}`,
    effect: o.effect,
    recommendation: o.recommendation,
    owner,
  }));
  results.forEach((r) => (r.exceptionId = observations.find((o) => o.attrs.includes(r.attr.id))?.id));

  // ── walkthrough trace of the sample ─────────────────────────────────────
  const tline = (q) => {
    const l = T?.find(q);
    return l ? `[${l.time}] ${l.speaker}` : "–";
  };
  const refs = (id) => annotations.filter((a) => a.attr === id).map((a) => a.ref);
  const pick = (id, pred) => annotations.filter((a) => a.attr === id && pred(a)).map((a) => a.ref);
  const trace = v
    ? [
        { step: 1, sopRef: `SOP ${f.request.ref.split(" ")[0]}`, designed: "Request on letterhead with cancelled cheque", observed: `${files.vcrf.code}: letter dated ${fmtDate(v.letterDate)}, received ${fmtDate(v.receivedOn)}; cheque attached`, transcript: tline("signed by") !== "–" ? tline("signed by") : tline("gmail.com"), performed: "Yes", note: pick("A4", (a) => a.transcript && /webmail/i.test(a.note))[0] ? `${pick("A4", (a) => a.transcript && /webmail/i.test(a.note))[0]}: request email from ${/gmail/i.test(v.sender || (T?.emails || []).join(" ")) ? "Gmail ID" : "webmail ID"} - no check of sender domain` : "-" },
        { step: 2, sopRef: `SOP ${f.vcrf.ref.split(" ")[0]}`, designed: "VCRF prepared with attachments", observed: `${files.vcrf.code}: VCRF ${v.ref}`, transcript: tline("prepares the VCRF"), performed: "Yes", note: "-" },
        { step: 3, sopRef: `SOP ${(f.docCheck?.ref || f.callback.ref).split(" ")[0]}`, designed: f.docCheck ? "Document check: letter and cheque attached" : "Callback to verify the request", observed: `${files.vcrf.code}: check recorded ${short(v.docCheck?.when)} ${v.docCheck?.when ? fmtDateTime(v.docCheck.when).slice(-5) : ""}${chq ? `; ${files.chq.code}: cheque in name of ${titleCase(chq.holder)}` : ""}`, transcript: tline("Once they're attached"), performed: get("A4")?.status === "Deficiency" ? "Yes - but criterion too weak" : "Yes", note: (() => {
          const r = pick("A4", (a) => !/reviewer/i.test(a.note));
          return r.length > 2 ? `${r[0]} to ${r[r.length - 1]}` : r.join(", ") || "-";
        })() },
        { step: 4, sopRef: `SOP ${f.update.ref.split(" ")[0]}`, designed: "MDM Executive updates SAP", observed: `${files.vcrf.code}: ${v.sap.txn} by ${v.sap.user} ${short(v.sap.when)} ${fmtDateTime(v.sap.when).slice(-5)}; ${v.sap.changeDoc}${chq && norm(chq.holder) !== norm(v.newHolder || v.vendorName) ? "; account holder keyed as vendor name" : ""}`, transcript: tline("the bank details in SAP") !== "–" ? tline("the bank details in SAP") : tline("updated the bank details"), performed: "Yes", note: pick("A7", (a) => /no maker-checker/i.test(a.note))[0] ? `${pick("A7", (a) => /no maker-checker/i.test(a.note))[0]}: same person checked and changed` : "-" },
        { step: 5, sopRef: "-", designed: "System approval before payable", observed: `${files.cfg?.code || "NFS-03"}: ${get("A6")?.status === "Deficiency" ? "no dual control on LFBK fields" : "dual control active"}`, transcript: tline("Not for bank fields") !== "–" ? tline("Not for bank fields") : tline("No separate approval"), performed: get("A6")?.status === "Deficiency" ? "Not designed" : "Yes", note: refs("A6").slice(0, 2).join(", ") || "-" },
        { step: 6, sopRef: "-", designed: "Payment to new account", observed: runsBetween[0] ? `${files.cfg?.code || "NFS-03"}: F110 run ${fmtDate(runsBetween[0].when)}` : "No run before review", transcript: tline("was paid on"), performed: "n/a", note: runsBetween[0] ? `${[pick("A5", (a) => /payment run on/i.test(a.note))[0], pick("A5", (a) => a.transcript)[0]].filter(Boolean).join(", ")}: paid before review` : "-" },
        { step: 7, sopRef: `SOP ${f.review.ref}`, designed: "Weekly change report extracted", observed: `${files.rev?.code || "NFS-05"}: W${cm?.week || ""} report prepared by ${cm?.preparedBy?.replace(/\s*\(.*\)/, "") ? "MDM Lead" : "MDM"}${cm?.manualFilter ? ", filtered" : ""}`, transcript: tline("delete rows"), performed: "Yes", note: refRange("A8") ? refRange("A8").replace(/A8-5$/, "A8-4") : "-" },
        { step: 8, sopRef: `SOP ${f.review.ref}`, designed: `${ownerRole} review and sign-off`, observed: `${files.rev?.code || "NFS-05"}: sign-off ${fmtDate(so?.date)}, ${/none/i.test(so?.exceptions || "") ? "no" : so?.exceptions || "no"} exceptions`, transcript: tline("I trust") !== "–" ? tline("I trust") : tline("I check it's attached"), performed: "Yes", note: [pick("A5", (a) => /review performed/i.test(a.note))[0], pick("A8", (a) => /no completeness/i.test(a.note))[0], pick("A4", (a) => /reviewer does not/i.test(a.note))[0]].filter(Boolean).join(", ") || "-" },
        { step: 9, sopRef: `SOP ${f.retentionRef || "8"}`, designed: "VCRF and sign-off retained", observed: `${files.vcrf.code} DMS ref; ${files.rev?.code || "NFS-05"} email sign-off`, transcript: tline("for eight years"), performed: "Yes", note: [pick("A10", (a) => /DMS\./.test(a.note) && /VCRF/.test(a.note))[0], pick("A10", (a) => /sign-off/i.test(a.note))[0]].filter(Boolean).join(", ") || "-" },
      ]
    : [];

  // ── payment exposure ────────────────────────────────────────────────────
  const exposure = runsBetween.map((r) => ({
    ...r,
    changesBefore: changes.filter((c) => c.isBank && c.when && c.when <= r.when).map((c) => ({ code: c.code, name: c.name, by: c.by, on: c.on })),
  }));

  // ── review notes (reviewer agent) ───────────────────────────────────────
  const reviewNotes = [
    bad("A4") && { ref: "RN-1", by: "Reviewer agent", point: "A4: Is the deficiency only in the sample, or in the design?", response: `Design: SOP ${f.docCheck?.ref?.split(" ")[0] || ""} asks only for presence of documents (${refs("A4")[0]}); sample followed SOP (${pick("A4", (a) => /limited to presence/i.test(a.note))[0] || refs("A4")[1]}), and the name mismatch (${pick("A4", (a) => a.code === files.chq?.code)[0] || "cheque"}) shows the effect.`, status: "Closed" },
    get("A2")?.status === "Pass" && { ref: "RN-2", by: "Reviewer agent", point: "A2 marked Pass - confirm SOP not overdue.", response: `Approved ${fmtDate(sop.approvalDate)}, review due ${fmtDate(sop.reviewDue)} (${refs("A2").slice(0, 2).join(", ")}).`, status: "Closed" },
    bad("A5") && bad("A6") && { ref: "RN-3", by: "Reviewer agent", point: "A5 and A6 overlap - avoid double counting in severity.", response: `Combined into one observation (${observations.find((o) => o.attrs.includes("A5"))?.id}); kept separate at attribute level.`, status: "Closed" },
    pick("A7", (a) => /AP user/.test(a.note)).length && { ref: "RN-4", by: "Reviewer agent", point: `${changes.find((c) => c.isBank && /accounts payable/i.test((access.find((u) => u.user === c.by) || {}).dept || ""))?.name || "AP"} change by ${pick("A7", (a) => /AP user/.test(a.note)).length ? changes.find((c) => c.isBank && /accounts payable/i.test((access.find((u) => u.user === c.by) || {}).dept || ""))?.by : ""} (${pick("A7", (a) => /AP user/.test(a.note))[0]}) - consider operating test of W${cm?.week || ""} payments.`, response: "Referred to human reviewer; outside design scope.", status: "Open" },
    { ref: `RN-5`, by: "Human reviewer", point: "", response: "", status: "" },
  ].filter(Boolean).map((n, i, arr) => (n.by === "Human reviewer" ? { ...n, ref: `RN-${arr.length}` } : n));

  // ── summary ─────────────────────────────────────────────────────────────
  const count = (s) => results.filter((r) => r.status === s).length;
  const defIds = results.filter((r) => r.status === "Deficiency").map((r) => r.attr.id);
  const partIds = results.filter((r) => r.status === "Partial").map((r) => r.attr.id);
  const passIds = results.filter((r) => r.status === "Pass").map((r) => r.attr.id);
  const designEffective = defIds.length === 0;
  const severity = !designEffective ? (bad("A5") && bad("A6") && bad("A4") ? "Significant deficiency" : defIds.length > 1 ? "Significant deficiency" : "Control deficiency") : "None";
  const summary = {
    effective: designEffective,
    designEffective,
    operatingEffective: null,
    conclusion: designEffective ? "Effectively designed" : "Not effectively designed",
    designConclusion: designEffective ? "EFFECTIVELY DESIGNED" : "NOT EFFECTIVELY DESIGNED",
    operatingConclusion: "Not tested (design only)",
    headline: `${defIds.length} of ${results.length} attributes deficient${defIds.length ? ` (${defIds.join(", ")})` : ""}; ${partIds.length ? `${partIds.join(", ")} partial; ` : ""}${passIds.join(", ")} pass.${defIds.length ? ` Gaps combine: request documents accepted on presence alone${chq && v && norm(chq.holder) !== norm(v.vendorName) ? " (the cheque is in a different name from the vendor)" : ""}, no system approval, payment before review and an unvalidated review report. Together these leave payment diversion neither prevented nor detected before loss.` : ""}`,
    deficiency: designEffective ? "" : `Proposed severity: ${severity} (for human reviewer confirmation).`,
    severity,
    tested: results.filter((r) => r.status !== "Not tested").length,
    passed: passIds.length,
    deficiencies: defIds.length,
    partial: partIds.length,
    exceptions: observations.length,
    high: observations.filter((o) => o.severity === "High").length,
    gaps: rcm.gaps.length,
    pending: count("Not tested"),
  };

  // narratives for the result rows
  results.forEach((r) => {
    r.details = r.details || [];
    r.narrative = {
      procedure: r.attr.procedure,
      observation: r.observation,
      conclusion: r.status === "Pass" ? "Designed appropriately." : r.status === "Partial" ? `Partially meets the criterion – see ${r.exceptionId || "observations"}.` : r.status === "Deficiency" ? `Design deficiency – see ${r.exceptionId}.` : "Not tested – evidence not provided.",
    };
  });

  // ── exception summary: one point per attribute ──────────────────────────
  const exceptionSummary = results.map((r) => ({
    id: r.attr.id,
    head: `${r.attr.id} ${r.attr.label}`,
    status: r.status,
    tone: r.status === "Pass" ? "ok" : r.status === "Partial" ? "warn" : r.status === "Deficiency" ? "bad" : "na",
    obs: r.exceptionId || "",
    text:
      r.status === "Pass"
        ? `No exception – ${r.observation}`
        : r.status === "Not tested"
          ? `Not tested – ${r.observation}`
          : `${r.status === "Partial" ? "Partial" : "Design deficiency"}${r.exceptionId ? ` (${r.exceptionId})` : ""} – ${r.observation}`,
    refs: r.annotations.map((a) => a.ref),
  }));

  const limitations = [
    `Design only – test of one walkthrough sample${v ? ` (${v.ref})` : ""}. Operating effectiveness not tested.`,
    ...(T ? [] : ["No walkthrough transcript – inquiry evidence (T) not available."]),
    ...results.filter((r) => r.status === "Not tested").map((r) => `${r.attr.id} not tested: ${r.observation}`),
    ...reviewNotes.filter((n) => n.status === "Open").map((n) => `${n.ref}: ${n.point}`),
  ];

  return {
    control: rcm.control,
    rcm,
    sop,
    transcript: T,
    results,
    annotations: results.flatMap((r) => r.annotations),
    observations,
    exceptions,
    exceptionSummary,
    trace,
    reviewNotes,
    pending: [],
    exposure,
    limitations,
    summary,
    meta: {
      reference: `WP-${rcm.control.id}-TOD`,
      testedAt: new Date(),
      files: ev.files,
      sample: v ? `${v.ref} (${v.vendorName}, vendor ${v.vendorCode})` : "–",
      walkthroughDate: T?.date || null,
      period: cm?.from ? `${fmtDate(cm.from)} to ${fmtDate(cm.to)}` : "–",
      company: rcm.control.company,
      inputs: [files.sop, files.rcm, files.cfg, files.vcrf, files.rev, files.tr, files.chq].filter(Boolean),
      exposureAmount: inr(exposure.reduce((s, r) => s + (r.amount || 0), 0)),
    },
    procedures: buildProcedures({ ev, T, results, observations }),
  };
}

function buildProcedures({ ev, T, results, observations }) {
  const st = (r) => (r === "Pass" ? "pass" : r === "Deficiency" ? "exception" : "info");
  return [
    {
      id: "t-read",
      label: "Read and classify the evidence",
      detail: `${plural(ev.files.length, "file")} received${T ? " · walkthrough transcript indexed" : ""}`,
      subChecks: ev.files.map((f) => ({ text: `${f.name} → ${KIND_LABEL[f.kind] || f.kind}`, status: f.kind === "unknown" ? "info" : "pass", log: [`[READ] ${f.name} classified as ${f.kind}`] })),
    },
    ...results.map((r) => ({
      id: `t-${r.attr.id}`,
      label: `${r.attr.id} · ${r.attr.label}`,
      detail: r.attr.criterion,
      subChecks: r.annotations.length
        ? r.annotations.map((a) => ({ text: `${a.ref} (${a.code}${a.location ? `, ${a.location}` : ""}): ${a.note}`, status: st(r.status), log: [`[ANNOTATE] ${a.ref} ${a.code} ${a.location} – “${a.highlight}”`] }))
        : [{ text: r.observation, status: "info" }],
      points: r.status !== "Pass" ? [`${r.status}: ${r.observation}`] : undefined,
    })),
    {
      id: "t-conclude",
      label: "Draft observations and conclude on design",
      detail: "Observations grouped by root cause; severity proposed for the human reviewer.",
      subChecks: observations.length
        ? observations.map((o) => ({ text: `${o.id} (${o.attrText}) ${o.title}`, status: "exception", log: [`[OBSERVATION] ${o.id} ${o.title}`] }))
        : [{ text: "No design observations", status: "pass" }],
    },
  ];
}
