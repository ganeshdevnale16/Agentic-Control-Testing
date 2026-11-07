// Test of design for CR-07 (credit sanction within delegated authority).
// Same output shape as the Non-FS engine so the shared results, report,
// workpaper and annotated-evidence code can be reused.
import { fmtDate, plural } from "../../nfs-vendor-bank/engine/util";
import { FS_KIND_LABEL, has, pageOf } from "./fsParsers";

const col = (i) => (i >= 0 ? String.fromCharCode(65 + i) : "A");
const KIND_CODE = { policy: "FS-01", rcm: "FS-02", config: "FS-03", note: "FS-04", memo: "FS-05" };
const codeOf = (name, kind) => (String(name || "").match(/\bN?FS-\d{2}/) || [])[0] || KIND_CODE[kind] || kind;
const cr = (n) => (n == null ? "–" : `INR ${Number(n).toFixed(2)} crore`);

export function runFsTest({ rcm, policy, evidence }) {
  const ev = evidence;
  const note = rcm.note;
  const wt = rcm.wt;
  const ctl = wt?.controls?.find((c) => c.controlId === rcm.control.id);
  const memo = ev.memo;
  const roles = ev.roles || [];
  const params = ev.params || [];
  const cl = policy.clauses;
  const files = {
    pol: { name: policy.name, code: codeOf(policy.name, "policy") },
    rcm: wt ? { name: wt.name, code: codeOf(wt.name, "rcm") } : null,
    note: note ? { name: note.name, code: codeOf(note.name, "note") } : null,
    cfg: ev.rolesMeta || ev.paramsMeta ? { name: (ev.rolesMeta || ev.paramsMeta).file, code: codeOf((ev.rolesMeta || ev.paramsMeta).file, "config") } : null,
    memo: memo ? { name: memo.name, code: codeOf(memo.name, "memo") } : null,
  };

  const annotations = [];
  const counters = {};
  const results = [];
  const A = (attr, src, location, highlight, note_, isT = false) => {
    if (!src) return null;
    counters[attr] = (counters[attr] || 0) + 1;
    const a = { ref: `${attr}-${counters[attr]}`, attr, code: src.code, file: src.name, location, highlight, note: note_, transcript: isT };
    annotations.push(a);
    return a;
  };
  const PQ = (attr, quote, msg) => (has(policy.raw, quote) ? A(attr, files.pol, `Page ${pageOf(policy.raw, quote) || 1}`, quote, msg) : null);
  const NQ = (attr, quote, msg) => {
    const f = note?.find(quote);
    return f ? A(attr, files.note, `Page ${f.page}${f.ref ? ` (para ${f.ref})` : ""}`, quote, msg, true) : null;
  };
  const MQ = (attr, quote, msg) => (memo && has(memo.raw, quote) ? A(attr, files.memo, `Page ${pageOf(memo.raw, quote) || 1}`, quote, msg) : null);
  const role = (code) => roles.find((r) => r.code === code);
  const param = (re) => params.find((p) => re.test(`${p.param} ${p.desc}`));
  const rm = ev.rolesMeta;
  const pm = ev.paramsMeta;
  const paramCells = (p, c0, c1) => (pm && p ? `'${pm.sheet}'!${col(pm.cols[c0])}${p.__row}${c1 ? `:${col(pm.cols[c1])}${p.__row}` : ""}` : "");
  const cellsLabel = (loc) => `Cells ${loc.split("!")[1]}`;
  const R = (id, status, observation, extra = {}) => {
    const attr = rcm.attributes.find((a) => a.id === id);
    const anns = annotations.filter((a) => a.attr === id);
    anns.forEach((a) => (a.result = status));
    const mark = status === "Pass" ? "✓" : status === "Partial" ? "◐" : status === "Not tested" ? "NT" : "✗";
    results.push({ attr, status, observation, annotations: anns, tick: `${mark}${anns.some((a) => a.transcript) ? " T" : ""}`, details: [], ...extra });
  };
  const refRange = (id) => {
    const r = annotations.filter((a) => a.attr === id).map((a) => a.ref);
    return r.length > 2 ? `${r[0]} to ${r[r.length - 1]}` : r.join(", ");
  };
  const asOf = note?.date || new Date();

  // A1 Risk linkage
  {
    if (ctl && wt.cols) {
      const loc = `'${wt.sheet}'!${col(wt.cols.riskDesc)}${ctl.__row}:${col(wt.cols.controlDesc)}${ctl.__row}`;
      A("A1", files.rcm, loc, cellsLabel(loc), `Risk ${rcm.control.riskId} (sanction beyond delegated authority) is addressed by system-enforced approval per the DoA and committee minutes.`);
    }
    PQ("A1", "No authority shall sanction a proposal above the limit delegated to it.", "Policy principle the control enforces.");
    const ok = /authority|DoA|delegat/i.test(`${rcm.control.riskDesc} ${rcm.control.description}`);
    R("A1", ok ? "Pass" : "Deficiency", ok ? `Control ${rcm.control.id} maps to risk ${rcm.control.riskId}: approval in LOS by the DoA authority with role limits and committee minutes.` : "Control does not clearly address the risk.");
  }

  // A2 Policy governance
  {
    const current = policy.reviewDue && policy.reviewDue >= asOf;
    if (policy.approvalText) PQ("A2", policy.approvalText, `v${policy.version} approved by the ${policy.approvedBy} on ${fmtDate(policy.approvalDate)}.`);
    if (policy.reviewDueText) PQ("A2", policy.reviewDueText, current ? "Within review cycle." : `${policy.reviewFrequency} review overdue by ${Math.round((asOf - policy.reviewDue) / 864e5 / 30)} months at walkthrough (${fmtDate(asOf)}).`);
    NQ("A2", `Credit Policy v${policy.version} is the policy currently in force`, "CPU confirms the overdue version is still in force; no re-approval since.");
    R("A2", current ? "Pass" : "Deficiency", current ? `Credit Policy v${policy.version} approved ${fmtDate(policy.approvalDate)}; next review ${fmtDate(policy.reviewDue)}.` : `Credit Policy v${policy.version} approved by ${policy.approvedBy} ${fmtDate(policy.approvalDate)}; ${policy.reviewFrequency.toLowerCase()} review was due ${fmtDate(policy.reviewDue)} and has not been performed. v${policy.version} remains in force at walkthrough ${fmtDate(asOf)}.`);
  }

  // A3 Ownership
  {
    if (ctl && wt.cols) {
      const loc = `'${wt.sheet}'!${col(wt.cols.owner)}${ctl.__row}`;
      A("A3", files.rcm, loc, cellsLabel(loc), `Control owner named: ${rcm.control.owner}.`);
    }
    PQ("A3", "Policy owner Chief Credit Officer", "Policy owner is the same role as the RCM control owner.");
    const ok = /chief credit officer/i.test(rcm.control.owner) && /chief credit officer/i.test(policy.owner);
    R("A3", ok ? "Pass" : "Deficiency", ok ? `Chief Credit Officer named in RCM and policy; has authority over sanction powers and escalation (policy 7.6).` : `Owner differs between RCM (${rcm.control.owner}) and policy (${policy.owner}).`);
  }

  // A4 Precision of authority limit
  if (!memo || !params.length) R("A4", "Not tested", "Sanction memo or LOS workflow parameters not provided.");
  else {
    const wf = param(/routing basis|PROPOSAL_AMT/i);
    PQ("A4", "with reference to the amount of the proposal under consideration", "Policy sets authority on the proposal amount only; existing exposure to the borrower is ignored.");
    if (wf) {
      const loc = paramCells(wf, "id", "desc");
      A("A4", files.cfg, loc, cellsLabel(loc), `LOS routes on ${wf.value} – the amount of the current proposal, consistent with the policy gap.`);
    }
    const rch = role(memo.routedTo);
    MQ("A4", `Rule: proposal amount ${memo.proposal?.toFixed(2)} Cr`, `Sample routed on proposal amount ${cr(memo.proposal)} to ${memo.routedTo}${rch ? ` (limit ${cr(rch.limitN)})` : ""}.`);
    if (memo.totalExposure) MQ("A4", `INR ${memo.totalExposure.toFixed(2)} crore`, `Total exposure after sanction ${cr(memo.totalExposure)} exceeds the approver's limit of ${cr(rch?.limitN)}; on an exposure basis the proposal would go to the next authority (ZCC).`);
    NQ("A4", "based on the proposal amount", "Process owners confirm routing ignores existing exposure.");
    const exceeds = rch && memo.totalExposure > rch.limitN;
    const def = policy.basis === "proposal" || (wf && /PROPOSAL/i.test(wf.value));
    R("A4", def ? "Deficiency" : "Pass",
      def
        ? `Policy 7.1 and LOS (${wf?.id || "routing"} = ${wf?.value || "proposal amount"}) set the authority on the proposal amount alone. In the sample, a ${cr(memo.proposal)} proposal was routed to the ${rch?.desc || memo.routedTo} (limit ${cr(rch?.limitN)})${exceeds ? ` although total exposure after sanction is ${cr(memo.totalExposure)}, above that limit` : ""}. Facilities can be split across proposals to stay within a lower authority.`
        : "Authority is set on total exposure.",
      { details: [
        { item: "Proposal amount", expected: `≤ ${cr(rch?.limitN)}`, actual: cr(memo.proposal), result: "Pass" },
        { item: "Total exposure after sanction", expected: `≤ ${cr(rch?.limitN)} for ${memo.routedTo}`, actual: cr(memo.totalExposure), result: exceeds ? "Exception" : "Pass" },
        { item: "Routing basis", expected: "Total exposure", actual: wf?.value || "Proposal amount", result: def ? "Exception" : "Pass" },
      ] });
  }

  // A5 System alignment
  if (!roles.length) R("A5", "Not tested", "LOS Role Limit Master not provided.");
  else {
    const match = (r) => policy.doa.find((d) => d.authority.toLowerCase().startsWith(r.desc.toLowerCase()) || d.authority.toLowerCase().includes(`(${r.code.toLowerCase()})`));
    const extra = roles.filter((r) => r.canApprove && !match(r));
    const wrong = roles.filter((r) => r.canApprove && match(r) && Number.isFinite(match(r).to) && Math.abs(match(r).to - r.limitN) > 0.001);
    extra.forEach((r) => {
      const loc = `'${rm.sheet}'!${col(rm.cols.code)}${r.__row}:${col(rm.cols.approve)}${r.__row}`;
      A("A5", files.cfg, loc, cellsLabel(loc), `${r.code} (${r.desc}) can approve individually up to ${cr(r.limitN)} – not a sanctioning authority in the DoA, where ${cr(r.limitN)} sits with the ZCC (committee).`);
    });
    wrong.forEach((r) => {
      const loc = `'${rm.sheet}'!${col(rm.cols.limit)}${r.__row}`;
      A("A5", files.cfg, loc, cellsLabel(loc), `${r.code} limit ${r.limit} differs from DoA ${match(r).limitText}.`);
    });
    if (extra.length) PQ("A5", "Zonal Credit Committee (ZCC)", "DoA gives the 5–25 crore band to the committee, not to an individual.");
    NQ("A5", "The Zonal Credit Head role was given approval rights in LOS in August 2025", "Change made for urgency; bypasses the committee.");
    const ok = !extra.length && !wrong.length;
    R("A5", ok ? "Pass" : "Deficiency",
      ok ? "Every LOS approving role and limit agrees to policy 7.2." : `${roles.filter((r) => r.canApprove).length - extra.length - wrong.length} of ${roles.filter((r) => r.canApprove).length} approving roles agree to the DoA. ${extra.map((r) => `${r.code} (${r.desc}) has individual approval up to ${cr(r.limitN)}, last modified ${r.on} by ${r.by}`).join("; ")} – not in the DoA, so proposals above INR 5 crore can be sanctioned without the ZCC.`,
      { details: roles.map((r) => ({ item: `${r.code} ${r.desc}`, expected: match(r) ? `${match(r).nature}, ${match(r).limitText}` : r.canApprove ? "Not a DoA authority" : "No approval", actual: `${r.type}, ${r.limit} Cr, approve ${r.approve}`, result: extra.includes(r) || wrong.includes(r) ? "Exception" : "Pass" })) });
  }

  // A6 Committee minutes
  if (!params.length) R("A6", "Not tested", "LOS workflow parameters not provided.");
  else {
    const wf = param(/minutes/i);
    PQ("A6", "uploaded to CredFlow LOS before the proposal is marked as sanctioned", "Policy requires minutes before sanction.");
    if (ctl && wt.cols) {
      const loc = `'${wt.sheet}'!${col(wt.cols.controlDesc)}${ctl.__row}`;
      A("A6", files.rcm, loc, cellsLabel(loc), "RCM states minutes are required before status moves to Approved – relies on LOS enforcement.");
    }
    if (wf) {
      const loc = paramCells(wf, "id", "on");
      A("A6", files.cfg, loc, cellsLabel(loc), `${wf.id} = ${wf.value}: ${wf.desc}. Changed ${wf.on}.`);
    }
    NQ("A6", "the ZCC minutes are uploaded at the next meeting", "Minutes follow the approval in practice.");
    const def = wf && !/BLOCK/i.test(wf.value);
    R("A6", def ? "Deficiency" : "Pass", def ? `LOS ${wf.id} is set to ${wf.value} (changed ${wf.on}): a proposal can be marked Approved without signed minutes, contrary to policy 7.3 and the RCM. Walkthrough confirms minutes are uploaded after the event.` : "LOS blocks approval until minutes are uploaded.");
  }

  // A7 SoD
  if (!params.length) R("A7", "Not tested", "LOS workflow parameters not provided.");
  else {
    const wf = param(/originat/i);
    PQ("A7", "No officer shall sanction or recommend for sanction a proposal originated by himself or herself.", "Independence requirement.");
    if (wf) {
      const loc = paramCells(wf, "id", "value");
      A("A7", files.cfg, loc, cellsLabel(loc), `${wf.id} = ${wf.value}: originator cannot approve or recommend.`);
    }
    const orig = memo?.trail.find((t) => /created/i.test(t.action));
    const appr = memo?.trail.find((t) => /^approved/i.test(t.action));
    if (orig) MQ("A7", orig.user, `Originated by ${orig.user}.`);
    if (appr) MQ("A7", appr.user, `Approved by ${appr.user} – a different user from the originator.`);
    NQ("A7", "The system does not allow the RM who originated the proposal to approve it", "Corroborates the system block.");
    const ok = wf && /BLOCK/i.test(wf.value) && (!orig || !appr || orig.user !== appr.user);
    R("A7", ok ? "Pass" : "Deficiency", ok ? `LOS blocks the originator from recommending or approving (${wf.id}); in the sample the originator ${orig?.user || "–"} and approver ${appr?.user || "–"} differ.` : "Originator-approver restriction not enforced.");
  }

  // A8 Configuration change control
  if (!roles.length && !params.length) R("A8", "Not tested", "LOS configuration not provided.");
  else {
    PQ("A8", "on written instruction from the Credit Policy Unit", "Changes require a written CPU instruction.");
    // baseline = the date most of the configuration was set up; later changes need a CPU instruction
    const dates = [...roles, ...params].map((x) => x.on).filter(Boolean);
    const baseline = Object.entries(dates.reduce((m, d) => ({ ...m, [d]: (m[d] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
    const baseDate = [...roles, ...params].find((x) => x.on === baseline)?.onDate;
    const recentRoles = roles.filter((r) => r.onDate && baseDate && r.onDate > baseDate && r.canApprove);
    const recentParams = params.filter((p) => p.onDate && baseDate && p.onDate > baseDate);
    recentRoles.forEach((r) => {
      const loc = `'${rm.sheet}'!${col(rm.cols.on)}${r.__row}:${col(rm.cols.by)}${r.__row}`;
      A("A8", files.cfg, loc, cellsLabel(loc), `${r.code} approval limit changed ${r.on} by ${r.by} – after the DoA was configured (${baseline}); no written CPU instruction and no policy change.`);
    });
    recentParams.forEach((p) => {
      const loc = paramCells(p, "on");
      A("A8", files.cfg, loc, cellsLabel(loc), `${p.id} (${p.param}) changed to ${p.value} on ${p.on} – no written CPU instruction.`);
    });
    NQ("A8", "was not readily available during the walkthrough", "Authorisation for the August 2025 change could not be produced.");
    const log = param(/audit log|change.*log/i);
    const def = recentRoles.length || recentParams.length;
    R("A8", def ? "Deficiency" : "Pass",
      def ? `${plural(recentRoles.length + recentParams.length, "configuration change")} after the DoA was configured on ${baseline} (${[...recentRoles.map((r) => `${r.code} ${r.on}`), ...recentParams.map((p) => `${p.id} ${p.on}`)].join(", ")}) – none supported by a written CPU instruction and none reflected in the policy.${log ? ` Change logging is ${log.value.toLowerCase()} (${log.id}) but no review of the log is defined.` : ""}` : "All configuration changes trace to authorised instructions.");
  }

  // A9 Exceptions and escalation
  {
    PQ("A9", "reported to the Chief Credit Officer within two working days", "Escalation, ratification and Audit Committee reporting defined.");
    const dev = param(/deviation/i);
    if (dev) {
      const loc = paramCells(dev, "id", "value");
      A("A9", files.cfg, loc, cellsLabel(loc), `${dev.id} ${dev.value}: deviations routed one level up (policy 7.5).`);
    }
    NQ("A9", "no such cases arose in FY 2025-26", "No beyond-authority cases reported, although LOS lets the Zonal Credit Head approve outside the DoA – no mechanism identifies such sanctions.");
    R("A9", "Partial", "Policy 7.5–7.6 define deviation routing and escalation (CCO within two working days, HOCC ratification, Audit Committee). However, nothing identifies sanctions beyond authority: LOS treats Zonal Credit Head approvals as valid, so none have been reported.");
  }

  // A10 Evidence of performance
  {
    if (memo?.generated) MQ("A10", memo.generated.split(" IST")[0], "Memo generated from LOS – system record of the sanction.");
    const appr = memo?.trail.find((t) => /^approved/i.test(t.action));
    if (appr) MQ("A10", appr.whenText, `Approval trail records user ${appr.user}, role and time.`);
    const log = param(/audit log|change.*log/i);
    if (log) {
      const loc = paramCells(log, "id", "value");
      A("A10", files.cfg, loc, cellsLabel(loc), `${log.id} ${log.value}: configuration changes logged.`);
    }
    NQ("A10", "The approver's user ID, date and time are recorded in the approval trail", "Corroborates the system trail.");
    R("A10", memo?.trail.length ? "Pass" : "Partial", memo?.trail.length ? `LOS approval trail records each step with user ID, role and timestamp (${memo.trail.length} steps in ${memo.ref}); sanction letter ${memo.sanctionLetter || "issued"}.` : "Approval trail not evidenced.");
  }

  // ── observations ────────────────────────────────────────────────────────
  const get = (id) => results.find((r) => r.attr.id === id);
  const bad = (id) => get(id) && !["Pass", "Not tested"].includes(get(id).status);
  const owner = rcm.control.owner;
  const observations = [];
  const O = (attrs, o) => observations.push({ id: `O${observations.length + 1}`, attrs, attrText: attrs.join(", "), refs: attrs.map(refRange).filter(Boolean).join("; "), owner, response: "", due: "", ...o });
  if (bad("A5") || bad("A8"))
    O(["A5", "A8"].filter(bad), { title: "LOS approval rights outside the DoA, changed without authorisation", severity: "High", condition: get("A5")?.observation || get("A8")?.observation, effect: "Proposals above INR 5 crore and up to INR 25 crore can be sanctioned by one individual instead of the committee, without the policy being changed or the change being approved.", recommendation: "Remove individual approval from ZONAL_CR_HEAD (or obtain Board approval and amend the DoA); require written CPU instruction for every LOS limit change, reconcile RLM-01 to the DoA quarterly, and review the configuration change log." });
  if (bad("A4")) O(["A4"], { title: "Authority set on proposal amount, not total exposure", severity: "High", condition: get("A4").observation, effect: "Facilities can be split or added incrementally so that each proposal stays within a lower authority while the borrower's total exposure exceeds it.", recommendation: "Amend policy 7.1 to determine the sanctioning authority on total (and group) exposure including the proposal, and change LOS routing (WF-01) to aggregate existing limits." });
  if (bad("A6")) O(["A6"], { title: "Committee minutes not enforced before sanction", severity: "High", condition: get("A6").observation, effect: "Committee proposals can be marked sanctioned without evidence that the committee met and approved with quorum.", recommendation: "Set WF-03 to BLOCK so status cannot move to Approved without uploaded signed minutes; review overrides since August 2025." });
  if (bad("A2")) O(["A2"], { title: "Credit policy overdue for annual review", severity: "Medium", condition: get("A2").observation, effect: "DoA and LOS settings may not reflect current risk appetite and practice; the August 2025 change is not covered by an approved policy.", recommendation: "Complete the annual review and Board approval of the credit policy, incorporating any intended changes to approval rights." });
  if (bad("A9")) O(["A9"], { title: "No mechanism to identify sanctions beyond authority", severity: "Medium", condition: get("A9").observation, effect: "Sanctions outside the DoA are not reported to the CCO, HOCC or Audit Committee.", recommendation: "Run a monthly LOS report of sanctions by approver role against the DoA (including total exposure) and route exceptions per policy 7.6." });
  const exceptions = observations.map((o) => ({ id: o.id, attrIds: o.attrs, title: o.title, type: "Design", severity: o.severity, condition: o.condition, criteria: o.attrs.map((id) => `${id} ${get(id).attr.criterion}`).join("; "), cause: `Annotation refs: ${o.refs}`, effect: o.effect, recommendation: o.recommendation, owner }));
  results.forEach((r) => (r.exceptionId = observations.find((o) => o.attrs.includes(r.attr.id))?.id));

  // ── walkthrough trace ───────────────────────────────────────────────────
  const step = (u) => memo?.trail.find((t) => u.test(t.action));
  const pick = (id, pred) => annotations.filter((a) => a.attr === id && pred(a)).map((a) => a.ref);
  const wtRef = (q) => {
    const f = note?.find(q);
    return f ? `Note ${f.ref}` : "–";
  };
  const trace = memo
    ? [
        { step: 1, sopRef: "–", designed: "RM creates the proposal in LOS", observed: `${files.memo.code}: ${step(/created/i)?.user} ${step(/created/i)?.whenText}`, transcript: wtRef("creates the proposal in CredFlow LOS"), performed: "Yes", note: "-" },
        { step: 2, sopRef: "–", designed: "Credit Analyst uploads CAM incl. existing facilities", observed: `${files.memo.code}: CAM ${step(/CAM/i)?.user} ${step(/CAM/i)?.whenText}; existing exposure ${memo.existing.map((e) => `${e.facility} ${cr(e.sanctioned)}`).join(", ")}`, transcript: wtRef("prepares the Credit Appraisal Memo"), performed: "Yes", note: "Existing exposure known to LOS" },
        { step: 3, sopRef: "7.1, 7.2", designed: "LOS routes to the authority per DoA", observed: `${files.memo.code}: ${memo.rule}`, transcript: wtRef("based on the proposal amount"), performed: "Yes - but basis excludes existing exposure", note: refRange("A4") || "-" },
        { step: 4, sopRef: "7.2, 7.4", designed: "Authority approves; originator cannot approve", observed: `${files.memo.code}: approved ${step(/^approved/i)?.user} ${step(/^approved/i)?.whenText}; originator ${step(/created/i)?.user}`, transcript: wtRef("does not allow the RM"), performed: "Yes", note: pick("A7", (a) => a.code === files.memo.code).join(", ") || "-" },
        { step: 5, sopRef: "7.3", designed: "Committee minutes uploaded before sanction", observed: `${files.cfg?.code || "FS-03"}: ${param(/minutes/i)?.id} = ${param(/minutes/i)?.value} (not applicable to sample)`, transcript: wtRef("minutes are uploaded at the next meeting"), performed: "Not enforced", note: refRange("A6") || "-" },
        { step: 6, sopRef: "7.2", designed: "Only DoA authorities hold approval rights", observed: `${files.cfg?.code || "FS-03"}: ${roles.filter((r) => r.canApprove && /ZONAL_CR_HEAD/.test(r.code)).map((r) => `${r.code} individual ${r.limit} Cr`).join(", ") || "as per DoA"}`, transcript: wtRef("approval rights in LOS in August 2025"), performed: bad("A5") ? "Not per DoA" : "Yes", note: pick("A5", (a) => a.code === files.cfg?.code).join(", ") || "-" },
        { step: 7, sopRef: "7.7", designed: "Limit changes on written CPU instruction", observed: `${files.cfg?.code || "FS-03"}: ${annotations.filter((a) => a.attr === "A8" && a.code === files.cfg?.code).map((a) => a.note.split(" – ")[0]).join("; ") || "no changes after baseline"}`, transcript: wtRef("was not readily available"), performed: bad("A8") ? "Evidence not available" : "Yes", note: refRange("A8") || "-" },
        { step: 8, sopRef: "–", designed: "Sanction letter after approval; disbursement blocked until Approved", observed: `${files.memo.code}: sanction letter ${memo.sanctionLetter}; ${files.cfg?.code || "FS-03"}: ${param(/disbursement/i)?.id} ${param(/disbursement/i)?.value}`, transcript: wtRef("issues the sanction letter"), performed: "Yes", note: "CR-09 (out of scope)" },
        { step: 9, sopRef: "7.6", designed: "Beyond-authority sanctions reported and ratified", observed: "No cases reported in FY 2025-26", transcript: wtRef("no such cases arose"), performed: "Not triggered", note: refRange("A9") || "-" },
      ]
    : [];

  const reviewNotes = [
    bad("A5") && { ref: "RN-1", by: "Reviewer agent", point: "A5: is the ZONAL_CR_HEAD approval right a design or an operating issue?", response: `Design: the LOS configuration (${pick("A5", (a) => a.code === files.cfg?.code)[0] || "A5-1"}) permits any proposal up to INR 25 crore to bypass the ZCC; it applies to all such proposals, not to one sample.`, status: "Closed" },
    bad("A4") && { ref: "RN-2", by: "Reviewer agent", point: "A4: sample was within the approver's proposal-amount limit – is this still a deficiency?", response: `Yes – the criterion is the basis of the limit. Policy 7.1 and ${param(/routing/i)?.id || "WF-01"} ignore existing exposure; the sample (total exposure ${cr(memo?.totalExposure)}) shows the effect.`, status: "Closed" },
    bad("A5") && bad("A8") && { ref: "RN-3", by: "Reviewer agent", point: "A5 and A8 relate to the same August 2025 change – avoid double counting.", response: `Combined into one observation (${observations.find((o) => o.attrs.includes("A5"))?.id}); kept separate at attribute level.`, status: "Closed" },
    bad("A5") && { ref: "RN-4", by: "Reviewer agent", point: "Identify all sanctions approved by ZONAL_CR_HEAD since 07-Aug-2025 for an operating-effectiveness test.", response: "Referred to human reviewer; outside design scope.", status: "Open" },
    { ref: "RN-5", by: "Human reviewer", point: "", response: "", status: "" },
  ].filter(Boolean).map((n, i, arr) => (n.by === "Human reviewer" ? { ...n, ref: `RN-${arr.length}` } : n));

  const defIds = results.filter((r) => r.status === "Deficiency").map((r) => r.attr.id);
  const partIds = results.filter((r) => r.status === "Partial").map((r) => r.attr.id);
  const passIds = results.filter((r) => r.status === "Pass").map((r) => r.attr.id);
  const designEffective = defIds.length === 0;
  const severity = designEffective ? "None" : bad("A5") || bad("A4") ? "Significant deficiency" : "Control deficiency";
  const summary = {
    effective: designEffective,
    designEffective,
    operatingEffective: null,
    conclusion: designEffective ? "Effectively designed" : "Not effectively designed",
    designConclusion: designEffective ? "EFFECTIVELY DESIGNED" : "NOT EFFECTIVELY DESIGNED",
    operatingConclusion: "Not tested (design only)",
    headline: `${defIds.length} of ${results.length} attributes deficient${defIds.length ? ` (${defIds.join(", ")})` : ""}; ${partIds.length ? `${partIds.join(", ")} partial; ` : ""}${passIds.join(", ")} pass.${defIds.length ? " LOS lets the Zonal Credit Head sanction up to INR 25 crore alone, outside the DoA and without an authorised change; authority is set on proposal amount rather than total exposure; committee minutes are not enforced; and the policy is overdue for review. Sanctions beyond the Board-approved DoA are therefore neither prevented nor detected." : ""}`,
    deficiency: designEffective ? "" : `Proposed severity: ${severity} (for human reviewer confirmation).`,
    severity,
    tested: results.filter((r) => r.status !== "Not tested").length,
    passed: passIds.length,
    deficiencies: defIds.length,
    partial: partIds.length,
    exceptions: observations.length,
    high: observations.filter((o) => o.severity === "High").length,
    gaps: rcm.gaps.length,
    pending: results.filter((r) => r.status === "Not tested").length,
  };
  results.forEach((r) => {
    r.narrative = { procedure: r.attr.procedure, observation: r.observation, conclusion: r.status === "Pass" ? "Designed appropriately." : r.status === "Partial" ? `Partially meets the criterion – see ${r.exceptionId || "observations"}.` : r.status === "Deficiency" ? `Design deficiency – see ${r.exceptionId}.` : "Not tested – evidence not provided." };
  });
  const limitations = [
    `Design only – test of one walkthrough sample${memo ? ` (${memo.ref})` : ""}. Operating effectiveness not tested.`,
    "CR-09 (disbursement block) is in the RCM extract but outside the scope of this test.",
    ...results.filter((r) => r.status === "Not tested").map((r) => `${r.attr.id} not tested: ${r.observation}`),
    ...reviewNotes.filter((n) => n.status === "Open").map((n) => `${n.ref}: ${n.point}`),
  ];

  const sample = memo ? `${memo.ref} (${memo.borrower.split(",")[0]}, ${cr(memo.proposal)})` : note?.sample || "–";
  return {
    control: rcm.control,
    rcm,
    sop: policy,
    transcript: null,
    results,
    annotations: results.flatMap((r) => r.annotations),
    observations,
    exceptions,
    trace,
    reviewNotes,
    pending: [],
    exposure: [],
    limitations,
    summary,
    labels: {
      doc: "Policy",
      walkthrough: "note",
      reportTitle: "Credit sanction within delegated authority",
      controlName: `${rcm.control.id} - Credit sanction within delegated authority (DoA)`,
      objective: `Assess whether ${rcm.control.id}, as designed, prevents credit from being sanctioned beyond the authority delegated in the Board-approved DoA.`,
      sampleRef: memo?.ref || "",
    },
    meta: {
      reference: `WP-${rcm.control.id}-TOD`,
      testedAt: new Date(),
      files: ev.files,
      sample,
      walkthroughDate: note?.date || null,
      period: "–",
      company: rcm.control.company,
      inputs: [files.pol, files.rcm, files.cfg, files.note, files.memo].filter(Boolean),
    },
    procedures: [
      { id: "t-read", label: "Read and classify the evidence", detail: `${plural(ev.files.length, "file")} received`, subChecks: ev.files.map((f) => ({ text: `${f.name} → ${FS_KIND_LABEL[f.kind] || f.kind}`, status: f.kind === "unknown" ? "info" : "pass", log: [`[READ] ${f.name} classified as ${f.kind}`] })) },
      ...results.map((r) => ({
        id: `t-${r.attr.id}`,
        label: `${r.attr.id} · ${r.attr.label}`,
        detail: r.attr.criterion,
        subChecks: r.annotations.length ? r.annotations.map((a) => ({ text: `${a.ref} (${a.code}, ${a.location}): ${a.note}`, status: r.status === "Pass" ? "pass" : r.status === "Deficiency" ? "exception" : "info", log: [`[ANNOTATE] ${a.ref} ${a.code} ${a.location} – “${a.highlight}”`] })) : [{ text: r.observation, status: "info" }],
        points: r.status !== "Pass" ? [`${r.status}: ${r.observation}`] : undefined,
      })),
      { id: "t-conclude", label: "Draft observations and conclude on design", detail: "Observations grouped by root cause; severity proposed for the human reviewer.", subChecks: observations.length ? observations.map((o) => ({ text: `${o.id} (${o.attrText}) ${o.title}`, status: "exception", log: [`[OBSERVATION] ${o.id} ${o.title}`] })) : [{ text: "No design observations", status: "pass" }] },
    ],
  };
}
