import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, X } from "lucide-react";
import { Badge } from "../../../components/DataTablesBlock";
import { fmtDate } from "../engine/util";

function Table({ head, rows, widths }) {
  return (
    <div className="rp-tb">
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={widths?.[i] ? { width: widths[i] } : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, k) => (
                <td key={k}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SEVERITY = [
  ["Pass", "Attribute designed appropriately – agreed to source without exception (✓)."],
  ["Deficiency", "Design gap – the attribute does not meet the design criterion (✗)."],
  ["Partial", "Partially meets the criterion (◐)."],
  ["High", "Allows an unauthorised bank change or payment to go undetected. Remediate immediately."],
  ["Medium", "Weakens the control materially; other steps partly mitigate it."],
  ["Low", "Documentation or hygiene point with limited standalone impact."],
];

export default function NfsReport({ result, onClose, onDownloadExcel }) {
  const { meta, control, summary, results, exceptions, rcm, sop, exposure, limitations, trace, reviewNotes, annotations, exceptionSummary } = result;
  const date = meta.testedAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const ok = summary.designEffective;
  const L = result.labels || {};
  const DOC = L.doc || "SOP";
  const logo = `${import.meta.env.BASE_URL}DeloitteLogo.png`;

  useEffect(() => {
    const prev = document.title;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.title = prev;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const print = () => {
    document.title = `${meta.reference} ${L.reportTitle || "Vendor bank-detail change"} design test report`;
    window.print();
  };

  return createPortal(
    <div className="report-overlay" role="dialog" aria-label="Control test report">
      <div className="rp-sheet">
        <div className="rp-bar">
          <button className="rp-btn rp-pri" onClick={print}>
            <Printer size={14} /> Print / Save as PDF
          </button>
          <button className="rp-btn" onClick={onDownloadExcel}>
            <Download size={14} /> Download workpaper
          </button>
          <span style={{ flex: 1 }} />
          <button className="rp-btn" onClick={onClose} aria-label="Close report">
            <X size={14} /> Close
          </button>
        </div>

        <div className="rp">
          <div className="rp-head">
            <img src={logo} alt="Deloitte" />
            <span>
              Non-FS controls testing
              <br />
              Test of design (walkthrough sample)
            </span>
          </div>
          <h1>{L.reportTitle || "Vendor bank-detail change"} – design testing report</h1>
          <div className="rp-sub">
            {meta.company} · {date}
          </div>

          <div className="rp-grid">
            {[
              ["Workpaper ref", meta.reference],
              ["Control", L.controlName || `${control.id} – Vendor bank-detail change control`],
              ["Process", `${control.process} › ${control.subProcess}`],
              ["Risk", control.riskId],
              [DOC, `${sop.docId} v${sop.version}`],
              ["Sample", meta.sample],
              ["Walkthrough date", fmtDate(meta.walkthroughDate)],
              ["Control owner", control.owner],
              ["Human review", "Pending"],
            ].map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                {v}
              </div>
            ))}
          </div>

          <h2>1. Executive summary</h2>
          <div className={`rp-cb ${ok ? "p" : "f"}`}>
            <b className="rp-cbh">Design conclusion: {summary.designConclusion}</b>
            {summary.headline}
            <div style={{ marginTop: 6 }}>
              <b>Scope:</b> design only, test of one walkthrough sample. Operating effectiveness not tested.
            </div>
            {!ok && (
              <div style={{ marginTop: 4 }}>
                <b>{summary.deficiency}</b>
              </div>
            )}
          </div>
          <div className="rp-kpis">
            <div>
              <b className="ok">{summary.passed}</b>
              <span>Pass</span>
            </div>
            <div>
              <b className={summary.deficiencies ? "bad" : "ok"}>{summary.deficiencies}</b>
              <span>Deficiency</span>
            </div>
            <div>
              <b className={summary.partial ? "bad" : "ok"}>{summary.partial}</b>
              <span>Partial</span>
            </div>
            <div>
              <b className={summary.exceptions ? "bad" : "ok"}>{summary.exceptions}</b>
              <span>Observations</span>
            </div>
          </div>

          <h3>Exception summary</h3>
          <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
            {exceptionSummary.map((b) => (
              <li key={b.id}>
                <b>{b.head}:</b> {b.text}
              </li>
            ))}
          </ul>

          <h2>2. Control and risk</h2>
          <Table
            head={["Field", "Detail"]}
            widths={["160px"]}
            rows={[
              ["Risk", `${control.riskId} – ${control.riskDesc}`],
              ["Control description", control.description],
              ["Type / nature / frequency", `${control.type} · ${control.nature} · ${control.frequency}`],
              ["Assertion", control.assertion],
              [DOC, `${sop.name} – approved by ${sop.approvedBy} on ${fmtDate(sop.approvalDate)}`],
            ]}
          />

          <h2>3. Risk and control matrix (generated)</h2>
          <Table
            head={["Control ID", "Activity", "Type", "Frequency", "Performed by", DOC, "Attributes", "Sample", "Design"]}
            rows={rcm.rcmRows.map((r) => [r.controlId, r.activity, r.type, r.frequency, r.performer, r.sopRef, r.attributes, r.sample, <Badge key="d" value={r.design} />])}
          />

          <h2>4. Walkthrough and preliminary design read</h2>
          <h3>Walkthrough agreed to the {DOC}</h3>
          <Table head={["Check", "Result", "Detail"]} widths={["200px", "80px"]} rows={rcm.consistency.map((c) => [c.check, <Badge key="r" value={c.result} />, c.detail])} />
          <h3>Preliminary design read of the {DOC}</h3>
          <Table head={["Ref", "Attr", "Area", "Assessment", "Observation"]} widths={["40px", "40px", "140px", "90px"]} rows={rcm.design.map((d) => [d.id, d.attr, d.area, <Badge key="s" value={d.status === "Not effective" ? `${d.status} (${d.severity})` : d.status} />, d.observation])} />
          <p className="rp-mut">Concluded by the test of design in section 5.</p>

          <h2>5. Test of design by attribute</h2>
          <Table
            head={["Attr", "Attribute", "Design criterion", "Result", "Tick"]}
            widths={["40px", "130px"]}
            rows={results.map((r) => [r.attr.id, r.attr.label, r.attr.criterion, <Badge key="b" value={r.status} />, r.tick])}
          />
          {results.map((r) => (
            <div key={r.attr.id} className="rp-nar">
              <div className="rp-nar-h">
                <b>
                  {r.attr.id} · {r.attr.label}
                </b>
                <Badge value={r.status} />
              </div>
              <p>
                <b>Procedure.</b> {r.narrative.procedure}
              </p>
              <p>
                <b>Observation.</b> {r.narrative.observation}
              </p>
              <p>
                <b>Conclusion.</b> {r.narrative.conclusion}
              </p>
              {r.annotations.length > 0 && (
                <Table head={["Ref", "Evidence", "Location", "Highlighted", "Annotation"]} widths={["50px", "60px", "120px", "150px"]} rows={r.annotations.map((a) => [a.ref, `${a.code}${a.transcript ? " (T)" : ""}`, a.location, a.highlight, a.note])} />
              )}
            </div>
          ))}

          <h2>6. Walkthrough trace – {meta.sample}</h2>
          <Table head={["Step", `${DOC} ref`, "Designed step", "Evidence observed", L.walkthrough === "note" ? "Walkthrough note" : "Transcript", "As designed?", "Note"]} rows={trace.map((t) => [t.step, t.sopRef, t.designed, t.observed, t.transcript, t.performed, t.note])} />

          <h2>7. Design observations (draft for management response)</h2>
          {exceptions.length === 0 && <p>No design observations.</p>}
          {exceptions.map((e) => (
            <div key={e.id} className={`rp-ex sev-${e.severity.toLowerCase()}`}>
              <div className="rp-nar-h">
                <b>
                  {e.id} · {e.title}
                </b>
                <Badge value={e.severity} />
              </div>
              <dl>
                <dt>Attributes</dt>
                <dd>{e.attrIds.join(", ")}</dd>
                <dt>Condition</dt>
                <dd>{e.condition}</dd>
                <dt>Criteria</dt>
                <dd>{e.criteria}</dd>
                <dt>Annotation refs</dt>
                <dd>{e.cause.replace(/^Annotation refs:\s*/, "")}</dd>
                <dt>Effect / risk</dt>
                <dd>{e.effect}</dd>
                <dt>Recommendation</dt>
                <dd>{e.recommendation}</dd>
                <dt>Owner</dt>
                <dd>{e.owner}</dd>
                <dt>Management response</dt>
                <dd className="rp-blank">To be obtained</dd>
              </dl>
            </div>
          ))}

          {exposure.length > 0 && (
            <>
              <h2>8. Payment exposure</h2>
              <Table
                head={["Run", "Date", "Executed by", "Vendors", "Amount (INR)", "Unreviewed bank changes"]}
                rows={exposure.map((r) => [r.runId, r.date, r.by, r.vendors ?? "–", r.amount?.toLocaleString("en-IN") ?? "–", r.changesBefore.map((c) => `${c.code} ${c.name}`).join(", ")])}
              />
            </>
          )}

          <h2>{exposure.length ? 9 : 8}. Review notes and sign-off</h2>
          <Table head={["Ref", "Raised by", "Review point", "Response", "Status"]} rows={reviewNotes.map((n) => [n.ref, n.by, n.point || "Human reviewer conclusion, severity and sign-off", n.response || "–", n.status || "Pending"])} />

          <h2>{exposure.length ? 10 : 9}. Scope and limitations</h2>
          <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>


          <h2>Appendix A. Result and severity definitions</h2>
          <Table head={["Rating", "Definition"]} widths={["110px"]} rows={SEVERITY.map(([k, v]) => [<Badge key="k" value={k} />, v])} />

          <h2>Appendix B. Evidence inputs</h2>
          <Table head={["Ref", "File"]} widths={["70px"]} rows={meta.inputs.map((f) => [f.code, f.name])} />

          <h2>Appendix C. Annotation index</h2>
          <Table head={["Ref", "Result", "Evidence", "Location", "Highlighted", "Annotation"]} widths={["50px", "70px", "60px", "110px", "150px"]} rows={annotations.map((a) => [a.ref, a.result, a.code, a.location, a.highlight, a.note])} />

          <h2>Appendix D. Agent processing log</h2>
          <Table
            head={["Time", "Activity"]}
            widths={["90px"]}
            rows={[...(result.rcmLog || []), ...(result.log || [])].map((l) => [l.time.toLocaleTimeString([], { hour12: false }), <span key="t" className="rp-mono" style={{ color: l.status === "exception" ? "#991b1b" : "#334155" }}>{l.text}</span>])}
          />

          <div className="rp-sign">
            <div>
              Prepared by: Agentic Controls Testing
              <br />
              {date}
            </div>
            <div>
              Reviewed by: ______________________
              <br />
              Date: ______________
            </div>
          </div>
          <div className="rp-foot">
            <span>{meta.reference} · demonstration environment</span>
            <span>Draft for management review</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
