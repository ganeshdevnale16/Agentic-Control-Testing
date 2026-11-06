import { useEffect, useRef, useState } from "react";
import { Download, Eye, Image as ImageIcon, RefreshCw, RotateCcw, Send, Shuffle, ShieldCheck, Upload, UserCheck } from "lucide-react";
import MessageList from "../../components/MessageList";
import InputArea from "../../components/InputArea";
import StepBadge from "../../components/StepBadge";
import DataTablesBlock from "../../components/DataTablesBlock";
import { ChoiceCards, KpiStrip, OwnerPanel, ReviewerPanel, SOURCE_OPTIONS, StatusBanner, SummaryBullets, ViewToggle, phaseLabel } from "./components";
import {
  ACTT_IPE_STATEMENT, ACTT_SYSTEM, ATTRIBUTES, IMPROVEMENTS, IPE_ACTT, IPE_MANUAL, MANUAL_IPE_STATEMENT, POPULATION, RCM,
  attributeSummary, getSamples, sampleSummary, stats, testingPerformed,
} from "./data/demo";
import { evidenceImagesFor } from "./evidenceImages";

const downloadWP = async (opts) => (await import("./exportWorkpaper")).downloadChangeWorkpaper(opts);

const TOTAL = 5;
const FILE_GROUP_THRESHOLD = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toLocaleDateString("en-GB").replace(/\//g, ".");

const PLACEHOLDERS = {
  rcm: "Attach your RCM (Risk & Control Matrix)…",
  source: "Choose where I should get the population from, or attach it…",
  "manual-file": "Attach the population file (E070 / STMS extracts) and screenshots…",
  running: "Working on it…",
  samples: "Attach the selected samples file, or choose random selection…",
  evidence: "Attach the ticket history PDFs and approval emails (.msg)…",
  done: "Ask about an exception or a sample, e.g. “CIDK905003”…",
};

// ── tables ──────────────────────────────────────────────────────────────────
const rcmTable = () => ({
  title: "Control Summary",
  columns: [
    { key: "f", label: "Field", minWidth: 150 },
    { key: "d", label: "Detail", minWidth: 480 },
  ],
  rows: [
    { f: "Control ID", d: RCM.controlId },
    { f: "Control objective", d: RCM.objective },
    { f: "Risk", d: RCM.risk },
    { f: "Control description", d: RCM.description },
    { f: "Type / nature", d: RCM.nature },
    { f: "Frequency", d: RCM.frequency },
    { f: "Key?", d: RCM.key },
    { f: "Owner", d: RCM.owner },
    { f: "Systems", d: RCM.systems },
    { f: "Test approach", d: RCM.testApproach },
    {
      f: "Test attributes",
      d: (
        <div>
          {ATTRIBUTES.map((a, i) => (
            <div key={a.short} style={{ marginBottom: 4 }}>
              {i + 1}. <strong>{a.short}</strong> – {a.text}
            </div>
          ))}
        </div>
      ),
    },
  ],
});

const ipeTable = (rows) => ({
  title: "IPE validation",
  columns: [
    { key: "layer", label: "Layer" },
    { key: "check", label: "Check", minWidth: 340 },
    { key: "value", label: "Value" },
    { key: "result", label: "Result", type: "badge" },
  ],
  rows,
});

const matchTable = () => ({
  title: "Row match proof (sample)",
  note: "E070 column A ↔ STMS column D, exact TR number match. CR numbers taken from E070 column J (10 digits starting with 6 or 7).",
  columns: [
    { key: "tr", label: "TR number", mono: true },
    { key: "cr", label: "CR number", mono: true },
    { key: "e070", label: "E070 row" },
    { key: "stms", label: "STMS row" },
    { key: "owner", label: "Owner" },
    { key: "user", label: "Import user" },
    { key: "date", label: "Date" },
  ],
  rows: POPULATION.matchProof,
});

const sampleTable = (samples, withResult) => ({
  title: withResult ? "Per-sample results" : "Selected samples",
  columns: [
    { key: "n", label: "#" },
    { key: "tr", label: "TR number", mono: true },
    { key: "cr", label: "CR number", mono: true },
    { key: "type", label: "Change type" },
    ...(withResult
      ? [
          ...ATTRIBUTES.map((_, k) => ({ key: `a${k}`, label: `A${k + 1}`, align: "center" })),
          { key: "result", label: "Result", type: "badge" },
          { key: "note", label: "Notes", minWidth: 220 },
        ]
      : []),
  ],
  rows: samples.map((s, i) => ({
    n: i + 1,
    tr: s.tr,
    cr: s.cr,
    type: withResult ? s.type : s.result === "Missing" ? "To be confirmed from ticket" : s.type,
    ...Object.fromEntries(s.attrs.map((a, k) => [`a${k}`, a])),
    result: s.result === "Pass" ? "Pass" : s.result === "Missing" ? "Not tested" : "Fail",
    note: s.note || "—",
  })),
});

const attributeTable = (samples) => ({
  title: "Attribute summary",
  columns: [
    { key: "n", label: "#" },
    { key: "attribute", label: "Attribute", minWidth: 180 },
    { key: "tested", label: "Tested", align: "center" },
    { key: "ok", label: "√", align: "center" },
    { key: "x", label: "X", align: "center" },
    { key: "conclusion", label: "Conclusion", type: "badge" },
    { key: "comment", label: "Comment", minWidth: 220 },
  ],
  rows: attributeSummary(samples),
});

const exceptionTable = (samples) => ({
  title: "Exceptions",
  columns: [
    { key: "tr", label: "TR number", mono: true },
    { key: "cr", label: "CR number", mono: true },
    { key: "note", label: "Exception", minWidth: 360 },
  ],
  rows: samples.filter((s) => s.result !== "Pass"),
});

const improvementTable = () => ({
  title: "Improvement opportunities",
  note: "Control design and operation improvements identified during testing – also in the work paper.",
  columns: [
    { key: "ref", label: "Ref" },
    { key: "area", label: "Area" },
    { key: "priority", label: "Priority", type: "badge" },
    { key: "recommendation", label: "Recommendation", minWidth: 420 },
  ],
  rows: IMPROVEMENTS,
});

// ── agent step lists ──────────────────────────────────────────────────────
const ok = (text, log) => ({ text, status: "pass", log: log ? [log] : undefined });

const RCM_STEPS = [
  {
    id: "r1",
    label: "Read the RCM",
    detail: RCM.controlId,
    subChecks: [ok("Control objective, risk and description identified"), ok(`Nature, frequency and owner captured – ${RCM.frequency}`), ok(`${ATTRIBUTES.length} test attributes extracted`), ok("Evidence required mapped to each attribute")],
  },
];

const ACTT_STEPS = [
  { id: "a1", label: "Connect to ACTT", detail: `Read-only connection to ${ACTT_SYSTEM.sid} · client ${ACTT_SYSTEM.client}`, subChecks: [ok("Authenticated to ACTT", "[ACTT] Session opened (read-only)"), ok(`Located ${ACTT_SYSTEM.description} ${ACTT_SYSTEM.sid} · client ${ACTT_SYSTEM.client}`)] },
  { id: "a2", label: "Extract transport population", detail: `In-scope period ${RCM.period}`, subChecks: [ok("E070 transport headers extracted – 87 rows"), ok("STMS_IMPORT import history extracted – 87 rows"), ok("Merged on TR number – 87 / 87 matched"), ok("CR numbers extracted – 70 unique CRs")] },
  { id: "a3", label: "IPE – reliance on ACTT", detail: "System-generated population", subChecks: IPE_ACTT.map((c) => ok(`${c.check} – ${c.value}`)) },
];

const MANUAL_STEPS = [
  { id: "m1", label: "Read population file", detail: "E070 Extract and STMS_IMPORT Extract sheets", subChecks: [ok("E070 sheet: 87 rows parsed"), ok("STMS sheet: 87 rows parsed"), ok("Merged on TR number – 87 / 87 matched"), ok("CR numbers extracted – 70 unique CRs")] },
  ...["Completeness", "Accuracy", "Screenshot"].map((layer, i) => ({
    id: `m${i + 2}`,
    label: `IPE – ${layer === "Screenshot" ? "screenshot verification" : layer.toLowerCase()}`,
    detail: `${IPE_MANUAL.filter((c) => c.layer === layer).length} checks`,
    subChecks: IPE_MANUAL.filter((c) => c.layer === layer).map((c) => ok(`${c.check} – ${c.value}`)),
  })),
];

const testingSteps = (samples, fileCount, round) => [
  {
    id: "t0",
    label: "Match evidence to samples",
    detail: `${fileCount} file(s) received${round > 1 ? ` · round ${round}` : ""}`,
    subChecks: [
      ok("Ticket history PDFs indexed by CR number"),
      ok(`GPO / LPO approval emails matched to ${samples.filter((s) => s.type === "Standard change").length} standard changes`),
      samples.some((s) => s.result === "Missing")
        ? { text: "No ticket history PDF found for CIDK905611 (CR 6000028397)", status: "exception" }
        : ok("Ticket history found for every sample, including CIDK905611 (supplied by the control owner)"),
    ],
  },
  ...samples.map((s, i) => {
    const miss = s.result === "Missing";
    return {
      id: `t${i + 1}`,
      label: `Sample ${i + 1} – ${s.tr} → CR ${s.cr}`,
      detail: miss ? "Not tested" : s.type,
      subChecks: miss
        ? [{ text: "Attributes 1–4 not tested – source document missing", status: "exception" }]
        : [
            ok(`A1–A2 – unit test ${s.unitDate}, UAT ${s.uatDate}, evidence retained in Solman`),
            ok(`A3 – ${s.type === "Preapproved change" ? "on pre-approved list" : `approved ${s.apprDate}`}, before import ${s.importDate}`),
            s.attrs[3] === "X"
              ? { text: `A4 – SOD violation: owner ${s.owner} also imported the transport`, status: "exception" }
              : ok(`A4 – owner ${s.owner} ≠ import user ${s.user}`),
          ],
    };
  }),
];

export default function ChangeChatbot({ onTitle, onNewChat }) {
  const idRef = useRef(10);
  const nid = () => idRef.current++;
  const handlers = useRef({});
  const ctx = useRef({ source: null, sampleMethod: "", round: 1, reviews: [], sourceMsg: null, submission: null });
  const stageRef = useRef("rcm");
  const [stage, setStageState] = useState("rcm");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [view, setView] = useState("tester");
  const [reviews, setReviewsState] = useState([]);
  const [submission, setSubmissionState] = useState(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      role: "assistant",
      type: "jsx",
      content: (
        <>
          Hello! I'm your <strong>Agentic control testing assistant</strong>.
          <br />
          <br />
          <StepBadge index={1} total={TOTAL} label="RCM" />
          <div>Please upload your RCM (Risk &amp; Control Matrix) file to proceed. Excel or any other format works.</div>
        </>
      ),
    },
  ]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stagedFiles]);

  const setStage = (s) => {
    stageRef.current = s;
    setStageState(s);
  };
  const setReviews = (fn) => {
    ctx.current.reviews = fn(ctx.current.reviews);
    setReviewsState(ctx.current.reviews);
  };
  const setSub = (v) => {
    ctx.current.submission = v;
    setSubmissionState(v);
  };
  const say = async (msg, delay = 450) => {
    const id = nid();
    setMessages((p) => [...p, { id, role: "assistant", type: "typing" }]);
    await sleep(delay);
    setMessages((p) => p.map((m) => (m.id === id ? { id, role: "assistant", ...msg } : m)));
    return id;
  };
  const sayText = (content, delay) => say({ type: "jsx", content }, delay);
  const update = (id, patch) => setMessages((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const userText = (content) => setMessages((p) => [...p, { id: nid(), role: "user", type: "text", content }]);
  const samples = () => getSamples(ctx.current.round);
  const wpData = () => ({ source: ctx.current.source, sampleMethod: ctx.current.sampleMethod, round: ctx.current.round, samples: samples(), reviews: ctx.current.reviews });

  // ── Step 1: RCM ─────────────────────────────────────────────────────────
  const readRcm = async () => {
    setStage("running");
    setBusy(true);
    await say({ type: "checks", intro: <div>Reading your RCM…</div>, checks: RCM_STEPS, runningLabel: "Reading the RCM…", doneLabel: "RCM read.", onComplete: () => handlers.current.afterRcm() }, 300);
  };

  handlers.current.afterRcm = async () => {
    setBusy(false);
    await say(
      {
        type: "jsx",
        content: (
          <>
            Thanks – I've read your RCM. I test the <strong>{RCM.name}</strong> control ({RCM.controlId}) the way an auditor would – checking that each change is tested
            before implementation, testing is documented and retained, changes are approved before migration and developers don't import their own transports – and
            rolling each finding up to a pass / exception verdict.
            <div style={{ marginTop: 14 }}>
              <DataTablesBlock tables={[rcmTable()]} />
            </div>
          </>
        ),
      },
      400
    );
    setStage("source");
    ctx.current.sourceMsg = await say({ type: "jsx", content: sourceContent(null) });
  };

  const sourceContent = (chosen) => (
    <>
      <StepBadge index={2} total={TOTAL} label="Population" />
      <div>
        Let's get started – please provide the population of transports imported into production in {RCM.period}. Pull it from ACTT, or upload the E070 / STMS
        extracts with screenshots, and I'll test completeness and accuracy end to end.
      </div>
      <ChoiceCards options={SOURCE_OPTIONS} chosen={chosen} onChoose={(id) => handlers.current.chooseSource(id)} />
    </>
  );

  // ── Step 2: population ──────────────────────────────────────────────────
  handlers.current.chooseSource = async (src) => {
    if (stageRef.current !== "source") return;
    ctx.current.source = src;
    update(ctx.current.sourceMsg, { content: sourceContent(src) });
    if (src === "actt") {
      userText(`Pull the population from ACTT (${ACTT_SYSTEM.sid} · client ${ACTT_SYSTEM.client})`);
      return runPopulation(ACTT_STEPS, "Connecting to ACTT now – nothing more is needed from you.");
    }
    userText("I'll upload the population manually");
    setStage("manual-file");
    await sayText("Please upload the population file with the E070 and STMS_IMPORT extracts, plus the E070 and STMS screenshots. I'll run the full IPE validation on it.");
  };

  const runPopulation = async (steps, intro) => {
    setStage("running");
    setBusy(true);
    await say(
      { type: "checks", intro: <div>{intro}</div>, checks: steps, runningLabel: "Extracting and validating the population…", doneLabel: "Population ready – IPE validation passed.", onComplete: () => handlers.current.afterPopulation() },
      350
    );
  };

  handlers.current.afterPopulation = async () => {
    const actt = ctx.current.source === "actt";
    setBusy(false);
    await say(
      {
        type: "jsx",
        content: (
          <>
            <div style={{ fontWeight: 600 }}>ITGC population analysis</div>
            <StatusBanner tone="ok" title={actt ? "IPE passed – population pulled from ACTT" : "IPE passed – 11 / 11 checks"}>
              {actt ? ACTT_IPE_STATEMENT : MANUAL_IPE_STATEMENT}
            </StatusBanner>
            <KpiStrip
              items={[
                { label: "Transport requests", value: POPULATION.transports },
                { label: "STMS matched", value: POPULATION.stmsMatched },
                { label: "Unique owners", value: POPULATION.owners },
                { label: "Unique CRs", value: POPULATION.uniqueCRs },
                { label: "SOD flags (owner = user)", value: POPULATION.sodFlags },
              ]}
            />
            <DataTablesBlock tables={[ipeTable(actt ? IPE_ACTT : IPE_MANUAL), matchTable()]} />
          </>
        ),
      },
      400
    );
    await sleep(300);
    setStage("samples");
    await askSamples();
  };

  const askSamples = async () => {
    ctx.current.samplesMsg = await say({
      type: "jsx",
      content: (
        <>
          <StepBadge index={3} total={TOTAL} label={ctx.current.round > 1 ? `Samples – round ${ctx.current.round}` : "Samples"} />
          <div>
            Population processed: {POPULATION.transports} transports. Upload your <strong>Selected Samples</strong> file, or I can randomly select {samples().length} samples per
            the RCM test approach.
          </div>
        </>
      ),
      actions: [
        { id: "upload-samples", label: "Upload selected samples", primary: true, icon: Upload },
        { id: "random", label: `Randomly select ${samples().length} samples`, icon: Shuffle },
      ],
    });
  };

  // ── Step 3: samples ─────────────────────────────────────────────────────
  const takeSamples = async (method) => {
    if (stageRef.current !== "samples") return;
    update(ctx.current.samplesMsg, { used: true });
    ctx.current.sampleMethod = method;
    setStage("evidence");
    await say({
      type: "jsx",
      content: (
        <>
          <DataTablesBlock intro={<>Samples locked – {samples().length} transports matched to the population:</>} tables={[sampleTable(samples(), false)]} />
          <StepBadge index={4} total={TOTAL} label="Evidence" />
          <div>
            Please upload the <strong>ticket history PDFs</strong> for these samples and, for standard changes, the <strong>GPO / LPO approval emails</strong> (.msg). You can
            attach a whole folder.
          </div>
        </>
      ),
    });
  };

  // ── Step 4: testing ─────────────────────────────────────────────────────
  const runTesting = async (fileCount) => {
    setStage("running");
    setBusy(true);
    const round = ctx.current.round;
    await say(
      {
        type: "checks",
        intro: <div>{round > 1 ? `Re-performing testing – round ${round}.` : "Thanks – testing each sample against the control attributes."}</div>,
        checks: testingSteps(samples(), fileCount, round),
        runningLabel: "Inspecting tickets, approvals and segregation of duties…",
        doneLabel: `Testing complete – ${stats(samples()).exceptions} exception(s) noted.`,
        onComplete: () => handlers.current.finish(),
      },
      400
    );
  };

  handlers.current.finish = async () => {
    const list = samples();
    const st = stats(list);
    const round = ctx.current.round;
    setBusy(false);
    setStage("done");
    await say(
      {
        type: "jsx",
        content: (
          <>
            <StepBadge index={5} total={TOTAL} label={round > 1 ? `Results – round ${round}` : "Results & work paper"} />
            <div style={{ fontWeight: 600 }}>
              {RCM.controlId} final report{round > 1 ? ` – round ${round}` : ""}
            </div>
            <StatusBanner tone={st.exceptions ? "bad" : "ok"} title={`Overall verdict: ${st.verdict}`}>
              {list.length} samples tested · {st.exceptions} exception(s). Population IPE: {ctx.current.source === "actt" ? "passed using the ACTT population" : "passed, 11 / 11 checks"}.
            </StatusBanner>
            <KpiStrip
              items={[
                { label: "Samples tested", value: list.length },
                { label: "Passed", value: st.passed, tone: "ok" },
                { label: "Exceptions", value: st.exceptions, tone: st.exceptions ? "bad" : "ok" },
                { label: "Population", value: POPULATION.transports },
              ]}
            />
            <DataTablesBlock tables={[sampleTable(list, true), attributeTable(list), exceptionTable(list), improvementTable()]} />
          </>
        ),
        actions: [
          { id: "download", label: "Download Testing Work Paper", primary: true, icon: Download },
          { id: "evidence", label: "Preview annotated evidence", icon: ImageIcon },
          { id: "ipe", label: "Show IPE checks", icon: ShieldCheck },
        ],
      },
      500
    );
    await sleep(250);
    await say({
      type: "jsx",
      content: (
        <>
          <div style={{ fontWeight: 600 }}>Exception summary – all {list.length} samples</div>
          <SummaryBullets items={list.map(sampleSummary)} />
          <div style={{ marginTop: 12 }}>The results are ready. Send them to the reviewer – they will approve or reject in the Reviewer view.</div>
        </>
      ),
      actions: [
        { id: "review", label: "Send to reviewer", primary: true, icon: Send },
        { id: "new", label: "Start a new audit", icon: RotateCcw },
      ],
    });
  };

  // ── Step 5: reviewer / owner ────────────────────────────────────────────
  // Tester sends the results → reviewer approves or rejects in the Reviewer view →
  // the owner is notified. A rejection names the phase where the issue is, and
  // re-testing restarts from that phase.
  const sendToReviewer = async (fromMsg) => {
    if (stageRef.current !== "done") return;
    if (fromMsg) update(fromMsg, { used: true });
    const round = ctx.current.round;
    setSub({ id: nid(), round, date: today() });
    setStage("review-pending");
    await say(
      {
        type: "jsx",
        content: (
          <>
            <StatusBanner tone="ok" title={`Round ${round} results sent to the reviewer`}>
              The reviewer sees the verdict and the exception summary in the Reviewer view and will approve or reject. You are notified here with the outcome.
            </StatusBanner>
          </>
        ),
        actions: [{ id: "reviewer", label: "Open reviewer view", primary: true, icon: Eye }],
      },
      250
    );
  };

  handlers.current.submitReview = async ({ decision, comment, reviewer, phase }) => {
    const round = ctx.current.round;
    setReviews((p) => [...p, { round, decision, comment, reviewer, phase, date: today() }]);
    setSub(null);
    if (decision === "Approved") {
      setStage("done");
      await sayText(
        <StatusBanner tone="ok" title={`Approved by ${reviewer} – control owner notified`}>
          Testing for round {round} is signed off{comment ? ` – “${comment}”` : ""}. The review is recorded in the work paper's Review Log.
        </StatusBanner>
      );
      return say(
        {
          type: "jsx",
          content: <div>Download the final, reviewed work paper.</div>,
          actions: [{ id: "download", label: "Download Testing Work Paper", primary: true, icon: Download }],
        },
        200
      );
    }
    setStage("owner-pending");
    await say({
      type: "jsx",
      content: (
        <>
          <StatusBanner tone="bad" title={`Rejected by ${reviewer} – issue in ${phaseLabel(phase)}. Control owner notified`}>
            “{comment}”
          </StatusBanner>
          <div>
            If the control owner accepts the observation, testing restarts from <strong>{phaseLabel(phase)}</strong> – not from evidence – and everything after that phase is
            performed again.
          </div>
        </>
      ),
      actions: [{ id: "owner", label: "Open control owner view", primary: true, icon: UserCheck }],
    });
  };

  const restartFrom = async (phase, docs) => {
    ctx.current.round += 1;
    const round = ctx.current.round;
    if (phase === "rcm") {
      setStage("rcm");
      return say({
        type: "jsx",
        content: (
          <>
            <StepBadge index={1} total={TOTAL} label={`RCM – round ${round}`} />
            <div>Please upload the corrected RCM (Risk &amp; Control Matrix). Population, samples, evidence and testing are then performed again.</div>
          </>
        ),
      });
    }
    if (phase === "population") {
      setStage("source");
      ctx.current.source = null;
      ctx.current.sourceMsg = await say({ type: "jsx", content: sourceContent(null) });
      return;
    }
    if (phase === "samples") {
      setStage("samples");
      return askSamples();
    }
    setStage("evidence");
    return say({
      type: "jsx",
      content: (
        <>
          <StepBadge index={4} total={TOTAL} label={`Evidence – round ${round}`} />
          <div>
            Please upload the updated evidence for the samples (ticket history PDFs and approval emails)
            {docs.length ? ", or I can re-test straight away with the documents the control owner provided" : ""}.
          </div>
        </>
      ),
      actions: docs.length ? [{ id: "retest-owner", label: "Re-test with the owner's documents", primary: true, icon: RefreshCw }] : [],
    });
  };

  const respond = async (idx, { decision, notes, docs }) => {
    const review = ctx.current.reviews[idx];
    const owner = { decision, notes, docs, date: today() };
    setReviews((p) => p.map((r, i) => (i === idx ? { ...r, owner } : r)));
    setView("tester");
    const docLine = docs.length ? <div style={{ fontSize: 13, color: "#53565A", marginTop: 4 }}>Reference documents: {docs.join(", ")}</div> : null;
    if (decision === "Accepted") {
      await sayText(
        <StatusBanner tone="ok" title={`Control owner accepted the observation – testing restarts from ${phaseLabel(review.phase)}`}>
          {notes || "No notes added."}
          {docLine}
        </StatusBanner>
      );
      return restartFrom(review.phase, docs);
    }
    await sayText(
      <StatusBanner tone="bad" title="Control owner rejected the observation – no re-test">
        <strong>Reason:</strong> {notes}
        {docLine}
      </StatusBanner>
    );
    setSub({ id: nid(), round: ctx.current.round, date: today(), note: "The control owner rejected your observation (see the reason in the review history below). No re-test was performed – please review again." });
    setStage("review-pending");
    return say({
      type: "jsx",
      content: <div>The owner's reason and documents are visible to the reviewer, who can approve or raise the observation again in the Reviewer view.</div>,
      actions: [{ id: "reviewer", label: "Open reviewer view", primary: true, icon: Eye }],
    });
  };

  const showEvidence = async () => {
    const list = samples().filter((s) => s.result !== "Missing");
    const picks = [list.find((s) => s.result === "Fail"), list.find((s) => s.result === "Pass")].filter(Boolean);
    const imgs = picks.flatMap((s) => evidenceImagesFor(s).map((im) => ({ ...im, tr: s.tr })));
    await sayText(
      <>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Annotated evidence (preview)</div>
        <div style={{ fontSize: 13, color: "#53565A", marginBottom: 10 }}>Green boxes show an attribute met, red shows an exception. Every tested sample has these screenshots in the work paper's Evidence tab.</div>
        {imgs.map((im) => (
          <figure key={im.title} style={{ margin: "0 0 14px" }}>
            <img src={im.dataUrl} alt={`${im.title} – ${im.caption}`} style={{ width: "100%", maxWidth: 820, border: "1px solid #D0D0CE", borderRadius: 4 }} />
            <figcaption style={{ fontSize: 12.5, color: "#53565A", marginTop: 4 }}>
              {im.title} – {im.caption}
            </figcaption>
          </figure>
        ))}
      </>,
      300
    );
  };

  // ── Q&A after testing ───────────────────────────────────────────────────
  const qa = async (text) => {
    const l = text.toLowerCase();
    const s = samples().find((x) => l.includes(x.tr.toLowerCase()) || l.includes(x.cr));
    if (s) {
      return sayText(
        <>
          <strong>
            {s.tr} → CR {s.cr}
          </strong>{" "}
          ({s.type}): <strong style={{ color: s.result === "Pass" ? "#26890D" : "#DA291C" }}>{s.result === "Pass" ? "Pass" : s.result === "Missing" ? "Not tested" : "Fail"}</strong>
          <div style={{ fontSize: 13, color: "#53565A", marginTop: 4 }}>{testingPerformed(s)}</div>
        </>
      );
    }
    if (/download|work ?paper|excel|twp/.test(l)) {
      await downloadWP(wpData());
      return sayText("Downloading the Testing Work Paper.", 250);
    }
    if (/review/.test(l)) return sendToReviewer();
    if (/evidence|screenshot|annot/.test(l)) return showEvidence();
    if (/improve|recommend/.test(l)) return say({ type: "tables", tables: [improvementTable()] });
    if (/attribute/.test(l)) return say({ type: "tables", tables: [attributeTable(samples())] });
    if (/ipe|population|complete|accura/.test(l)) return say({ type: "tables", tables: [ipeTable(ctx.current.source === "actt" ? IPE_ACTT : IPE_MANUAL)] });
    if (/exception|fail|sod|issue|why|summary/.test(l)) return say({ type: "jsx", content: <SummaryBullets items={samples().map(sampleSummary)} /> });
    return sayText("I can explain the exceptions, show a sample (type its TR or CR number), the attribute summary, improvement opportunities or annotated evidence, send the results to the reviewer, or download the work paper.");
  };

  // ── buttons ─────────────────────────────────────────────────────────────
  const onAction = async (msgId, action) => {
    if (action === "upload-samples") return fileInputRef.current?.click();
    if (action === "random") {
      if (stageRef.current !== "samples") return;
      userText(`Randomly select ${samples().length} samples`);
      return takeSamples(`Random selection by the tool – ${samples().length} samples from a population of ${POPULATION.transports} transports.`);
    }
    if (action === "download") return downloadWP(wpData());
    if (action === "evidence") return showEvidence();
    if (action === "ipe") return say({ type: "tables", tables: [ipeTable(ctx.current.source === "actt" ? IPE_ACTT : IPE_MANUAL)] });
    if (action === "review") return sendToReviewer(msgId);
    if (action === "reviewer") return setView("reviewer");
    if (action === "owner") return setView("owner");
    if (action === "retest-owner") {
      if (stageRef.current !== "evidence") return;
      update(msgId, { used: true });
      const last = ctx.current.reviews[ctx.current.reviews.length - 1];
      userText("Re-test with the control owner's documents");
      return runTesting(last?.owner?.docs?.length || 1);
    }
    if (action === "new") return onNewChat();
  };

  // ── send ────────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files);
    e.target.value = "";
    if (!picked.length || busy) return;
    setStagedFiles((p) => [...p, ...picked]);
  };

  const handleSend = async () => {
    if (busy) return;
    const files = stagedFiles;
    const text = input.trim();
    if (!files.length && !text) return;
    setInput("");
    setStagedFiles([]);
    const userMsgs =
      files.length > FILE_GROUP_THRESHOLD
        ? [{ id: nid(), role: "user", type: "fileGroup", content: { count: files.length, names: files.map((f) => f.name) } }]
        : files.map((f) => ({ id: nid(), role: "user", type: "file", content: f.name }));
    if (text) userMsgs.push({ id: nid(), role: "user", type: "text", content: text });
    setMessages((p) => [...p, ...userMsgs]);
    const st = stageRef.current;

    if (st === "rcm") {
      if (files.length) {
        onTitle(files[0].name);
        return readRcm();
      }
      return sayText("Please attach your RCM file to continue – Excel or any other format works.");
    }
    if (st === "source") {
      if (files.length) {
        ctx.current.source = "manual";
        update(ctx.current.sourceMsg, { content: sourceContent("manual") });
        return runPopulation(MANUAL_STEPS, "Thanks – reading the population and running the IPE validation.");
      }
      if (/actt|pull|system/i.test(text)) return handlers.current.chooseSource("actt");
      if (/manual|upload/i.test(text)) return handlers.current.chooseSource("manual");
      return sayText("Please choose a population source above – pull from ACTT, or upload manually.");
    }
    if (st === "manual-file") {
      if (files.length) return runPopulation(MANUAL_STEPS, "Thanks – reading the population and running the IPE validation.");
      return sayText("Please attach the population file (E070 and STMS extracts) to continue.");
    }
    if (st === "samples") {
      if (files.length) return takeSamples(`Selected samples file provided by the engagement team (${files[0].name}) – ${samples().length} samples.`);
      if (/random|select/i.test(text)) return onAction(null, "random");
      return sayText("Upload the Selected Samples file, or choose random selection.");
    }
    if (st === "evidence") {
      if (files.length) return runTesting(files.length);
      return sayText("Please attach the ticket history PDFs and approval emails for the selected samples.");
    }
    if (st === "review-pending") return sayText("The results are with the reviewer – switch to the Reviewer view to approve or reject.");
    if (st === "owner-pending") return sayText("Waiting for the control owner to respond to the reviewer's observation – switch to the Control owner view.");
    if (st === "done" && text) return qa(text);
    if (text) return sayText("I'm working on it – one moment.", 200);
  };

  const list = samples();
  const st = stats(list);
  const summary = { verdict: st.verdict, total: list.length, passed: st.passed, exceptions: st.exceptions, bullets: list.map(sampleSummary) };
  const badges = {
    reviewer: submission ? 1 : 0,
    owner: reviews.filter((r) => (r.decision === "Rejected" && !r.owner) || (r.decision === "Approved" && !r.ack)).length,
  };
  const controlName = `${RCM.controlId} · ${RCM.name}`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#ffffff", minWidth: 0, height: "100%" }}>
      <ViewToggle view={view} setView={setView} badges={badges} />
      <div style={{ flex: 1, minHeight: 0, display: view === "tester" ? "flex" : "none", flexDirection: "column" }}>
        <MessageList ref={endRef} messages={messages} config={{}} onAction={onAction} />
        <InputArea
          input={input}
          setInput={setInput}
          stagedFiles={stagedFiles}
          onFileChange={handleFileChange}
          onFolderChange={handleFileChange}
          onRemoveStagedFile={(i) => setStagedFiles((p) => p.filter((_, k) => k !== i))}
          onClearStagedFiles={() => setStagedFiles([])}
          onSend={handleSend}
          processing={busy}
          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          placeholder={PLACEHOLDERS[stage] || PLACEHOLDERS.done}
          footnote="Demo environment · results are fixed for every upload · AI-assisted results should be reviewed by a qualified tester"
        />
      </div>
      {view === "reviewer" && <ReviewerPanel submission={submission} summary={summary} reviews={reviews} onSubmit={(r) => handlers.current.submitReview(r)} controlName={controlName} />}
      {view === "owner" && (
        <OwnerPanel
          reviews={reviews}
          onRespond={respond}
          onAck={(idx) => setReviews((p) => p.map((r, i) => (i === idx ? { ...r, ack: true } : r)))}
          controlName={controlName}
        />
      )}
    </div>
  );
}
