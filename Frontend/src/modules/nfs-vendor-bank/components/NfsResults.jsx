import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText, TableProperties } from "lucide-react";
import { Badge } from "../../../components/DataTablesBlock";
import { ExceptionCard } from "../../../components/ResultsDashboard";
import { fmtDate } from "../engine/util";

const th = { padding: "9px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11.5 };
const td = { padding: "8px 12px", color: "#334155", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const RESULT_COLOR = { Pass: "#166534", Deficiency: "#991b1b", Partial: "#9a3412", "Not tested": "#64748b" };

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

function SimpleTable({ head, rows, minWidth = 640 }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {head.map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, k) => (
                <td key={k} style={k === 0 ? { ...td, whiteSpace: "nowrap" } : td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const { summary, results, exceptions, trace, exposure, limitations, meta, reviewNotes } = result;
  const ok = summary.designEffective;

  return (
    <div>
      <p style={{ margin: "0 0 12px" }}>
        Test of design is complete for {result.control.id} – sample {meta.sample}
        {meta.walkthroughDate ? `, walkthrough ${fmtDate(meta.walkthroughDate)}` : ""}.
      </p>

      <div style={{ borderRadius: 10, padding: "12px 16px", background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ok ? "#166534" : "#991b1b" }}>Design conclusion: {summary.designConclusion}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{meta.reference}</span>
        </div>
        <div style={{ fontSize: 12, color: "#475569", margin: "6px 0" }}>Scope: design only (one walkthrough sample). Operating effectiveness not tested.</div>
        <div style={{ fontSize: 13, color: "#334155" }}>{summary.headline}</div>
        {!ok && <div style={{ fontSize: 12.5, color: "#991b1b", marginTop: 4, fontWeight: 600 }}>{summary.deficiency}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 10 }}>
        <Kpi value={results.length} label="Attributes" />
        <Kpi value={summary.passed} label="Pass" tone="ok" />
        <Kpi value={summary.deficiencies} label="Deficiency" tone={summary.deficiencies ? "bad" : "ok"} />
        <Kpi value={summary.partial} label="Partial" tone={summary.partial ? "warn" : "ok"} />
        <Kpi value={exceptions.length} label="Observations" tone={exceptions.length ? "bad" : "ok"} />
        <Kpi value={result.annotations.length} label="Annotations" />
      </div>

      <Section note="Click a row to see the procedure, observation and the annotated evidence (A{n}-{k}) behind the result.">Test of design by attribute</Section>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={th}></th>
              <th style={th}>Attr</th>
              <th style={th}>Attribute</th>
              <th style={th}>Design criterion</th>
              <th style={th}>Annotations</th>
              <th style={th}>Result</th>
              <th style={th}>Tick</th>
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
                    <td style={{ ...td, minWidth: 150, fontWeight: 600 }}>{r.attr.label}</td>
                    <td style={{ ...td, minWidth: 240 }}>{r.attr.criterion}</td>
                    <td style={td}>{r.annotations.length || "–"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <Badge value={r.status} />
                      {r.exceptionId && <div style={{ fontSize: 11, color: "#991b1b", marginTop: 3 }}>{r.exceptionId}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700, color: RESULT_COLOR[r.status] }}>{r.tick}</td>
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
                          <span style={{ fontWeight: 600, color: RESULT_COLOR[r.status] }}>{r.narrative.conclusion}</span>
                        </div>
                        {r.annotations.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <SimpleTable
                              head={["Ref", "Evidence", "Location", "Highlighted text / cells", "Annotation"]}
                              rows={r.annotations.map((a) => [
                                <strong key="r">{a.ref}</strong>,
                                <span key="e" title={a.file}>
                                  {a.code}
                                  {a.transcript ? " (T)" : ""}
                                </span>,
                                a.location,
                                <span key="h" style={{ background: r.status === "Pass" ? "#dcfce7" : r.status === "Partial" ? "#ffedd5" : "#fee2e2", padding: "1px 4px", borderRadius: 3 }}>
                                  {a.highlight}
                                </span>,
                                a.note,
                              ])}
                            />
                          </div>
                        )}
                        {r.details?.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <SimpleTable head={["Item", "Expected", "Found", "Result"]} rows={r.details.map((d) => [d.item, d.expected, d.actual, <Badge key="b" value={d.result} />])} />
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
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>Tick marks: ✓ agreed to source · ✗ exception / design gap · ◐ partially meets criterion · T corroborated in the walkthrough {result.labels?.walkthrough || "transcript"}</div>

      {exceptions.length > 0 && (
        <>
          <Section note="Draft for management response – condition, criteria, effect and recommendation, with the annotation references.">Design observations ({exceptions.length})</Section>
          {exceptions.map((ex) => (
            <ExceptionCard key={ex.id} ex={ex} />
          ))}
        </>
      )}

      {trace.length > 0 && (
        <>
          <Section note={`Each step of the sample traced from the ${result.labels?.doc || "SOP"} to the evidence and the walkthrough ${result.labels?.walkthrough || "transcript"}.`}>Walkthrough trace – {meta.sample}</Section>
          <SimpleTable
            minWidth={820}
            head={["Step", `${result.labels?.doc || "SOP"} ref`, "Designed step", "Evidence observed", result.labels?.walkthrough === "note" ? "Walkthrough note" : "Transcript", "As designed?", "Annotation / note"]}
            rows={trace.map((t) => [t.step, t.sopRef, t.designed, t.observed, t.transcript, <Badge key="p" value={t.performed} />, t.note])}
          />
        </>
      )}

      {exposure.length > 0 && (
        <p style={{ fontSize: 12.5, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
          Payment exposure: {exposure.map((r) => `run ${r.runId} on ${r.date} (${r.vendors ?? "?"} vendors, ${r.by})`).join("; ")} ran after the sample change and before the weekly review. Ask AP for the payment list to confirm the amount paid to the new account.
        </p>
      )}

      <Section>Review notes</Section>
      <SimpleTable head={["Ref", "Raised by", "Review point", "Response", "Status"]} rows={reviewNotes.map((n) => [n.ref, n.by, n.point || "Human review and sign-off pending", n.response || "–", n.status ? <Badge key="s" value={n.status} /> : "Pending"])} />

      <Section>Scope and limitations</Section>
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
