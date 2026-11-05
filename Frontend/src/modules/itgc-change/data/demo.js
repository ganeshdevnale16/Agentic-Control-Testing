// ─────────────────────────────────────────────────────────────────────────────
// ITGC 1.1.3 Change Management – fixed demo data.
// The demo returns these results whatever files are uploaded. Edit here to
// change what the chat shows and what goes into the Testing Work Paper.
// ─────────────────────────────────────────────────────────────────────────────

export const CONTROL = {
  ref: "ITGC 1.1.3",
  name: "Change management – testing and approval of changes",
  process: "Change",
  client: "Client name",
  description:
    "Changes to the SAP production environment (CIP, client 500) are tested by the business or appropriate persons prior to implementation, testing results are documented and retained in the ticketing system, and changes are approved before migration. The person who develops a change does not migrate it to production.",
  todSteps:
    "1. Obtain the population of transports imported into production during the in-scope period (E070 / STMS).\n2. Validate completeness and accuracy of the population (IPE).\n3. Select samples.\n4. For each sample, inspect the ServiceNow ticket, Solman CR history and approval evidence and assess each control attribute.\n5. Conclude on the operating effectiveness of the control.",
  testingMethod: "Inspection",
  frequency: "Multiple times a day (ad hoc)",
  period: "09.04.2025 - 31.07.2025",
  environment: "SAP ECC – production system CIP, client 500",
  attributes: [
    "Changes are tested by Business team/appropriate persons prior to implementation. Where applicable, consider relevant types of testing based on Policy directives.",
    "Testing results are documented and retained within the ticketing or appropriate system.",
    "Changes are approved by appropriate personnel (functional owner / change manager, or listed on the pre-approved change list) prior to migration, and the transport owner is not the person who imports the transport into production (segregation of duties).",
  ],
};

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

// IPE checks when the population is uploaded manually
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

// IPE position when the population is pulled from ACTT
export const IPE_ACTT = [
  { layer: "Source", check: "Population extracted by ACTT directly from production system CIP, client 500", value: "CIP 500" },
  { layer: "Source", check: "Extraction parameters match the in-scope period", value: "09.04.2025 to 31.07.2025" },
  { layer: "Completeness", check: "ACTT record count reconciles to E070 / STMS tables in the system", value: "87" },
  { layer: "Integrity", check: "Population delivered without manual handling or editing", value: "System-generated" },
].map((c) => ({ ...c, result: "Pass" }));

export const ACTT_IPE_STATEMENT =
  "IPE passed – the population was pulled directly from the system using ACTT. As a system-generated extract with no manual handling, reliance is placed on the ACTT extraction for completeness and accuracy, so no separate screenshot reconciliation is needed.";

export const MANUAL_IPE_STATEMENT =
  "IPE passed – completeness and accuracy of the uploaded population were validated across 3 layers (completeness, accuracy and screenshot verification): 11 of 11 checks passed.";

const STD = "Standard change";
const PRE = "Preapproved change";

// owner = developer / transport owner, user = person who imported into production
export const SAMPLES = [
  { tr: "CIDK905003", cr: "6000027444", ticket: "CHG0041207", type: STD, owner: "1094229", user: "1094229", unitDate: "14.04.2025", uatBy: "873379", uatDate: "16.04.2025", importDate: "17.04.2025", attrs: ["√", "√", "X"], result: "Fail", note: "SOD violation: transport owner = transport user" },
  { tr: "CIDK905677", cr: "7000004355", ticket: "CHG0041562", type: PRE, owner: "870144", user: "1094229", unitDate: "06.05.2025", uatBy: "1149116", uatDate: "07.05.2025", importDate: "08.05.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905761", cr: "6000028726", ticket: "CHG0041733", type: STD, owner: "873379", user: "1094229", unitDate: "19.05.2025", uatBy: "870144", uatDate: "21.05.2025", importDate: "22.05.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905771", cr: "6000028584", ticket: "CHG0041748", type: STD, owner: "1149116", user: "1094229", unitDate: "20.05.2025", uatBy: "873379", uatDate: "22.05.2025", importDate: "23.05.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905812", cr: "7000004371", ticket: "CHG0041890", type: PRE, owner: "870144", user: "1094229", unitDate: "03.06.2025", uatBy: "1149116", uatDate: "04.06.2025", importDate: "05.06.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905828", cr: "6000028748", ticket: "CHG0041925", type: STD, owner: "873379", user: "1094229", unitDate: "10.06.2025", uatBy: "870144", uatDate: "12.06.2025", importDate: "13.06.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905879", cr: "7000004376", ticket: "CHG0042188", type: PRE, owner: "1149116", user: "1094229", unitDate: "08.07.2025", uatBy: "873379", uatDate: "09.07.2025", importDate: "10.07.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905902", cr: "7000004385", ticket: "CHG0042301", type: PRE, owner: "870144", user: "1094229", unitDate: "22.07.2025", uatBy: "1149116", uatDate: "23.07.2025", importDate: "24.07.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905922", cr: "7000004393", ticket: "CHG0042356", type: PRE, owner: "873379", user: "1094229", unitDate: "28.07.2025", uatBy: "870144", uatDate: "29.07.2025", importDate: "30.07.2025", attrs: ["√", "√", "√"], result: "Pass" },
  { tr: "CIDK905611", cr: "6000028397", ticket: "", type: "Unknown – PDF not provided", owner: "", user: "", attrs: ["NT", "NT", "NT"], result: "Missing", note: "Ticket history PDF not provided – ITGC checks could not be performed" },
];

export const evidenceRefs = (s) => {
  if (s.result === "Missing") return "No supporting documents matched.";
  const refs = [`CR Form (K): CR ${s.cr} - Ticket History.pdf (p.1)`, `Test Case (N): Test Evidence - ${s.tr}.pdf (p.2)`];
  if (s.type === STD) refs.push(`Functional Owner (Q): RE_ Approval ${s.cr}.msg`);
  refs.push(`Change Manager (S): RE_ CM Approval ${s.cr}.msg`);
  if (s.type === PRE) refs.push("Pre-Approved (J): Pre-Approved Change List 2025.xlsx");
  return refs.join(" | ");
};

export const testingPerformed = (s) => {
  if (s.result === "Missing") return "Not tested – the ticket history PDF for this change was not provided, so attributes 1 to 3 could not be assessed.";
  const appr =
    s.type === PRE
      ? `The change is listed on the pre-approved change list and the change manager approval was inspected.`
      : `Functional owner and change manager approvals were inspected and dated before the import on ${s.importDate}.`;
  const sod =
    s.owner === s.user
      ? `Transport owner (${s.owner}) is the same user who imported the transport into production (${s.user}) – segregation of duties not met.`
      : `Transport owner (${s.owner}) differs from the user who imported it into production (${s.user}).`;
  return `Unit testing performed by ${s.owner} on ${s.unitDate}; UAT completed by ${s.uatBy} on ${s.uatDate}, before the import on ${s.importDate}. Evidence retained in Solman CR ${s.cr}. ${appr} ${sod}`;
};

export const passed = SAMPLES.filter((s) => s.result === "Pass").length;
export const exceptions = SAMPLES.length - passed;
export const VERDICT = exceptions ? "Ineffective" : "Effective";
