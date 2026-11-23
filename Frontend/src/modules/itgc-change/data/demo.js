// ─────────────────────────────────────────────────────────────────────────────
// ITGC Change Management – fixed demo data.
// The demo returns these results whatever files are uploaded. Edit here to
// change what the chat shows and what goes into the Testing Work Paper.
//
// Terminology used throughout (one name per source system):
//   SNOW change request  – ServiceNow change record, CHG…     (s.chg)
//   Solman request       – SAP Solution Manager (ChaRM), 6…/7… (s.cr)
//   Transport request    – SAP transport, CIDK…               (s.tr)
//   Developer            – transport owner (E070-AS4USER)
//   Implementer          – user who imported the transport into production (STMS)
// Change types follow the client change policy: Normal, Standard (pre-approved)
// and Emergency. Each type has its own testing / approval criteria (CRITERIA).
// ─────────────────────────────────────────────────────────────────────────────

// ── change types ──────────────────────────────────────────────────────────
export const NORMAL = "Normal";
export const STANDARD = "Standard";
export const EMERGENCY = "Emergency";
export const CHANGE_TYPES = [NORMAL, STANDARD, EMERGENCY];
const TYPE_LABEL = { [NORMAL]: "Normal change", [STANDARD]: "Standard change (pre-approved)", [EMERGENCY]: "Emergency change" };
export const typeLabel = (s) => TYPE_LABEL[s.type] || s.type;

// What the tool "reads" from the uploaded RCM
export const RCM = {
  controlId: "ITGC-CM-1.1.3",
  name: "SAP change management – testing, approval and deployment of changes",
  objective:
    "Changes to the SAP production environment are requested, tested and authorised before deployment, so that only intended and validated changes reach production.",
  risk:
    "Unauthorised, untested or erroneous changes are deployed to SAP production, impacting the integrity of financial data and the reliability of automated controls and reports.",
  description:
    "Every change to SAP production (CIP, client 500) is logged as a SNOW change request and linked to a Solman request and the transport request(s). Changes are classified as Normal, Standard (pre-approved) or Emergency per the change policy. Testing proportionate to the change type is performed and evidenced on the SNOW change tasks before deployment. Normal changes are approved by the business owner and the CAB / change manager; Standard changes must be listed in the standard change catalogue and approved by the change coordinator; Emergency changes are approved by the ECAB before deployment and reviewed retrospectively by the CAB. The developer cannot import their own transport into production.",
  nature: "Preventive / manual (IT-dependent)",
  frequency: "Event based – performed for each change deployed to production",
  key: "Yes",
  owner: "SAP Application Owner / Change Manager",
  systems: "SAP ECC (CIP, client 500); SAP Solution Manager – ChaRM (Solman); ServiceNow (SNOW); STMS",
  testingMethod: "Inquiry, inspection and re-performance",
  period: "09.04.2025 - 31.07.2025",
  environment: "SAP ECC – production system CIP, client 500",
};

// Sampling – set in line with the client sampling methodology.
// size:    sample size the client methodology gives for this control and population
// minPerType: minimum samples from each change type, so the evidence flow is shown for all three
export const SAMPLING = {
  size: 10,
  minPerType: 2,
  methodology: "Client sampling methodology – event-based control",
  method: "Random selection, stratified by change type (Normal / Standard / Emergency)",
};
RCM.testApproach = `${SAMPLING.method}. Sample size of ${SAMPLING.size} per the client sampling methodology for an event-based control, with at least ${SAMPLING.minPerType} samples from each change type, drawn from the population of transports imported into production in the period.`;

// Attribute wording is the tool's own (not copied from any client template).
export const ATTRIBUTES = [
  {
    short: "Change request raised & justified",
    text: "Each change is logged as a SNOW change request linked to the Solman request and transport request, recording the requestor, request date, assignee, current state and a description that supports the business need for the change.",
  },
  {
    short: "Tested before deployment",
    text: "Testing proportionate to the change type (unit test by IT, user acceptance test by the business) is completed before the transport is imported into production. Where the change type does not require testing, or testing follows deployment for an emergency fix, the reason is recorded.",
  },
  {
    short: "Test results evidenced",
    text: "Test results and sign-off are attached to the SNOW testing tasks or the Solman request and retained. Marked N/A where testing is not required for the change, with the reason recorded.",
  },
  {
    short: "Authorised for deployment",
    text: "Deployment is authorised in line with the change type (see criteria by change type) and an implementation and back-out (rollback) plan is documented.",
  },
  {
    short: "Segregation of duties",
    text: "The developer (transport owner) did not import the transport into production and did not perform the user acceptance test.",
  },
];

// What is checked for each attribute, by change type – the tool applies only the
// criteria for the sample's own change type.
export const CRITERIA = [
  {
    [NORMAL]: "SNOW change request linked to Solman and transport request; requestor, date, assignee, state and business justification recorded",
    [STANDARD]: "As Normal, and the standard change catalogue item is referenced",
    [EMERGENCY]: "As Normal, and the reason for the emergency is recorded",
  },
  {
    [NORMAL]: "Unit test and UAT completed before import",
    [STANDARD]: "Unit test before import; UAT only where the catalogue item requires it – otherwise N/A with the reason",
    [EMERGENCY]: "Unit test before import; business verification may follow deployment, per the emergency procedure",
  },
  {
    [NORMAL]: "Unit test and UAT evidence attached to the SNOW testing tasks",
    [STANDARD]: "Evidence attached where testing was performed; N/A with the reason where not required",
    [EMERGENCY]: "Unit test evidence and post-deployment verification evidence attached",
  },
  {
    [NORMAL]: "Business owner and CAB / change manager approval before import; back-out plan documented",
    [STANDARD]: "Listed in the standard change catalogue and change coordinator approval before import; back-out plan documented",
    [EMERGENCY]: "ECAB approval before import and retrospective CAB review after deployment; back-out plan documented",
  },
  {
    [NORMAL]: "Developer ≠ implementer and developer ≠ UAT tester",
    [STANDARD]: "Developer ≠ implementer and developer ≠ UAT tester (where UAT applies)",
    [EMERGENCY]: "Developer ≠ implementer and developer ≠ business verifier",
  },
];

export const ACTT_SYSTEM = { name: "ACTT", sid: "CIP", client: "500", description: "SAP ECC production" };

export const POPULATION = {
  transports: 87,
  period: "09.04.2025 — 31.07.2025",
  stmsMatched: 87,
  owners: 9,
  crsExtracted: 87,
  sodFlags: 0,
  target: "/CIQ/",
  prefix: "CIDK",
  uniqueCRs: 70,
  typeMapped: 87,
  byType: { [NORMAL]: 41, [STANDARD]: 38, [EMERGENCY]: 8 },
  matchProof: [
    { tr: "CIDK905757", cr: "7000004365", type: STANDARD, e070: 29, stms: 21, owner: "873379", user: "1094229", date: "21.05.2025" },
    { tr: "CIDK905769", cr: "7000004366", type: STANDARD, e070: 32, stms: 19, owner: "1149116", user: "1094229", date: "19.05.2025" },
    { tr: "CIDK905906", cr: "7000004387", type: EMERGENCY, e070: 63, stms: 81, owner: "870144", user: "1094229", date: "30.07.2025" },
  ],
};
export const typeSplit = () => CHANGE_TYPES.map((t) => `${t} ${POPULATION.byType[t]}`).join(" · ");

export const IPE_MANUAL = [
  { layer: "Completeness", check: "E070 extract row count matches STMS reported entry count", value: "87" },
  { layer: "Completeness", check: "E070 extract row count matches STMS extract data row count", value: "87" },
  { layer: "Completeness", check: "E070 data dates fall within STMS reported time interval", value: "09.04.2025 to 31.07.2025" },
  { layer: "Accuracy", check: "Data extracted from production system (CIP)", value: "CIP" },
  { layer: "Accuracy", check: "All transport records are from client 500 (Production)", value: "500" },
  { layer: "Accuracy", check: "Transport target confirms production landscape route", value: "/CIQ/" },
  { layer: "Accuracy", check: "Transport request prefixes are consistent (same SAP landscape)", value: "CIDK" },
  { layer: "Screenshot", check: "E070 screenshot record count matches E070 extract row count", value: "87" },
  { layer: "Screenshot", check: "STMS screenshot entry count matches STMS extract entry count", value: "87" },
  { layer: "Screenshot", check: "E070 selection screen filter parameters match STMS time interval", value: "From 09.04.2025 to 31.07.2025" },
  { layer: "Screenshot", check: "Screenshot status bar / title confirms production system CIP 500", value: "E070: CIP 500; STMS: CIP" },
].map((c) => ({ ...c, result: "Pass" }));

export const IPE_ACTT = [
  { layer: "Source", check: "Population extracted by ACTT directly from production system CIP, client 500", value: "CIP 500" },
  { layer: "Source", check: "Extraction parameters match the in-scope period", value: "09.04.2025 to 31.07.2025" },
  { layer: "Completeness", check: "ACTT record count reconciles to E070 / STMS tables in the system", value: "87" },
  { layer: "Integrity", check: "Population delivered without manual handling or editing", value: "System-generated" },
].map((c) => ({ ...c, result: "Pass" }));

export const ACTT_IPE_STATEMENT =
  "IPE passed – the population was pulled directly from the system using ACTT. As a system-generated extract with no manual handling, reliance is placed on the ACTT extraction for completeness and accuracy.";
export const MANUAL_IPE_STATEMENT =
  "IPE passed – completeness and accuracy of the uploaded population were validated across completeness, accuracy and screenshot verification: 11 of 11 checks passed.";
export const TYPE_MAPPING_STATEMENT =
  "Change type mapped to every transport from the SNOW change request extract (87 / 87 mapped), so samples can be drawn from each change type and tested against the criteria for that type.";

// ── samples ───────────────────────────────────────────────────────────────
// developer = transport owner, implementer = user who imported into production.
// approvals are built from apprDate / catalogue / retroDate by approvalsFor().
const BACKOUT =
  "Re-import the previous version of the changed objects with a transport of copies; Basis to restore from the pre-import version if the import fails. Functional owner confirms the rollback.";

const BASE_SAMPLES = [
  {
    tr: "CIDK905003", cr: "6000027444", chg: "CHG0041207", type: NORMAL, state: "Closed – complete",
    short: "FI – validation rule for intercompany GL postings (company code 1000)",
    justification: "Intercompany postings to company code 1000 are being made without a trading partner, which breaks the intercompany reconciliation. A validation rule is needed to block these postings at entry.",
    requestedBy: "560812", requestedOn: "08.04.2025", planDate: "09.04.2025", developer: "1094229", devDate: "11.04.2025",
    unitDate: "14.04.2025", uatBy: "873379", uatDate: "16.04.2025", apprDate: "16.04.2025", implementer: "1094229", importDate: "17.04.2025",
    attrs: ["√", "√", "√", "√", "X"], result: "Fail", note: "SoD conflict – the developer (transport owner) also imported the transport into production",
  },
  {
    tr: "CIDK905677", cr: "7000004355", chg: "CHG0041562", type: STANDARD, catalogue: "SC-006", state: "Closed – complete",
    short: "Standard catalogue SC-006 – new payment terms key Z030",
    justification: "Procurement agreed 30-day net payment terms with a new supplier group; payment terms key Z030 is required to post their invoices correctly.",
    requestedBy: "561044", requestedOn: "02.05.2025", planDate: "05.05.2025", developer: "870144", devDate: "05.05.2025",
    unitDate: "06.05.2025", uatBy: "1149116", uatDate: "07.05.2025", apprDate: "07.05.2025", implementer: "1094229", importDate: "08.05.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905761", cr: "6000028726", chg: "CHG0041733", type: NORMAL, state: "Closed – complete",
    short: "MM – purchase order release strategy for capex orders",
    justification: "Capex purchase orders above EUR 250k need a second release level (Finance Director) under the revised delegation of authority.",
    requestedBy: "562377", requestedOn: "13.05.2025", planDate: "14.05.2025", developer: "873379", devDate: "16.05.2025",
    unitDate: "19.05.2025", uatBy: "870144", uatDate: "21.05.2025", apprDate: "21.05.2025", implementer: "1094229", importDate: "22.05.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905771", cr: "6000028584", chg: "CHG0041748", type: NORMAL, state: "Closed – complete",
    short: "SD – pricing procedure update for rebate condition ZR01",
    justification: "New customer rebate agreements from Q3 require rebate condition ZR01 in the domestic pricing procedure so accruals are posted at billing.",
    requestedBy: "560812", requestedOn: "12.05.2025", planDate: "13.05.2025", developer: "1149116", devDate: "16.05.2025",
    unitDate: "20.05.2025", uatBy: "873379", uatDate: "22.05.2025", apprDate: "22.05.2025", implementer: "1094229", importDate: "23.05.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905812", cr: "7000004371", chg: "CHG0041890", type: STANDARD, catalogue: "SC-011", state: "Closed – complete",
    short: "Standard catalogue SC-011 – new cost centre group in the standard hierarchy",
    justification: "A new shared-service team was set up; its cost centres must be grouped in the standard hierarchy for management reporting.",
    requestedBy: "561044", requestedOn: "29.05.2025", planDate: "02.06.2025", developer: "870144", devDate: "02.06.2025",
    unitDate: "03.06.2025", uatBy: "1149116", uatDate: "04.06.2025", apprDate: "04.06.2025", implementer: "1094229", importDate: "05.06.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905828", cr: "6000028748", chg: "CHG0041925", type: NORMAL, state: "Closed – complete",
    short: "FI-AA – depreciation key change for the IT equipment asset class",
    justification: "The useful life of IT equipment was revised from 5 to 4 years under the updated accounting policy; the depreciation key must reflect this.",
    requestedBy: "562377", requestedOn: "03.06.2025", planDate: "04.06.2025", developer: "873379", devDate: "06.06.2025",
    unitDate: "10.06.2025", uatBy: "870144", uatDate: "12.06.2025", apprDate: "12.06.2025", implementer: "1094229", importDate: "13.06.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905879", cr: "7000004376", chg: "CHG0042188", type: EMERGENCY, state: "Closed – complete",
    short: "Emergency fix – payment run (F110) short dump during DME file creation",
    justification: "Emergency: the vendor payment run is failing for 3 company codes, blocking supplier payments due today. Correction to the DME format mapping.",
    requestedBy: "560812", requestedOn: "10.07.2025", planDate: "10.07.2025", developer: "1149116", devDate: "10.07.2025",
    unitDate: "10.07.2025", verifyBy: "873379", verifyDate: "11.07.2025", apprDate: "10.07.2025", retroDate: "14.07.2025", implementer: "1094229", importDate: "10.07.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905902", cr: "7000004385", chg: "CHG0042301", type: STANDARD, catalogue: "SC-014", state: "Closed – complete",
    short: "Standard catalogue SC-014 – FI document number range extension (FY 2025/26)",
    justification: "The vendor invoice number range for FY 2025/26 is 92% used; it must be extended before it is exhausted at period end.",
    requestedBy: "561044", requestedOn: "21.07.2025", planDate: "22.07.2025", developer: "870144", devDate: "22.07.2025",
    testNA: "Testing not required – SC-014 is a number-range maintenance item with no code or logic change; the catalogue requires only a post-import check by IT (recorded on the implementation task).",
    apprDate: "23.07.2025", implementer: "1094229", importDate: "24.07.2025",
    attrs: ["√", "N/A", "N/A", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905922", cr: "7000004393", chg: "CHG0042356", type: EMERGENCY, state: "Closed – complete",
    short: "Emergency fix – GR/IR clearing background job failing at month end",
    justification: "Emergency: the GR/IR automatic clearing job is cancelling during month-end close, leaving uncleared items that delay the close.",
    requestedBy: "562377", requestedOn: "30.07.2025", planDate: "30.07.2025", developer: "873379", devDate: "30.07.2025",
    unitDate: "30.07.2025", verifyBy: "870144", verifyDate: "31.07.2025", apprDate: "30.07.2025", retroDate: "01.08.2025", implementer: "1094229", importDate: "30.07.2025",
    attrs: ["√", "√", "√", "√", "√"], result: "Pass",
  },
  {
    tr: "CIDK905611", cr: "6000028397", chg: "", type: NORMAL, state: "",
    short: "Not available – SNOW change request record not provided",
    attrs: ["NT", "NT", "NT", "NT", "NT"], result: "Missing", note: "SNOW change request record (PDF) not provided – attributes could not be tested",
  },
].map((s) => ({ backout: BACKOUT, ...s }));

// After the control owner accepts a reviewer observation and testing is
// re-performed, the missing SNOW record has been supplied, so the CIDK905611
// sample can be tested. The SoD exception on CIDK905003 remains.
const RETEST_905611 = {
  tr: "CIDK905611", cr: "6000028397", chg: "CHG0041650", type: NORMAL, state: "Closed – complete",
  short: "CO – settlement rule update for capital project WBS elements",
  justification: "Capital project WBS elements must settle to assets under construction rather than cost centres, so capex is capitalised correctly.",
  requestedBy: "560812", requestedOn: "06.05.2025", planDate: "07.05.2025", developer: "1149116", devDate: "09.05.2025",
  unitDate: "12.05.2025", uatBy: "870144", uatDate: "13.05.2025", apprDate: "13.05.2025", implementer: "1094229", importDate: "14.05.2025",
  backout: BACKOUT, attrs: ["√", "√", "√", "√", "√"], result: "Pass", note: "Re-tested in round 2 using the SNOW change request record supplied by the control owner",
};

export const getSamples = (round = 1) => (round > 1 ? BASE_SAMPLES.map((s) => (s.tr === "CIDK905611" ? RETEST_905611 : s)) : BASE_SAMPLES);

export const countByType = (samples) => CHANGE_TYPES.map((t) => `${t} ${samples.filter((s) => s.type === t).length}`).join(" · ");

export const stats = (samples) => {
  const passed = samples.filter((s) => s.result === "Pass").length;
  const exceptions = samples.length - passed;
  return { passed, exceptions, verdict: exceptions ? "Ineffective" : "Effective" };
};

export const isNormal = (s) => s.type === NORMAL;
export const isStd = (s) => s.type === STANDARD;
export const isEmergency = (s) => s.type === EMERGENCY;
export const isMissing = (s) => s.result === "Missing";
export const sodMet = (s) => s.developer !== s.implementer && s.developer !== (s.uatBy || s.verifyBy);

// Approvals shown on the evidence and in the work paper, per change type
export const approvalsFor = (s) => {
  if (isStd(s))
    return [
      { step: `Standard change catalogue item ${s.catalogue}`, by: "Change Manager", on: "01.01.2025", status: "Listed", timing: "pre-approved" },
      { step: "Change coordinator approval", by: "Change Coordinator", on: s.apprDate, status: "Approved", timing: "before deployment" },
    ];
  if (isEmergency(s))
    return [
      { step: "ECAB approval", by: "Emergency CAB", on: s.apprDate, status: "Approved", timing: "before deployment" },
      { step: "Retrospective CAB review", by: "Change Manager (CAB)", on: s.retroDate, status: "Approved", timing: "after deployment" },
    ];
  return [
    { step: "Business owner approval", by: "Business Owner", on: s.apprDate, status: "Approved", timing: "before deployment" },
    { step: "CAB / change manager approval", by: "Change Manager (CAB)", on: s.apprDate, status: "Approved", timing: "before deployment" },
  ];
};

export const approvalText = (s) => (isMissing(s) ? "–" : approvalsFor(s).map((a) => `${a.step.replace(/ approval$/, "")} ${a.on}`).join("; "));

// Change tasks on the SNOW change request: planning, development, testing, implementation
export const tasksFor = (s) => {
  const t = [
    { task: "Planning – assessment & approval to proceed", by: "Change Coordinator", state: "Closed", on: s.planDate, att: "Impact assessment" },
    { task: "Development", by: s.developer, state: "Closed", on: s.devDate, att: `Transport ${s.tr}` },
  ];
  if (s.testNA) t.push({ task: "Testing", by: "–", state: "Not required", on: "–", att: "N/A – see reason", na: true });
  else {
    t.push({ task: "Testing – unit test", by: s.developer, state: "Closed", on: s.unitDate, att: `UnitTest_${s.tr}.pdf`, test: true });
    if (isEmergency(s)) t.push({ task: "Testing – business verification (post-deployment)", by: s.verifyBy, state: "Closed", on: s.verifyDate, att: `Verification_${s.chg}.pdf`, test: true });
    else t.push({ task: "Testing – user acceptance test (UAT)", by: s.uatBy, state: "Closed", on: s.uatDate, att: `UAT_Signoff_${s.chg}.pdf`, test: true });
  }
  t.push({ task: "Implementation – import to production", by: s.implementer, state: "Closed", on: s.importDate, att: "STMS import log" });
  return t;
};

export const evidenceRefs = (s) => {
  if (isMissing(s)) return "No supporting documents matched.";
  const refs = [`SNOW change request: ${s.chg} – Change Request Record.pdf (p.1–2)`, `Solman request: ${s.cr} – Request Details.pdf (p.1)`];
  if (s.testNA) refs.push(`Testing: N/A – standard change catalogue ${s.catalogue}.xlsx`);
  else refs.push(`Test evidence: UnitTest_${s.tr}.pdf`, isEmergency(s) ? `Test evidence: Verification_${s.chg}.pdf` : `Test evidence: UAT_Signoff_${s.chg}.pdf`);
  if (isStd(s)) refs.push(`Approval: Standard Change Catalogue 2025.xlsx (${s.catalogue})`, `Approval: RE_ CC Approval ${s.chg}.msg`);
  else if (isEmergency(s)) refs.push(`Approval: RE_ ECAB Approval ${s.chg}.msg`, `Approval: CAB Minutes ${s.retroDate}.pdf (retrospective)`);
  else refs.push(`Approval: RE_ Business Owner Approval ${s.chg}.msg`, `Approval: RE_ CAB Approval ${s.chg}.msg`);
  refs.push(`Transport request: STMS Import History ${s.tr}.png`);
  return refs.join(" | ");
};

const NT_TEXT = (n) => `Not tested – the SNOW change request record (PDF) for this change was not provided, so attributes 1 to ${n} could not be assessed.`;

export const testingPerformed = (s) => {
  if (isMissing(s)) return NT_TEXT(ATTRIBUTES.length);
  const a1 = `A1 – Inspected SNOW change request ${s.chg} (${s.type.toLowerCase()} change, state: ${s.state}) linked to Solman request ${s.cr} and transport request ${s.tr}: raised by ${s.requestedBy} on ${s.requestedOn}, assigned to ${s.developer}, with a business justification recorded${isEmergency(s) ? ", including the reason for the emergency" : ""}${isStd(s) ? ` and catalogue item ${s.catalogue} referenced` : ""}.`;
  const a23 = s.testNA
    ? `A2/A3 – N/A: ${s.testNA}`
    : isEmergency(s)
      ? `A2/A3 – Unit test by ${s.developer} on ${s.unitDate}, before deployment on ${s.importDate}; business verification by ${s.verifyBy} on ${s.verifyDate} after deployment, as permitted by the emergency change procedure. Evidence attached to the SNOW testing tasks.`
      : `A2/A3 – Unit test by ${s.developer} on ${s.unitDate} and UAT by ${s.uatBy} on ${s.uatDate}, both before deployment on ${s.importDate}. Evidence attached to the SNOW testing tasks.`;
  const a4 = isStd(s)
    ? `A4 – Listed in the standard change catalogue (${s.catalogue}) and approved by the change coordinator on ${s.apprDate}, before deployment on ${s.importDate}; back-out plan documented.`
    : isEmergency(s)
      ? `A4 – ECAB approval on ${s.apprDate} before deployment on ${s.importDate}, and retrospective CAB review on ${s.retroDate}; back-out plan documented.`
      : `A4 – Business owner and CAB / change manager approvals dated ${s.apprDate}, before deployment on ${s.importDate}; back-out plan documented.`;
  const tester = s.uatBy || s.verifyBy;
  const a5 = sodMet(s)
    ? `A5 – STMS import history: developer ${s.developer} differs from the implementer ${s.implementer}${tester ? ` and from the ${s.uatBy ? "UAT tester" : "business verifier"} ${tester}` : ""}.`
    : `A5 – STMS import history: the developer ${s.developer} also imported the transport into production (implementer ${s.implementer}) – segregation of duties not met.`;
  return [a1, a23, a4, a5].join(" ");
};

// One summary bullet per sample
export const sampleSummary = (s, i) => {
  const head = `Sample ${i + 1} – ${s.tr} (Solman ${s.cr}, ${s.type.toLowerCase()})`;
  if (isMissing(s))
    return { head, tone: "warn", text: `Not tested – SNOW change request record not provided, so none of the ${ATTRIBUTES.length} attributes could be assessed. Treated as an exception until the evidence is supplied.` };
  if (s.result === "Fail")
    return {
      head,
      tone: "bad",
      text: `Exception on attribute 5 (segregation of duties) – developer ${s.developer} also imported the transport into production on ${s.importDate}. Request, testing (unit ${s.unitDate}, UAT ${s.uatDate}) and approvals were otherwise in place.`,
    };
  const test = s.testNA ? "testing N/A per standard catalogue" : isEmergency(s) ? `unit test ${s.unitDate} before import, business verification ${s.verifyDate}` : `unit test ${s.unitDate} and UAT ${s.uatDate} before import on ${s.importDate}`;
  const appr = isStd(s) ? `catalogue ${s.catalogue} + change coordinator ${s.apprDate}` : isEmergency(s) ? `ECAB ${s.apprDate}, retrospective CAB ${s.retroDate}` : `approved ${s.apprDate}`;
  return { head, tone: "ok", text: `No exception – ${test}; ${appr}; developer ${s.developer} ≠ implementer ${s.implementer}.${s.note ? ` ${s.note}.` : ""}` };
};

// √ / X / N/A / not-tested counts for each attribute
export const attributeSummary = (samples) =>
  ATTRIBUTES.map((a, k) => {
    const marks = samples.map((s) => s.attrs[k]);
    const ok = marks.filter((m) => m === "√").length;
    const x = marks.filter((m) => m === "X").length;
    const na = marks.filter((m) => m === "N/A").length;
    const nt = marks.filter((m) => m === "NT").length;
    const failed = samples.filter((s) => s.attrs[k] === "X").map((s) => s.tr);
    const naList = samples.filter((s) => s.attrs[k] === "N/A").map((s) => s.tr);
    const parts = [];
    if (x) parts.push(`Exception in ${failed.join(", ")}.`);
    if (nt) parts.push(`${nt} sample(s) not tested – evidence missing.`);
    if (na) parts.push(`N/A for ${naList.join(", ")} – testing not required per the standard change catalogue (reason recorded).`);
    if (!parts.length) parts.push(`All ${ok} samples met the attribute.`);
    return {
      n: k + 1,
      attribute: a.short,
      tested: samples.length - nt,
      ok,
      x,
      na,
      nt,
      conclusion: x ? "Exception" : nt ? "Not fully tested" : "No exception",
      comment: parts.join(" "),
    };
  });

// Summary of the test procedures performed (Summary sheet and chat)
export const testProcedures = ({ source, sampleMethod, samples }) => {
  const st = stats(samples);
  const sum = attributeSummary(samples);
  return [
    { step: "Testing method", detail: `${RCM.testingMethod}. Inquiry of the control owner on the change process; inspection of SNOW, Solman and STMS records; re-performance of the segregation-of-duties check.` },
    {
      step: "IPE",
      detail: source === "actt"
        ? `Population extracted by ACTT from CIP, client 500; reliance placed on the system-generated extract (${IPE_ACTT.length} of ${IPE_ACTT.length} checks passed).`
        : `Completeness, accuracy and screenshot checks performed on the uploaded E070 / STMS extracts – ${IPE_MANUAL.length} of ${IPE_MANUAL.length} checks passed.`,
    },
    { step: "Population", detail: `${POPULATION.transports} transport requests imported into production in the period ${RCM.period}, matched to ${POPULATION.uniqueCRs} Solman requests and mapped to SNOW change types (${typeSplit()}).` },
    { step: "Sampling methodology", detail: `${SAMPLING.method}, per the client sampling methodology for an event-based control. ${sampleMethod || ""}`.trim() },
    { step: "Number of samples", detail: `${samples.length} samples – ${countByType(samples)}.` },
    {
      step: "Attributes assessed",
      detail: `${ATTRIBUTES.length} attributes per sample, each against the criteria for the sample's change type: ${sum.map((a) => `A${a.n} ${a.attribute} (${a.ok} √, ${a.x} X${a.na ? `, ${a.na} N/A` : ""}${a.nt ? `, ${a.nt} NT` : ""})`).join("; ")}.`,
    },
    {
      step: "Overall conclusion",
      detail: `${st.verdict.toUpperCase()} – ${st.passed} of ${samples.length} samples passed, ${st.exceptions} exception(s)${st.exceptions ? `: ${samples.filter((s) => s.result !== "Pass").map((s) => `${s.tr} (${isMissing(s) ? "not tested – evidence not provided" : "segregation of duties"})`).join(", ")}` : ""}.`,
    },
  ];
};

export const IMPROVEMENTS = [
  { ref: "IO-1", area: "Segregation of duties", priority: "High", observation: "A developer was able to import their own transport into production (CIDK905003).", recommendation: "Restrict the STMS import authorisation (S_CTS_ADMI / S_TRANSPRT) so developers cannot import transports they own; add a system check that blocks import when developer = implementer." },
  { ref: "IO-2", area: "Evidence retention", priority: "High", observation: "The SNOW change request record for one sampled change could not be produced at the time of testing (CIDK905611).", recommendation: "Make test evidence, approvals and the back-out plan mandatory on the SNOW change request before it can move to 'Implement'." },
  { ref: "IO-3", area: "Monitoring", priority: "Medium", observation: "No periodic reconciliation of STMS imports to approved SNOW change requests was evident.", recommendation: "Run a weekly automated reconciliation of STMS imports to approved SNOW change requests and review it with sign-off by the change manager." },
  { ref: "IO-4", area: "Standard changes", priority: "Medium", observation: "3 of 10 samples were standard (pre-approved) changes, one with testing marked not required under the catalogue.", recommendation: "Review and re-approve the standard change catalogue at least annually, including which catalogue items may skip testing, with change manager and application owner sign-off." },
  { ref: "IO-5", area: "Traceability", priority: "Low", observation: "Solman request numbers are taken from the free-text transport short description.", recommendation: "Enforce a mandatory Solman request reference in the transport description (or a Solman-only release) so every transport maps to a Solman request and SNOW change request." },
];
