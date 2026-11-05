import { fmtDate, plural } from "./util";

// Sample sizes by control frequency (common audit guidance)
export const SAMPLE_GUIDE = [
  { re: /annual/i, freq: "Annual", size: "1" },
  { re: /quarter/i, freq: "Quarterly", size: "2" },
  { re: /month/i, freq: "Monthly", size: "2–5" },
  { re: /week/i, freq: "Weekly", size: "5–15" },
  { re: /daily/i, freq: "Daily", size: "20–40" },
  { re: /per change|per transaction|as required|ad hoc|event|recurring|multiple/i, freq: "Per occurrence", size: "25 (all if fewer than 25)" },
];
export const sampleFor = (freq) => (SAMPLE_GUIDE.find((g) => g.re.test(freq || "")) || { size: "Per judgement" }).size;

const KIND_TESTS = [
  ["review", /review|sign[s-]? ?off/i],
  ["request", /request|letterhead|VCRF|cheque/i],
  ["callback", /verif\w+ (the )?request|confirm/i],
  ["update", /SAP|XK02|FK02|update|change is made|maintain/i],
];
const kindOf = (text) => {
  // Callback beats request when both appear ("performs a callback to verify the request")
  if (/call ?back/i.test(text)) return "callback";
  return (KIND_TESTS.find(([, re]) => re.test(text)) || ["other"])[0];
};

const ACTIVITY_DEFAULT = {
  request: { name: "Change request & documentation", type: "Preventive", frequency: "Per change" },
  callback: { name: "Independent callback verification", type: "Preventive", frequency: "Per change" },
  update: { name: "Bank-detail update in SAP", type: "Preventive", frequency: "Per change" },
  review: { name: "Weekly review of sensitive-field changes", type: "Detective", frequency: "Weekly" },
  other: { name: "Control activity", type: "", frequency: "" },
};

// Build the RCM, the design assessment and the test plan.
export function buildRcm({ sop, wt, today = new Date() }) {
  const f = sop.facts;
  const ctl = wt?.controls?.[0];
  const controlId = ctl?.controlId || "P2P-04";
  const owner = ctl?.owner || sop.owner || "Process owner";
  const roleOf = (k) => ({ request: f.vcrf.preparer, callback: f.callback.performer, update: f.update.performer, review: f.review.reviewer })[k] || "";
  const sopRef = (k) => ({ request: [f.request.ref, f.vcrf.ref].filter(Boolean).join(", "), callback: f.callback.ref, update: f.update.ref, review: f.review.ref ? `${f.review.ref} Weekly review` : "" })[k] || "";

  // ── activities: from the walkthrough RCM if given, otherwise from the SOP
  let acts = ctl?.activities?.length
    ? ctl.activities.map((a) => ({ letter: a.letter, text: a.text, kind: kindOf(a.text), type: a.type, frequency: a.frequency, fromWalkthrough: true }))
    : [
        f.request.ref && { letter: "a", kind: "request", text: "Vendor bank-detail changes are raised on a VCRF with the vendor's request letter and cancelled cheque." },
        f.callback.ref && { letter: "b", kind: "callback", text: "A callback is performed to verify the request and recorded on the VCRF." },
        f.update.ref && { letter: "c", kind: "update", text: `The change is made in SAP (${f.update.txn || "XK02"}).` },
        f.review.ref && { letter: "d", kind: "review", text: "The sensitive-field change report is reviewed and signed off." },
      ].filter(Boolean);
  acts = acts.map((a) => ({
    ...a,
    id: `${controlId}.${a.letter}`,
    name: ACTIVITY_DEFAULT[a.kind].name,
    type: (a.type && a.type.replace(/\s*\(.*\)/, "")) || ACTIVITY_DEFAULT[a.kind].type,
    frequency: (a.frequency && a.frequency.replace(/\s*\(.*\)/, "")) || ACTIVITY_DEFAULT[a.kind].frequency,
    performer: roleOf(a.kind),
    sopRef: sopRef(a.kind),
  }));

  // ── walkthrough ↔ SOP consistency ───────────────────────────────────────
  const consistency = [];
  const add = (check, ok, detail, status) => consistency.push({ check, result: status || (ok ? "Agrees" : "Differs"), detail });
  if (ctl) {
    const ownerName = (s) => (String(s).match(/[A-Z]\.\s?[A-Z][a-z]+/) || [String(s)])[0];
    add("Control owner", ownerName(ctl.owner) === ownerName(sop.owner), `RCM: ${ctl.owner || "–"} · SOP: ${sop.owner || "–"}`);
    acts.forEach((a) => add(`Activity (${a.letter}) covered by SOP`, !!a.sopRef, a.sopRef ? `SOP ${a.sopRef}` : "No SOP clause describes this activity"));
    if (f.update.txn) add("SAP transaction", new RegExp(f.update.txn).test(ctl.controlDesc), `SOP: ${f.update.txn} · RCM: ${(ctl.controlDesc.match(/\b(XK02|FK02|BP)\b/) || ["not stated"])[0]}`);
    const rev = acts.find((a) => a.kind === "review");
    if (rev && f.review.frequency) add("Review frequency", new RegExp(f.review.frequency, "i").test(rev.frequency), `RCM: ${rev.frequency} · SOP: ${f.review.frequency}${f.review.day ? ` (${f.review.day})` : ""}`);
    if (f.callback.ref) {
      const rcmSilent = !/(vendor master|independent|on file|onboarding)/i.test(ctl.controlDesc);
      add("Callback number source", !rcmSilent, rcmSilent ? "RCM does not say which number to call; SOP points to the request letter" : "RCM specifies an independent source", rcmSilent ? "Gap" : undefined);
    }
  } else add("Walkthrough", true, "Narrative walkthrough received – activities taken from the SOP", "Noted");

  // ── design assessment ───────────────────────────────────────────────────
  const design = [];
  const D = (id, area, status, severity, observation, recommendation, ref) => design.push({ id, area, status, severity, observation, recommendation, ref });
  const current = sop.reviewDue ? sop.reviewDue >= today : null;
  D("D1", "SOP approval and currency", sop.approvedBy && current !== false ? "Adequate" : "Gap", sop.approvedBy && current !== false ? "–" : "Low",
    `${sop.docId || "SOP"} v${sop.version || "?"} approved by ${sop.approvedBy || "–"} on ${fmtDate(sop.approvalDate)}; next review ${fmtDate(sop.reviewDue)}${current === false ? " – overdue" : ""}.`,
    current === false ? "Re-approve the SOP and confirm it reflects current practice." : "–", "Header");
  D("D2", "Request documentation", f.request.letterhead && f.request.cheque && f.request.signatory ? "Adequate" : "Gap", f.request.letterhead && f.request.cheque ? "–" : "Medium",
    `Requires ${[f.request.letterhead && "letterhead request", f.request.signatory && "authorised signatory", f.request.cheque && "cancelled cheque of the new account"].filter(Boolean).join(", ") || "no supporting documents"}.`,
    f.request.letterhead && f.request.cheque ? "–" : "Require a signed letterhead request and cancelled cheque for every bank change.", f.request.ref);
  const cbOk = f.callback.source === "master";
  D("D3", "Independence of the callback", cbOk ? "Adequate" : "Gap", cbOk ? "–" : "High",
    f.callback.source === "letter"
      ? `SOP ${f.callback.ref} tells the MDM Executive to call the number written on the vendor's request letter. A fraudster who sends a fake letter will also supply the number, so the callback reaches the fraudster and confirms the change. The authorised number captured at onboarding (SOP 4) is not used.`
      : f.callback.source === "unspecified"
      ? `SOP ${f.callback.ref || "–"} does not say which number to call.`
      : `SOP ${f.callback.ref} requires the callback to an independently held number.`,
    cbOk ? "–" : "Amend the SOP so the callback is made only to the authorised contact held in the vendor master (onboarding record), never to a number supplied in the request.", f.callback.ref);
  const sameRole = f.callback.performer && f.callback.performer === f.update.performer;
  const makerChecker = f.independentApproval;
  D("D4", "Maker-checker before the change takes effect", makerChecker ? "Adequate" : "Gap", makerChecker ? "–" : "High",
    makerChecker
      ? "SOP requires an independent approval / confirmation before the change is effective."
      : `${sameRole ? `The ${f.callback.performer} prepares the VCRF, performs the callback and updates SAP` : "One person can complete the change end to end"}; no second person approves the change before it can be used in a payment run. The only independent check is the weekly review after the event.`,
    makerChecker ? "–" : "Require a second user to confirm the change in SAP (sensitive fields + FK08 dual control) before it is used for payment.", [f.callback.ref, f.update.ref].filter(Boolean).join(", "));
  const timingGap = /week/i.test(f.review.frequency) && f.paymentDays;
  D("D5", "Timing of the detective review", timingGap ? "Gap" : "Adequate", timingGap ? "Medium" : "–",
    timingGap
      ? `The review runs ${f.review.day ? `every ${f.review.day}` : "weekly"} for the previous week, but payment runs happen on ${f.paymentDays}. A fraudulent change can be paid out before anyone reviews it.`
      : "Review timing is aligned to payment processing.",
    timingGap ? "Block payments to vendors with unconfirmed bank changes until confirmed, or review bank changes before each payment run." : "–", f.review.ref);
  const ipeGap = !f.review.completeness;
  D("D6", "Reliability of the change report (IPE)", ipeGap ? "Gap" : "Adequate", ipeGap ? "Medium" : "–",
    ipeGap
      ? `The ${f.review.preparer || "preparer"} extracts the report${f.review.toExcel ? " to Excel" : ""}. The MDM team whose changes are being reviewed prepares it, and the SOP has no step to confirm the report is complete (e.g. tie to SAP change documents CDHDR/CDPOS).`
      : "SOP requires completeness checks on the change report.",
    ipeGap ? "Have the report generated by someone outside MDM (or a locked system report) and tie the record count to SAP change documents before review." : "–", f.review.ref);
  D("D7", "Exception handling", f.exceptions.vague || !f.exceptions.text ? "Gap" : "Adequate", f.exceptions.vague || !f.exceptions.text ? "Low" : "–",
    f.exceptions.text ? `SOP ${f.exceptions.ref}: discrepancies are reported "for necessary action" – no escalation path, timeline, payment hold or vendor contact.` : "SOP has no exception-handling step.",
    f.exceptions.vague || !f.exceptions.text ? "Define escalation (CFO), payment hold, confirmation with the vendor via the master contact, and a closure timeline." : "–", f.exceptions.ref);
  D("D8", "Record retention", f.retentionYears >= 8 ? "Adequate" : "Gap", f.retentionYears >= 8 ? "–" : "Low",
    f.retentionYears ? `VCRFs and signed reviews retained for ${f.retentionYears} years.` : "No retention period stated.",
    f.retentionYears >= 8 ? "–" : "Retain records for at least 8 years (Companies Act, 2013 s.128).", f.retentionRef);
  D("D9", "System enforcement (IT dependency)", "To test", "–",
    "The control relies on SAP: bank fields should be sensitive fields with dual control (FK08/FK09) and a payment block until confirmed, and change access should be restricted. The SOP does not mention this – tested with the configuration and access evidence.",
    "–", "–");

  const gaps = design.filter((d) => d.status === "Gap");
  const designConclusion = gaps.some((g) => g.severity === "High") ? "Not effectively designed" : gaps.length ? "Effectively designed – with improvement points" : "Effectively designed";

  // ── test attributes (the test plan) ─────────────────────────────────────
  const attributes = [
    { id: "A1", act: "request", label: "Change supported by VCRF, signed letterhead request and cancelled cheque", procedure: "Inspect the VCRF for the request letter (letterhead, authorised signatory) and a cancelled cheque of the new account; agree the account holder name to the vendor name.", evidence: ["E1"], severity: "Medium" },
    { id: "A2", act: "callback", label: "Callback made to the authorised number held in the vendor master", procedure: "Agree the number called on the VCRF to the authorised contact in the vendor master (onboarding record), not to the number on the request.", evidence: ["E1"], severity: "High" },
    { id: "A3", act: "callback", label: "Callback recorded in full and completed before the SAP update", procedure: "Check the callback record has date, time, number, person and outcome, and that it precedes the SAP change time.", evidence: ["E1"], severity: "Medium" },
    { id: "A4", act: "update", label: "SAP change agrees to the approved VCRF", procedure: "Agree the bank key / account and user and date of the SAP change (change document / change report) to the VCRF.", evidence: ["E1", "E5"], severity: "High" },
    { id: "A5", act: "update", label: "Change made by authorised MDM user without payment-run access (SoD)", procedure: "For every bank-detail change, check the user's role and whether the same user can run F110 – and whether they actually ran a payment run.", evidence: ["E3", "E4", "E5"], severity: "High" },
    { id: "A6", act: "it", label: "SAP enforces dual control on vendor bank fields", procedure: "Inspect T055F sensitive-field configuration: bank key, account number and holder must be sensitive with FK08 dual control and a payment block; check FK08 is assigned to someone outside MDM.", evidence: ["E2", "E3"], severity: "High" },
    { id: "A7", act: "review", label: "Weekly review performed on time and signed off by the Finance Controller", procedure: "Check the review covers the full prior week, was sent and signed off by the reviewer, and when it happened relative to payment runs.", evidence: ["E5", "E4"], severity: "Medium" },
    { id: "A8", act: "review", label: "Change report complete and accurate (IPE)", procedure: "Assess who prepared the report and whether completeness was evidenced; agree counts in the sign-off to the report.", evidence: ["E5", "E3"], severity: "Medium" },
    { id: "A9", act: "review", label: "Reviewer identified the discrepancies in the changes reviewed", procedure: "Re-perform the review for bank-detail changes: compare each to its VCRF and the SOP, and check whether the reviewer flagged what we found.", evidence: ["E5", "E1", "E3"], severity: "High" },
  ].map((a) => ({ ...a, activity: acts.find((x) => x.kind === a.act)?.id || `${controlId} (IT dependency)` }));

  const evidenceRequests = [
    { id: "E1", name: "VCRF with request letter, cancelled cheque and callback log", kind: "vcrf", for: "A1–A4, A9", note: "One per sampled bank change" },
    { id: "E2", name: "SAP sensitive-field configuration (T055F / dual control)", kind: "sensitive", for: "A6", note: "Extract by SAP Basis" },
    { id: "E3", name: "SAP user access extract (SUIM) – XK02/FK02, F110, FK08", kind: "access", for: "A5, A6, A8, A9", note: "Finance users" },
    { id: "E4", name: "F110 payment run calendar / log", kind: "calendar", for: "A5, A7", note: "Period under review" },
    { id: "E5", name: "Weekly sensitive-field change report with sign-off", kind: "changes", for: "A4, A5, A7–A9", note: "One per sampled week" },
  ];

  // ── RCM rows ────────────────────────────────────────────────────────────
  const riskId = ctl?.riskId || "R-P2P-02";
  const riskDesc = ctl?.riskDesc || "Unauthorised or fraudulent change to vendor bank details diverts payments.";
  const rcmRows = [
    ...acts.map((a) => ({
      process: wt?.meta?.process || "Procure-to-Pay",
      subProcess: wt?.meta?.subProcess || "Vendor Master Maintenance",
      riskId,
      riskDesc,
      controlId: a.id,
      activity: a.name,
      description: a.text,
      type: a.type,
      nature: a.kind === "update" || a.kind === "review" ? "IT-dependent manual" : "Manual",
      frequency: a.frequency,
      performer: a.performer || "–",
      owner,
      assertion: ctl?.assertion || "Occurrence / Existence",
      sopRef: a.sopRef || "–",
      attributes: attributes.filter((x) => x.act === a.kind).map((x) => x.id).join(", "),
      sample: sampleFor(a.frequency),
      design: designFor(a.kind, design),
    })),
    {
      process: wt?.meta?.process || "Procure-to-Pay",
      subProcess: wt?.meta?.subProcess || "Vendor Master Maintenance",
      riskId,
      riskDesc,
      controlId: `${controlId}.IT`,
      activity: "SAP sensitive-field dual control & change access (IT dependency)",
      description: "Vendor bank fields are configured as sensitive (T055F) so changes need confirmation by a second user (FK08) and payments are blocked until confirmed; XK02/FK02 access is restricted and segregated from F110.",
      type: "Preventive",
      nature: "Automated / ITGC",
      frequency: "Continuous",
      performer: "SAP Basis / IT Security",
      owner,
      assertion: "Safeguarding of assets",
      sopRef: "Not in SOP",
      attributes: "A5, A6",
      sample: "Test of one + access listing",
      design: "To test",
    },
  ];

  const control = {
    id: controlId,
    name: ctl ? `${ctl.controlId} – Vendor bank-detail change` : "Vendor bank-detail change",
    riskId,
    riskDesc,
    description: ctl?.controlDesc || acts.map((a) => `(${a.letter}) ${a.text}`).join(" "),
    owner,
    type: ctl?.type || "Preventive / Detective",
    nature: ctl?.nature || "Manual",
    frequency: ctl?.frequency || "Per change; Weekly",
    assertion: ctl?.assertion || "Occurrence / Existence",
    company: sop.company || wt?.meta?.company || "",
    process: wt?.meta?.process || "Procure-to-Pay",
    subProcess: wt?.meta?.subProcess || "Vendor Master Maintenance",
  };

  return { control, activities: acts, consistency, design, gaps, designConclusion, attributes, evidenceRequests, rcmRows, procedures: buildProcedures({ sop, wt, acts, consistency, design, attributes, evidenceRequests, today }) };
}

function designFor(kind, design) {
  const map = { request: ["D2"], callback: ["D3", "D4"], update: ["D4"], review: ["D5", "D6", "D7"] };
  const g = design.filter((d) => (map[kind] || []).includes(d.id) && d.status === "Gap");
  return g.length ? `Gap – ${g.map((x) => x.id).join(", ")}` : "Adequate";
}

// Steps shown in the live checklist while the RCM is being built
function buildProcedures({ sop, wt, acts, consistency, design, attributes, evidenceRequests, today }) {
  const f = sop.facts;
  const s = (text, status = "pass", log) => ({ text, status, log: log ? [log] : undefined });
  const procs = [];
  procs.push({
    id: "p-sop",
    label: "Read the SOP",
    detail: `${sop.name} – ${sop.title}`,
    subChecks: [
      s(`Identified ${sop.docId || "SOP"} version ${sop.version || "?"}, approved by ${sop.approvedBy || "–"}`, sop.approvedBy ? "pass" : "info", `[READ] ${sop.name}: ${sop.sections.length} sections`),
      s(`Approval ${fmtDate(sop.approvalDate)}; next review ${fmtDate(sop.reviewDue)}`, sop.reviewDue && sop.reviewDue < today ? "exception" : "pass"),
      s(`Roles defined: ${sop.roles.map((r) => r.role).join(", ") || "none found"}`, sop.roles.length ? "pass" : "info"),
      s(`Process owner: ${sop.owner || "not stated"}`, sop.owner ? "pass" : "info"),
      s(`Bank-change procedure found in clauses ${[f.request.ref, f.vcrf.ref, f.callback.ref, f.update.ref].filter(Boolean).map((r) => r.split(" ")[0]).join(", ")}`),
    ],
    points: [`${plural(sop.sections.length, "section")} read; ${plural(sop.roles.length, "role")} identified.`],
  });
  procs.push({
    id: "p-wt",
    label: "Read the walkthrough / existing RCM",
    detail: wt ? `${wt.name}${wt.sheet ? ` › ${wt.sheet}` : ""}` : "No walkthrough file – activities taken from the SOP",
    subChecks: wt?.controls?.length
      ? [
          s(`Risk ${wt.controls[0].riskId}: ${wt.controls[0].riskDesc}`, "pass", `[READ] ${wt.name}: ${wt.controls.length} control(s)`),
          s(`Control ${wt.controls[0].controlId} owned by ${wt.controls[0].owner}`),
          s(`Split the control into ${plural(acts.length, "activity", "activities")}: ${acts.map((a) => `(${a.letter}) ${a.name}`).join("; ")}`),
          s(`Type / frequency mapped per activity: ${acts.map((a) => `${a.letter} ${a.type}, ${a.frequency}`).join("; ")}`),
        ]
      : [s(wt ? "Narrative walkthrough read – used to confirm the SOP" : "No walkthrough provided", "info")],
  });
  procs.push({
    id: "p-map",
    label: "Validate walkthrough against the SOP",
    detail: "Each control activity must be described in the SOP, with the same owner, transaction and frequency.",
    subChecks: consistency.map((c) => s(`${c.check}: ${c.detail}`, c.result === "Agrees" || c.result === "Noted" ? "pass" : "exception")),
  });
  procs.push({
    id: "p-design",
    label: "Assess control design",
    detail: "Could the control, as written, prevent or detect a fraudulent bank-detail change in time?",
    subChecks: design.map((d) => s(`${d.id} ${d.area}: ${d.status === "Gap" ? `gap (${d.severity})` : d.status.toLowerCase()}`, d.status === "Gap" ? (d.severity === "Low" ? "info" : "exception") : d.status === "To test" ? "info" : "pass", `[DESIGN] ${d.id} ${d.area} – ${d.status}`)),
    points: design.filter((d) => d.status === "Gap" && d.severity === "High").map((d) => `${d.id}: ${d.observation}`),
  });
  procs.push({
    id: "p-rcm",
    label: "Generate RCM and test plan",
    detail: "RCM rows, test attributes, sample sizes and the evidence request list.",
    subChecks: [
      s(`${acts.length + 1} RCM rows (${acts.length} activities + IT dependency)`, "pass", "[RCM] Rows generated"),
      s(`${attributes.length} test attributes (A1–A${attributes.length}) linked to activities`),
      s(`Sample sizes set by frequency: ${[...new Set(acts.map((a) => `${a.frequency} → ${sampleFor(a.frequency)}`))].join("; ")}`),
      s(`${evidenceRequests.length} evidence items requested`),
    ],
  });
  return procs;
}
