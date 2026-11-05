import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText, TableProperties } from "lucide-react";
import { Badge } from "../../../components/DataTablesBlock";
import { ExceptionCard } from "../../../components/ResultsDashboard";

const th = { padding: "9px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11.5 };
const td = { padding: "8px 12px", color: "#334155", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

function Kpi({ value, label, tone }) {
  const color = tone === "ok" ? "#166534" : tone === "bad" ? "#991b1b" : tone === "warn" ? "#9a3412" : "#000000";
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", background: "#fff" }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function Section({ children, note }) {
  return (
    <div style={{ margin: "18px 0 8px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#000000" }}>{children}</div>
      {note && <div style={{ fontSize: 12, color: "#64748b" }}>{note}</div>}
    </div>
  );
}

const btn = (primary) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: primary ? "#000000" : "#fff",
  color: primary ? "#fff" : "#000000",
  border: primary ? "none" : "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
});

export default function NfsResults({ result, onOpenReport, onDownloadExcel, onDownloadRcm }) {
  const [open, setOpen] = useState({});
  const { summary, results, exceptions, rcm, exposure, limitations, meta } = result;
  const ok = summary.effective;

  return (
    <div>
      <p style={{ margin: "0 0 12px" }}>Testing is complete. Here is the result for {result.control.id}:</p>

      <div style={{ borderRadius: 10, padding: "12px 16px", background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ok ? "#166534" : "#991b1b" }}>Control conclusion: {summary.conclusion}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{meta.reference}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0" }}>
          <span style={{ fontSize: 12, color: "#475569" }}>
            Design: <Badge value={summary.designEffective ? "Effective" : "Not effective"} />
          </span>
          <span style={{ fontSize: 12, color: "#475569" }}>
            Operating: <Badge value={summary.operatingEffective ? "Effective" : "Not effective"} />
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#334155" }}>{summary.headline}</div>
        {!ok && <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>{summary.deficiency}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 10 }}>
        <Kpi value={summary.tested} label="Attributes tested" />
        <Kpi value={summary.passed} label="Passed" tone="ok" />
        <Kpi value={summary.exceptions} label={`Exceptions (${summary.high} high)`} tone={summary.exceptions ? "bad" : "ok"} />
        <Kpi value={summary.gaps} label="Design gaps" tone={summary.gaps ? "warn" : "ok"} />
        <Kpi value={summary.pending} label="Items pending evidence" tone={summary.pending ? "warn" : "ok"} />
      </div>

      <Section note="Click a row to see each item tested, and the procedure, observation and conclusion.">Results by test attribute</Section>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={th}></th>
              <th style={th}>#</th>
              <th style={th}>Attribute</th>
              <th style={th}>Control</th>
              <th style={th}>Items</th>
              <th style={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isOpen = !!open[i];
              return (
                <Fragment key={r.attr.id}>
                  <tr onClick={() => setOpen((p) => ({ ...p, [i]: !p[i] }))} style={{ cursor: "pointer", background: isOpen ? "#f8fafc" : i % 2 ? "#fafbfc" : "#fff" }}>
                    <td style={{ ...td, width: 20, color: "#94a3b8" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td style={td}>{r.attr.id}</td>
                    <td style={{ ...td, minWidth: 240 }}>{r.attr.label}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "#86BC25" }}>{r.attr.activity}</td>
                    <td style={td}>{r.details.length || "–"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <Badge value={r.status} />
                      {r.exceptionId && <div style={{ fontSize: 11, color: "#991b1b", marginTop: 3 }}>{r.exceptionId}</div>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ ...td, background: "#f8fafc", padding: "10px 16px 14px 44px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "4px 12px", lineHeight: 1.6 }}>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Procedure</span>
                          <span>{r.narrative.procedure}</span>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Observation</span>
                          <span>{r.narrative.observation}</span>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Conclusion</span>
                          <span style={{ fontWeight: 600, color: r.status === "Pass" ? "#166534" : r.status === "Exception" ? "#991b1b" : "#9a3412" }}>{r.narrative.conclusion}</span>
                        </div>
                        {r.details.length > 0 && (
                          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8, marginTop: 10, background: "#fff" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th style={th}>Item</th>
                                  <th style={th}>Expected</th>
                                  <th style={th}>Found</th>
                                  <th style={th}>Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.details.map((d, k) => (
                                  <tr key={k}>
                                    <td style={{ ...td, minWidth: 160 }}>{d.item}</td>
                                    <td style={{ ...td, minWidth: 160 }}>{d.expected}</td>
                                    <td style={{ ...td, minWidth: 220 }}>{d.actual}</td>
                                    <td style={td}>
                                      <Badge value={d.result} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
          <Section note="Each exception is written up as condition, criteria, cause, effect and recommendation.">Exceptions ({exceptions.length})</Section>
          {exceptions.map((ex) => (
            <ExceptionCard key={ex.id} ex={ex} />
          ))}
        </>
      )}

      {rcm.gaps.length > 0 && (
        <>
          <Section note="From the SOP and walkthrough – these need fixing even where the attribute passed.">Design gaps ({rcm.gaps.length})</Section>
          <div style={{ display: "grid", gap: 6 }}>
            {rcm.gaps.map((g) => (
              <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", background: "#fff" }}>
                <Badge value={g.severity} />
                <div>
                  <strong>
                    {g.id} {g.area}.
                  </strong>{" "}
                  {g.recommendation}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {exposure.length > 0 && (
        <p style={{ fontSize: 12.5, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
          Payment exposure: {exposure.map((r) => `run ${r.runId} on ${r.date} (${r.vendors ?? "?"} vendors) by ${r.by}`).join("; ")} ran while bank-detail changes were still unreviewed. Ask AP for the payment list of these runs to confirm whether the changed vendors were paid.
        </p>
      )}

      <Section>Limitations and outstanding requests</Section>
      <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc", fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
        {limitations.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button onClick={onOpenReport} style={btn(true)}>
          <FileText size={14} /> View full report (PDF)
        </button>
        <button onClick={onDownloadExcel} style={btn(false)}>
          <Download size={14} /> Download workpaper (Excel)
        </button>
        <button onClick={onDownloadRcm} style={btn(false)}>
          <TableProperties size={14} /> Download RCM
        </button>
      </div>
    </div>
  );
}
