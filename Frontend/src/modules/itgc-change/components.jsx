import { Check, Cloud, FileSpreadsheet } from "lucide-react";

const DG = "#86BC25";
const DGD = "#26890D";

export function ChoiceCards({ options, chosen, onChoose }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 10 }}>
      {options.map((o) => {
        const isChosen = chosen === o.id;
        const disabled = !!chosen;
        const Icon = o.Icon;
        return (
          <button
            key={o.id}
            disabled={disabled}
            onClick={() => onChoose(o.id)}
            style={{
              textAlign: "left",
              background: isChosen ? "#F1F8E6" : "#ffffff",
              border: `1px solid ${isChosen ? DG : "#D0D0CE"}`,
              borderRadius: 4,
              padding: "14px 16px",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled && !isChosen ? 0.45 : 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => !disabled && (e.currentTarget.style.borderColor = DG)}
            onMouseLeave={(e) => !disabled && (e.currentTarget.style.borderColor = "#D0D0CE")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 4, background: isChosen ? DG : "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isChosen ? <Check size={16} color="#000" strokeWidth={3} /> : <Icon size={16} color="#fff" />}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>{o.title}</span>
              {o.tag && !disabled && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: DGD, background: "#F1F8E6", borderRadius: 99, padding: "2px 8px" }}>{o.tag}</span>
              )}
            </span>
            {o.lines.map((l, i) => (
              <span key={i} style={{ fontSize: 12.5, color: "#53565A", lineHeight: 1.55 }}>{l}</span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

export const SOURCE_OPTIONS = [
  {
    id: "actt",
    Icon: Cloud,
    title: "Pull from ACTT",
    lines: ["I pull the E070 / STMS transport population for CIP client 500 through ACTT.", "System-generated, so IPE reliance is placed on ACTT."],
    tag: "Recommended",
  },
  {
    id: "manual",
    Icon: FileSpreadsheet,
    title: "Upload manually",
    lines: ["You upload the population file (E070 and STMS extracts) with screenshots.", "I run the full IPE validation: completeness, accuracy and screenshot checks."],
  },
];

export function KpiStrip({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`, border: "1px solid #D0D0CE", borderRadius: 4, overflow: "hidden", margin: "10px 0 14px" }}>
      {items.map((k, i) => (
        <div key={k.label} style={{ padding: "10px 14px", borderLeft: i ? "1px solid #D0D0CE" : "none", background: "#fff" }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: k.tone === "bad" ? "#DA291C" : k.tone === "ok" ? DGD : "#000", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          <div style={{ fontSize: 12, color: "#53565A" }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StatusBanner({ tone, title, children }) {
  const ok = tone === "ok";
  return (
    <div style={{ borderLeft: `4px solid ${ok ? DG : "#DA291C"}`, background: ok ? "#F1F8E6" : "#FDECEA", padding: "10px 14px", margin: "8px 0 12px" }}>
      <div style={{ fontWeight: 700, color: ok ? DGD : "#A4121D", fontSize: 14 }}>{title}</div>
      {children && <div style={{ fontSize: 13, color: "#1A1A1A", marginTop: 2 }}>{children}</div>}
    </div>
  );
}
