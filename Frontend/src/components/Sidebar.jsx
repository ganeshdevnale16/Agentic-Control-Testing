import { ArrowLeft, MessageSquare, Plus } from "lucide-react";

export default function Sidebar({ moduleTitle, accent = "#86BC25", onBack, sessions = [], activeId, onSelect, onNew }) {
  return (
    <div style={{ width: 260, backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", borderBottom: "1px solid #e2e8f0", padding: "14px 16px", fontSize: 12.5, fontWeight: 500, color: "#64748b", cursor: "pointer", textAlign: "left" }}
        >
          <ArrowLeft size={14} /> All modules
        </button>
      )}

      {moduleTitle && (
        <div style={{ padding: "14px 16px 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#000000", lineHeight: 1.4 }}>{moduleTitle}</span>
        </div>
      )}

      <div style={{ padding: 16 }}>
        <button
          onClick={onNew}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 16px", fontSize: 13, color: "#000000", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
        >
          <Plus size={16} /> New Chat
        </button>
      </div>
      <div style={{ flex: 1, padding: "0 12px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 8px 8px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Recent</div>
        {sessions
          .slice()
          .reverse()
          .map((s) => {
            const on = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                title={s.title}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: on ? "#000000" : "#475569",
                  fontWeight: on ? 600 : 400,
                  background: on ? "#f1f5f9" : "transparent",
                  marginBottom: 2,
                  textAlign: "left",
                }}
              >
                <MessageSquare size={13} style={{ flexShrink: 0, color: "#94a3b8" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
              </button>
            );
          })}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>Powered by AI</div>
    </div>
  );
}
