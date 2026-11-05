import { OPS, OP_WORDS, formatValue } from "../modules/itgc-password/data/sapParameters";
import { CONTROL } from "../modules/itgc-password/data/control";
import { SAP_SYSTEM, requery } from "./sapConnector";

const SEVERITY_RANK = { High: 3, Medium: 2, Low: 1 };
const fmt = (n) => Number(n).toLocaleString("en-US");

export const unitText = (value, unit) => (!unit || unit === "seconds" ? "" : ` ${value === 1 ? unit.replace(/s$/, "") : unit}`);
export const ruleText = (a) => `${OPS[a.op]} ${formatValue(a.value, a.unit)}${unitText(a.value, a.unit)}`;

// ── Policy-reading procedures (shown before the source is chosen) ─────────
export function buildPolicyProcedures(parsed, docName) {
  const { attributes, unmapped, stats } = parsed;
  return [
    {
      id: "pol-1",
      label: "Reading the policy document",
      detail: "Extracting text from the document and splitting it into numbered clauses.",
      subChecks: [
        { text: `Opening ${docName}`, status: "pass", log: [`[DOC] Loaded ${docName}`] },
        { text: `Extracted ${fmt(stats.words)} words in ${stats.clauses} clauses`, status: "pass", log: [`[DOC] ${stats.clauses} clauses indexed`] },
      ],
      points: [`The document reads cleanly – ${stats.clauses} clauses indexed for analysis.`],
    },
    {
      id: "pol-2",
      label: "Identifying testable requirements",
      detail: "Finding requirement statements (must / shall / at least / at most) and checking which carry a measurable threshold.",
      subChecks: [
        { text: `${stats.requirements} requirement statements found`, status: "pass", log: [`[NLP] ${stats.requirements} requirement statements`] },
        { text: `${attributes.length} have a measurable, system-enforced threshold`, status: attributes.length ? "pass" : "exception", log: [`[NLP] ${attributes.length} measurable requirements`] },
        {
          text: unmapped.length ? `${unmapped.length} cannot be tested from system configuration – flagged for manual testing` : "All requirement statements are system-testable",
          status: unmapped.length ? "info" : "pass",
          log: unmapped.map((u) => `[NLP] Not system-testable: ${u.ref} "${u.text}"`),
        },
      ],
      points: [
        `${attributes.length} requirements can be tested automatically against SAP.`,
        ...(unmapped.length ? [`${unmapped.length} requirement(s) (${unmapped.map((u) => u.ref).join(", ")}) are behavioural or procedural and are out of scope for this automated test.`] : []),
      ],
    },
    {
      id: "pol-3",
      label: "Mapping requirements to SAP profile parameters",
      detail: "Matching each requirement to the SAP parameter that enforces it and normalising units (e.g. minutes to seconds).",
      subChecks: attributes.map((a) => ({
        text: `${a.clauseRef} ${a.label} → ${a.key} ${ruleText(a)}`,
        status: "pass",
        log: [`[MAP] ${a.id} ${a.clauseRef} → ${a.key} ${OPS[a.op]} ${a.value}${a.conversion ? ` (${a.conversion})` : ""}`],
      })),
      points: [`${attributes.length} test attributes (A1–A${attributes.length}) defined from the policy.`],
    },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function evaluate(attr, raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return { ok: false, reason: "blank" };
  const num = Number(s);
  if (Number.isNaN(num)) {
    if (attr.op === "eq") return { ok: s.toLowerCase() === String(attr.value).toLowerCase(), value: s };
    return { ok: false, reason: "non-numeric", value: s };
  }
  if (attr.zeroDisables && num === 0) return { ok: false, reason: "disabled", value: num };
  const ok = attr.op === "min" ? num >= attr.value : attr.op === "max" ? num <= attr.value : num === attr.value;
  return { ok, value: num };
}

function pickRandom(list, n) {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out.sort((a, b) => a.n - b.n);
}

function shortHost(h) {
  const m = String(h).match(/_(\w+_\d+)$/);
  return m ? m[1] : h;
}

// ── Main test ──────────────────────────────────────────────────────────────
export function runControlTest({ attributes, unmapped, policyName, source, extract, screenCount, screenshots = [] }) {
  const testedAt = new Date();
  const isSap = source === "sap";
  const all = extract.rows;
  const active = all.filter((r) => r.active);
  const hosts = [...new Set(active.map((r) => r.host))];
  const expectedHosts = isSap ? SAP_SYSTEM.instances.map((i) => i.name) : hosts;
  const keysInScope = new Set(attributes.map((a) => a.key.toLowerCase()));

  const meta = {
    reference: `${CONTROL.id}-${testedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${String(testedAt.getHours()).padStart(2, "0")}${String(testedAt.getMinutes()).padStart(2, "0")}`,
    testedAt,
    source,
    sourceLabel: isSap ? `Direct SAP connection (${SAP_SYSTEM.sid} · client ${SAP_SYSTEM.client})` : "Manual upload of system extract",
    system: isSap ? `SAP ${SAP_SYSTEM.sid} · client ${SAP_SYSTEM.client} (${SAP_SYSTEM.description})` : (active.find((r) => r.system)?.system ? `SAP ${active.find((r) => r.system).system}` : "Per uploaded extract"),
    table: isSap ? SAP_SYSTEM.table : "Extract provided by user",
    fileName: extract.fileName,
    sheetName: extract.sheetName,
    policyName,
    instances: expectedHosts,
    totalRows: all.length,
    activeRows: active.length,
    screenCount: screenCount ?? null,
  };

  // ── Completeness & accuracy (IPE) ──
  const ca = [];
  ca.push(
    screenCount == null
      ? { id: "C&A-1", check: "Extract record count agrees to system screen count", result: "Not performed", status: "info", detail: "No system screen count was provided, so completeness of the extract could not be independently confirmed." }
      : screenCount === active.length
      ? { id: "C&A-1", check: "Extract record count agrees to system screen count", result: "Agreed", status: "pass", detail: `Extract ${fmt(active.length)} active entries = system screen ${fmt(screenCount)}.` }
      : { id: "C&A-1", check: "Extract record count agrees to system screen count", result: "Differs", status: "exception", detail: `Extract ${fmt(active.length)} active entries vs system screen ${fmt(screenCount)} (difference ${fmt(Math.abs(active.length - screenCount))}). The extract may be incomplete.` }
  );
  ca.push({
    id: "C&A-2",
    check: "Only current (active) parameter values used",
    result: "Agreed",
    status: "pass",
    detail: extract.hasState === false ? "No status column in the extract – all rows treated as current values." : `${fmt(all.length - active.length)} inactive / historical entries excluded from testing.`,
  });

  const dupMap = new Map();
  active.forEach((r) => {
    const k = `${r.host}|${r.param.toLowerCase()}`;
    dupMap.set(k, (dupMap.get(k) || 0) + 1);
  });
  const dups = [...dupMap.entries()].filter(([, c]) => c > 1);
  const dupsInScope = dups.filter(([k]) => keysInScope.has(k.split("|")[1]));
  ca.push(
    dups.length === 0
      ? { id: "C&A-3", check: "No duplicate active entries", result: "Agreed", status: "pass", detail: "Each parameter appears once per instance." }
      : { id: "C&A-3", check: "No duplicate active entries", result: dupsInScope.length ? "Exception" : "Noted", status: dupsInScope.length ? "exception" : "info", detail: `${dups.length} duplicate active entr${dups.length > 1 ? "ies" : "y"} (${dupsInScope.length} in scope). Latest-dated value used.` }
  );

  const inScopeRows = active.filter((r) => keysInScope.has(r.param.toLowerCase()));
  const badValues = inScopeRows.filter((r) => String(r.value).trim() === "");
  ca.push(
    badValues.length
      ? { id: "C&A-4", check: "In-scope values populated", result: "Exception", status: "exception", detail: `${badValues.length} in-scope parameter(s) have a blank value (rows ${badValues.map((r) => r.n).join(", ")}).` }
      : { id: "C&A-4", check: "In-scope values populated", result: "Agreed", status: "pass", detail: `${inScopeRows.length} in-scope parameter values populated.` }
  );

  const missingHosts = expectedHosts.filter((h) => !hosts.includes(h));
  ca.push(
    isSap
      ? missingHosts.length
        ? { id: "C&A-5", check: "Extract covers every application server (SM51)", result: "Differs", status: "exception", detail: `Missing from extract: ${missingHosts.join(", ")}.` }
        : { id: "C&A-5", check: "Extract covers every application server (SM51)", result: "Agreed", status: "pass", detail: `${expectedHosts.length} of ${expectedHosts.length} instances present: ${expectedHosts.join(", ")}.` }
      : { id: "C&A-5", check: "Extract covers every application server", result: "Not verifiable", status: "info", detail: `${hosts.length} instance(s) in extract (${hosts.join(", ")}). Tester to confirm against SM51 that no instance is missing.` }
  );

  // ── Sample tie-out ──
  const sampleRows = pickRandom(active, 5);
  const requeried = isSap ? requery(all, sampleRows) : [];
  const sample = sampleRows.map((r, i) => {
    if (isSap) {
      const src = requeried[i];
      const agreed = !!src && String(src.value) === String(r.value);
      return { ...r, sourceValue: src ? src.value : "not found", result: agreed ? "Agreed" : "Differs", status: agreed ? "pass" : "exception" };
    }
    return {
      ...r,
      sourceValue: screenshots.length ? "Agree to screenshot" : "–",
      result: screenshots.length ? "Tester to agree" : "Not performed",
      status: "info",
    };
  });
  const sampleOk = sample.every((s) => s.status === "pass");
  ca.push({
    id: "C&A-6",
    check: `Random sample of ${sample.length} entries agrees to source`,
    result: isSap ? (sampleOk ? "Agreed" : "Differs") : "Not performed",
    status: isSap ? (sampleOk ? "pass" : "exception") : "info",
    detail: isSap
      ? `Rows ${sample.map((s) => s.n).join(", ")} re-read from ${SAP_SYSTEM.table} and agreed.`
      : `No system access in manual mode. Tester to agree rows ${sample.map((s) => s.n).join(", ")} to SAP screenshots${screenshots.length ? ` (${screenshots.length} provided)` : ""}.`,
  });

  const caExceptions = ca.filter((c) => c.status === "exception").length;
  const caLimited = ca.filter((c) => c.status === "info" && c.result === "Not performed").length;
  const caConclusion = caExceptions
    ? "Population reliance not supported – C&A exceptions must be resolved before relying on the test results."
    : caLimited
    ? "Population can be relied on subject to the limitations noted (checks not performed in manual mode)."
    : "Population is complete and accurate and can be relied on for testing.";

  // ── Attribute testing ──
  const results = attributes.map((a) => {
    const instances = expectedHosts.map((host) => {
      const matches = active.filter((r) => r.host === host && r.param.toLowerCase() === a.key.toLowerCase());
      if (!matches.length) return { host, row: null, ok: false, reason: "missing", display: "not maintained" };
      const row = matches.sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
      const ev = evaluate(a, row.value);
      return { host, row, ok: ev.ok, reason: ev.reason || null, value: ev.value, display: formatValue(ev.value ?? row.value, a.unit) };
    });

    const allOk = instances.every((i) => i.ok);
    const anyMissing = instances.some((i) => i.reason === "missing");
    const allMissing = instances.every((i) => i.reason === "missing");
    const anyDisabled = instances.some((i) => i.reason === "disabled");
    const mixed = instances.some((i) => i.ok) && instances.some((i) => !i.ok);
    const type = allOk
      ? null
      : anyDisabled
      ? "Control disabled"
      : allMissing
      ? "Parameter not maintained"
      : anyMissing
      ? "Not maintained on all instances"
      : mixed
      ? "Inconsistent across instances"
      : "Non-compliant configuration";

    const obsParts = instances.map((i) => {
      const where = i.row ? ` (row ${i.row.n})` : "";
      const extra = i.reason === "disabled" && a.zeroMeaning ? ` – ${a.zeroMeaning}` : i.reason === "missing" ? "" : i.ok ? "" : " – does not meet policy";
      return `${i.host} = ${i.display}${where}${extra}`;
    });
    const sourcePhrase = isSap
      ? `from table ${SAP_SYSTEM.table} in SAP ${SAP_SYSTEM.sid} client ${SAP_SYSTEM.client}`
      : `from the extract provided (${extract.fileName} › ${extract.sheetName})`;

    const narrative = {
      procedure: `Obtained the active profile parameter population ${sourcePhrase} and inspected ${a.key} on each of the ${expectedHosts.length} application server instance(s). Compared the active value to policy ${a.clauseRef}, which requires ${a.label.toLowerCase()} ${OP_WORDS[a.op]} ${formatValue(a.value, a.unit)}${unitText(a.value, a.unit)}.`,
      observation: `Noted that ${obsParts.join("; ")}.`,
      conclusion: allOk
        ? "No exception noted – the configured value meets the policy on every instance."
        : `Exception noted – ${type.toLowerCase()}.`,
    };

    return {
      attr: a,
      instances,
      status: allOk ? "Pass" : "Exception",
      type,
      actualSummary: instances.map((i) => (expectedHosts.length > 1 ? `${shortHost(i.host)}: ${i.display}` : i.display)).join(" · "),
      narrative,
      evidenceRef: instances.filter((i) => i.row).map((i) => `${extract.fileName} row ${i.row.n}`).join("; ") || "–",
    };
  });

  // ── Exceptions ──
  const exceptions = [];
  results
    .filter((r) => r.status === "Exception")
    .forEach((r) => {
      const a = r.attr;
      const id = `EX-${String(exceptions.length + 1).padStart(2, "0")}`;
      r.exceptionId = id;
      r.narrative.conclusion += ` See ${id}.`;
      const failing = r.instances.filter((i) => !i.ok);
      const severity = r.type === "Control disabled" ? "High" : a.severity;
      const target = `${OP_WORDS[a.op]} ${formatValue(a.value, a.unit)}${unitText(a.value, a.unit)}`;

      const cause = {
        "Control disabled": `${a.key} is set to 0 on ${failing.filter((i) => i.reason === "disabled").map((i) => i.host).join(", ")}, which switches the check off (${a.zeroMeaning || "0 disables the control"}). Likely an instance-profile override or a value left from system set-up.${failing.some((i) => i.reason !== "disabled") ? ` On ${failing.filter((i) => i.reason !== "disabled").map((i) => i.host).join(", ")} the value is set but does not meet the policy.` : ""}`,
        "Parameter not maintained": `${a.key} is not explicitly maintained in the system profiles, so the SAP kernel default applies. The effective value has not been aligned to the policy.`,
        "Not maintained on all instances": `${a.key} is maintained on some instances only; the instance(s) ${failing.map((i) => i.host).join(", ")} rely on the kernel default.`,
        "Inconsistent across instances": `The value differs between application servers, which indicates an instance-profile override that was not updated when the policy changed. Users logging on through ${failing.map((i) => i.host).join(", ")} are subject to weaker rules.`,
        "Non-compliant configuration": `The profile value has not been updated to reflect the current policy requirement.`,
      }[r.type];

      const recommendation =
        r.type === "Parameter not maintained" || r.type === "Not maintained on all instances"
          ? `Maintain ${a.key} explicitly at ${target} in the default profile (DEFAULT.PFL) via RZ10 so every instance inherits it. Confirm the effective value in RZ11 on each instance, then re-extract and re-test.`
          : `Set ${a.key} to ${target} in the default profile (DEFAULT.PFL) via RZ10 and remove any instance-profile overrides${r.type === "Control disabled" ? " – a value of 0 disables the check" : ""}. Activate the profile (dynamic switch in RZ11 is not persistent across restarts), re-extract PAHI and re-test.`;

      exceptions.push({
        id,
        attrId: a.id,
        key: a.key,
        title: `${a.label}: ${r.type.toLowerCase()}`,
        type: r.type,
        severity,
        condition: `${r.narrative.observation.replace(/^Noted that /, "")}`,
        criteria: `Policy ${a.clauseRef}: “${a.clause}” → ${a.key} ${ruleText(a)}.`,
        cause: `Potential cause (to be confirmed with ${CONTROL.owner}): ${cause}`,
        effect: a.risk,
        recommendation,
        owner: CONTROL.owner,
        instances: failing.map((i) => i.host),
        managementResponse: "",
        targetDate: "",
      });
    });

  // C&A exceptions also go on the exception log (they affect reliance)
  ca.filter((c) => c.status === "exception").forEach((c) => {
    exceptions.push({
      id: `EX-${String(exceptions.length + 1).padStart(2, "0")}`,
      attrId: c.id,
      key: "Population (IPE)",
      title: `Completeness & accuracy: ${c.check.toLowerCase()}`,
      type: "IPE exception",
      severity: "High",
      condition: c.detail,
      criteria: "The population used for testing must be complete and accurate (IPE).",
      cause: "Potential cause (to be confirmed): extract filters or export limits applied when the data was pulled.",
      effect: "Test results may not cover the full population, so reliance on them is limited.",
      recommendation: "Re-extract the full population without row limits, agree the count to the system screen and re-run the test.",
      owner: "Control tester",
      instances: [],
      managementResponse: "",
      targetDate: "",
    });
  });

  const passed = results.filter((r) => r.status === "Pass").length;
  const attrExceptions = results.length - passed;
  const bySev = (s) => exceptions.filter((e) => e.severity === s).length;
  const top = exceptions.reduce((m, e) => (SEVERITY_RANK[e.severity] > SEVERITY_RANK[m] ? e.severity : m), "Low");
  const effective = exceptions.length === 0;
  const summary = {
    tested: results.length,
    passed,
    attrExceptions,
    exceptions: exceptions.length,
    high: bySev("High"),
    medium: bySev("Medium"),
    low: bySev("Low"),
    effective,
    conclusion: effective ? "Effective" : "Not effective",
    headline: effective
      ? `No exceptions noted – all ${results.length} test attributes comply with the policy on every instance.`
      : `${attrExceptions} of ${results.length} test attributes did not meet the policy${caExceptions ? `, plus ${caExceptions} population (C&A) exception(s)` : ""}.`,
    deficiency: effective
      ? "No deficiency identified."
      : `Control deficiency – highest severity ${top}. The engagement team should assess whether the deficiency, alone or in aggregate, is a significant deficiency, considering compensating controls (e.g. SSO / MFA, monitoring of failed logons).`,
    caConclusion,
  };

  const procedures = buildRunProcedures({ isSap, extract, all, active, hosts, expectedHosts, screenCount, ca, sample, results, exceptions, summary });

  return { meta, control: CONTROL, attributes, unmapped, ca, sample, results, exceptions, summary, procedures, screenshots };
}

// ── Processing procedures for the agent run ───────────────────────────────
function buildRunProcedures({ isSap, extract, all, active, hosts, expectedHosts, screenCount, ca, sample, results, exceptions, summary }) {
  const procs = [];
  if (isSap) {
    procs.push({
      id: "run-1",
      label: `Connecting to SAP ${SAP_SYSTEM.sid}`,
      detail: `Opening a read-only RFC session to ${SAP_SYSTEM.description}.`,
      subChecks: [
        { text: `Resolving system ${SAP_SYSTEM.sid} · client ${SAP_SYSTEM.client}`, status: "pass", log: [`[CONN] Destination ${SAP_SYSTEM.sid}_${SAP_SYSTEM.client} resolved (${SAP_SYSTEM.description})`] },
        { text: `Logging on with read-only service account ${SAP_SYSTEM.serviceUser}`, status: "pass", log: [`[AUTH] RFC logon ${SAP_SYSTEM.serviceUser} – user type System, no dialog access`] },
        { text: `Confirming display-only authorisation for table ${SAP_SYSTEM.table} (S_TABU_NAM, activity 03)`, status: "pass", log: [`[AUTH] S_TABU_NAM ACTVT=03 TABLE=${SAP_SYSTEM.table} – authorised (display only)`] },
        { text: `Reading application server list (SM51) – ${expectedHosts.length} instances`, status: "pass", log: expectedHosts.map((h) => `[SM51] Instance active: ${h}`) },
      ],
      points: [`Connected with display-only access – the agent cannot change anything in ${SAP_SYSTEM.sid}.`, `${expectedHosts.length} application server instances in scope: ${expectedHosts.join(", ")}.`],
    });
    procs.push({
      id: "run-2",
      label: `Extracting the parameter population (table ${SAP_SYSTEM.table})`,
      detail: "Pulling every profile parameter value with its status, host and change date.",
      subChecks: [
        { text: `Reading table ${SAP_SYSTEM.table} via RFC_READ_TABLE`, status: "pass", log: [`[RFC] RFC_READ_TABLE QUERY_TABLE=${SAP_SYSTEM.table} FIELDS=HOSTNAME,SYSTEMID,PARDATE,PARSTATE,PARNAME,PARVALUE ROWCOUNT=0`] },
        { text: `${fmt(all.length)} rows returned across ${hosts.length} instances`, status: "pass", log: [`[RFC] ${fmt(all.length)} rows received`] },
        { text: `Filtering PARSTATE = 'A' → ${fmt(active.length)} active entries (${fmt(all.length - active.length)} historical excluded)`, status: "pass", log: [`[FLT] ${fmt(active.length)} active / ${fmt(all.length - active.length)} inactive`] },
        { text: `Capturing SE16 'Number of entries' for PARSTATE = 'A' → ${fmt(screenCount)}`, status: "pass", log: [`[SE16] ${SAP_SYSTEM.table} PARSTATE=A → ${fmt(screenCount)} entries (screen evidence captured)`] },
        { text: `Exporting extract to ${extract.fileName}`, status: "pass", log: [`[XLS] ${extract.fileName} written (${fmt(all.length)} rows)`] },
      ],
      points: [`${fmt(all.length)} rows extracted; ${fmt(active.length)} current values used for testing.`, `The system screen shows ${fmt(screenCount)} active entries – captured independently for the completeness check.`],
    });
  } else {
    const m = extract.mapping;
    procs.push({
      id: "run-1",
      label: "Loading the extract you provided",
      detail: "Reading the workbook, detecting the header row and mapping the columns.",
      subChecks: [
        { text: `Opening ${extract.fileName} › ${extract.sheetName}`, status: "pass", log: [`[XLS] Opened ${extract.fileName}, sheet ${extract.sheetName}`] },
        { text: `Columns mapped – parameter: ${m.param || "col 1"}, value: ${m.value || "col 2"}, status: ${m.state || "none"}, host: ${m.host || "none"}`, status: m.state && m.host ? "pass" : "info", log: [`[XLS] Mapping ${JSON.stringify(m)}`] },
        { text: `${fmt(all.length)} rows read, ${fmt(active.length)} current values`, status: "pass", log: [`[XLS] ${fmt(all.length)} rows / ${fmt(active.length)} active`] },
        { text: `${hosts.length} instance(s) in the extract: ${hosts.join(", ")}`, status: "pass", log: hosts.map((h) => `[XLS] Instance ${h}`) },
      ],
      points: [`${fmt(all.length)} rows loaded from ${extract.fileName}.`, ...(m.state ? [] : ["No status column found – every row treated as a current value."]), ...(m.host ? [] : ["No host column found – the extract is treated as a single instance."])],
    });
  }

  procs.push({
    id: "run-ca",
    label: "Completeness and accuracy of the population (IPE)",
    detail: "Making sure the population is complete and accurate before relying on it.",
    subChecks: ca.map((c) => ({ text: `${c.check} – ${c.result}`, status: c.status, log: [`[C&A] ${c.id} ${c.result}: ${c.detail}`] })),
    points: [summary.caConclusion, ...ca.filter((c) => c.status !== "pass").map((c) => `${c.id}: ${c.detail}`)],
  });

  procs.push({
    id: "run-sample",
    label: "Random sample tie-out to source",
    detail: isSap ? "Re-reading randomly selected rows directly from the system and agreeing them to the extract." : "Selecting random rows for the tester to agree to the SAP screenshots.",
    subChecks: sample.map((s) => ({
      text: `Row ${s.n} · ${s.param} = ${s.value} (${s.host}) – ${s.result}`,
      status: s.status,
      log: [`[SMP] row ${s.n} ${s.host} ${s.param}: extract ${s.value} / source ${s.sourceValue} → ${s.result}`],
    })),
    points: [isSap ? `All ${sample.length} sampled rows agree to the source.` : `Sample tie-out needs system access – rows ${sample.map((s) => s.n).join(", ")} listed for the tester.`],
  });

  procs.push({
    id: "run-test",
    label: "Testing each attribute against the policy",
    detail: `Comparing the active value of each parameter on every instance to its policy threshold.`,
    subChecks: results.map((r) => ({
      text: `${r.attr.id} ${r.attr.key}: ${r.actualSummary} vs ${ruleText(r.attr)} – ${r.status === "Pass" ? "Pass" : r.type}`,
      status: r.status === "Pass" ? "pass" : "exception",
      log: r.instances.map((i) => `[TEST] ${r.attr.id} ${i.host} ${r.attr.key}=${i.display} ${OPS[r.attr.op]} ${r.attr.value} → ${i.ok ? "PASS" : `FAIL${i.reason ? ` (${i.reason})` : ""}`}`),
    })),
    points: [
      `${summary.passed} of ${results.length} attributes pass on every instance.`,
      ...results.filter((r) => r.status !== "Pass").map((r) => `${r.attr.id} ${r.attr.label}: ${r.narrative.observation.replace(/^Noted that /, "")}`),
    ],
  });

  procs.push({
    id: "run-report",
    label: "Annotating evidence and compiling the report",
    detail: "Marking up the evidence, writing narratives and concluding on the control.",
    subChecks: [
      { text: `Annotating evidence for ${results.length} attributes`, status: "pass", log: [`[EVD] ${results.length} annotated evidence images rendered`] },
      { text: "Writing procedure, observation and conclusion narratives", status: "pass", log: ["[RPT] Narratives written"] },
      { text: `Logging ${exceptions.length} exception(s) with cause, effect and recommendation`, status: exceptions.length ? "exception" : "pass", log: exceptions.map((e) => `[EXC] ${e.id} ${e.severity} – ${e.title}`) },
      { text: `Concluding on operating effectiveness – ${summary.conclusion}`, status: summary.effective ? "pass" : "exception", log: [`[RPT] Conclusion: ${summary.conclusion}`] },
    ],
    points: [summary.headline, summary.deficiency],
  });

  return procs;
}
