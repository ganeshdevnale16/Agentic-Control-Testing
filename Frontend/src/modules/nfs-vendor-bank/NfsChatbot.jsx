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
import { emptyEvidence, parseCheque, parseSheetEvidence, parseVcrf } from "./engine/evidenceParser";
import { parseTranscript } from "./engine/transcriptParser";
import { runTest } from "./engine/testEngine";
import { TOTAL_STEPS, DEMO_DOCS, DEMO_EVIDENCE } from "./data/constants";

// Excel writers load on first download
const exportNfs = () => import("./exportNfs");
const downloadRcm = async (rcm, sop) => (await exportNfs()).downloadRcm(rcm, sop);
const downloadWorkpaper = async (result) => (await exportNfs()).downloadWorkpaper(result);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EVIDENCE_KINDS = ["vcrf", "config", "review", "cheque", "rcm"];

const PLACEHOLDERS = {
  start: "Type “create RCM” to begin…",
  docs: "Attach the SOP and the walkthrough…",
  building: "Building the RCM…",
  evidence: "Attach the evidence files…",
  testing: "Testing in progress…",
  done: "Ask about an attribute or observation, e.g. “why is A4 deficient?”",
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
  const ctx = useRef({ evidence: emptyEvidence(), early: [], sources: {} });
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
        ctx.current.sources[f.name] = { file: f, doc };
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
            Let's build the RCM. Please upload just two things: the <strong>SOP</strong> for the process and the <strong>walkthrough</strong> (transcript or notes). PDF, Word, text or Excel all work. I'll
            read them, check the walkthrough agrees with the SOP and generate the RCM with a preliminary design read and the test-of-design plan.
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
      else if (i.kind === "transcript") c.transcript = parseTranscript(i.doc.text, i.file.name);
      else if (i.kind === "walkthrough" && !c.wt) c.wt = parseWalkthrough(i.doc);
      else if (EVIDENCE_KINDS.includes(i.kind)) c.early.push(i);
    }
    const early = items.filter((i) => EVIDENCE_KINDS.includes(i.kind));
    await say({
      type: "tables",
      intro: early.length ? `Thanks. I've kept ${early.length} evidence file(s) aside for step 3.` : "Thanks – here's what I found:",
      tables: [receivedTable(items)],
    }, 300);
    if (c.sop) onTitle(c.sop.docId || c.sop.name);
    if (c.sop && (c.wt || c.transcript)) return buildRcmFlow();
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
    c.rcm = buildRcm({ sop: c.sop, wt: c.wt, transcript: c.transcript });
    await say(
      {
        type: "checks",
        intro: (
          <>
            <StepBadge index={2} total={TOTAL_STEPS} label="Validate & generate RCM" />
            <div>Reading the SOP and the walkthrough, checking they agree and planning the test of design…</div>
          </>
        ),
        checks: c.rcm.procedures,
        runningLabel: "Validating the documents and building the RCM…",
        doneLabel: `RCM generated – ${c.rcm.rcmRows.length} rows, ${c.rcm.attributes.length} test-of-design attributes, ${c.rcm.gaps.length} design point(s) to test.`,
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
                Here's the RCM for <strong>{rcm.control.id}</strong> ({rcm.control.subProcess}). Preliminary view: <strong>{rcm.designConclusion}</strong>. The design is concluded in step 4 from the evidence and the walkthrough.
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
                title: "Preliminary design read of the SOP",
                note: "Each point is tested and concluded under the attribute shown.",
                columns: [
                  { key: "id", label: "Ref" },
                  { key: "attr", label: "Attr" },
                  { key: "area", label: "Area", minWidth: 170 },
                  { key: "status", label: "Assessment", type: "badge" },
                  { key: "severity", label: "Severity" },
                  { key: "observation", label: "Observation", minWidth: 380 },
                ],
                rows: rcm.design,
              },
              {
                title: "Test-of-design plan",
                columns: [
                  { key: "id", label: "Attr" },
                  { key: "label", label: "Attribute", minWidth: 150 },
                  { key: "criterion", label: "Design criterion", minWidth: 260 },
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
    const have = { rcm: !!ev.rcmExtract?.controls?.length, vcrf: ev.vcrfs.length > 0, cheque: ev.cheques.length > 0, sensitive: !!ev.sensitive?.length, access: !!ev.access?.length, calendar: !!ev.calendar?.length, changes: !!ev.changes?.length && !!ev.signoff };
    return ctx.current.rcm.evidenceRequests.map((e) => ({ ...e, status: have[e.kind] ? "Received" : "Missing" }));
  };
  const statusTable = (title) => ({
    title,
    columns: [
      { key: "id", label: "Ref" },
      { key: "code", label: "File ref" },
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
      } else if (i.kind === "rcm") {
        ev.rcmExtract = parseWalkthrough(i.doc);
      } else if (i.kind === "cheque") {
        const q = parseCheque(i.doc.text, i.file.name);
        if (!ev.cheques.some((x) => x.file === q.file)) ev.cheques.push(q);
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
    c.result.sources = c.sources;
    c.result.rcmLog = c.rcmLog;
    await say(
      {
        type: "checks",
        intro: (
          <>
            <StepBadge index={4} total={TOTAL_STEPS} label="Testing & results" />
            <div>Testing the design of each attribute against the evidence and the walkthrough, and annotating every finding…</div>
          </>
        ),
        checks: c.result.procedures,
        runningLabel: "Testing design and annotating evidence…",
        doneLabel: `Test of design complete – ${c.result.summary.deficiencies} deficient, ${c.result.summary.partial} partial, ${c.result.summary.passed} pass.`,
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
    await sayText("Ask me about any attribute or observation (for example “why is A4 deficient?”, “show the annotations for A7” or “who can run payments?”), or open the report.", 300, [
      ...(c.result.exceptions.length ? [{ id: "explain", label: "Explain the observations", icon: MessageCircleQuestion }] : []),
      { id: "report", label: "View full report", icon: FileText },
      { id: "excel", label: "Download workpaper", icon: FileSpreadsheet },
      { id: "new", label: "Start a new test", icon: RotateCcw },
    ]);
  };

  // ── Q&A ─────────────────────────────────────────────────────────────────
  const TOPICS = [
    [/cheque|gmail|sender|document check|precis|criteria|name/, "A4"],
    [/sod|segregat|f110|payment run access|run payments|conflict|maker/, "A7"],
    [/sensitive|dual|fk08|config|t055f|system/, "A6"],
    [/ipe|complete|accura|report prepar|filter/, "A8"],
    [/timing|before payment|paid|timel/, "A5"],
    [/escalat|exception handling|hold/, "A9"],
    [/retention|retain|evidence of performance|dms/, "A10"],
    [/owner|authority/, "A3"],
    [/sop|policy|approv/, "A2"],
    [/risk/, "A1"],
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
    if (/design|gap|observation|conclu/.test(l) && !/\ba(10|\d)\b/.test(l))
      return say({ type: "tables", intro: `Design conclusion: ${r.summary.designConclusion}. ${r.summary.deficiency}`, tables: [{ title: "Design observations", columns: [{ key: "id", label: "Obs" }, { key: "attrText", label: "Attr" }, { key: "title", label: "Title", minWidth: 200 }, { key: "severity", label: "Severity", type: "badge" }, { key: "recommendation", label: "Recommendation", minWidth: 360 }], rows: r.observations }] });
    if (/annotation|annotated|evidence ref/.test(l)) {
      const am = l.match(/\ba(10|\d)\b/);
      const list = am ? r.annotations.filter((a) => a.attr === `A${am[1]}`) : r.annotations;
      return say({ type: "tables", intro: `${list.length} annotation(s)${am ? ` for A${am[1]}` : ""}:`, tables: [{ title: "Annotation index", columns: [{ key: "ref", label: "Ref" }, { key: "code", label: "Evidence" }, { key: "location", label: "Location" }, { key: "highlight", label: "Highlighted", minWidth: 180 }, { key: "note", label: "Annotation", minWidth: 300 }], rows: list }] });
    }
    if (/trace|walkthrough step/.test(l)) return say({ type: "tables", tables: [{ title: "Walkthrough trace", columns: [{ key: "step", label: "Step" }, { key: "sopRef", label: "SOP ref" }, { key: "designed", label: "Designed step", minWidth: 180 }, { key: "observed", label: "Evidence observed", minWidth: 240 }, { key: "transcript", label: "Transcript" }, { key: "performed", label: "As designed?" }, { key: "note", label: "Annotation / note" }], rows: r.trace }] });
    if (/exposure|paid|payment/.test(l) && !/access/.test(l) && r.exposure.length)
      return sayText(`${r.exposure.map((x) => `Run ${x.runId} on ${x.date} (${x.by}, ${x.vendors} vendors, INR ${x.amount?.toLocaleString("en-IN")}) went out while ${x.changesBefore.map((c) => `${c.code} ${c.name}`).join(" and ")} had unreviewed bank changes.`).join(" ")} Ask AP for the payment list of these runs to confirm whether the changed vendors were paid.`);
    if (/pending|outstanding|missing|request|limitation/.test(l)) return sayText(<ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>{r.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>);
    const idm = l.match(/\ba(10|\d)\b/);
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
              – <strong style={{ color: res.status === "Pass" ? "#166534" : res.status === "Partial" ? "#9a3412" : "#991b1b" }}>{res.status}</strong> {res.tick}
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>Design criterion: {res.attr.criterion}</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{res.observation}</div>
            {res.annotations.length > 0 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Annotations: {res.annotations.map((a) => `${a.ref} (${a.code})`).join(", ")}</div>}
            {ex && <ExceptionCard ex={ex} />}
          </>
        ),
      });
    }
    if (/why|exception|fail|issue|wrong|fix|recommend|summary|result/.test(l)) {
      if (!r.exceptions.length) return sayText("No design observations – every attribute is designed appropriately.");
      return say({ type: "exceptions", content: <div>{r.exceptions.length} design observation(s):</div>, exceptions: r.exceptions });
    }
    return sayText("I can explain any attribute (A1–A10) or observation, show the annotations or the walkthrough trace, the payment exposure or the open review points, or open the report.");
  };

  // ── demo loaders ────────────────────────────────────────────────────────
  // Scripted demo: whatever the user uploads, the predefined evidence-pack files
  // are read, so the result is always the same.
  const scripted = async (names, handler) => {
    setBusy(true);
    try {
      const files = await Promise.all(names.map(demoFile));
      setBusy(false);
      await handler(files);
    } catch (e) {
      setBusy(false);
      await sayText(`I couldn't load the files: ${e.message}.`);
    }
  };
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
      userText("Explain the observations");
      return say({ type: "exceptions", content: <div>{ctx.current.result.exceptions.length} design observation(s):</div>, exceptions: ctx.current.result.exceptions });
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
        return scripted(DEMO_DOCS, ingestDocs);
      }
      if (/rcm|create|start|begin|yes/i.test(text)) return askDocs();
      return sayText("I'll start by building the RCM. Type “create RCM” or press the button above.");
    }
    if (st === "docs") {
      if (files.length) return scripted(DEMO_DOCS, ingestDocs);
      if (/continue|without|skip|proceed/i.test(text) && ctx.current.sop) return buildRcmFlow();
      return sayText("Please attach the SOP and the walkthrough with the paperclip.");
    }
    if (st === "evidence") {
      if (files.length) return scripted(DEMO_EVIDENCE, ingestEvidence);
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
