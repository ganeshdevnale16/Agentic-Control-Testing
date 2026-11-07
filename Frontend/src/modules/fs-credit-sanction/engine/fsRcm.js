// RCM, preliminary design read and test-of-design plan for the credit
// sanction (DoA) control, built from the credit policy, RCM and walkthrough note.
import { fmtDate, plural } from "../../nfs-vendor-bank/engine/util";

const surname = (s) => (String(s).match(/([A-Z][a-z]{2,})\b/g) || []).pop() || "";

export function buildFsRcm({ policy, wt, note, today = new Date() }) {
  const ctl = wt?.controls?.find((c) => /DoA|delegat|sanction|authority/i.test(`${c.controlDesc} ${c.riskDesc}`)) || wt?.controls?.[0];
  const controlId = ctl?.controlId || "CR-07";
  const owner = ctl?.owner || policy.owner || "Control owner";
  const cl = policy.clauses;
  const asOf = note?.date || today;

  const control = {
    id: controlId,
    name: `${controlId} – Credit sanction within delegated authority`,
    riskId: ctl?.riskId || "R-CR-03",
    riskDesc: ctl?.riskDesc || "Loans sanctioned beyond delegated authority.",
    description: ctl?.controlDesc || "",
    owner,
    type: ctl?.type || "Preventive",
    nature: ctl?.nature || "IT-dependent manual",
    frequency: ctl?.frequency || "Per transaction",
    assertion: ctl?.assertion || "Occurrence / Authorisation",
    company: policy.company || wt?.meta?.company?.split(" - ")[0] || "",
    process: wt?.meta?.process || "Lending",
    subProcess: wt?.meta?.subProcess || "Credit Sanction",
  };

  const activities = [
    { letter: "a", kind: "route", id: `${controlId}.a`, name: "LOS routing to sanctioning authority", text: "LOS routes each proposal to the authority per the DoA role limits.", type: "Preventive", frequency: "Per transaction", performer: "CredFlow LOS", sopRef: "7.1, 7.2" },
    { letter: "b", kind: "approve", id: `${controlId}.b`, name: "Sanction by the delegated authority", text: "The sanctioning authority approves within its delegated limit; originator cannot approve.", type: "Preventive", frequency: "Per transaction", performer: "Sanctioning authority", sopRef: "7.2, 7.4" },
    { letter: "c", kind: "committee", id: `${controlId}.c`, name: "Committee minutes before sanction", text: "Signed committee minutes uploaded before the sanction status moves to Approved.", type: "Preventive", frequency: "Per committee proposal", performer: "Zonal credit secretariat", sopRef: "7.3" },
  ];

  // ── RCM ↔ policy ↔ walkthrough consistency ─────────────────────────────
  const consistency = [];
  const add = (check, ok, detail, status) => consistency.push({ check, result: status || (ok ? "Agrees" : "Differs"), detail });
  add("Control owner", surname(owner) && /chief credit officer/i.test(owner) === /chief credit officer/i.test(policy.owner), `RCM: ${owner} · Policy: ${policy.owner || "–"}`);
  const rcmVer = (ctl?.controlDesc.match(/v(\d+\.\d+)/i) || [])[1];
  add("Policy version referenced", !rcmVer || rcmVer === policy.version, `RCM: v${rcmVer || "–"} · Policy: v${policy.version}`);
  add("DoA matrix in policy", policy.doa.length > 0, `${plural(policy.doa.length, "authority level")} in section 7.2`);
  if (note) {
    add("Routing basis", /proposal amount/i.test(note.raw) === (policy.basis === "proposal"), `Walkthrough: routed on proposal amount · Policy 7.1: ${policy.basis === "proposal" ? "amount of the proposal" : policy.basis || "–"}`);
    const zch = note.find("Zonal Credit Head role was given approval rights");
    add("Approval rights per walkthrough", !zch, zch ? `Walkthrough ${zch.ref}: Zonal Credit Head approves individually – not a DoA authority` : "All approvers are DoA authorities", zch ? "Gap" : undefined);
    add("Walkthrough sample", !!note.sample, note.sample || "Not stated", note.sample ? "Agrees" : "Noted");
  }

  // ── preliminary design read of the policy ──────────────────────────────
  const design = [];
  const D = (id, attr, area, status, severity, observation, ref) => design.push({ id, attr, area, status, severity, observation, recommendation: "", ref });
  const current = policy.reviewDue ? policy.reviewDue >= asOf : null;
  D("D1", "A2", "Policy approval and currency", current === false ? "Gap" : "Adequate", current === false ? "Medium" : "–", `Credit Policy v${policy.version} approved by ${policy.approvedBy} ${fmtDate(policy.approvalDate)}; ${policy.reviewFrequency.toLowerCase()} review, next due ${fmtDate(policy.reviewDue)}${current === false ? " – overdue at walkthrough" : ""}.`, "Document control");
  D("D2", "A4", "Basis of the authority limit", policy.basis === "proposal" ? "Gap" : "Adequate", policy.basis === "proposal" ? "High" : "–", policy.basis === "proposal" ? "Policy 7.1 sets authority by the amount of the proposal under consideration, not the borrower's total exposure – existing facilities are ignored." : "Authority is set on total exposure.", "7.1");
  D("D3", "A6", "Committee minutes before sanction", /before the proposal is marked as sanctioned/i.test(cl["7.3"] || "") ? "To test" : "Gap", "–", "Policy 7.3 requires signed ZCC minutes in LOS before sanction – system enforcement to be tested.", "7.3");
  D("D4", "A7", "Independence of approver", /originated by himself or herself/i.test(cl["7.4"] || "") ? "Adequate" : "Gap", "–", "Policy 7.4: no officer sanctions or recommends a proposal they originated.", "7.4");
  D("D5", "A9", "Sanctions beyond authority", cl["7.6"] ? "Adequate" : "Gap", "–", cl["7.6"] ? "Policy 7.6: report to CCO within two working days, HOCC ratification, quarterly to Audit Committee." : "No escalation defined.", "7.6");
  D("D6", "A5", "System enforcement of DoA (IT dependency)", "To test", "–", "Policy 7.7: limits configured in LOS by IT Security on written instruction from CPU – tested with the Role Limit Master.", "7.7");
  D("D7", "A8", "Change control over LOS limits", cl["7.7"] ? "To test" : "Gap", "–", "Configuration changes must be on written CPU instruction and logged.", "7.7");
  const gaps = design.filter((d) => d.status === "Gap");
  const designConclusion = gaps.some((g) => g.severity === "High") ? "Design gaps indicated – to be concluded by the test of design" : "No design gaps indicated so far";

  // ── test-of-design attributes ──────────────────────────────────────────
  const attributes = [
    { id: "A1", act: "overall", label: "Risk linkage", criterion: "Control addresses the stated risk and assertion", procedure: "Compared RCM risk and control description to policy section 7.", evidence: ["FS-02", "FS-01"], severity: "High" },
    { id: "A2", act: "overall", label: "Policy governance", criterion: "Policy exists, is approved and within its review cycle", procedure: "Inspected policy document control for approval and next review date; confirmed version in force at walkthrough.", evidence: ["FS-01", "FS-04"], severity: "Medium" },
    { id: "A3", act: "overall", label: "Ownership and authority", criterion: "Named owner with authority to act", procedure: "Agreed control owner in RCM to policy owner and walkthrough.", evidence: ["FS-02", "FS-01", "FS-04"], severity: "Medium" },
    { id: "A4", act: "route", label: "Precision of authority limit", criterion: "Authority is determined on a basis that captures the full credit risk (total exposure)", procedure: "Read policy 7.1; inspected LOS routing parameter; compared proposal amount and total exposure in the sample.", evidence: ["FS-01", "FS-03", "FS-05", "FS-04"], severity: "High" },
    { id: "A5", act: "it", label: "System alignment (LOS limits = DoA)", criterion: "LOS role limits agree to the DoA matrix in policy 7.2", procedure: "Agreed each LOS role and limit (RLM-01) to policy 7.2; inquired on changes.", evidence: ["FS-03", "FS-01", "FS-04"], severity: "High" },
    { id: "A6", act: "committee", label: "Committee approval evidence", criterion: "Signed minutes are mandatory before a committee proposal is sanctioned", procedure: "Read policy 7.3 and RCM; inspected workflow parameter for minutes upload; inquired.", evidence: ["FS-01", "FS-02", "FS-03", "FS-04"], severity: "High" },
    { id: "A7", act: "approve", label: "Segregation of duties", criterion: "Originator cannot recommend or approve their own proposal", procedure: "Read policy 7.4; inspected workflow parameter; traced originator and approver in the sample trail.", evidence: ["FS-01", "FS-03", "FS-05", "FS-04"], severity: "High" },
    { id: "A8", act: "it", label: "Configuration change control", criterion: "Changes to LOS limits and workflow are authorised in writing and logged", procedure: "Read policy 7.7; inspected last-modified details in RLM-01 / WFP-02; requested change instructions.", evidence: ["FS-01", "FS-03", "FS-04"], severity: "High" },
    { id: "A9", act: "overall", label: "Exceptions and escalation", criterion: "Sanctions beyond authority are identified, escalated and ratified", procedure: "Read policy 7.5–7.6; inspected deviation routing; inquired on cases.", evidence: ["FS-01", "FS-03", "FS-04"], severity: "Medium" },
    { id: "A10", act: "overall", label: "Evidence of performance", criterion: "Approval leaves a retained, system-generated trail", procedure: "Inspected the sanction memo approval trail (user, role, timestamp) and configuration log setting.", evidence: ["FS-05", "FS-03", "FS-04"], severity: "Low" },
  ].map((a) => ({ ...a, activity: a.act === "overall" ? controlId : a.act === "it" ? `${controlId}.IT` : activities.find((x) => x.kind === a.act)?.id || controlId }));

  const evidenceRequests = [
    { id: "E1", code: "FS-03", name: "LOS Role Limit Master (RLM-01)", kind: "roles", for: "A4, A5, A8", note: "Production extract" },
    { id: "E2", code: "FS-03", name: "LOS sanction workflow parameters (WFP-02)", kind: "params", for: "A4, A6, A7, A8, A9, A10", note: "Production extract" },
    { id: "E3", code: "FS-05", name: "Sanction memo with LOS approval trail for the walkthrough sample", kind: "memo", for: "A4, A7, A10", note: note?.sample || "Walkthrough sample" },
  ];

  const rcmRows = [
    ...activities.map((a) => ({
      process: control.process,
      subProcess: control.subProcess,
      riskId: control.riskId,
      riskDesc: control.riskDesc,
      controlId: a.id,
      activity: a.name,
      description: a.text,
      type: a.type,
      nature: a.kind === "route" ? "Automated" : "IT-dependent manual",
      frequency: a.frequency,
      performer: a.performer,
      owner,
      assertion: control.assertion,
      sopRef: `Policy ${a.sopRef}`,
      attributes: attributes.filter((x) => x.act === a.kind).map((x) => x.id).join(", "),
      sample: "Test of one (walkthrough)",
      design: design.some((d) => d.status === "Gap" && attributes.find((x) => x.id === d.attr)?.act === a.kind) ? "Gap – see test of design" : "To test",
    })),
    { process: control.process, subProcess: control.subProcess, riskId: control.riskId, riskDesc: control.riskDesc, controlId: `${controlId}.IT`, activity: "LOS role limits & workflow configuration (IT dependency)", description: "DoA limits and sanction workflow rules are configured in CredFlow LOS by IT Security on written CPU instruction; changes logged.", type: "Preventive", nature: "Automated / ITGC", frequency: "Continuous", performer: "IT Security", owner, assertion: "Authorisation", sopRef: "Policy 7.7", attributes: "A5, A8", sample: "Test of one (configuration)", design: "To test" },
  ];

  const s = (text, status = "pass", log) => ({ text, status, log: log ? [log] : undefined });
  const procedures = [
    { id: "p-pol", label: "Read the credit policy", detail: `${policy.name} – v${policy.version}`, subChecks: [s(`Credit Policy v${policy.version} approved by ${policy.approvedBy} on ${fmtDate(policy.approvalDate)}`, "pass", `[READ] ${policy.name}`), s(`Next review due ${fmtDate(policy.reviewDue)} (${policy.reviewFrequency})`, current === false ? "exception" : "pass"), s(`DoA matrix: ${policy.doa.map((d) => `${d.authority} ${d.limitText}`).join("; ")}`), s(`Authority basis (7.1): ${policy.basis === "proposal" ? "amount of the proposal" : policy.basis}`, policy.basis === "proposal" ? "exception" : "pass")] },
    { id: "p-rcm", label: "Read the RCM", detail: wt ? `${wt.name} › ${wt.sheet}` : "No RCM", subChecks: wt ? [s(`${plural(wt.controls.length, "control")} found; testing ${controlId} (${control.riskId})`, "pass", `[READ] ${wt.name}`), s(`Owner: ${owner}`), s(`Type / nature / frequency: ${control.type} · ${control.nature} · ${control.frequency}`)] : [s("No RCM provided", "info")] },
    ...(note ? [{ id: "p-note", label: "Read the walkthrough note", detail: `${note.name} – ${fmtDate(note.date)}`, subChecks: [s(`Performed by ${note.performedBy}`, "pass", `[READ] ${note.name}`), s(`Sample traced: ${note.sample}`), s(`${Object.keys(note.clauses).length} narrative points indexed for corroboration (T)`)] }] : []),
    { id: "p-map", label: "Validate RCM and walkthrough against the policy", detail: "Owner, version, routing basis and approvers must agree.", subChecks: consistency.map((c) => s(`${c.check}: ${c.detail}`, c.result === "Agrees" || c.result === "Noted" ? "pass" : "exception")) },
    { id: "p-design", label: "Preliminary design read of the policy", detail: "Concluded by the test of design in step 4.", subChecks: design.map((d) => s(`${d.id} ${d.area}: ${d.status === "Gap" ? `gap (${d.severity})` : d.status.toLowerCase()}`, d.status === "Gap" ? "exception" : d.status === "To test" ? "info" : "pass")) },
    { id: "p-plan", label: "Generate RCM and test plan", detail: "RCM rows, test-of-design attributes and evidence request list.", subChecks: [s(`${rcmRows.length} RCM rows`), s(`${attributes.length} test-of-design attributes (A1–A${attributes.length})`), s(`${evidenceRequests.length} evidence items requested`)] },
  ];

  return { control, activities, consistency, design, gaps, designConclusion, attributes, evidenceRequests, rcmRows, wt, note, procedures, labels: { doc: "Policy", consistencySheet: "Walkthrough vs Policy" } };
}
