// ─────────────────────────────────────────────────────────────────────────────
// ITGC Change Management – fixed demo data.
// The demo returns these results whatever files are uploaded. Edit here to
// change what the chat shows and what goes into the Testing Work Paper.
// ─────────────────────────────────────────────────────────────────────────────

// What the tool "reads" from the uploaded RCM
export const RCM = {
  controlId: "ITGC-CM-1.1.3",
  name: "SAP change management – testing, approval and migration of changes",
  objective:
    "Changes to the SAP production environment are authorised, tested and approved before implementation, so that only intended and validated changes reach production.",
  risk:
    "Unauthorised, untested or erroneous changes are migrated to SAP production, impacting the integrity of financial data and the reliability of automated controls and reports.",
  description:
    "Every change to SAP production (CIP, client 500) is raised as a ticket in ServiceNow and mapped to a change request (CR) in Solution Manager. Unit testing and UAT are performed by the business or appropriate persons and evidenced in Solman before implementation. Standard changes are approved by the functional owner and the change manager; pre-approved changes must be on the pre-approved change list. The developer (transport owner) cannot import the transport into production.",
  nature: "Preventive / manual (IT-dependent)",
  frequency: "Ad hoc – multiple times a day",
  key: "Yes",
  owner: "SAP Application Owner / Change Manager",
  systems: "SAP ECC (CIP, client 500); SAP Solution Manager (Solman); ServiceNow; STMS",
  testApproach: "Random sample of 10 from the population of transports imported into production in the period",
  period: "09.04.2025 - 31.07.2025",
  environment: "SAP ECC – production system CIP, client 500",
};

export const ATTRIBUTES = [
  { short: "Tested prior to implementation", text: "Changes are tested by the business team / appropriate persons prior to implementation. Where applicable, relevant types of testing are performed per policy." },
  { short: "Testing documented & retained", text: "Testing results are documented and retained within the ticketing or appropriate system (Solman / ServiceNow)." },
  { short: "Approved before migration", text: "Changes are approved by the functional owner and change manager before migration to production, or are on the pre-approved change list." },
  { short: "Segregation of duties", text: "The transport owner (developer) is not the user who imports the transport into production." },
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
  matchProof: [
    { tr: "CIDK905757", cr: "7000004365", e070: 29, stms: 21, owner: "873379", user: "1094229", date: "21.05.2025" },
    { tr: "CIDK905769", cr: "7000004366", e070: 32, stms: 19, owner: "1149116", user: "1094229", date: "19.05.2025" },
    { tr: "CIDK905906", cr: "7000004387", e070: 63, stms: 81, owner: "870144", user: "1094229", date: "30.07.2025" },
  ],
};

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

const STD = "Standard change";
const PRE = "Preapproved change";

// owner = developer / transport owner, user = person who imported into production
const BASE_SAMPLES = [
  { tr: "CIDK905003", cr: "6000027444", ticket: "CHG0041207", type: STD, owner: "1094229", user: "1094229", unitDate: "14.04.2025", uatBy: "873379", uatDate: "16.04.2025", apprDate: "16.04.2025", importDate: "17.04.2025", attrs: ["√", "√", "√", "X"], result: "Fail", note: "SOD violation: transport owner = transport user" },
  { tr: "CIDK905677", cr: "7000004355", ticket: "CHG0041562", type: PRE, owner: "870144", user: "1094229", unitDate: "06.05.2025", uatBy: "1149116", uatDate: "07.05.2025", apprDate: "07.05.2025", importDate: "08.05.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905761", cr: "6000028726", ticket: "CHG0041733", type: STD, owner: "873379", user: "1094229", unitDate: "19.05.2025", uatBy: "870144", uatDate: "21.05.2025", apprDate: "21.05.2025", importDate: "22.05.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905771", cr: "6000028584", ticket: "CHG0041748", type: STD, owner: "1149116", user: "1094229", unitDate: "20.05.2025", uatBy: "873379", uatDate: "22.05.2025", apprDate: "22.05.2025", importDate: "23.05.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905812", cr: "7000004371", ticket: "CHG0041890", type: PRE, owner: "870144", user: "1094229", unitDate: "03.06.2025", uatBy: "1149116", uatDate: "04.06.2025", apprDate: "04.06.2025", importDate: "05.06.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905828", cr: "6000028748", ticket: "CHG0041925", type: STD, owner: "873379", user: "1094229", unitDate: "10.06.2025", uatBy: "870144", uatDate: "12.06.2025", apprDate: "12.06.2025", importDate: "13.06.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905879", cr: "7000004376", ticket: "CHG0042188", type: PRE, owner: "1149116", user: "1094229", unitDate: "08.07.2025", uatBy: "873379", uatDate: "09.07.2025", apprDate: "09.07.2025", importDate: "10.07.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905902", cr: "7000004385", ticket: "CHG0042301", type: PRE, owner: "870144", user: "1094229", unitDate: "22.07.2025", uatBy: "1149116", uatDate: "23.07.2025", apprDate: "23.07.2025", importDate: "24.07.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905922", cr: "7000004393", ticket: "CHG0042356", type: PRE, owner: "873379", user: "1094229", unitDate: "28.07.2025", uatBy: "870144", uatDate: "29.07.2025", apprDate: "29.07.2025", importDate: "30.07.2025", attrs: ["√", "√", "√", "√"], result: "Pass" },
  { tr: "CIDK905611", cr: "6000028397", ticket: "", type: "Unknown – PDF not provided", owner: "", user: "", attrs: ["NT", "NT", "NT", "NT"], result: "Missing", note: "Ticket history PDF not provided – ITGC checks could not be performed" },
];

// After the control owner accepts a reviewer observation and testing is
// re-performed, the missing ticket history has been supplied, so the
// CIDK905611 sample can be tested. The SoD exception on CIDK905003 remains.
const RETEST_905611 = {
  tr: "CIDK905611", cr: "6000028397", ticket: "CHG0041650", type: STD, owner: "1149116", user: "1094229",
  unitDate: "12.05.2025", uatBy: "870144", uatDate: "13.05.2025", apprDate: "13.05.2025", importDate: "14.05.2025",
  attrs: ["√", "√", "√", "√"], result: "Pass", note: "Re-tested in round 2 using the ticket history supplied by the control owner",
};

export const getSamples = (round = 1) => (round > 1 ? BASE_SAMPLES.map((s) => (s.tr === "CIDK905611" ? RETEST_905611 : s)) : BASE_SAMPLES);

export const stats = (samples) => {
  const passed = samples.filter((s) => s.result === "Pass").length;
  const exceptions = samples.length - passed;
  return { passed, exceptions, verdict: exceptions ? "Ineffective" : "Effective" };
};

export const isPre = (s) => s.type === PRE;
export const isStd = (s) => s.type === STD;

export const evidenceRefs = (s) => {
  if (s.result === "Missing") return "No supporting documents matched.";
  const refs = [`CR Form: CR ${s.cr} - Ticket History.pdf (p.1)`, `Test Case: Test Evidence - ${s.tr}.pdf (p.2)`];
  if (isStd(s)) refs.push(`Functional Owner: RE_ Approval ${s.cr}.msg`);
  refs.push(`Change Manager: RE_ CM Approval ${s.cr}.msg`);
  if (isPre(s)) refs.push("Pre-Approved: Pre-Approved Change List 2025.xlsx");
  return refs.join(" | ");
};

export const testingPerformed = (s) => {
  if (s.result === "Missing") return "Not tested – the ticket history PDF for this change was not provided, so attributes 1 to 4 could not be assessed.";
  const appr = isPre(s)
    ? "The change is on the pre-approved change list and the change manager approval was inspected."
    : `Functional owner and change manager approvals were inspected, dated ${s.apprDate}, before the import on ${s.importDate}.`;
  const sod =
    s.owner === s.user
      ? `Transport owner (${s.owner}) is the same user who imported the transport into production (${s.user}) – segregation of duties not met.`
      : `Transport owner (${s.owner}) differs from the user who imported it into production (${s.user}).`;
  return `Unit testing performed by ${s.owner} on ${s.unitDate}; UAT completed by ${s.uatBy} on ${s.uatDate}, before the import on ${s.importDate}. Evidence retained in Solman CR ${s.cr}. ${appr} ${sod}`;
};

// One summary bullet per sample
export const sampleSummary = (s, i) => {
  const head = `Sample ${i + 1} – ${s.tr} (CR ${s.cr}${s.result === "Missing" ? "" : `, ${s.type.toLowerCase()}`})`;
  if (s.result === "Missing")
    return { head, tone: "warn", text: "Not tested – ticket history PDF not provided, so none of the 4 attributes could be assessed. Treated as an exception until the evidence is supplied." };
  if (s.result === "Fail")
    return {
      head,
      tone: "bad",
      text: `Exception on attribute 4 (segregation of duties) – transport owner ${s.owner} also imported the transport into production on ${s.importDate}. Testing (unit ${s.unitDate}, UAT ${s.uatDate}) and approvals were otherwise in place.`,
    };
  return {
    head,
    tone: "ok",
    text: `No exception – unit test ${s.unitDate} and UAT ${s.uatDate} before import on ${s.importDate}; ${isPre(s) ? "on the pre-approved change list" : `approved on ${s.apprDate}`}; owner ${s.owner} ≠ importer ${s.user}.${s.note ? ` ${s.note}.` : ""}`,
  };
};

// Pass / exception / not-tested counts for each attribute
export const attributeSummary = (samples) =>
  ATTRIBUTES.map((a, k) => {
    const marks = samples.map((s) => s.attrs[k]);
    const ok = marks.filter((m) => m === "√").length;
    const x = marks.filter((m) => m === "X").length;
    const nt = marks.filter((m) => m === "NT").length;
    const failed = samples.filter((s) => s.attrs[k] === "X").map((s) => s.tr);
    return {
      n: k + 1,
      attribute: a.short,
      tested: samples.length - nt,
      ok,
      x,
      nt,
      conclusion: x ? "Exception" : nt ? "Not fully tested" : "No exception",
      comment: x
        ? `Exception in ${failed.join(", ")}.`
        : nt
          ? `${nt} sample(s) not tested – evidence missing.`
          : `All ${ok} samples met the attribute.`,
    };
  });

export const IMPROVEMENTS = [
  { ref: "IO-1", area: "Segregation of duties", priority: "High", observation: "A developer was able to import their own transport into production (CIDK905003).", recommendation: "Restrict the STMS import authorisation (S_CTS_ADMI / S_TRANSPRT) so developers cannot import transports they own; add a system check that blocks import when owner = import user." },
  { ref: "IO-2", area: "Evidence retention", priority: "High", observation: "Ticket history for one sampled change could not be produced at the time of testing (CIDK905611).", recommendation: "Make test evidence and approvals mandatory attachments in Solman / ServiceNow before a CR can move to 'To be imported'." },
  { ref: "IO-3", area: "Monitoring", priority: "Medium", observation: "No periodic reconciliation of STMS imports to approved CRs was evident.", recommendation: "Run a weekly automated reconciliation of STMS imports to approved CRs and review it with sign-off by the change manager." },
  { ref: "IO-4", area: "Pre-approved changes", priority: "Medium", observation: "5 of 10 samples relied on the pre-approved change list.", recommendation: "Review and re-approve the pre-approved change list at least annually, with change manager and application owner sign-off." },
  { ref: "IO-5", area: "Traceability", priority: "Low", observation: "CR numbers are taken from the free-text transport short description.", recommendation: "Enforce a mandatory CR reference format in the transport description (or a Solman-only release) so every transport maps to a CR." },
];
