import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, MessageCircleQuestion, RotateCcw, SkipForward, Upload } from "lucide-react";
import MessageList from "./components/MessageList";
import InputArea from "./components/InputArea";
import ReportView from "./components/ReportView";
import StepBadge from "./components/StepBadge";
import { TOTAL_STEPS } from "./modules/itgc-password/config.jsx";
import { DEMO_POLICY, DEMO_POLICY_NAME } from "./modules/itgc-password/data/control";
import { OPS, formatValue } from "./modules/itgc-password/data/sapParameters";
import { parsePolicy } from "./engine/policyParser";
import { buildPolicyProcedures, runControlTest, ruleText } from "./engine/testEngine";
import { SAP_SYSTEM, generatePahiExtract, screenRecordCount } from "./engine/sapConnector";
import { isExtractFile, isImageFile, isPolicyFile, readExtract, readPolicyText } from "./engine/fileReaders";
import { annotateEvidence } from "./engine/evidenceAnnotator";
// ExcelJS / SheetJS writers are loaded on first download to keep the initial bundle small
const downloadWorkpaper = async (result) => (await import("./utils/exportExcel")).downloadWorkpaper(result);
const downloadSampleExtract = async (rows) => (await import("./utils/exportExcel")).downloadSampleExtract(rows);

const FILE_GROUP_THRESHOLD = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

const PLACEHOLDERS = {
  policy: "Attach the policy document, or paste the policy text…",
  reading: "Reading the policy…",
  source: "Choose where I should get the evidence from…",
  "manual-file": "Attach the extract (Excel or CSV)…",
  "manual-count": "Type the record count shown in SAP, e.g. 1930",
  running: "Testing in progress…",
  done: "Ask about a parameter or exception, e.g. “why did A1 fail?”",
};

function readDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Could not read the image"));
    r.readAsDataURL(file);
  });
}

export default function Chatbot({ config, onTitle, onNewChat }) {
  const idRef = useRef(2);
  const nid = () => idRef.current++;
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      role: "assistant",
      type: "welcome",
      actions: [
        { id: "upload-policy", label: "Upload policy document", primary: true, icon: Upload },
        { id: "demo-policy", label: "Use demo policy", icon: FileText },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [stage, setStageState] = useState("policy");
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const stageRef = useRef("policy");
  const ctx = useRef({ screenshots: [], policyLog: [] });
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
  const sayText = (content, delay) => say({ type: "jsx", content }, delay);
  const update = (id, patch) => setMessages((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const userText = (content) => setMessages((p) => [...p, { id: nid(), role: "user", type: "text", content }]);

  // ── Step 1: policy ──────────────────────────────────────────────────────
  const handlePolicy = async (text, name) => {
    if (stageRef.current !== "policy") return;
    const parsed = parsePolicy(text);
    if (!parsed.attributes.length) {
      await sayText(
        <>
          I read <strong>{name}</strong> but couldn't find a requirement with a measurable threshold (for example “at least 10 characters” or “locked after 5 failed attempts”). Please check it's the password policy, or upload another version.
        </>
      );
      return;
    }
    setStage("reading");
    setBusy(true);
    onTitle(name);
    const procs = buildPolicyProcedures(parsed, name);
    Object.assign(ctx.current, { parsed, policyName: name, policyProcedures: procs });
    await say(
      {
        type: "checks",
        checks: procs,
        runningLabel: "Reading the policy and deriving the test attributes…",
        doneLabel: `Policy read – ${parsed.attributes.length} test attributes defined.`,
        onComplete: afterPolicy,
      },
      350
    );
  };

  const afterPolicy = useCallback(async (log) => {
    const { parsed, policyName } = ctx.current;
    ctx.current.policyLog = log;
    setBusy(false);
    const tables = [
      {
        title: "Test attributes",
        note: "Each measurable requirement mapped to the SAP profile parameter that enforces it.",
        columns: [
          { key: "id", label: "#" },
          { key: "ref", label: "Policy" },
          { key: "label", label: "Requirement", minWidth: 200 },
          { key: "key", label: "SAP parameter", mono: true },
          { key: "rule", label: "Rule" },
          { key: "severity", label: "Severity", type: "badge" },
        ],
        rows: parsed.attributes.map((a) => ({ id: a.id, ref: a.clauseRef, label: a.label + (a.conversion ? ` (${a.conversion})` : ""), key: a.key, rule: ruleText(a), severity: a.severity })),
      },
    ];
    if (parsed.unmapped.length)
      tables.push({
        title: "Not testable from system configuration",
        note: "Behavioural or procedural requirements – flagged in the report for separate manual testing.",
        columns: [
          { key: "ref", label: "Policy" },
          { key: "text", label: "Requirement", minWidth: 380 },
          { key: "t", label: "Treatment", type: "badge" },
        ],
        rows: parsed.unmapped.map((u) => ({ ref: u.ref, text: u.text, t: "Manual test" })),
      });
    await say({ type: "tables", intro: <>I've read <strong>{policyName}</strong> and identified <strong>{parsed.attributes.length} test attributes</strong> to validate against the system:</>, tables }, 300);
    await sleep(350);
    ctx.current.sourceMsgId = await say({
      type: "source",
      system: `${SAP_SYSTEM.sid} · client ${SAP_SYSTEM.client} · ${SAP_SYSTEM.description}`,
      content: (
        <>
          <StepBadge index={2} total={TOTAL_STEPS} label="Evidence source" />
          <div>Where should I get the evidence from?</div>
        </>
      ),
    });
    setStage("source");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: source ──────────────────────────────────────────────────────
  const chooseSource = async (src) => {
    if (stageRef.current !== "source") return;
    update(ctx.current.sourceMsgId, { chosen: src });
    ctx.current.source = src;
    if (src === "sap") {
      userText(`Connect to SAP ${SAP_SYSTEM.sid} · client ${SAP_SYSTEM.client}`);
      const rows = generatePahiExtract();
      const extract = { rows, fileName: `SAP_${SAP_SYSTEM.table}_${SAP_SYSTEM.sid}_${today()}.xlsx`, sheetName: SAP_SYSTEM.table, hasState: true };
      await startRun(extract, screenRecordCount(rows));
    } else {
      userText("I'll upload an extract");
      setStage("manual-file");
      await say({
        type: "jsx",
        content: (
          <>
            <StepBadge index={3} total={TOTAL_STEPS} label="Upload extract" />
            <div>
              Please upload the profile parameter extract (Excel or CSV). An SE16 export of table <strong>PAHI</strong> works as-is – I look for the parameter name, value, status
              (PARSTATE) and host columns, and only test current values. You can attach SAP screenshots as well; I'll include them as reference evidence.
            </div>
          </>
        ),
        actions: [{ id: "template", label: "Download sample extract", icon: Download }],
      });
    }
  };

  const loadExtract = async (file) => {
    let extract;
    try {
      extract = await readExtract(file);
    } catch (e) {
      await sayText(`I couldn't read ${file.name}: ${e.message}`);
      return;
    }
    if (!extract.rows.length) {
      await sayText(`${file.name} has no rows I can use. Make sure the first sheet has a parameter and a value column.`);
      return;
    }
    ctx.current.extract = extract;
    const active = extract.rows.filter((r) => r.active).length;
    const hosts = [...new Set(extract.rows.map((r) => r.host))];
    setStage("manual-count");
    await say({
      type: "jsx",
      content: (
        <>
          <div>
            Loaded <strong>{file.name}</strong> – {extract.rows.length.toLocaleString()} rows, {active.toLocaleString()} current values across {hosts.length} instance(s).
          </div>
          <div style={{ marginTop: 8 }}>
            To confirm the extract is complete, what record count did SAP show for the same selection (SE16 → <em>Number of entries</em>)? Type the number, or skip and I'll note the limitation in the report.
          </div>
        </>
      ),
      actions: [{ id: "skip-count", label: "Skip – no screen count", icon: SkipForward }],
    });
  };

  // ── Step 3: agent testing ───────────────────────────────────────────────
  const startRun = async (extract, screenCount) => {
    setStage("running");
    setBusy(true);
    const c = ctx.current;
    const result = runControlTest({
      attributes: c.parsed.attributes,
      unmapped: c.parsed.unmapped,
      policyName: c.policyName,
      source: c.source,
      extract,
      screenCount,
      screenshots: c.screenshots,
    });
    result.__rows = extract.rows;
    result.policyProcedures = c.policyProcedures;
    result.policyLog = c.policyLog;
    c.result = result;
    await say(
      {
        type: "checks",
        intro: (
          <>
            <StepBadge index={3} total={TOTAL_STEPS} label="Agent testing" />
            <div>
              {c.source === "sap"
                ? `Connecting to SAP ${SAP_SYSTEM.sid} now. I'll collect the evidence myself – nothing more is needed from you.`
                : "Thanks – testing the extract now."}
            </div>
          </>
        ),
        checks: result.procedures,
        runningLabel: "Running control tests and validating evidence…",
        doneLabel: `Control testing complete – ${result.summary.exceptions} exception(s) noted.`,
        onComplete: finish,
      },
      400
    );
  };

  const finish = useCallback(async (log) => {
    const result = ctx.current.result;
    result.log = log;
    result.results.forEach((r) => {
      try {
        r.evidence = annotateEvidence(r, result);
      } catch (e) {
        console.error(`Evidence annotation failed for ${r.attr.key}`, e);
        r.evidence = null;
      }
    });
    setBusy(false);
    setFinalResult(result);
    setStage("done");
    await say({ type: "results", header: <StepBadge index={4} total={TOTAL_STEPS} label="Results & report" />, result }, 500);
    await sleep(300);
    await say({
      type: "jsx",
      content: "Ask me about any parameter or exception (for example “why did A1 fail?” or “show evidence for history”), or open the report.",
      actions: [
        ...(result.exceptions.length ? [{ id: "explain", label: "Explain the exceptions", icon: MessageCircleQuestion }] : []),
        { id: "report", label: "View full report", icon: FileText },
        { id: "excel", label: "Download Excel", icon: FileSpreadsheet },
        { id: "new", label: "Start a new test", icon: RotateCcw },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Q&A after the test ──────────────────────────────────────────────────
  const findResult = (l) => {
    const { results } = ctx.current.result;
    const id = l.match(/\ba(\d{1,2})\b/);
    if (id) return results.find((r) => r.attr.id.toLowerCase() === `a${id[1]}`);
    return (
      results.find((r) => l.includes(r.attr.key.toLowerCase())) ||
      results.find((r) => r.attr.label.toLowerCase().split(" ").filter((w) => w.length > 4).some((w) => l.includes(w)))
    );
  };

  const qa = async (text) => {
    const l = text.toLowerCase();
    const result = ctx.current.result;
    if (/report|pdf|print/.test(l)) {
      setReportOpen(true);
      return sayText("Opening the full report – use Print / Save as PDF to download it.", 250);
    }
    if (/excel|workpaper|download/.test(l)) {
      await downloadWorkpaper(result);
      return sayText("Downloading the Excel workpaper (summary, testing, exceptions, C&A, evidence, audit trail and population).", 250);
    }
    if (/new test|start over|restart|new chat/.test(l)) return onNewChat();
    if (/c&a|complete|population|ipe|accura/.test(l)) {
      return say({
        type: "tables",
        intro: result.summary.caConclusion,
        tables: [
          {
            title: "Completeness and accuracy",
            columns: [
              { key: "id", label: "Ref" },
              { key: "check", label: "Check", minWidth: 220 },
              { key: "result", label: "Result", type: "badge" },
              { key: "detail", label: "Detail", minWidth: 320 },
            ],
            rows: result.ca,
          },
        ],
      });
    }
    const r = findResult(l);
    const wantsWhy = /why|exception|fail|issue|gap|wrong|fix|recommend/.test(l);
    if (r && wantsWhy && r.exceptionId) {
      const ex = result.exceptions.find((e) => e.id === r.exceptionId);
      return say({ type: "exceptions", content: <div>{r.narrative.observation}</div>, exceptions: [ex] });
    }
    if (r) {
      return say({
        type: r.evidence ? "evidence" : "jsx",
        url: r.evidence?.url,
        alt: `Annotated evidence for ${r.attr.key}`,
        content: (
          <>
            <div>
              <strong>
                {r.attr.id} {r.attr.label}
              </strong>{" "}
              ({r.attr.key}) – policy {OPS[r.attr.op]} {formatValue(r.attr.value, r.attr.unit)}, actual {r.actualSummary}: <strong style={{ color: r.status === "Pass" ? "#166534" : "#991b1b" }}>{r.status}</strong>
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{r.narrative.observation}</div>
          </>
        ),
      });
    }
    if (wantsWhy || /summary|result/.test(l)) {
      if (!result.exceptions.length) return sayText("Every attribute complied with the policy on every instance – no exceptions.");
      return say({ type: "exceptions", content: <div>{result.exceptions.length} exception(s) noted:</div>, exceptions: result.exceptions });
    }
    return sayText("I can explain any exception, show the evidence for a parameter (e.g. “A3” or “password history”), show the C&A checks, or open the report.");
  };

  // ── Actions from buttons ────────────────────────────────────────────────
  const onAction = async (msgId, action) => {
    if (action === "upload-policy") return fileInputRef.current?.click();
    if (action === "template") return downloadSampleExtract(generatePahiExtract());
    if (action === "report") return setReportOpen(true);
    if (action === "excel") return downloadWorkpaper(ctx.current.result);
    if (action === "new") return onNewChat();
    if (action === "demo-policy") {
      if (stageRef.current !== "policy") return;
      update(msgId, { used: true });
      userText("Use the demo policy");
      return handlePolicy(DEMO_POLICY, DEMO_POLICY_NAME);
    }
    if (action.startsWith("source:")) return chooseSource(action.split(":")[1]);
    if (action === "skip-count") {
      if (stageRef.current !== "manual-count") return;
      update(msgId, { used: true });
      userText("Skip – no screen count");
      return startRun(ctx.current.extract, null);
    }
    if (action === "explain") {
      userText("Explain the exceptions");
      return say({ type: "exceptions", content: <div>{ctx.current.result.exceptions.length} exception(s) noted:</div>, exceptions: ctx.current.result.exceptions });
    }
  };

  // ── Send ────────────────────────────────────────────────────────────────
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

    const userMsgs =
      files.length > FILE_GROUP_THRESHOLD
        ? [{ id: nid(), role: "user", type: "fileGroup", content: { count: files.length, names: files.map((f) => f.name) } }]
        : files.map((f) => ({ id: nid(), role: "user", type: "file", content: f.name }));
    if (text && !(stageRef.current === "policy" && text.length > 120)) userMsgs.push({ id: nid(), role: "user", type: "text", content: text });
    else if (text) userMsgs.push({ id: nid(), role: "user", type: "text", content: `${text.slice(0, 120)}… (policy text pasted)` });
    setMessages((p) => [...p, ...userMsgs]);

    // Screenshots are accepted at any step as reference evidence
    const images = files.filter(isImageFile);
    for (const img of images) ctx.current.screenshots.push({ name: img.name, url: await readDataUrl(img) });
    if (images.length) await sayText(`${images.length} screenshot(s) received – I'll attach them to the report as reference evidence.`, 250);
    const docs = files.filter((f) => !isImageFile(f));
    const st = stageRef.current;

    if (st === "policy") {
      const policyFile = docs.find((f) => isPolicyFile(f.name));
      if (policyFile) {
        try {
          const t = await readPolicyText(policyFile);
          return handlePolicy(t, policyFile.name);
        } catch (e) {
          return sayText(`I couldn't read ${policyFile.name}: ${e.message}. Try saving it as .docx or .txt.`);
        }
      }
      if (docs.some((f) => isExtractFile(f.name))) return sayText("That looks like a data extract. I need the policy document first (.docx, .pdf or .txt) so I know what to test.");
      if (docs.length) return sayText("I can read policy documents in .docx, .pdf, .txt or .md format.");
      if (/^demo|demo policy/i.test(text)) return handlePolicy(DEMO_POLICY, DEMO_POLICY_NAME);
      if (text.length > 80) return handlePolicy(text, "Pasted policy text");
      if (text) return sayText("I need the policy document first. Attach it with the paperclip, paste the policy text, or use the demo policy above.");
      return;
    }

    if (st === "source") {
      const ext = docs.find((f) => isExtractFile(f.name));
      if (ext) {
        await chooseSource("manual");
        return loadExtract(ext);
      }
      if (/\bsap\b|connect|system/i.test(text)) return chooseSource("sap");
      if (/manual|upload|extract|excel|file/i.test(text)) return chooseSource("manual");
      if (text || docs.length) return sayText("Please choose an evidence source above – connect to SAP, or upload an extract.");
      return;
    }

    if (st === "manual-file") {
      const ext = docs.find((f) => isExtractFile(f.name));
      if (ext) return loadExtract(ext);
      if (text || docs.length) return sayText("I need the extract as an Excel (.xlsx / .xls) or CSV file for this step.");
      return;
    }

    if (st === "manual-count") {
      const n = text.replace(/[,\s]/g, "").match(/^\d+$/);
      if (n) return startRun(ctx.current.extract, Number(n[0]));
      if (/skip|no|don'?t|none/i.test(text)) return startRun(ctx.current.extract, null);
      if (text) return sayText("Please type the record count as a number (e.g. 1930), or press Skip.");
      return;
    }

    if (st === "done") {
      if (text) return qa(text);
      return;
    }
    if (text) return sayText("I'm working on it – one moment.", 200);
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
        accept=".docx,.pdf,.txt,.md,.xlsx,.xls,.csv,image/*"
        footnote="Demo with simulated SAP data · AI-assisted results should be reviewed by a qualified tester"
      />
      {reportOpen && finalResult && (
        <ReportView result={finalResult} onClose={() => setReportOpen(false)} onDownloadExcel={() => downloadWorkpaper(finalResult)} />
      )}
    </div>
  );
}
