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
  ["High", "Allows an unauthorised bank change or payment to go undetected. Remediate immediately."],
  ["Medium", "Weakens the control materially; other steps partly mitigate it."],
  ["Low", "Documentation or hygiene point with limited standalone impact."],
];

export default function NfsReport({ result, onClose, onDownloadExcel }) {
  const { meta, control, summary, results, exceptions, rcm, sop, exposure, limitations, pending } = result;
  const date = meta.testedAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const ok = summary.effective;
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
    document.title = `${meta.reference} Vendor Bank Change Control Test Report`;
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
            <Download size={14} /> Download workpaper (Excel)
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
              Test of design and operating effectiveness
            </span>
          </div>
          <h1>Vendor bank-detail change – control test report</h1>
          <div className="rp-sub">
            {meta.company} · {date}
          </div>

          <div className="rp-grid">
            {[
              ["Control", control.id],
              ["Process", `${control.process} › ${control.subProcess}`],
              ["Report reference", meta.reference],
              ["Risk", control.riskId],
              ["SOP", `${sop.docId} v${sop.version}`],
              ["Period tested", meta.period],
              ["Control owner", control.owner],
              ["Performed by", `Agentic Controls Testing · ${meta.testedAt.toLocaleString()}`],
              ["Reviewer sign-off", "Pending"],
            ].map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                {v}
              </div>
            ))}
          </div>

          <h2>1. Executive summary</h2>
          <div className={`rp-cb ${ok ? "p" : "f"}`}>
            <b className="rp-cbh">Control conclusion: {summary.conclusion}</b>
            {summary.headline}
            <div style={{ marginTop: 6 }}>
              <b>Design:</b> {summary.designConclusion} · <b>Operating:</b> {summary.operatingConclusion}
            </div>
            {!ok && (
              <div style={{ marginTop: 4 }}>
                <b>Deficiency assessment:</b> {summary.deficiency}
              </div>
            )}
          </div>
          <div className="rp-kpis">
            <div>
              <b>{summary.tested}</b>
              <span>Attributes tested</span>
            </div>
            <div>
              <b className="ok">{summary.passed}</b>
              <span>Passed</span>
            </div>
            <div>
              <b className={summary.exceptions ? "bad" : "ok"}>{summary.exceptions}</b>
              <span>Exceptions ({summary.high} high)</span>
            </div>
            <div>
              <b className={summary.gaps ? "bad" : "ok"}>{summary.gaps}</b>
              <span>Design gaps</span>
            </div>
          </div>

          <h2>2. Control and risk</h2>
          <Table
            head={["Field", "Detail"]}
            widths={["160px"]}
            rows={[
              ["Risk", `${control.riskId} – ${control.riskDesc}`],
              ["Control description", control.description],
              ["Type / nature / frequency", `${control.type} · ${control.nature} · ${control.frequency}`],
              ["Assertion", control.assertion],
              ["SOP", `${sop.name} – approved by ${sop.approvedBy} on ${fmtDate(sop.approvalDate)}`],
            ]}
          />

          <h2>3. Risk and control matrix (generated)</h2>
          <Table
            head={["Control ID", "Activity", "Type", "Frequency", "Performed by", "SOP", "Attributes", "Sample", "Design"]}
            rows={rcm.rcmRows.map((r) => [r.controlId, r.activity, r.type, r.frequency, r.performer, r.sopRef, r.attributes, r.sample, <Badge key="d" value={r.design} />])}
          />

          <h2>4. Walkthrough and design assessment</h2>
          <h3>Walkthrough agreed to the SOP</h3>
          <Table head={["Check", "Result", "Detail"]} widths={["200px", "80px"]} rows={rcm.consistency.map((c) => [c.check, <Badge key="r" value={c.result} />, c.detail])} />
          <h3>Design assessment</h3>
          <Table head={["Ref", "Area", "Assessment", "Observation", "Recommendation"]} widths={["40px", "140px", "90px"]} rows={rcm.design.map((d) => [d.id, d.area, <Badge key="s" value={d.status === "Gap" ? d.severity : d.status} />, d.observation, d.recommendation])} />
          <p className="rp-mut">Design conclusion: {summary.designConclusion}.</p>

          <h2>5. Test results</h2>
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
              {r.details.length > 0 && <Table head={["Item", "Expected", "Found", "Result"]} rows={r.details.map((d) => [d.item, d.expected, d.actual, <Badge key="x" value={d.result} />])} />}
            </div>
          ))}

          <h2>6. Exceptions</h2>
          {exceptions.length === 0 && <p>No exceptions noted.</p>}
          {exceptions.map((e) => (
            <div key={e.id} className={`rp-ex sev-${e.severity.toLowerCase()}`}>
              <div className="rp-nar-h">
                <b>
                  {e.id} · {e.title}
                </b>
                <Badge value={e.severity} />
              </div>
              <dl>
                <dt>Type</dt>
                <dd>{e.type}</dd>
                <dt>Condition</dt>
                <dd>{e.condition}</dd>
                <dt>Criteria</dt>
                <dd>{e.criteria}</dd>
                <dt>Cause</dt>
                <dd>{e.cause}</dd>
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
              <h2>7. Payment exposure</h2>
              <Table
                head={["Run", "Date", "Executed by", "Vendors", "Amount (INR)", "Unreviewed bank changes"]}
                rows={exposure.map((r) => [r.runId, r.date, r.by, r.vendors ?? "–", r.amount?.toLocaleString("en-IN") ?? "–", r.changesBefore.map((c) => `${c.code} ${c.name}`).join(", ")])}
              />
            </>
          )}

          <h2>{exposure.length ? 8 : 7}. Limitations and outstanding requests</h2>
          <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          {pending.length > 0 && <Table head={["VCRF", "Vendor", "Changed by", "Changed on"]} rows={pending.map((p) => [p.ref, `${p.code} ${p.name}`, p.by, p.on])} />}

          <h2>Appendix A. Severity definitions</h2>
          <Table head={["Rating", "Definition"]} widths={["110px"]} rows={SEVERITY.map(([k, v]) => [<Badge key="k" value={k} />, v])} />

          <h2>Appendix B. Evidence index</h2>
          <Table head={["File", "Recognised as"]} rows={meta.files.map((f) => [f.name, f.label])} />

          <h2>Appendix C. Agent processing log</h2>
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
