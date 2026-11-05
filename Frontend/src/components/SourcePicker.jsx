import { Check, Database, FileSpreadsheet } from "lucide-react";

const OPTIONS = [
  {
    id: "sap",
    Icon: Database,
    title: "Connect to SAP",
    lines: ["I log on with a read-only account and pull table PAHI myself.", "Full C&A: record count, instance coverage and sample re-read from the system."],
    tag: "Recommended",
  },
  {
    id: "manual",
    Icon: FileSpreadsheet,
    title: "Upload an extract",
    lines: ["You upload a PAHI / RSPFPAR export (Excel or CSV) from SE16.", "Add the record count shown on screen and screenshots for C&A."],
  },
];

export default function SourcePicker({ chosen, system, onChoose }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 10 }}>
      {OPTIONS.map((o) => {
        const isChosen = chosen === o.id;
        const disabled = !!chosen;
        return (
          <button
            key={o.id}
            disabled={disabled}
            onClick={() => onChoose(o.id)}
            style={{
              textAlign: "left",
              background: isChosen ? "#F1F8E6" : "#ffffff",
              border: `1px solid ${isChosen ? "#86BC25" : "#e2e8f0"}`,
              borderRadius: 12,
              padding: "14px 16px",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled && !isChosen ? 0.5 : 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontFamily: "inherit",
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.borderColor = "#86BC25";
            }}
            onMouseLeave={(e) => {
              if (!disabled) e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: isChosen ? "#86BC25" : "#000000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isChosen ? <Check size={16} color="#fff" strokeWidth={3} /> : <o.Icon size={16} color="#fff" />}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#000000" }}>{o.title}</span>
              {o.tag && !disabled && (
                <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: "#86BC25", background: "#F1F8E6", borderRadius: 99, padding: "2px 8px" }}>{o.tag}</span>
              )}
            </span>
            {o.id === "sap" && system && <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{system}</span>}
            {o.lines.map((l, i) => (
              <span key={i} style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
                {l}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}
