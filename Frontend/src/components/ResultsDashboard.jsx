import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText, Image as ImageIcon } from "lucide-react";
import { Badge } from "./DataTablesBlock";
import { ruleText } from "../engine/testEngine";

const th = { padding: "9px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11.5 };
const td = { padding: "8px 12px", color: "#334155", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

function Kpi({ value, label, tone }) {
  const color = tone === "ok" ? "#166534" : tone === "bad" ? "#991b1b" : "#000000";
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", background: "#fff" }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children, note }) {
  return (
    <div style={{ margin: "18px 0 8px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#000000" }}>{children}</div>
      {note && <div style={{ fontSize: 12, color: "#64748b" }}>{note}</div>}
    </div>
  );
}

export function ExceptionCard({ ex }) {
  const rows = [
    ["Condition", ex.condition],
    ["Criteria", ex.criteria],
    ["Cause", ex.cause],
    ["Effect / risk", ex.effect],
    ["Recommendation", ex.recommendation],
  ];
  return (
    <div style={{ border: "1px solid #e2e8f0", borderLeft: `4px solid ${ex.severity === "High" ? "#dc2626" : ex.severity === "Medium" ? "#ea580c" : "#ca8a04"}`, borderRadius: 8, padding: "10px 14px", margin: "8px 0", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#000000" }}>
          {ex.id} · {ex.title}
        </span>
        <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Badge value={ex.severity} />
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 12px", fontSize: 12.5, lineHeight: 1.6 }}>
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <span style={{ color: "#64748b", fontWeight: 600 }}>{k}</span>
            <span style={{ color: "#334155" }}>{v}</span>
          </Fragment>
        ))}
        <span style={{ color: "#64748b", fontWeight: 600 }}>Owner</span>
        <span style={{ color: "#334155" }}>{ex.owner} · management response to be obtained</span>
      </div>
    </div>
  );
}

export default function ResultsDashboard({ result, onOpenReport, onDownloadExcel }) {
  const [open, setOpen] = useState({});
  const [showImg, setShowImg] = useState({});
  const { summary, results, exceptions, meta, ca } = result;
  const ok = summary.effective;

  return (
    <div>
      <p style={{ margin: "0 0 12px" }}>Control testing is complete. Here are the validated results:</p>

      <div
        style={{
          borderRadius: 10,
          padding: "12px 16px",
          background: ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ok ? "#166534" : "#991b1b" }}>Control conclusion: {summary.conclusion}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {result.control.id} · {meta.reference}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>{summary.headline}</div>
        {!ok && <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>{summary.deficiency}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <Kpi value={summary.tested} label="Attributes tested" />
        <Kpi value={summary.passed} label="Passed" tone="ok" />
        <Kpi value={summary.exceptions} label="Exceptions" tone={summary.exceptions ? "bad" : "ok"} />
        <Kpi value={meta.activeRows.toLocaleString()} label="Population tested" />
        <Kpi value={meta.instances.length} label="Instances tested" />
      </div>

      <SectionTitle note={summary.caConclusion}>Population completeness and accuracy</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ca.map((c) => (
          <span key={c.id} title={c.detail} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px", background: "#fff" }}>
            {c.check} <Badge value={c.result} />
          </span>
        ))}
      </div>

      <SectionTitle note="Click a row to read the test narrative and see the annotated evidence.">Test results by attribute</SectionTitle>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={th}></th>
              <th style={th}>#</th>
              <th style={th}>Requirement</th>
              <th style={th}>SAP parameter</th>
              <th style={th}>Policy</th>
              <th style={th}>Actual</th>
              <th style={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isOpen = !!open[i];
              return (
                <Fragment key={r.attr.id}>
                  <tr
                    onClick={() => setOpen((p) => ({ ...p, [i]: !p[i] }))}
                    style={{ cursor: "pointer", background: isOpen ? "#f8fafc" : i % 2 ? "#fafbfc" : "#fff" }}
                  >
                    <td style={{ ...td, width: 20, color: "#94a3b8" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td style={td}>{r.attr.id}</td>
                    <td style={{ ...td, minWidth: 170 }}>
                      {r.attr.label}
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Policy {r.attr.clauseRef}</div>
                    </td>
                    <td style={{ ...td, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12, color: "#86BC25" }}>{r.attr.key}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{ruleText(r.attr)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.actualSummary}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <Badge value={r.status} />
                      {r.exceptionId && <div style={{ fontSize: 11, color: "#991b1b", marginTop: 3 }}>{r.exceptionId}</div>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ ...td, background: "#f8fafc", padding: "10px 16px 14px 44px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "4px 12px", lineHeight: 1.6 }}>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Procedure</span>
                          <span>{r.narrative.procedure}</span>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Observation</span>
                          <span>{r.narrative.observation}</span>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Conclusion</span>
                          <span style={{ fontWeight: 600, color: r.status === "Pass" ? "#166534" : "#991b1b" }}>{r.narrative.conclusion}</span>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Evidence</span>
                          <span>{r.evidenceRef}</span>
                        </div>
                        {r.evidence && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowImg((p) => ({ ...p, [i]: !p[i] }));
                            }}
                            style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 10px", fontSize: 12, color: "#475569", cursor: "pointer" }}
                          >
                            <ImageIcon size={13} /> {showImg[i] ? "Hide" : "Show"} annotated evidence
                          </button>
                        )}
                        {showImg[i] && r.evidence && (
                          <img src={r.evidence.url} alt={`Annotated evidence for ${r.attr.key}`} style={{ display: "block", maxWidth: "100%", marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 8 }} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {exceptions.length > 0 && (
        <>
          <SectionTitle note="Each exception is written up as condition, criteria, cause, effect and recommendation.">
            Exceptions ({exceptions.length})
          </SectionTitle>
          {exceptions.map((ex) => (
            <ExceptionCard key={ex.id} ex={ex} />
          ))}
        </>
      )}

      {result.unmapped.length > 0 && (
        <p style={{ fontSize: 12.5, color: "#64748b", marginTop: 12 }}>
          Not covered by this automated test: policy {result.unmapped.map((u) => u.ref).join(", ")} (behavioural or procedural requirements). These need separate manual testing.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button
          onClick={onOpenReport}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#000000", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          <FileText size={14} /> View full report (PDF)
        </button>
        <button
          onClick={onDownloadExcel}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#000000", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          <Download size={14} /> Download Excel workpaper
        </button>
      </div>
    </div>
  );
}
