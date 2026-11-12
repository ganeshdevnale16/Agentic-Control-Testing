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
  // Callback / document check beat request when both appear ("checks that the request letter … attached")
  if (/call ?back/i.test(text)) return "callback";
  if (/document check|checks? that the request|are attached/i.test(text)) return "check";
  return (KIND_TESTS.find(([, re]) => re.test(text)) || ["other"])[0];
};

const ACTIVITY_DEFAULT = {
  request: { name: "Change request & documentation", type: "Preventive", frequency: "Per change" },
  callback: { name: "Independent callback verification", type: "Preventive", frequency: "Per change" },
  check: { name: "Document check of the request", type: "Preventive", frequency: "Per change" },
  update: { name: "Bank-detail update in SAP", type: "Preventive", frequency: "Per change" },
  review: { name: "Weekly review of sensitive-field changes", type: "Detective", frequency: "Weekly" },
  other: { name: "Control activity", type: "", frequency: "" },
};

// Build the RCM, the design assessment and the test plan.
export function buildRcm({ sop, wt, transcript, today = new Date() }) {
  const f = sop.facts;
  const ctl = wt?.controls?.[0];
  const controlId = ctl?.controlId || "P2P-04";
  const owner = ctl?.owner || sop.owner || "Process owner";
  const roleOf = (k) => ({ request: f.vcrf.preparer, callback: f.callback.performer, check: f.docCheck?.performer, update: f.update.performer, review: f.review.reviewer })[k] || "";
  const sopRef = (k) => ({ request: [f.request.ref, f.vcrf.ref].filter(Boolean).join(", "), callback: f.callback.ref, check: f.docCheck?.ref, update: f.update.ref, review: f.review.ref ? `${f.review.ref} Weekly review` : "" })[k] || "";

  // ── activities: from the walkthrough RCM if given, otherwise from the SOP
  let acts = ctl?.activities?.length
    ? ctl.activities.map((a) => ({ letter: a.letter, text: a.text, kind: kindOf(a.text), type: a.type, frequency: a.frequency, fromWalkthrough: true }))
    : [
        f.request.ref && { letter: "a", kind: "request", text: "Vendor bank-detail changes are raised on a VCRF with the vendor's request letter and cancelled cheque." },
        f.docCheck?.ref && { letter: "b", kind: "check", text: "The request letter and cancelled cheque are checked and the check is recorded on the VCRF." },
        !f.docCheck?.ref && f.callback.ref && { letter: "b", kind: "callback", text: "A callback is performed to verify the request and recorded on the VCRF." },
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
      add("Callback number source", !rcmSilent, rcmSilent ? "RCM does not say which number to call; SOP points to the request letter" : "RCM specifies an independent source", rcmSilent ? "Not adequate" : undefined);
    }
  } else add("Walkthrough", true, "Narrative walkthrough received – activities taken from the SOP", "Noted");
  if (transcript?.lines?.length) {
    const ownerLine = transcript.find("control owner");
    add("Owner confirmed in walkthrough", !!ownerLine, ownerLine ? `[${ownerLine.time}] ${ownerLine.speaker}: “${ownerLine.text.slice(0, 90)}…”` : "Owner not identified in the transcript", ownerLine ? undefined : "Noted");
    add("Walkthrough sample", !!transcript.sample, transcript.sample || "Sample not stated", transcript.sample ? "Agrees" : "Noted");
  }

  // ── preliminary design read of the SOP (concluded by the test of design) ─
  const design = [];
  const D = (id, area, status, severity, observation, recommendation, ref, attr) => design.push({ id, area, status, severity, observation, recommendation, ref, attr });
  const current = sop.reviewDue ? sop.reviewDue >= today : null;
  D("D1", "SOP approval and currency", sop.approvedBy && current !== false ? "Effective" : "Not adequate", sop.approvedBy && current !== false ? "–" : "Low",
    `${sop.docId || "SOP"} v${sop.version || "?"} approved by ${sop.approvedBy || "–"} on ${fmtDate(sop.approvalDate)}; next review ${fmtDate(sop.reviewDue)}${current === false ? " – overdue" : ""}.`,
    current === false ? "Re-approve the SOP and confirm it reflects current practice." : "–", "Header", "A2");
  const dc = f.docCheck;
  const weakCheck = dc ? dc.presenceOnly : f.callback.source !== "master";
  D("D2", "Precision of the request check", weakCheck ? "Not adequate" : "Effective", weakCheck ? "High" : "–",
    dc
      ? dc.presenceOnly
        ? `SOP ${dc.ref} asks the ${dc.performer || "MDM Executive"} only to ${dc.quote || "check that the documents are attached"}. There is no criterion to match the cheque account name to the vendor, the signatory to onboarding records or the sender email to the vendor master.`
        : `SOP ${dc.ref} defines validation criteria for the request documents.`
      : f.callback.source === "letter"
      ? `SOP ${f.callback.ref} has the callback made to the number on the request letter, so it reaches whoever sent the request.`
      : `SOP ${f.callback.ref || "–"} describes the verification of the request.`,
    weakCheck ? "Define validation criteria: cheque account name = vendor legal name, signatory = onboarding list, request from the vendor's registered email domain; mismatches to the Finance Controller before any SAP update." : "–",
    dc?.ref || f.callback.ref, "A4");
  const checker = dc?.performer || f.callback.performer;
  const sameRole = checker && checker === f.update.performer;
  D("D3", "Separation of verifier and maker", sameRole || !f.independentApproval ? "Not adequate" : "Effective", sameRole || !f.independentApproval ? "High" : "–",
    sameRole
      ? `The ${checker} checks the request and also updates SAP (SOP ${[dc?.ref || f.callback.ref, f.update.ref].filter(Boolean).join(", ")}); no second person approves the change before it can be paid.`
      : f.independentApproval
      ? "An independent approval is required before the change is effective."
      : "No independent approval of the change before it can be used for payment.",
    sameRole || !f.independentApproval ? "Separate the verifier and maker; require a second user to confirm the change in SAP (FK08) before it is payable." : "–",
    [dc?.ref || f.callback.ref, f.update.ref].filter(Boolean).join(", "), "A7");
  const timingGap = /week/i.test(f.review.frequency) && f.paymentDays;
  D("D4", "Timing of the independent check", timingGap ? "Not adequate" : "Effective", timingGap ? "High" : "–",
    timingGap
      ? `The only independent check is the review ${f.review.day ? `every ${f.review.day}` : "weekly"} after the change is live, while payment runs happen on ${f.paymentDays}. A changed account can be paid before anyone reviews it.`
      : "Review timing is aligned to payment processing.",
    timingGap ? "Block payment to vendors with bank changes until confirmed, or review bank changes before each payment run." : "–", f.review.ref, "A5");
  const ipeGap = !f.review.completeness;
  D("D5", "Reliability of the change report (IPE)", ipeGap ? "Not adequate" : "Effective", ipeGap ? "Medium" : "–",
    ipeGap
      ? `The ${f.review.preparer || "preparer"} extracts the report${f.review.toExcel ? " from SAP to Excel" : ""}; the reviewed team produces the review population and the SOP has no completeness step.`
      : "SOP requires completeness checks on the change report.",
    ipeGap ? "Run a saved SAP variant outside MDM, keep parameters and record counts, and reconcile to the unfiltered extract." : "–", f.review.ref, "A8");
  D("D6", "Exception handling", f.exceptions.vague || !f.exceptions.text ? "Not adequate" : "Effective", f.exceptions.vague || !f.exceptions.text ? "Low" : "–",
    f.exceptions.text ? `SOP ${f.exceptions.ref}: discrepancies are reported "for necessary action" – no timeline, payment hold or escalation.` : "SOP has no exception-handling step.",
    f.exceptions.vague || !f.exceptions.text ? "Define same-day payment hold, escalation to the CFO, bank recall within 24 hours and an incident log." : "–", f.exceptions.ref, "A9");
  D("D7", "Record retention", f.retentionYears >= 8 ? "Effective" : "Not adequate", f.retentionYears >= 8 ? "–" : "Low",
    f.retentionYears ? `VCRFs and signed reviews retained for ${f.retentionYears} years.` : "No retention period stated.",
    f.retentionYears >= 8 ? "–" : "Retain records for at least 8 years (Companies Act, 2013 s.128).", f.retentionRef, "A10");
  D("D8", "System enforcement (IT dependency)", "To test", "–",
    "The SOP does not say whether SAP enforces approval of bank changes before they are payable (sensitive fields, FK08 dual control, payment block) – tested with the configuration extract.",
    "–", "–", "A6");

  const gaps = design.filter((d) => d.status === "Not adequate");
  const designConclusion = gaps.some((g) => g.severity === "High") ? "Design gaps indicated – to be concluded by the test of design" : gaps.length ? "Minor design points – to be confirmed by the test of design" : "No design gaps indicated";

  // ── test of design attributes (the test plan) ─────────────────────────
  const attributes = [
    { id: "A1", act: "overall", label: "Risk linkage", criterion: "Control addresses the stated risk and assertion", procedure: "Compared RCM risk and control description; confirmed risk scenario with owner.", evidence: ["NFS-02", "NFS-06"], severity: "High" },
    { id: "A2", act: "overall", label: "Policy governance", criterion: "SOP exists, is approved and within its review cycle", procedure: "Inspected SOP cover page for approval and review dates.", evidence: ["NFS-01", "NFS-06"], severity: "Low" },
    { id: "A3", act: "overall", label: "Ownership and authority", criterion: "Named owner with authority to act", procedure: "Agreed owner in RCM to SOP and walkthrough.", evidence: ["NFS-02", "NFS-01", "NFS-06"], severity: "Medium" },
    { id: "A4", act: "check", label: "Precision and criteria", criterion: "Document check has criteria specific enough to detect a fraudulent request", procedure: "Read SOP 5.3; traced sample document check; compared cheque account name and request sender with vendor master; inquired on reviewer's check.", evidence: ["NFS-01", "NFS-07", "NFS-04", "NFS-06"], severity: "High" },
    { id: "A5", act: "review", label: "Frequency and timing", criterion: "Control operates before the change can result in payment", procedure: "Compared SAP change time, payment run calendar and review date for the sample week.", evidence: ["NFS-01", "NFS-04", "NFS-03", "NFS-05", "NFS-06"], severity: "High" },
    { id: "A6", act: "it", label: "System alignment", criterion: "SAP enforces approval of bank changes before they are payable", procedure: "Inspected T055F sensitive-field settings; inquired with Basis.", evidence: ["NFS-03", "NFS-06"], severity: "High" },
    { id: "A7", act: "update", label: "Segregation of duties", criterion: "Verifier, maker and payment-run roles are separated", procedure: "Inspected SUIM access extract; traced who performed the document check and SAP change; inquired.", evidence: ["NFS-03", "NFS-04", "NFS-05", "NFS-01", "NFS-06"], severity: "High" },
    { id: "A8", act: "review", label: "Information used (IPE)", criterion: "Review report is complete, accurate and independently sourced", procedure: "Inspected W38 report header and SOP section 6; inquired on extraction and filtering.", evidence: ["NFS-05", "NFS-01", "NFS-06"], severity: "Medium" },
    { id: "A9", act: "review", label: "Exceptions and escalation", criterion: "Exceptions have defined timeline, payment hold and escalation", procedure: "Read SOP section 7; inquired.", evidence: ["NFS-01", "NFS-06"], severity: "Medium" },
    { id: "A10", act: "overall", label: "Evidence of performance", criterion: "Performance leaves a retained, reviewable trail", procedure: "Inspected VCRF DMS reference and sign-off; read retention clause.", evidence: ["NFS-04", "NFS-07", "NFS-05", "NFS-01", "NFS-06"], severity: "Low" },
  ].map((a) => ({
    ...a,
    activity: a.act === "overall" ? controlId : a.act === "it" ? `${controlId}.IT` : acts.find((x) => x.kind === a.act || (a.act === "check" && x.kind === "callback"))?.id || controlId,
  }));

  const evidenceRequests = [
    { id: "E1", code: "NFS-02", name: "Existing RCM extract for the control", kind: "rcm", for: "A1, A3", note: "Client RCM FY 2026-27" },
    { id: "E2", code: "NFS-03", name: "SAP sensitive-field configuration (T055F)", kind: "sensitive", for: "A6", note: "Extract by SAP Basis" },
    { id: "E3", code: "NFS-03", name: "SAP user access extract (SUIM) – XK02/FK02, F110, FK08", kind: "access", for: "A7", note: "Finance users" },
    { id: "E4", code: "NFS-03", name: "F110 payment run calendar", kind: "calendar", for: "A5", note: "Sample week" },
    { id: "E5", code: "NFS-04", name: "VCRF for the walkthrough sample, with the document check and SAP update", kind: "vcrf", for: "A4, A5, A7, A10", note: "Sample VCR-2026-0389" },
    { id: "E6", code: "NFS-05", name: "Weekly sensitive-field change report with sign-off", kind: "changes", for: "A5, A7, A8, A10", note: "Sample week (W38)" },
    { id: "E7", code: "NFS-07", name: "Cancelled cheque attached to the VCRF", kind: "cheque", for: "A4, A10", note: "Scanned copy from DMS" },
  ];


  // ── RCM rows ────────────────────────────────────────────────────────────
  const riskId = ctl?.riskId || "R-P2P-02";
  const riskDesc = ctl?.riskDesc || "Unauthorised or fraudulent change to vendor bank details diverts payments to a fraudster's account";
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
      attributes: attributes.filter((x) => x.act === a.kind || (x.act === "check" && a.kind === "callback")).map((x) => x.id).join(", ") || "A1–A3, A10",
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
      attributes: "A6",
      sample: "Test of one (walkthrough)",
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

  // ── RCM in the client's format: one row per control, activities lettered in the description
  const req = acts.find((a) => a.kind === "request");
  const chk = acts.find((a) => a.kind === "check" || a.kind === "callback");
  const upd = acts.find((a) => a.kind === "update");
  const rev = acts.find((a) => a.kind === "review");
  const preventive = [req, chk || upd].filter(Boolean).length;
  const L = (i) => String.fromCharCode(97 + i);
  const parts = [
    req && `Vendor bank-detail changes are raised on a VCRF with the vendor's letterhead request and cancelled cheque of the new account.`,
    (chk || upd) &&
      (chk?.kind === "check" || !chk
        ? `The ${f.docCheck?.performer || f.update.performer || "MDM Executive"} checks that both documents are attached and makes the change in SAP (${f.update.txn || "XK02"}).`
        : `The ${f.callback.performer || "MDM Executive"} performs a callback to verify the request and makes the change in SAP (${f.update.txn || "XK02"}).`),
    rev && `Every ${f.review.day || "week"} the ${f.review.reviewer || "Finance Controller"} reviews the sensitive-field change report for the prior week and signs off.`,
  ].filter(Boolean);
  const range = (a, b) => (a === b ? L(a) : `${L(a)}-${L(b)}`);
  const lastP = Math.max(0, preventive - 1);
  const rcmRow = {
    riskId,
    riskDesc,
    controlId,
    controlDesc: parts.map((t, i) => `(${L(i)}) ${t}`).join(" "),
    type: rev ? `Preventive (${range(0, lastP)}); Detective (${L(parts.length - 1)})` : "Preventive",
    nature: "Manual",
    frequency: rev ? `Per change (${range(0, lastP)}); ${f.review.frequency || "Weekly"} (${L(parts.length - 1)})` : "Per change",
    owner,
    assertion: "Occurrence / Existence; Safeguarding of assets",
    evidence: `VCRF with request letter and cancelled cheque${rev ? "; signed weekly change report" : ""}`,
    system: `SAP S/4HANA change documents${f.review.toExcel ? "; Excel change report" : ""}`,
  };
  const rcmHeader = {
    title: `${sop.company || "Company"} - Risk and Control Matrix (Extract)`,
    process: `Process: ${wt?.meta?.process || "Procure-to-Pay"} | Sub-process: ${wt?.meta?.subProcess || "Vendor Master Maintenance"}`,
    sheet: `RCM - ${(wt?.meta?.subProcess || "Vendor Master Maintenance").replace(/\s*Maintenance$/i, "")}`.slice(0, 31),
  };

  return { rcmRow, rcmHeader, control, activities: acts, consistency, design, gaps, designConclusion, attributes, evidenceRequests, rcmRows, transcript, wt, procedures: buildProcedures({ sop, wt, transcript, acts, consistency, design, attributes, evidenceRequests, today }) };
}

function designFor(kind, design) {
  const map = { request: ["D2"], check: ["D2", "D3"], callback: ["D2", "D3"], update: ["D3"], review: ["D4", "D5", "D6"] };
  const g = design.filter((d) => (map[kind] || []).includes(d.id) && d.status === "Not adequate");
  return g.length ? `Not adequate – ${g.map((x) => x.id).join(", ")}` : "Effective";
}

// Steps shown in the live checklist while the RCM is being built
function buildProcedures({ sop, wt, transcript, acts, consistency, design, attributes, evidenceRequests, today }) {
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
      s(`Bank-change procedure found in clauses ${[f.request.ref, f.vcrf.ref, f.docCheck?.ref || f.callback.ref, f.update.ref].filter(Boolean).map((r) => r.split(" ")[0]).join(", ")}`),
    ],
    points: [`${plural(sop.sections.length, "section")} read; ${plural(sop.roles.length, "role")} identified.`],
  });
  if (wt)
    procs.push({
    id: "p-wt",
    label: "Read the walkthrough notes / RCM extract",
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
  if (!wt && transcript)
    procs.push({
      id: "p-acts",
      label: "Identify the control activities",
      detail: "Taken from the SOP and confirmed against the walkthrough",
      subChecks: [
        s(`Split the control into ${plural(acts.length, "activity", "activities")}: ${acts.map((a) => `(${a.letter}) ${a.name}`).join("; ")}`),
        s(`Type / frequency per activity: ${acts.map((a) => `${a.letter} ${a.type}, ${a.frequency}`).join("; ")}`),
      ],
    });
  if (transcript)
    procs.push({
      id: "p-tr",
      label: "Read the walkthrough transcript",
      detail: `${transcript.name}${transcript.date ? ` – ${fmtDate(transcript.date)}` : ""}`,
      subChecks: [
        s(`${plural(transcript.lines.length, "statement")} from ${plural(new Set(transcript.lines.map((l) => l.speaker)).size, "participant")}`, transcript.lines.length ? "pass" : "info", `[READ] ${transcript.name}: ${transcript.lines.length} statements`),
        s(`Sample traced: ${transcript.sample || "not stated"}`, transcript.sample ? "pass" : "info"),
        s("Statements indexed by time stamp and page for corroboration (T)"),
      ],
    });
  procs.push({
    id: "p-map",
    label: "Validate walkthrough against the SOP",
    detail: "Each control activity must be described in the SOP, with the same owner, transaction and frequency.",
    subChecks: consistency.map((c) => s(`${c.check}: ${c.detail}`, c.result === "Agrees" || c.result === "Noted" ? "pass" : "exception")),
  });
  procs.push({
    id: "p-design",
    label: "Preliminary design read of the SOP",
    detail: "Could the control, as written, prevent or detect a fraudulent bank-detail change in time? Concluded by the test of design in step 4.",
    subChecks: design.map((d) => s(`${d.id} ${d.area}: ${d.status === "Not adequate" ? `not adequate (${d.severity})` : d.status.toLowerCase()}`, d.status === "Not adequate" ? (d.severity === "Low" ? "info" : "exception") : d.status === "To test" ? "info" : "pass", `[DESIGN] ${d.id} ${d.area} – ${d.status}`)),
    points: design.filter((d) => d.status === "Not adequate" && d.severity === "High").map((d) => `${d.id}: ${d.observation}`),
  });
  procs.push({
    id: "p-rcm",
    label: "Generate RCM and test plan",
    detail: "RCM rows, test attributes, sample sizes and the evidence request list.",
    subChecks: [
      s(`${acts.length + 1} RCM rows (${acts.length} activities + IT dependency)`, "pass", "[RCM] Rows generated"),
      s(`${attributes.length} test-of-design attributes (A1–A${attributes.length}) with design criteria`),
      s(`Sample sizes set by frequency: ${[...new Set(acts.map((a) => `${a.frequency} → ${sampleFor(a.frequency)}`))].join("; ")}`),
      s(`${evidenceRequests.length} evidence items requested`),
    ],
  });
  return procs;
}
