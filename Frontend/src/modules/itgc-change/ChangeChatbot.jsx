import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, ListChecks, RotateCcw, Shuffle, ShieldCheck, Upload } from "lucide-react";
import MessageList from "../../components/MessageList";
import InputArea from "../../components/InputArea";
import StepBadge from "../../components/StepBadge";
import DataTablesBlock from "../../components/DataTablesBlock";
import { ChoiceCards, KpiStrip, SOURCE_OPTIONS, StatusBanner } from "./components";
import {
  ACTT_IPE_STATEMENT, ACTT_SYSTEM, CONTROL, IPE_ACTT, IPE_MANUAL, MANUAL_IPE_STATEMENT, POPULATION, SAMPLES, VERDICT,
  exceptions, passed, testingPerformed,
} from "./data/demo";

const downloadWP = async (opts) => (await import("./exportWorkpaper")).downloadChangeWorkpaper(opts);

const TOTAL = 4;
const FILE_GROUP_THRESHOLD = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLACEHOLDERS = {
  source: "Choose where I should get the population from…",
  "manual-file": "Attach the population file (E070 / STMS extracts) and screenshots…",
  running: "Working on it…",
  samples: "Attach the selected samples file, or choose random selection…",
  evidence: "Attach the ticket history PDFs and approval emails (.msg)…",
  done: "Ask about an exception or a sample, e.g. “CIDK905003”…",
};

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

const populationTables = () => [
  {
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
  },
];

const sampleTable = (withResult) => ({
  title: withResult ? "Per-sample results" : "Selected samples",
  columns: [
    { key: "n", label: "#" },
    { key: "tr", label: "TR number", mono: true },
    { key: "cr", label: "CR number", mono: true },
    { key: "type", label: "Change type" },
    ...(withResult
      ? [
          { key: "a1", label: "Attr 1" },
          { key: "a2", label: "Attr 2" },
          { key: "a3", label: "Attr 3" },
          { key: "result", label: "Result", type: "badge" },
          { key: "note", label: "Notes", minWidth: 240 },
        ]
      : []),
  ],
  rows: SAMPLES.map((s, i) => ({
    n: i + 1,
    tr: s.tr,
    cr: s.cr,
    type: withResult ? s.type : s.result === "Missing" ? "To be confirmed from ticket" : s.type,
    a1: s.attrs[0],
    a2: s.attrs[1],
    a3: s.attrs[2],
    result: s.result === "Pass" ? "Pass" : "Fail",
    note: s.note || "—",
  })),
});

const exceptionTable = () => ({
  title: "Exceptions",
  columns: [
    { key: "tr", label: "TR number", mono: true },
    { key: "cr", label: "CR number", mono: true },
    { key: "note", label: "Exception", minWidth: 360 },
  ],
  rows: SAMPLES.filter((s) => s.result !== "Pass"),
});

// ── agent step lists for the live checklist ───────────────────────────────
const ok = (text, log) => ({ text, status: "pass", log: log ? [log] : undefined });

const ACTT_STEPS = [
  { id: "a1", label: "Connect to ACTT", detail: `Read-only connection to ${ACTT_SYSTEM.sid} · client ${ACTT_SYSTEM.client}`, subChecks: [ok("Authenticated to ACTT", "[ACTT] Session opened (read-only)"), ok(`Located ${ACTT_SYSTEM.description} ${ACTT_SYSTEM.sid} · client ${ACTT_SYSTEM.client}`)] },
  { id: "a2", label: "Extract transport population", detail: `In-scope period ${CONTROL.period}`, subChecks: [ok("E070 transport headers extracted – 87 rows"), ok("STMS_IMPORT import history extracted – 87 rows"), ok("Merged on TR number – 87 / 87 matched"), ok("CR numbers extracted – 70 unique CRs")] },
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

const testingSteps = (fileCount) => [
  {
    id: "t0",
    label: "Match evidence to samples",
    detail: `${fileCount} file(s) received`,
    subChecks: [
      ok("Ticket history PDFs indexed by CR number"),
      ok("GPO / LPO approval emails matched to 4 standard changes"),
      { text: "No ticket history PDF found for CIDK905611 (CR 6000028397)", status: "exception" },
    ],
  },
  ...SAMPLES.map((s, i) => {
    const miss = s.result === "Missing";
    return {
      id: `t${i + 1}`,
      label: `Sample ${i + 1} – ${s.tr} → CR ${s.cr}`,
      detail: miss ? "Not tested" : s.type,
      subChecks: miss
        ? [{ text: "Attributes 1–3 not tested – source document missing", status: "exception" }]
        : [
            ok(`Attributes 1 & 2 – unit test ${s.unitDate}, UAT ${s.uatDate}, evidence retained in Solman`),
            s.attrs[2] === "X"
              ? { text: `Attribute 3 – SOD violation: owner ${s.owner} also imported the transport`, status: "exception" }
              : ok(`Attribute 3 – ${s.type === "Preapproved change" ? "on pre-approved list" : "approved before import"}; owner ≠ import user`),
          ],
    };
  }),
];

export default function ChangeChatbot({ onTitle, onNewChat }) {
  const idRef = useRef(10);
  const nid = () => idRef.current++;
  const handlers = useRef({});
  const ctx = useRef({ source: null, sampleMethod: "" });
  const stageRef = useRef("source");
  const [stage, setStageState] = useState("source");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const sourceContent = (chosen) => (
    <>
      <StepBadge index={1} total={TOTAL} label="Population" />
      <div>Let's start with the population. Pull it from ACTT, or upload the population file (E070 / STMS extracts) – you can also just attach it below.</div>
      <ChoiceCards options={SOURCE_OPTIONS} chosen={chosen} onChoose={(id) => handlers.current.chooseSource(id)} />
    </>
  );

  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      role: "assistant",
      type: "jsx",
      content: (
        <>
          Hello! I'm <strong>ITGC Compliance Audit</strong>, your IT General Controls Testing & SOX Compliance assistant.
          <br />
          <br />
          Automate ITGC audits for SOX compliance. Pull the SAP transport population from ACTT or upload it yourself, then run change management control
          tests (ITGC 1.1.3), segregation of duties checks and pre-approved change verification, and generate the Testing Work Paper.
          <br />
          <br />
          You can attach files using the paperclip button in the input bar, or drag & drop files into the input area.
          <br />
          <br />
          What would you like to work on today?
        </>
      ),
    },
    { id: 2, role: "assistant", type: "jsx", content: sourceContent(null) },
  ]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stagedFiles]);

  const setStage = (s) => {
    stageRef.current = s;
    setStageState(s);
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

  // ── Step 1: population ──────────────────────────────────────────────────
  const chooseSource = async (src) => {
    if (stageRef.current !== "source") return;
    ctx.current.source = src;
    update(2, { content: sourceContent(src) });
    if (src === "actt") {
      userText(`Pull the population from ACTT (${ACTT_SYSTEM.sid} · client ${ACTT_SYSTEM.client})`);
      onTitle(`ACTT ${ACTT_SYSTEM.sid} ${ACTT_SYSTEM.client}`);
      return runPopulation(ACTT_STEPS, `Connecting to ACTT now – nothing more is needed from you.`);
    }
    userText("I'll upload the population manually");
    setStage("manual-file");
    await sayText(
      <>
        <StepBadge index={1} total={TOTAL} label="Upload population" />
        <div>
          Please upload the 1.1.3 population file with the <strong>E070</strong> and <strong>STMS_IMPORT</strong> extracts, plus the E070 and STMS screenshots. I'll run the full IPE validation on it.
        </div>
      </>
    );
  };
  handlers.current.chooseSource = chooseSource;

  const runPopulation = async (steps, intro) => {
    setStage("running");
    setBusy(true);
    await say(
      {
        type: "checks",
        intro: <div>{intro}</div>,
        checks: steps,
        runningLabel: "Extracting and validating the population…",
        doneLabel: "Population ready – IPE validation passed.",
        onComplete: afterPopulation,
      },
      350
    );
  };

  const afterPopulation = useCallback(async () => {
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
            <div style={{ fontSize: 13, color: "#53565A", marginBottom: 10 }}>
              Period {POPULATION.period} · transport target {POPULATION.target} · TR prefix {POPULATION.prefix}
            </div>
            <DataTablesBlock tables={[ipeTable(actt ? IPE_ACTT : IPE_MANUAL), ...populationTables()]} />
          </>
        ),
      },
      400
    );
    await sleep(300);
    setStage("samples");
    ctx.current.samplesMsg = await say({
      type: "jsx",
      content: (
        <>
          <StepBadge index={2} total={TOTAL} label="Samples" />
          <div>
            Population processed: {POPULATION.transports} transports for {POPULATION.period}. Upload your <strong>Selected Samples</strong> file, or I can randomly select samples from the population
            (recommended: {SAMPLES.length} for this population size).
          </div>
        </>
      ),
      actions: [
        { id: "upload-samples", label: "Upload selected samples", primary: true, icon: Upload },
        { id: "random", label: `Randomly select ${SAMPLES.length} samples`, icon: Shuffle },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: samples ─────────────────────────────────────────────────────
  const takeSamples = async (method) => {
    if (stageRef.current !== "samples") return;
    update(ctx.current.samplesMsg, { used: true });
    ctx.current.sampleMethod = method;
    setStage("evidence");
    await say({
      type: "jsx",
      content: (
        <>
          <DataTablesBlock intro={<>Samples locked – {SAMPLES.length} transports matched precisely to the population:</>} tables={[sampleTable(false)]} />
          <StepBadge index={3} total={TOTAL} label="Evidence" />
          <div>
            Please upload the <strong>ticket history PDFs</strong> for these samples. For standard changes, also upload the <strong>GPO / LPO approval emails</strong> (.msg). You can attach a whole folder.
          </div>
        </>
      ),
    });
  };

  // ── Step 3: testing ─────────────────────────────────────────────────────
  const runTesting = async (fileCount) => {
    setStage("running");
    setBusy(true);
    await say(
      {
        type: "checks",
        intro: <div>Thanks – testing each sample against the three control attributes.</div>,
        checks: testingSteps(fileCount),
        runningLabel: "Inspecting tickets, approvals and segregation of duties…",
        doneLabel: `Testing complete – ${exceptions} exception(s) noted.`,
        onComplete: finish,
      },
      400
    );
  };

  const resultsContent = () => (
    <>
      <StepBadge index={4} total={TOTAL} label="Results & work paper" />
      <div style={{ fontWeight: 600 }}>{CONTROL.ref} audit result</div>
      <StatusBanner tone={exceptions ? "bad" : "ok"} title={`Overall verdict: ${VERDICT}`}>
        {SAMPLES.length} samples tested · {exceptions} exception(s). Population IPE:{" "}
        {ctx.current.source === "actt" ? "passed using the ACTT population" : "passed, 11 / 11 checks"}.
      </StatusBanner>
      <KpiStrip
        items={[
          { label: "Samples tested", value: SAMPLES.length },
          { label: "Passed", value: passed, tone: "ok" },
          { label: "Exceptions", value: exceptions, tone: exceptions ? "bad" : "ok" },
          { label: "Population", value: POPULATION.transports },
        ]}
      />
      <div style={{ fontSize: 13, background: "#FFF6E0", borderLeft: "4px solid #ED8B00", padding: "8px 12px", marginBottom: 12 }}>
        1 sample incomplete – ticket history PDF not provided for CIDK905611.
      </div>
      <DataTablesBlock tables={[sampleTable(true), exceptionTable()]} />
    </>
  );

  const finish = useCallback(async () => {
    setBusy(false);
    setStage("done");
    await say(
      {
        type: "jsx",
        content: resultsContent(),
        actions: [
          { id: "download", label: "Download Testing Work Paper", primary: true, icon: Download },
          { id: "ipe", label: "Show IPE checks", icon: ShieldCheck },
          { id: "new", label: "Start a new audit", icon: RotateCcw },
        ],
      },
      500
    );
    await sleep(250);
    await sayText("Every step is logged in the activity log above. Ask me about any sample (e.g. “CIDK905003”) or the exceptions.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async () => {
    await downloadWP({ source: ctx.current.source, sampleMethod: ctx.current.sampleMethod });
  };

  // ── Q&A after testing ───────────────────────────────────────────────────
  const qa = async (text) => {
    const l = text.toLowerCase();
    const tr = SAMPLES.find((s) => l.includes(s.tr.toLowerCase()) || l.includes(s.cr));
    if (tr) {
      return sayText(
        <>
          <strong>
            {tr.tr} → CR {tr.cr}
          </strong>{" "}
          ({tr.type}): <strong style={{ color: tr.result === "Pass" ? "#26890D" : "#DA291C" }}>{tr.result === "Pass" ? "Pass" : "Fail"}</strong>
          <div style={{ fontSize: 13, color: "#53565A", marginTop: 4 }}>{testingPerformed(tr)}</div>
        </>
      );
    }
    if (/download|work ?paper|excel|twp/.test(l)) {
      await download();
      return sayText("Downloading the Testing Work Paper (Test Sheet + Evidence & Attribute mapping).", 250);
    }
    if (/ipe|population|complete|accura/.test(l)) return say({ type: "tables", tables: [ipeTable(ctx.current.source === "actt" ? IPE_ACTT : IPE_MANUAL)] });
    if (/new|restart|start over/.test(l)) return onNewChat();
    if (/exception|fail|sod|issue|why/.test(l)) return say({ type: "tables", intro: `${exceptions} exception(s) noted:`, tables: [exceptionTable()] });
    return sayText("I can explain the exceptions, show a sample (type its TR or CR number), show the IPE checks, or download the work paper.");
  };

  // ── buttons ─────────────────────────────────────────────────────────────
  const onAction = async (msgId, action) => {
    if (action === "upload-samples") return fileInputRef.current?.click();
    if (action === "random") {
      if (stageRef.current !== "samples") return;
      userText(`Randomly select ${SAMPLES.length} samples`);
      return takeSamples(`Random selection by the tool – ${SAMPLES.length} samples from a population of ${POPULATION.transports} transports.`);
    }
    if (action === "download") return download();
    if (action === "ipe") {
      userText("Show IPE checks");
      return say({ type: "tables", tables: [ipeTable(ctx.current.source === "actt" ? IPE_ACTT : IPE_MANUAL)] });
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

    if (st === "source") {
      if (files.length) {
        ctx.current.source = "manual";
        update(2, { content: sourceContent("manual") });
        onTitle(files[0].name);
        return runPopulation(MANUAL_STEPS, "Thanks – reading the population and running the IPE validation.");
      }
      if (/actt|pull|system/i.test(text)) return chooseSource("actt");
      if (/manual|upload/i.test(text)) return chooseSource("manual");
      return sayText("Please choose a population source above – pull from ACTT, or upload manually.");
    }
    if (st === "manual-file") {
      if (files.length) {
        onTitle(files[0].name);
        return runPopulation(MANUAL_STEPS, "Thanks – reading the population and running the IPE validation.");
      }
      return sayText("Please attach the population file (E070 and STMS extracts) to continue.");
    }
    if (st === "samples") {
      if (files.length) return takeSamples(`Selected samples file provided by the engagement team (${files[0].name}) – ${SAMPLES.length} samples.`);
      if (/random|select/i.test(text)) return onAction(null, "random");
      return sayText("Upload the Selected Samples file, or choose random selection.");
    }
    if (st === "evidence") {
      if (files.length) return runTesting(files.length);
      return sayText("Please attach the ticket history PDFs and approval emails for the selected samples.");
    }
    if (st === "done" && text) return qa(text);
    if (text) return sayText("I'm working on it – one moment.", 200);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#ffffff", minWidth: 0, height: "100%" }}>
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
        placeholder={PLACEHOLDERS[stage]}
        footnote="Demo environment · results are fixed for every upload · AI-assisted results should be reviewed by a qualified tester"
      />
    </div>
  );
}
