import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";

// Compact final result – the full detail (attributes, annotations, observations,
// walkthrough trace, review notes) is in the downloaded workpaper.
export default function NfsResults({ result, onDownloadExcel }) {
  const [open, setOpen] = useState(false);
  const { summary, summaryIntro, summaryPoints, meta } = result;
  const ok = summary.designEffective;

  return (
    <div>
      <div style={{ borderRadius: 10, padding: "12px 16px", background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ok ? "#166534" : "#991b1b" }}>Design conclusion: {summary.designConclusion}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{meta.reference}</span>
        </div>
        <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>
          {summary.deficiencies} of {result.results.length} attributes deficient · {summary.partial} partial · {summary.passed} pass
          {!ok && <> · {summary.severity} (proposed)</>}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Test of design · sample {meta.sample}</div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onDownloadExcel}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1e293b", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Download size={15} /> Download workpaper
        </button>
        {summaryPoints.length > 0 && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Exception Summary {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>Exception Summary</div>
          <div style={{ fontSize: 13, color: "#334155", marginBottom: 6 }}>{summaryIntro}</div>
          <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc", fontSize: 13, color: "#334155", lineHeight: 1.75 }}>
            {summaryPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
