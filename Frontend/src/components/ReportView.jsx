import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, X } from "lucide-react";
import { Badge } from "./DataTablesBlock";
import { ruleText } from "../engine/testEngine";

const SEVERITY_DEFS = [
  ["High", "Setting could directly allow unauthorised access (e.g. weak length, lock-out or a disabled check). Remediate as a priority."],
  ["Medium", "Setting materially weakens authentication but other settings partly mitigate it."],
  ["Low", "Complexity or hygiene setting with limited standalone impact."],
];

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

export default function ReportView({ result, onClose, onDownloadExcel }) {
  const { meta, control, summary, results, exceptions, ca, sample, attributes, unmapped, log, screenshots } = result;
  const date = meta.testedAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const ok = summary.effective;
  const mono = (t) => <span className="rp-mono">{t}</span>;

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
    document.title = `${meta.reference} ITGC Password Configuration Test Report`;
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
            <Download size={14} /> Download Excel workpaper
          </button>
          <span style={{ flex: 1 }} />
          <button className="rp-btn" onClick={onClose} aria-label="Close report">
            <X size={14} /> Close
          </button>
        </div>

        <div className="rp">
          <div className="rp-head">
            <img src={`${import.meta.env.BASE_URL}DeloitteLogo.png`} alt="Deloitte" />
            <span>
              IT General Controls
              <br />
              Test of operating effectiveness
            </span>
          </div>
          <h1>SAP password configuration – control test report</h1>
          <div className="rp-sub">
            {meta.system} · {date}
          </div>

          <div className="rp-grid">
            {[
              ["Control", `${control.id} · ${control.name}`],
              ["System", meta.system],
              ["Report reference", meta.reference],
              ["Policy tested", meta.policyName],
              ["Evidence source", meta.sourceLabel],
              ["Extract", `${meta.fileName}${meta.sheetName ? ` › ${meta.sheetName}` : ""}`],
              ["Population", `${meta.activeRows.toLocaleString()} active of ${meta.totalRows.toLocaleString()} entries · ${meta.instances.length} instance(s)`],
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
            {summary.headline} {ok ? "Password settings on every application server are configured in line with the approved policy." : "System password settings do not fully meet the approved password policy. Weak or inconsistent settings increase the risk of unauthorised access to financially significant data (ICFR relevant)."}
            <div style={{ marginTop: 6 }}>
              <b>Deficiency assessment:</b> {summary.deficiency}
            </div>
            <div style={{ marginTop: 4 }}>
              <b>Population reliance:</b> {summary.caConclusion}
            </div>
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
              <span>Exceptions</span>
            </div>
            <div>
              <b>
                {summary.high} / {summary.medium} / {summary.low}
              </b>
              <span>High / Medium / Low</span>
            </div>
          </div>

          <h2>2. Control information</h2>
          <Table
            head={["Field", "Detail"]}
            widths={["170px"]}
            rows={[
              ["Control ID", control.id],
              ["Control", control.name],
              ["Domain", control.domain],
              ["Control objective", control.objective],
              ["Risk addressed", control.risk],
              ["Control description", control.description],
              ["Control type", `${control.type} · ${control.nature}`],
              ["Frequency", control.frequency],
              ["Control owner", control.owner],
            ]}
          />

          <h2>3. Scope and test approach</h2>
          <p>{control.approach}</p>
          <p>
            The agent read <b>{meta.policyName}</b>, identified {attributes.length} measurable requirements and mapped each to the SAP profile parameter that enforces it. Each attribute was tested on every application server instance, because SAP lets instance profiles override the default profile and users can log on through any instance.
          </p>
          <Table
            head={["#", "Policy", "Requirement", "SAP parameter", "Rule", "Severity"]}
            rows={attributes.map((a) => [a.id, a.clauseRef, a.label, mono(a.key), ruleText(a) + (a.conversion ? ` (${a.conversion})` : ""), <Badge key="s" value={a.severity} />])}
          />
          {unmapped.length > 0 && (
            <>
              <p style={{ marginTop: 10 }}>
                <b>Out of scope for this automated test.</b> The following requirements are behavioural or procedural and cannot be tested from system configuration. They should be covered by separate manual procedures:
              </p>
              <Table head={["Policy", "Requirement", "Treatment"]} rows={unmapped.map((u) => [u.ref, u.text, <Badge key="m" value="Manual test" />])} />
            </>
          )}

          <h2>4. Completeness and accuracy of the population (IPE)</h2>
          <Table head={["Ref", "Check", "Result", "Detail"]} rows={ca.map((c) => [c.id, c.check, <Badge key="r" value={c.result} />, c.detail])} />
          <p style={{ marginTop: 10 }}>
            <b>Sample tie-out.</b> {sample.length} entries were selected at random from the active population.
          </p>
          <Table
            head={["Row", "Instance", "Parameter", "Extract value", "Source value", "Result"]}
            rows={sample.map((s) => [s.n, s.host, mono(s.param), s.value, s.sourceValue, <Badge key="r" value={s.result} />])}
          />
          <p className="rp-mut">Conclusion: {summary.caConclusion}</p>

          <h2>5. Test results</h2>
          <Table
            head={["#", "Requirement", "SAP parameter", "Policy", "Actual (per instance)", "Result"]}
            rows={results.map((r) => [
              r.attr.id,
              r.attr.label,
              mono(r.attr.key),
              ruleText(r.attr),
              <b key="a">{r.actualSummary}</b>,
              <span key="r">
                <Badge value={r.status} />
                {r.exceptionId ? <div className="rp-mut">{r.exceptionId}</div> : null}
              </span>,
            ])}
          />
          <h3>Test narratives</h3>
          {results.map((r) => (
            <div key={r.attr.id} className="rp-nar">
              <div className="rp-nar-h">
                <b>
                  {r.attr.id} {r.attr.label}
                </b>
                <Badge value={r.status} />
              </div>
              <p>
                <b>Procedure.</b> {r.narrative.procedure}
              </p>
              <p>
                <b>Observation.</b> {r.narrative.observation}
              </p>
              <p className={r.status === "Pass" ? "ok" : "bad"}>
                <b>Conclusion.</b> {r.narrative.conclusion}
              </p>
              <p className="rp-mut">Evidence: {r.evidenceRef}</p>
            </div>
          ))}

          <h2>6. Exceptions and recommendations</h2>
          {exceptions.length === 0 ? (
            <p>No exceptions noted.</p>
          ) : (
            <>
              <Table
                head={["ID", "Exception", "Type", "Severity", "Affected instances", "Owner"]}
                rows={exceptions.map((e) => [e.id, e.title, e.type, <Badge key="s" value={e.severity} />, e.instances.join(", ") || "–", e.owner])}
              />
              {exceptions.map((e) => (
                <div key={e.id} className={`rp-ex sev-${e.severity.toLowerCase()}`}>
                  <div className="rp-nar-h">
                    <b>
                      {e.id} · {e.title}
                    </b>
                    <Badge value={e.severity} />
                  </div>
                  <dl>
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
                    <dt>Management response</dt>
                    <dd className="rp-blank">To be obtained from {e.owner}</dd>
                    <dt>Target date</dt>
                    <dd className="rp-blank">&nbsp;</dd>
                  </dl>
                </div>
              ))}
            </>
          )}

          <h2>7. Annotated evidence</h2>
          {results
            .filter((r) => r.evidence)
            .map((r, i) => (
              <div key={r.attr.id} className="rp-ev">
                <div className="rp-nar-h">
                  <b>
                    7.{i + 1} {r.attr.id} {r.attr.label}
                  </b>
                  <Badge value={r.status} />
                </div>
                <img src={r.evidence.url} alt={`Annotated evidence for ${r.attr.key}`} />
              </div>
            ))}

          {screenshots?.length > 0 && (
            <>
              <h2>8. Reference screenshots provided</h2>
              {screenshots.map((s, i) => (
                <div key={i} className="rp-ev">
                  <div className="rp-mut">{s.name}</div>
                  <img src={s.url} alt={s.name} />
                </div>
              ))}
            </>
          )}

          <h2>Appendix A. Severity definitions and tickmarks</h2>
          <Table head={["Rating", "Definition"]} widths={["110px"]} rows={SEVERITY_DEFS.map(([k, v]) => [<Badge key="k" value={k} />, v])} />
          <p className="rp-mut">✓ value agreed / meets policy · ✗ value does not meet policy · boxed parameter = item tested · row numbers refer to the exported extract.</p>

          <h2>Appendix B. Agent processing log</h2>
          <Table head={["Time", "Activity"]} widths={["90px"]} rows={(log || []).map((l) => [l.time.toLocaleTimeString([], { hour12: false }), <span key="t" className="rp-mono" style={{ color: l.status === "exception" ? "#991b1b" : "#334155" }}>{l.text}</span>])} />

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
            <span>{meta.reference} · demonstration environment{meta.source === "sap" ? " with simulated SAP data" : ""}</span>
            <span>Draft for management review</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
