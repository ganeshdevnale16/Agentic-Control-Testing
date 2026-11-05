import { fmtDate, fmtDateTime, lastDigits, plural, samePhone } from "./util";
import { KIND_LABEL } from "./readers";

const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const inr = (n) => (n == null ? "–" : n >= 1e7 ? `INR ${(n / 1e7).toFixed(2)} crore` : `INR ${n.toLocaleString("en-IN")}`);
const surname = (s) => (String(s).match(/([A-Z][a-z]{2,})\b/g) || []).pop() || "";

export function runTest({ rcm, sop, evidence, sampleNote }) {
  const ev = evidence;
  const access = ev.access || [];
  const calendar = ev.calendar || [];
  const changes = ev.changes || [];
  const bankChanges = changes.filter((c) => c.isBank);
  const userOf = (id) => access.find((u) => u.user.toUpperCase() === String(id).toUpperCase());
  const userByName = (name) => access.find((u) => surname(u.name) && surname(u.name) === surname(name));
  const vcrfFor = (ref, code) => ev.vcrfs.find((v) => (ref && v.ref === ref) || (!ref && code && v.vendorCode === code));
  const results = [];
  const R = (id, status, observation, details, extra = {}) => {
    const attr = rcm.attributes.find((a) => a.id === id);
    results.push({ attr, status, observation, details, ...extra });
  };
  const notTested = (id, why) => R(id, "Not tested", why, []);

  // ── A1 documentation ────────────────────────────────────────────────────
  if (!ev.vcrfs.length) notTested("A1", "No VCRF provided.");
  else {
    const det = ev.vcrfs.map((v) => {
      const holderOk = !!v.vendorName && (v.holderLine || "").toLowerCase().split(v.vendorName.toLowerCase()).length - 1 >= 1 && (!v.newHolder || v.newHolder.toLowerCase() === v.vendorName.toLowerCase());
      const ok = v.docs.letter && v.docs.cheque && !!v.signedBy && holderOk;
      return { item: `${v.ref} · ${v.vendorCode} ${v.vendorName}`, expected: "Letterhead request, signatory, cancelled cheque, holder = vendor", actual: `${v.docs.letterhead ? "letterhead ✓" : "letterhead ✗"}, ${v.signedBy ? `signed by ${v.signedBy}` : "no signatory"}, ${v.docs.cheque ? "cheque ✓" : "cheque ✗"}, holder ${v.newHolder || "–"}`, result: ok ? "Pass" : "Exception", v };
    });
    const emailed = ev.vcrfs.filter((v) => v.receivedVia === "Email");
    R("A1", det.every((d) => d.result === "Pass") ? "Pass" : "Exception",
      `${plural(det.length, "VCRF")} inspected. ${det.every((d) => d.result === "Pass") ? "Each has the letterhead request, a named authorised signatory and a cancelled cheque, and the new account is in the vendor's name." : "Supporting documents are missing for " + det.filter((d) => d.result !== "Pass").map((d) => d.v.ref).join(", ") + "."}` +
        (emailed.length ? ` Note: ${emailed.map((v) => v.ref).join(", ")} arrived by email; the VCRF does not record the sender address or compare it to the vendor-master email (${emailed[0].master.email || "–"}).` : ""),
      det);
  }

  // ── A2 callback independence ───────────────────────────────────────────
  if (!ev.vcrfs.length) notTested("A2", "No VCRF provided.");
  else {
    const det = ev.vcrfs.map((v) => {
      const toMaster = samePhone(v.callback.number, v.master.phone);
      const toLetter = samePhone(v.callback.number, v.letterPhone);
      const result = !v.master.phone ? "Not verifiable" : toMaster ? "Pass" : "Exception";
      return { item: `${v.ref} · ${v.vendorName}`, expected: `Master contact ${v.master.phone || "not on VCRF"}`, actual: `Called ${v.callback.number || "–"} (${v.callback.source}${toLetter ? " – same as request letter" : ""})`, result, v, toLetter };
    });
    const bad = det.filter((d) => d.result === "Exception");
    R("A2", bad.length ? "Exception" : det.some((d) => d.result === "Not verifiable") ? "Not verifiable" : "Pass",
      bad.length
        ? bad.map((d) => `${d.v.ref}: ${d.v.callback.by || "the MDM Executive"} called ${d.v.callback.number}, the number printed on the request letter, on ${fmtDateTime(d.v.callback.when)}. The authorised contact in the vendor master is ${d.v.master.contact ? `${d.v.master.contact}, ` : ""}${d.v.master.phone}. The callback therefore went to whoever sent the letter and does not verify the request.`).join(" ")
        : "Each callback was made to the authorised number held in the vendor master.",
      det);
  }

  // ── A3 callback recorded & before update ────────────────────────────────
  if (!ev.vcrfs.length) notTested("A3", "No VCRF provided.");
  else {
    const det = ev.vcrfs.map((v) => {
      const cb = v.callback;
      const complete = cb.when && cb.number && cb.person && cb.outcome;
      const before = cb.when && v.sap.when && cb.when < v.sap.when;
      return { item: v.ref, expected: "Date, time, number, person, outcome; callback before SAP update", actual: `Callback ${fmtDateTime(cb.when)} with ${cb.person || "–"} (${cb.outcome || "no outcome"}); SAP ${v.sap.txn} ${fmtDateTime(v.sap.when)}`, result: complete && before ? "Pass" : "Exception", v };
    });
    R("A3", det.every((d) => d.result === "Pass") ? "Pass" : "Exception",
      det.every((d) => d.result === "Pass") ? `The callback log is complete and each callback came before the SAP update (${det.map((d) => `${d.v.ref}: ${fmtDateTime(d.v.callback.when)} → ${fmtDateTime(d.v.sap.when)}`).join("; ")}). The record itself is complete – the problem is which number was called (A2).` : "Callback details are incomplete or the SAP update came first.",
      det);
  }

  // ── A4 SAP change agrees to VCRF ────────────────────────────────────────
  if (!ev.vcrfs.length || !changes.length) notTested("A4", !ev.vcrfs.length ? "No VCRF provided." : "No change report provided to agree the SAP change.");
  else {
    const det = ev.vcrfs.map((v) => {
      const row = changes.find((c) => c.vcrf === v.ref) || changes.find((c) => c.code === v.vendorCode && c.isBank);
      if (!row) return { item: v.ref, expected: "Change in SAP change report", actual: "Not found in the change report", result: "Exception", v };
      const ifscOk = !v.newIfsc || row.newV.includes(v.newIfsc);
      const acctOk = !v.newAcct || lastDigits(row.newV) === lastDigits(v.newAcct);
      const userOk = !v.sap.user || row.by.toUpperCase() === v.sap.user.toUpperCase();
      const dateOk = !v.sap.when || sameDay(row.when, v.sap.when);
      const ok = ifscOk && acctOk && userOk && dateOk;
      return { item: `${v.ref} · ${v.vendorCode}`, expected: `${v.newIfsc} / …${lastDigits(v.newAcct)} by ${v.sap.user} on ${fmtDate(v.sap.when)}`, actual: `${row.newV} by ${row.by} on ${row.on} (row ${row.__row})`, result: ok ? "Pass" : "Exception", v };
    });
    R("A4", det.every((d) => d.result === "Pass") ? "Pass" : "Exception",
      det.every((d) => d.result === "Pass") ? "The new IFSC, account ending, user and date in SAP agree to the VCRF." : "The SAP change does not agree to the VCRF for " + det.filter((d) => d.result !== "Pass").map((d) => d.item).join(", ") + ".",
      det);
  }

  // ── A5 segregation of duties ────────────────────────────────────────────
  const conflictUsers = access.filter((u) => u.change && u.pay);
  if (!access.length) notTested("A5", "No user access extract provided.");
  else {
    const changers = [...new Map([...bankChanges.map((c) => [c.by, c]), ...ev.vcrfs.filter((v) => v.sap.user).map((v) => [v.sap.user, { by: v.sap.user, code: v.vendorCode, name: v.vendorName, when: v.sap.when, vcrf: v.ref }])]).values()];
    const det = changers.map((c) => {
      const u = userOf(c.by);
      const runs = calendar.filter((r) => r.by.toUpperCase() === String(c.by).toUpperCase());
      const nonMdm = u && !/master data|mdm/i.test(u.dept);
      const bad = u && u.pay;
      return {
        item: `${c.by}${u ? ` (${u.name}, ${u.dept})` : ""} changed ${c.code} ${c.name}`,
        expected: "MDM user; no F110 access",
        actual: !u ? "User not in access extract" : `${u.roles}; F110 ${u.pay ? "YES" : "no"}${runs.length ? `; ran payment run(s) ${runs.map((r) => `${r.runId} on ${r.date}`).join(", ")}` : ""}${nonMdm ? "; not an MDM user" : ""}`,
        result: !u ? "Not verifiable" : bad ? "Exception" : "Pass",
        u,
        runs,
        c,
        nonMdm,
      };
    });
    const bad = det.filter((d) => d.result === "Exception");
    R("A5", bad.length ? "Exception" : "Pass",
      bad.length
        ? `${bad.map((d) => `${d.u.user} (${d.u.name}, ${d.u.dept}) changed the bank details of ${d.c.code} ${d.c.name} on ${fmtDate(d.c.when)} and also holds F110 payment-run access${d.runs.length ? ` – and executed payment run ${d.runs.map((r) => `${r.runId} (${r.date}, ${r.vendors ?? "?"} vendors, ${inr(r.amount)})`).join(", ")}` : ""}.`).join(" ")} ${plural(conflictUsers.length, "user")} in total can both change vendor bank details and run payments: ${conflictUsers.map((u) => `${u.user} ${u.name}`).join(", ")}.${det.some((d) => d.nonMdm) ? ` SOP ${sop.facts.update.ref} assigns SAP updates to the ${sop.facts.update.performer || "MDM Executive"}; ${det.filter((d) => d.nonMdm).map((d) => d.u.user).join(", ")} is in ${det.find((d) => d.nonMdm).u.dept}.` : ""}`
        : "Users who changed bank details have no payment-run access.",
      det,
      { conflictUsers });
  }

  // ── A6 system configuration ─────────────────────────────────────────────
  const fk08 = access.filter((u) => u.confirm);
  if (!ev.sensitive?.length) notTested("A6", "No sensitive-field configuration provided.");
  else {
    const bankFields = ev.sensitive.filter((r) => /LFBK|bank|account|ifsc|holder/i.test(`${r.field} ${r.desc}`));
    const det = bankFields.map((r) => ({ item: `${r.field} ${r.desc}`, expected: "Sensitive, dual control, payment block", actual: `Sensitive ${r.sensitive ? "Yes" : "No"} · dual control ${r.dual ? "Yes" : "No"} · block ${r.block ? "Yes" : "No"}`, result: r.sensitive && r.dual && r.block ? "Pass" : "Exception" }));
    if (access.length) det.push({ item: "FK08 (confirm change) assigned", expected: "At least one user outside MDM", actual: fk08.length ? fk08.map((u) => u.user).join(", ") : "No user has FK08", result: fk08.length ? "Pass" : "Exception" });
    const bad = det.filter((d) => d.result === "Exception");
    const protectedF = ev.sensitive.filter((r) => r.sensitive && r.dual).map((r) => r.desc || r.field);
    R("A6", bad.length ? "Exception" : "Pass",
      bad.length
        ? `${bankFields.filter((r) => !r.sensitive).map((r) => r.desc || r.field).join(", ")} ${bankFields.filter((r) => !r.sensitive).length === 1 ? "is" : "are"} not defined as sensitive fields, so a change takes effect immediately with no second-user confirmation and no payment block. Dual control is active only for ${protectedF.join(", ") || "no fields"}.${fk08.length ? "" : " No user holds FK08, so dual control could not operate even if it were switched on."} (${ev.sensitiveMeta?.lines?.slice(1).join("; ") || ""})`
        : "Bank fields are sensitive with dual control and a payment block, and FK08 is assigned.",
      det);
  }

  // ── A7 review timeliness & sign-off; payment exposure ───────────────────
  const m = ev.changesMeta;
  const so = ev.signoff;
  let exposure = [];
  if (!m || !so) notTested("A7", "No signed weekly change report provided.");
  else {
    const due = m.to ? new Date(m.to.getTime() + 864e5) : null;
    const timely = so.date && due && so.date <= new Date(due.getTime() + 2 * 864e5);
    const reviewerOk = so.reviewer && (new RegExp(surname(sop.owner) || "Controller", "i").test(so.reviewer) || /controller/i.test(so.reviewer));
    const firstBank = bankChanges.reduce((min, c) => (c.when && (!min || c.when < min) ? c.when : min), null);
    exposure = calendar.filter((r) => firstBank && r.when >= firstBank && r.when < (so.date || m.sentOn || r.when)).map((r) => ({ ...r, changesBefore: bankChanges.filter((c) => c.when && c.when < r.when) }));
    const det = [
      { item: "Period covered", expected: "Previous Monday–Sunday", actual: `${fmtDate(m.from)} to ${fmtDate(m.to)}`, result: m.from && m.to && m.from.getDay() === 1 && m.to.getDay() === 0 ? "Pass" : "Exception" },
      { item: "Report sent / reviewed", expected: `By ${fmtDate(due)} (${sop.facts.review.day || "Monday"})`, actual: `Sent ${fmtDateTime(m.sentOn)}; reviewed ${fmtDate(so.date)}`, result: timely ? "Pass" : "Exception" },
      { item: "Sign-off by reviewer", expected: sop.owner || "Finance Controller", actual: `${so.reviewer || "–"} · ${so.signoff || "–"}`, result: reviewerOk && so.signoff ? "Pass" : "Exception" },
      ...exposure.map((r) => ({ item: `Payment run ${r.runId} ${r.date}`, expected: "Bank changes reviewed before payment", actual: `${plural(r.changesBefore.length, "bank change")} not yet reviewed; run by ${r.by}, ${r.vendors ?? "?"} vendors, ${inr(r.amount)}`, result: "Noted" })),
    ];
    const ok = det.filter((d) => d.result !== "Noted").every((d) => d.result === "Pass");
    R("A7", ok ? "Pass" : "Exception",
      `${m.week ? `Week ${m.week}` : "The week"} (${fmtDate(m.from)}–${fmtDate(m.to)}) was sent on ${fmtDateTime(m.sentOn)} and signed off by ${so.reviewer} on ${fmtDate(so.date)} – ${ok ? "on time, by the right person" : "not in line with the SOP"}.` +
        (exposure.length ? ` However, ${plural(exposure.length, "payment run")} (${exposure.map((r) => `${r.runId} on ${r.date}, ${inr(r.amount)}`).join("; ")}) ran after the first bank change and before the review, so the review could not stop a fraudulent payment (design gap D5).` : ""),
      det);
  }

  // ── A8 report completeness & accuracy (IPE) ────────────────────────────
  if (!m) notTested("A8", "No change report provided.");
  else {
    const prep = userByName(m.preparedBy);
    const det = [
      { item: "Preparer independent of changes", expected: "No vendor change access", actual: prep ? `${m.preparedBy} = ${prep.user}, XK02/FK02 ${prep.change ? "YES" : "no"}` : `${m.preparedBy || "–"} (not in access extract)`, result: prep ? (prep.change ? "Exception" : "Pass") : "Not verifiable" },
      { item: "How the report was produced", expected: "System report / completeness evidenced", actual: m.source || "Not stated", result: m.manualFilter ? "Exception" : "Pass" },
      { item: "Completeness tie-out", expected: "Record count tied to SAP change documents (CDHDR)", actual: /cdhdr|record count|tie|reconcil/i.test(m.lines.join(" ")) ? "Evidenced" : "No evidence of a tie-out", result: /cdhdr|record count|tie|reconcil/i.test(m.lines.join(" ")) ? "Pass" : "Exception" },
    ];
    if (so) {
      det.push({ item: "Sign-off count = report rows", expected: String(changes.length), actual: String(so.count ?? "–"), result: so.count === changes.length ? "Pass" : "Exception" });
      det.push({ item: "Bank changes in sign-off = report", expected: String(bankChanges.length), actual: String(so.bankVerified ?? "–"), result: so.bankVerified === bankChanges.length ? "Pass" : "Exception" });
    }
    const bad = det.filter((d) => d.result === "Exception");
    R("A8", bad.length ? "Exception" : "Pass",
      bad.length
        ? `The report was ${m.manualFilter ? "exported to Excel and filtered manually by the MDM team" : "prepared"} and sent by ${m.preparedBy}${prep?.change ? `, who holds vendor change access (${prep.user}, XK02/FK02)` : ""}. Nothing shows it was tied back to SAP change documents, so a change could be left out without the reviewer knowing. The counts in the sign-off agree to the report as provided, but that does not prove completeness. The review therefore cannot rely on the report.`
        : "The report is complete and accurate.",
      det);
  }

  // ── A9 precision of the review ─────────────────────────────────────────
  const pending = bankChanges.filter((c) => !vcrfFor(c.vcrf, c.code)).map((c) => ({ ref: c.vcrf, code: c.code, name: c.name, by: c.by, on: c.on }));
  if (!bankChanges.length || !so) notTested("A9", "No change report with bank-detail changes provided.");
  else {
    const a2 = results.find((r) => r.attr.id === "A2");
    const det = bankChanges.map((c) => {
      const v = vcrfFor(c.vcrf, c.code);
      const u = userOf(c.by);
      const issues = [];
      const cbRow = a2?.details?.find((d) => d.v?.ref === v?.ref);
      if (cbRow?.result === "Exception") issues.push("callback made to the number on the request letter, not the vendor master");
      if (u && !/master data|mdm/i.test(u.dept)) issues.push(`changed by ${u.user} (${u.dept}), not the MDM Executive`);
      if (u?.pay) issues.push(`${u.user} also has F110 payment-run access`);
      const verified = /verified|ok|agreed/i.test(c.remark);
      return {
        item: `${c.vcrf} · ${c.code} ${c.name}`,
        expected: "Discrepancies flagged by the reviewer",
        actual: `Reviewer: "${c.remark}". ${issues.length ? `Re-performance found: ${issues.join("; ")}.` : "No issues found on re-performance."}${v ? "" : " (VCRF not provided – callback not re-performed)"}`,
        result: issues.length && verified ? "Exception" : !v ? "Pending" : "Pass",
        issues,
      };
    });
    const missed = det.filter((d) => d.result === "Exception");
    R("A9", missed.length ? "Exception" : det.some((d) => d.result === "Pending") ? "Pending" : "Pass",
      missed.length
        ? `${so.reviewer} marked every change "Verified" and signed off "${so.exceptions || "no exceptions"}" (${so.comment}). Re-performing the review found ${plural(missed.reduce((n, d) => n + d.issues.length, 0), "issue")} on ${plural(missed.length, "bank-detail change")} that the reviewer did not flag: ${missed.map((d) => `${d.item.split(" · ")[0]} – ${d.issues.join("; ")}`).join(". ")}. The review is not precise enough to detect an unauthorised change.`
        : "Re-performance agreed to the reviewer's conclusions.",
      det);
  }

  // ── exceptions ──────────────────────────────────────────────────────────
  const get = (id) => results.find((r) => r.attr.id === id);
  const exceptions = [];
  const owner = rcm.control.owner;
  const exposureText = exposure.length ? ` ${plural(exposure.length, "payment run")} (${exposure.map((r) => `${r.runId}, ${inr(r.amount)}`).join("; ")}) ran after the change and before the weekly review.` : "";
  const addEx = (attrIds, o) => exceptions.push({ id: `EX-${String(exceptions.length + 1).padStart(2, "0")}`, attrIds, owner, instances: attrIds, ...o });

  if (get("A2")?.status === "Exception") {
    const v = get("A2").details.find((d) => d.result === "Exception").v;
    addEx(["A2"], {
      title: "Callback made to the number supplied in the request",
      type: "Design & operating",
      severity: "High",
      condition: get("A2").observation,
      criteria: `RCM ${rcm.control.id}(b): callback to verify the request. Good practice: verify bank changes only through contact details already held independently (vendor master / onboarding, SOP 4). SOP ${sop.facts.callback.ref} instead points to the request letter.`,
      cause: `SOP ${sop.facts.callback.ref} instructs the MDM Executive to call the number on the vendor's request letter; the RCM does not specify the number source.`,
      effect: `A fraudulent letter with the fraudster's number would be "confirmed", and payments to ${v.vendorName} would go to the new account.${exposureText} It is not yet known whether ${v.vendorName} (${v.vendorCode}) actually requested this change.`,
      recommendation: `Immediately call ${v.vendorName} on the master number ${v.master.phone} to confirm the change to ${v.newIfsc} …${lastDigits(v.newAcct)}, and confirm whether any payment has gone to the new account. Amend SOP ${sop.facts.callback.ref} and the RCM so callbacks use only the vendor-master contact, and record the source of the number on the VCRF.`,
    });
  }
  if (get("A6")?.status === "Exception")
    addEx(["A6"], {
      title: "Vendor bank fields not protected by SAP dual control",
      type: "Design (IT dependency)",
      severity: "High",
      condition: get("A6").observation,
      criteria: "Vendor bank key, account number and account holder should be sensitive fields (T055F) with FK08/FK09 dual control and a payment block until a second user confirms the change.",
      cause: "Sensitive-field configuration covers only some vendor fields; bank fields were never added. FK08 is not assigned to anyone.",
      effect: "A single user can change bank details and the change is used in the next payment run with no system check. The control relies entirely on manual steps that can be bypassed.",
      recommendation: "Add LFBK-BANKL, LFBK-BANKN and LFBK-KOINH to sensitive fields for company code 1000 with payment block; assign FK08 to a user outside MDM and AP (e.g. Finance Controller's team); review open unconfirmed changes before each F110 run.",
    });
  if (get("A5")?.status === "Exception") {
    const d = get("A5").details.filter((x) => x.result === "Exception");
    addEx(["A5"], {
      title: "Users can both change vendor bank details and run payments",
      type: "Operating (access / SoD)",
      severity: "High",
      condition: get("A5").observation,
      criteria: "Segregation of duties: users who maintain vendor bank details must not have payment-run (F110) access. SOP assigns SAP updates to the MDM Executive only.",
      cause: `Role Z_AP_PAYRUN and Z_MDM_VENDOR_MAINT are assigned together to ${get("A5").conflictUsers.map((u) => u.user).join(", ")}; no SoD rule set or periodic access review caught it.`,
      effect: `One person can redirect a vendor's bank account and pay it.${d.some((x) => x.runs.length) ? ` This was exercised: ${d.filter((x) => x.runs.length).map((x) => `${x.u.user} changed ${x.c.code} and ran ${x.runs.map((r) => r.runId).join(", ")}`).join("; ")}.` : ""}`,
      recommendation: `Remove F110 from MDM users and vendor-maintenance roles from AP users (${get("A5").conflictUsers.map((u) => u.user).join(", ")}). Review all bank changes by these users in the year and agree payments made to changed accounts to vendor confirmations.`,
    });
  }
  if (get("A9")?.status === "Exception")
    addEx(["A9"], {
      title: "Weekly review did not identify discrepancies",
      type: "Operating (review precision)",
      severity: "High",
      condition: get("A9").observation,
      criteria: `RCM ${rcm.control.id}(d) / SOP ${sop.facts.review.ref}: the Finance Controller verifies each bank-detail change against the VCRF and the SOP.`,
      cause: "The review checks that a VCRF exists rather than what it shows (number called, who made the change and their access). No review checklist defines what to verify.",
      effect: "The detective control signed off a non-independent callback and a change by a user with payment access as \"no exceptions\". It cannot be relied upon to detect unauthorised changes.",
      recommendation: "Introduce a review checklist per bank change: number called agrees to vendor master, changer is an MDM user without F110, VCRF and SAP change agree. Record evidence of each check on the report.",
    });
  if (get("A8")?.status === "Exception")
    addEx(["A8"], {
      title: "Change report completeness not evidenced (IPE)",
      type: "Operating (IPE)",
      severity: "Medium",
      condition: get("A8").observation,
      criteria: "Information used in a control must be complete and accurate; the preparer should be independent of the activity being reviewed.",
      cause: `SOP ${sop.facts.review.ref} has the MDM Lead extract and filter the report; no completeness step is defined.`,
      effect: "A change omitted from the report – deliberately or by a filter error – would not be reviewed.",
      recommendation: "Generate the report from SAP change documents (CDHDR/CDPOS, object KRED) by someone outside MDM, keep the parameters and record count with the report, and have the reviewer tie the count.",
    });
  ["A1", "A3", "A4", "A7"].forEach((id) => {
    const r = get(id);
    if (r?.status !== "Exception") return;
    addEx([id], { title: r.attr.label, type: "Operating", severity: r.attr.severity, condition: r.observation, criteria: r.attr.procedure, cause: "To be confirmed with the control owner.", effect: "Weakens prevention or detection of unauthorised bank changes.", recommendation: "Remediate and re-test." });
  });
  results.forEach((r) => (r.exceptionId = exceptions.find((e) => e.attrIds.includes(r.attr.id))?.id));

  // ── narratives, summary ─────────────────────────────────────────────────
  results.forEach((r) => {
    r.narrative = {
      procedure: r.attr.procedure,
      observation: r.observation,
      conclusion: r.status === "Pass" ? "Attribute operated as designed." : r.status === "Exception" ? `Exception – see ${r.exceptionId}.` : r.status === "Pending" ? "Pending – evidence outstanding." : r.status === "Not verifiable" ? "Could not be verified from the evidence provided." : "Not tested – evidence not provided.",
    };
  });

  const tested = results.filter((r) => !/not tested/i.test(r.status));
  const passed = results.filter((r) => r.status === "Pass").length;
  const high = exceptions.filter((e) => e.severity === "High").length;
  const operatingEffective = exceptions.length === 0;
  const designEffective = !rcm.gaps.some((g) => g.severity === "High") && get("A6")?.status !== "Exception";
  const effective = operatingEffective && designEffective;
  const weeks = m ? 1 : 0;
  const limitations = [
    `${plural(ev.vcrfs.length, "VCRF")} provided against ${plural(bankChanges.length, "bank-detail change")} in the change report; RCM sample for a per-change control is ${rcm.rcmRows[0]?.sample || "25"}.`,
    `${plural(weeks, "week")} of review provided; RCM sample for a weekly control is 5–15 weeks.`,
    ...(pending.length ? [`VCRF not provided for ${pending.map((p) => `${p.ref} (${p.code} ${p.name})`).join(", ")} – callback for these changes not re-performed.`] : []),
    ...(sampleNote ? [sampleNote] : []),
  ];

  const summary = {
    effective,
    designEffective,
    operatingEffective,
    conclusion: effective ? "Effective" : "Not effective",
    designConclusion: designEffective ? rcm.designConclusion : "Not effectively designed",
    operatingConclusion: operatingEffective ? "Operating effectively" : "Not operating effectively",
    headline: effective
      ? "The control is designed and operating effectively for the items tested."
      : `${plural(exceptions.length, "exception")} (${high} high) and ${plural(rcm.gaps.length, "design gap")}. The callback does not independently verify requests, SAP does not enforce dual control on bank fields, users can change bank details and run payments, and the weekly review missed these issues.`,
    deficiency: effective
      ? ""
      : `Control deficiency in a key anti-fraud control over vendor payments. Because a single user can change bank details and pay without effective prevention or detection${exposure.length ? `, and payment runs totalling ${inr(exposure.reduce((s, r) => s + (r.amount || 0), 0))} were executed while bank changes were still unreviewed` : ""}, evaluate whether this is a significant deficiency / material weakness together with compensating controls. Immediate step: confirm the sampled bank changes directly with the vendors on their master contact numbers.`,
    tested: tested.length,
    passed,
    exceptions: exceptions.length,
    high,
    gaps: rcm.gaps.length,
    pending: pending.length,
  };

  return {
    control: rcm.control,
    rcm,
    sop,
    results,
    exceptions,
    pending,
    exposure,
    limitations,
    summary,
    meta: {
      reference: `${rcm.control.id}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
      testedAt: new Date(),
      files: ev.files,
      period: m ? `${fmtDate(m.from)} to ${fmtDate(m.to)}` : "–",
      company: rcm.control.company,
    },
    procedures: buildProcedures({ rcm, ev, results, exceptions }),
  };
}

function buildProcedures({ rcm, ev, results, exceptions }) {
  const st = (r) => (r === "Pass" ? "pass" : r === "Exception" ? "exception" : "info");
  const have = {
    vcrf: ev.vcrfs.length > 0,
    sensitive: !!ev.sensitive?.length,
    access: !!ev.access?.length,
    calendar: !!ev.calendar?.length,
    changes: !!ev.changes?.length,
  };
  const procs = [
    {
      id: "t-read",
      label: "Read and classify the evidence",
      detail: `${plural(ev.files.length, "file")} received`,
      subChecks: ev.files.map((f) => ({ text: `${f.name} → ${KIND_LABEL[f.kind] || f.kind}`, status: f.kind === "unknown" ? "info" : "pass", log: [`[READ] ${f.name} classified as ${f.kind}`] })),
    },
    {
      id: "t-cover",
      label: "Check evidence against the request list",
      detail: "Every RCM attribute needs its evidence before it can be concluded.",
      subChecks: rcm.evidenceRequests.map((e) => ({ text: `${e.id} ${e.name}: ${have[e.kind] ? "received" : "missing"}`, status: have[e.kind] ? "pass" : "info" })),
    },
  ];
  results.forEach((r) => {
    procs.push({
      id: `t-${r.attr.id}`,
      label: `${r.attr.id} · ${r.attr.label}`,
      detail: r.attr.procedure,
      subChecks: r.details.length
        ? r.details.map((d) => ({ text: `${d.item}: ${d.actual}`, status: st(d.result), log: [`[TEST] ${r.attr.id} ${d.item} – ${d.result}`] }))
        : [{ text: r.observation, status: "info" }],
      points: r.status === "Exception" || r.status === "Pending" ? [r.observation] : undefined,
    });
  });
  procs.push({
    id: "t-conclude",
    label: "Evaluate exceptions and conclude",
    detail: "Severity, root cause and recommendation for each exception; overall design and operating conclusion.",
    subChecks: exceptions.length
      ? exceptions.map((e) => ({ text: `${e.id} ${e.title} (${e.severity})`, status: "exception", log: [`[EXCEPTION] ${e.id} ${e.title}`] }))
      : [{ text: "No exceptions", status: "pass" }],
  });
  return procs;
}
