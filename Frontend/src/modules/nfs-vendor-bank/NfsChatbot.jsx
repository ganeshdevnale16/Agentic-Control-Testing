import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, FolderOpen, MessageCircleQuestion, Play, RotateCcw, TableProperties, Upload } from "lucide-react";
import MessageList from "../../components/MessageList";
import InputArea from "../../components/InputArea";
import StepBadge from "../../components/StepBadge";
import DataTablesBlock from "../../components/DataTablesBlock";
import { ExceptionCard } from "../../components/ResultsDashboard";
import NfsResults from "./components/NfsResults";
import NfsReport from "./components/NfsReport";
import { KIND_LABEL, classify, readDoc } from "./engine/readers";
import { parseSop } from "./engine/sopParser";
import { parseWalkthrough } from "./engine/walkthroughParser";
import { buildRcm } from "./engine/rcmBuilder";
import { emptyEvidence, parseSheetEvidence, parseVcrf } from "./engine/evidenceParser";
import { runTest } from "./engine/testEngine";
import { TOTAL_STEPS, DEMO_DOCS, DEMO_EVIDENCE } from "./data/constants";

// Excel writers load on first download
const exportNfs = () => import("./exportNfs");
const downloadRcm = async (rcm, sop) => (await exportNfs()).downloadRcm(rcm, sop);
const downloadWorkpaper = async (result) => (await exportNfs()).downloadWorkpaper(result);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EVIDENCE_KINDS = ["vcrf", "config", "review"];

const PLACEHOLDERS = {
  start: "Type “create RCM” to begin…",
  docs: "Attach the SOP and the walkthrough file…",
  building: "Building the RCM…",
  evidence: "Attach the evidence files…",
  testing: "Testing in progress…",
  done: "Ask about an attribute or exception, e.g. “why did A2 fail?”",
};

async function demoFile(name) {
  const res = await fetch(`${import.meta.env.BASE_URL}demo/nfs/${name}`);
  if (!res.ok) throw new Error(`demo file ${name} not found (${res.status})`);
  return new File([await res.blob()], name);
}

const RCM_TABLE_COLS = [
  { key: "controlId", label: "Control ID", mono: true },
  { key: "activity", label: "Control activity", minWidth: 200 },
  { key: "type", label: "Type" },
  { key: "nature", label: "Nature" },
  { key: "frequency", label: "Frequency" },
  { key: "performer", label: "Performed by" },
  { key: "sopRef", label: "SOP ref" },
  { key: "attributes", label: "Attributes" },
  { key: "sample", label: "Sample" },
  { key: "design", label: "Design", type: "badge" },
];

export default function NfsChatbot({ config, onTitle, onNewChat }) {
  const idRef = useRef(2);
  const nid = () => idRef.current++;
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      role: "assistant",
      type: "welcome",
      actions: [
        { id: "create-rcm", label: "Create RCM", primary: true, icon: TableProperties },
        { id: "demo-docs", label: "Try with demo files", icon: FolderOpen },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [stage, setStageState] = useState("start");
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const stageRef = useRef("start");
  const ctx = useRef({ evidence: emptyEvidence(), early: [] });
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const setStage = (s) => {
    stageRef.current = s;
    setStageState(s);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stagedFiles]);

  // ── message helpers ─────────────────────────────────────────────────────
  const say = async (msg, delay = 450) => {
    const id = nid();
    setMessages((p) => [...p, { id, role: "assistant", type: "typing" }]);
    await sleep(delay);
    setMessages((p) => p.map((m) => (m.id === id ? { id, role: "assistant", ...msg } : m)));
    return id;
  };
  const sayText = (content, delay, actions) => say({ type: "jsx", content, actions }, delay);
  const userText = (content) => setMessages((p) => [...p, { id: nid(), role: "user", type: "text", content }]);
  const userFiles = (names) => setMessages((p) => [...p, ...names.map((n) => ({ id: nid(), role: "user", type: "file", content: n }))]);
  const disable = (id) => setMessages((p) => p.map((m) => (m.id === id ? { ...m, used: true } : m)));

  // read + classify a batch of files
  const readAll = async (files) => {
    const out = [];
    for (const f of files) {
      try {
        const doc = await readDoc(f);
        out.push({ file: f, doc, kind: classify(doc) });
      } catch (e) {
        out.push({ file: f, error: e.message, kind: "unknown" });
      }
    }
    return out;
  };

  const receivedTable = (items) => ({
    title: "Files received",
    columns: [
      { key: "name", label: "File", minWidth: 260 },
      { key: "kind", label: "Recognised as", minWidth: 220 },
    ],
    rows: items.map((i) => ({ name: i.file.name, kind: i.error ? `Could not read – ${i.error}` : KIND_LABEL[i.kind] })),
  });

  // ── Step 1: ask for SOP + walkthrough ───────────────────────────────────
  const askDocs = async () => {
    setStage("docs");
    await say({
      type: "jsx",
      content: (
        <>
          <StepBadge index={1} total={TOTAL_STEPS} label="SOP & walkthrough" />
          <div>
            Let's build the RCM. Please upload the <strong>SOP</strong> for the process and the <strong>walkthrough file</strong> (walkthrough notes, or the existing RCM extract from the walkthrough). You can attach both at
            once – PDF, Word, text or Excel. I'll read them, check they agree with each other and generate the RCM with a design assessment and test plan.
          </div>
        </>
      ),
      actions: [
        { id: "upload", label: "Upload SOP & walkthrough", primary: true, icon: Upload },
        { id: "demo-docs", label: "Use demo SOP & walkthrough", icon: FolderOpen },
      ],
    });
  };

  const ingestDocs = async (files) => {
    const items = await readAll(files);
    const c = ctx.current;
    for (const i of items) {
      if (i.kind === "sop") c.sop = parseSop(i.doc.text, i.file.name);
      else if (i.kind === "rcm" || i.kind === "walkthrough") c.wt = parseWalkthrough(i.doc);
      else if (EVIDENCE_KINDS.includes(i.kind)) c.early.push(i);
    }
    const early = items.filter((i) => EVIDENCE_KINDS.includes(i.kind));
    await say({
      type: "tables",
      intro: early.length ? `Thanks. I've kept ${early.length} evidence file(s) aside for step 3.` : "Thanks – here's what I found:",
      tables: [receivedTable(items)],
    }, 300);
    if (c.sop) onTitle(c.sop.docId || c.sop.name);
    if (c.sop && c.wt) return buildRcmFlow();
    if (c.sop)
      return sayText(<>I have the SOP. Please attach the <strong>walkthrough file</strong> as well, or continue and I'll take the control activities from the SOP alone.</>, 300, [
        { id: "upload", label: "Upload walkthrough", primary: true, icon: Upload },
        { id: "no-wt", label: "Continue without walkthrough", icon: Play },
      ]);
    if (c.wt) return sayText(<>I have the walkthrough. I also need the <strong>SOP</strong> (PDF, Word or text) to validate it against.</>, 300, [{ id: "upload", label: "Upload SOP", primary: true, icon: Upload }]);
    return sayText("I couldn't find an SOP or a walkthrough in those files. The SOP should be a PDF, Word or text document; the walkthrough can be notes or an RCM extract in Excel.", 300);
  };

  // ── Step 2: generate the RCM ────────────────────────────────────────────
  const buildRcmFlow = async () => {
    const c = ctx.current;
    setStage("building");
    setBusy(true);
    c.rcm = buildRcm({ sop: c.sop, wt: c.wt });
    await say(
      {
        type: "checks",
        intro: (
          <>
            <StepBadge index={2} total={TOTAL_STEPS} label="Validate & generate RCM" />
            <div>Reading the SOP and walkthrough, checking they agree and assessing the design…</div>
          </>
        ),
        checks: c.rcm.procedures,
        runningLabel: "Validating the documents and building the RCM…",
        doneLabel: `RCM generated – ${c.rcm.rcmRows.length} rows, ${c.rcm.attributes.length} test attributes, ${c.rcm.gaps.length} design gap(s).`,
        onComplete: afterRcm,
      },
      350
    );
  };

  const afterRcm = async (log) => {
    const c = ctx.current;
    c.rcmLog = log;
    setBusy(false);
    const { rcm } = c;
    await say(
      {
        type: "jsx",
        content: (
          <DataTablesBlock
            intro={
              <>
                Here's the RCM for <strong>{rcm.control.id}</strong> ({rcm.control.subProcess}). Design conclusion: <strong>{rcm.designConclusion}</strong>.
              </>
            }
            tables={[
              {
                title: "Risk and control matrix",
                note: `${rcm.control.riskId} – ${rcm.control.riskDesc}`,
                columns: RCM_TABLE_COLS,
                rows: rcm.rcmRows,
              },
              {
                title: "Walkthrough checked against the SOP",
                columns: [
                  { key: "check", label: "Check", minWidth: 200 },
                  { key: "result", label: "Result", type: "badge" },
                  { key: "detail", label: "Detail", minWidth: 320 },
                ],
                rows: rcm.consistency,
              },
              {
                title: "Design assessment",
                note: "Gaps are carried into the report and the workpaper.",
                columns: [
                  { key: "id", label: "Ref" },
                  { key: "area", label: "Area", minWidth: 170 },
                  { key: "status", label: "Assessment", type: "badge" },
                  { key: "severity", label: "Severity" },
                  { key: "observation", label: "Observation", minWidth: 380 },
                ],
                rows: rcm.design,
              },
              {
                title: "Test plan",
                columns: [
                  { key: "id", label: "#" },
                  { key: "activity", label: "Control", mono: true },
                  { key: "label", label: "Attribute", minWidth: 260 },
                  { key: "ev", label: "Evidence" },
                ],
                rows: rcm.attributes.map((a) => ({ ...a, ev: a.evidence.join(", ") })),
              },
            ]}
          />
        ),
        actions: [{ id: "rcm", label: "Download RCM (Excel)", icon: Download }],
      },
      300
    );
    await sleep(300);
    await askEvidence();
  };

  // ── Step 3: evidence ────────────────────────────────────────────────────
  const evidenceStatus = () => {
    const ev = ctx.current.evidence;
    const have = { vcrf: ev.vcrfs.length > 0, sensitive: !!ev.sensitive?.length, access: !!ev.access?.length, calendar: !!ev.calendar?.length, changes: !!ev.changes?.length && !!ev.signoff };
    return ctx.current.rcm.evidenceRequests.map((e) => ({ ...e, status: have[e.kind] ? "Received" : "Missing" }));
  };
  const statusTable = (title) => ({
    title,
    columns: [
      { key: "id", label: "Ref" },
      { key: "name", label: "Evidence", minWidth: 300 },
      { key: "for", label: "Used for" },
      { key: "status", label: "Status", type: "badge" },
    ],
    rows: evidenceStatus(),
  });

  const askEvidence = async () => {
    setStage("evidence");
    await say({
      type: "jsx",
      content: (
        <>
          <StepBadge index={3} total={TOTAL_STEPS} label="Evidence" />
          <div style={{ marginBottom: 12 }}>
            Now I need the evidence to test the control. Upload whatever you have – I'll recognise each file from its content and test as soon as everything is in.
          </div>
          <DataTablesBlock tables={[{ ...statusTable("Evidence requested"), rows: evidenceStatus().map((r) => ({ ...r, status: "Awaiting" })) }]} />
        </>
      ),
      actions: [
        { id: "upload", label: "Upload evidence", primary: true, icon: Upload },
        { id: "demo-evidence", label: "Use demo evidence", icon: FolderOpen },
      ],
    });
    if (ctx.current.early.length) {
      const early = ctx.current.early;
      ctx.current.early = [];
      await sayText(`Using the ${early.length} evidence file(s) you sent earlier.`, 250);
      await ingestEvidence(early);
    }
  };

  // items: [{ file, doc, kind }] already read, or File[]
  const ingestEvidence = async (input) => {
    const items = input[0]?.doc || input[0]?.error ? input : await readAll(input);
    const ev = ctx.current.evidence;
    for (const i of items) {
      if (i.error) continue;
      if (!ev.files.some((f) => f.name === i.file.name)) ev.files.push({ name: i.file.name, kind: i.kind, label: KIND_LABEL[i.kind] });
      if (i.kind === "vcrf") {
        const v = parseVcrf(i.doc.text, i.file.name);
        if (!ev.vcrfs.some((x) => x.ref === v.ref)) ev.vcrfs.push(v);
      } else if (i.doc.kind === "sheets") parseSheetEvidence(i.doc, ev);
    }
    const st = evidenceStatus();
    const missing = st.filter((s) => s.status === "Missing");
    await say({
      type: "tables",
      intro: missing.length ? `Got it. Still missing: ${missing.map((m) => m.id).join(", ")}.` : "All requested evidence received.",
      tables: [receivedTable(items), statusTable("Evidence status")],
    }, 300);
    if (!missing.length) return startTest();
    return sayText("Upload the rest, or run the test now – attributes without evidence will be marked “Not tested”.", 250, [
      { id: "upload", label: "Upload more evidence", primary: true, icon: Upload },
      { id: "run", label: "Run test with what I have", icon: Play },
    ]);
  };

  // ── Step 4: testing ─────────────────────────────────────────────────────
  const startTest = async () => {
    if (stageRef.current !== "evidence") return;
    const c = ctx.current;
    setStage("testing");
    setBusy(true);
    c.result = runTest({ rcm: c.rcm, sop: c.sop, evidence: c.evidence });
    c.result.rcmLog = c.rcmLog;
    await say(
      {
        type: "checks",
        intro: (
          <>
            <StepBadge index={4} total={TOTAL_STEPS} label="Testing & results" />
            <div>Testing each attribute against the evidence…</div>
          </>
        ),
        checks: c.result.procedures,
        runningLabel: "Testing the control and evaluating exceptions…",
        doneLabel: `Testing complete – ${c.result.summary.exceptions} exception(s) noted.`,
        onComplete: finish,
      },
      400
    );
  };

  const finish = async (log) => {
    const c = ctx.current;
    c.result.log = log;
    setBusy(false);
    setFinalResult(c.result);
    setStage("done");
    await say(
      {
        type: "jsx",
        content: (
          <>
            <StepBadge index={4} total={TOTAL_STEPS} label="Results & workpaper" />
            <NfsResults result={c.result} onOpenReport={() => setReportOpen(true)} onDownloadExcel={() => downloadWorkpaper(c.result)} onDownloadRcm={() => downloadRcm(c.rcm, c.sop)} />
          </>
        ),
      },
      500
    );
    await sleep(300);
    await sayText("Ask me about any attribute or exception (for example “why did A2 fail?” or “who can run payments?”), or open the report.", 300, [
      ...(c.result.exceptions.length ? [{ id: "explain", label: "Explain the exceptions", icon: MessageCircleQuestion }] : []),
      { id: "report", label: "View full report", icon: FileText },
      { id: "excel", label: "Download workpaper", icon: FileSpreadsheet },
      { id: "new", label: "Start a new test", icon: RotateCcw },
    ]);
  };

  // ── Q&A ─────────────────────────────────────────────────────────────────
  const TOPICS = [
    [/callback|call ?back|phone|number/, "A2"],
    [/sod|segregat|f110|payment run access|run payments|conflict/, "A5"],
    [/sensitive|dual|fk08|config|t055f/, "A6"],
    [/ipe|complete|accura|report prepar/, "A8"],
    [/precis|missed|review(er)? (miss|fail)/, "A9"],
    [/timel|sign.?off/, "A7"],
    [/vcrf|cheque|letterhead/, "A1"],
  ];
  const qa = async (text) => {
    const l = text.toLowerCase();
    const r = ctx.current.result;
    if (/report|pdf|print/.test(l)) {
      setReportOpen(true);
      return sayText("Opening the full report – use Print / Save as PDF to download it.", 250);
    }
    if (/excel|workpaper|download/.test(l) && !/rcm/.test(l)) {
      await downloadWorkpaper(r);
      return sayText("Downloading the Excel workpaper.", 250);
    }
    if (/\brcm\b/.test(l)) {
      await downloadRcm(r.rcm, r.sop);
      return sayText("Downloading the RCM.", 250);
    }
    if (/new test|start over|restart|new chat/.test(l)) return onNewChat();
    if (/design|gap/.test(l))
      return say({ type: "tables", intro: `Design conclusion: ${r.summary.designConclusion}.`, tables: [{ title: "Design gaps", columns: [{ key: "id", label: "Ref" }, { key: "area", label: "Area", minWidth: 160 }, { key: "severity", label: "Severity", type: "badge" }, { key: "recommendation", label: "Recommendation", minWidth: 360 }], rows: r.rcm.gaps }] });
    if (/exposure|paid|payment/.test(l) && !/access/.test(l) && r.exposure.length)
      return sayText(`${r.exposure.map((x) => `Run ${x.runId} on ${x.date} (${x.by}, ${x.vendors} vendors, INR ${x.amount?.toLocaleString("en-IN")}) went out while ${x.changesBefore.map((c) => `${c.code} ${c.name}`).join(" and ")} had unreviewed bank changes.`).join(" ")} Ask AP for the payment list of these runs to confirm whether the changed vendors were paid.`);
    if (/pending|outstanding|missing|request|limitation/.test(l)) return sayText(<ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>{r.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>);
    const idm = l.match(/\ba(\d)\b/);
    const id = idm ? `A${idm[1]}` : TOPICS.find(([re]) => re.test(l))?.[1];
    const res = id && r.results.find((x) => x.attr.id === id);
    if (res) {
      const ex = r.exceptions.find((e) => e.id === res.exceptionId);
      return say({
        type: "jsx",
        content: (
          <>
            <div>
              <strong>
                {res.attr.id} {res.attr.label}
              </strong>{" "}
              – <strong style={{ color: res.status === "Pass" ? "#166534" : "#991b1b" }}>{res.status}</strong>
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{res.observation}</div>
            {ex && <ExceptionCard ex={ex} />}
          </>
        ),
      });
    }
    if (/why|exception|fail|issue|wrong|fix|recommend|summary|result/.test(l)) {
      if (!r.exceptions.length) return sayText("No exceptions – every attribute tested operated as designed.");
      return say({ type: "exceptions", content: <div>{r.exceptions.length} exception(s) noted:</div>, exceptions: r.exceptions });
    }
    return sayText("I can explain any attribute (A1–A9) or exception, show the design gaps, the payment exposure or the outstanding requests, or open the report.");
  };

  // ── demo loaders ────────────────────────────────────────────────────────
  const loadDemo = async (names, handler) => {
    setBusy(true);
    try {
      const files = await Promise.all(names.map(demoFile));
      userFiles(names);
      setBusy(false);
      await handler(files);
    } catch (e) {
      setBusy(false);
      await sayText(`I couldn't load the demo files: ${e.message}.`);
    }
  };

  // ── buttons ─────────────────────────────────────────────────────────────
  const onAction = async (msgId, action) => {
    const st = stageRef.current;
    if (action === "upload") return fileInputRef.current?.click();
    if (action === "rcm") return downloadRcm(ctx.current.rcm, ctx.current.sop);
    if (action === "report") return setReportOpen(true);
    if (action === "excel") return downloadWorkpaper(ctx.current.result);
    if (action === "new") return onNewChat();
    if (action === "create-rcm") {
      if (st !== "start") return;
      disable(msgId);
      userText("Create an RCM");
      return askDocs();
    }
    if (action === "demo-docs") {
      if (st !== "start" && st !== "docs") return;
      disable(msgId);
      if (st === "start") {
        userText("Create an RCM with the demo files");
        setStage("docs");
      }
      return loadDemo(DEMO_DOCS, ingestDocs);
    }
    if (action === "no-wt") {
      if (st !== "docs" || !ctx.current.sop) return;
      disable(msgId);
      userText("Continue without walkthrough");
      return buildRcmFlow();
    }
    if (action === "demo-evidence") {
      if (st !== "evidence") return;
      disable(msgId);
      return loadDemo(DEMO_EVIDENCE, ingestEvidence);
    }
    if (action === "run") {
      if (st !== "evidence") return;
      disable(msgId);
      userText("Run the test with what I have");
      return startTest();
    }
    if (action === "explain") {
      userText("Explain the exceptions");
      return say({ type: "exceptions", content: <div>{ctx.current.result.exceptions.length} exception(s) noted:</div>, exceptions: ctx.current.result.exceptions });
    }
  };

  // ── send ────────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files);
    e.target.value = "";
    if (!picked.length || busy) return;
    setStagedFiles((prev) => [...prev, ...picked]);
  };

  const handleSend = async () => {
    if (busy) return;
    const files = stagedFiles;
    const text = input.trim();
    if (!files.length && !text) return;
    setInput("");
    setStagedFiles([]);
    if (files.length) userFiles(files.map((f) => f.name));
    if (text) userText(text);
    const st = stageRef.current;

    if (st === "start") {
      if (files.length) {
        setStage("docs");
        return ingestDocs(files);
      }
      if (/rcm|create|start|begin|yes/i.test(text)) return askDocs();
      return sayText("I'll start by building the RCM. Type “create RCM” or press the button above.");
    }
    if (st === "docs") {
      if (files.length) return ingestDocs(files);
      if (/continue|without|skip|proceed/i.test(text) && ctx.current.sop) return buildRcmFlow();
      return sayText("Please attach the SOP and the walkthrough file with the paperclip.");
    }
    if (st === "evidence") {
      if (files.length) return ingestEvidence(files);
      if (/run|proceed|test|go/i.test(text)) return startTest();
      return sayText("Attach the evidence files, or type “run” to test with what you've sent so far.");
    }
    if (st === "done") return text ? qa(text) : sayText("Testing is finished – start a new chat to test another set of files.");
    return sayText("I'm working on it – one moment.", 200);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#ffffff", minWidth: 0, height: "100%" }}>
      <MessageList ref={endRef} messages={messages} config={config} onAction={onAction} />
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
        accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
        footnote="Demo with dummy client data · AI-assisted results should be reviewed by a qualified tester"
      />
      {reportOpen && finalResult && <NfsReport result={finalResult} onClose={() => setReportOpen(false)} onDownloadExcel={() => downloadWorkpaper(finalResult)} />}
    </div>
  );
}
