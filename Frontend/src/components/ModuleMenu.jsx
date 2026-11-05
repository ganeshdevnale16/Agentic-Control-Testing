import { ArrowRight, Bot, Clock } from "lucide-react";

export default function ModuleMenu({ modules, onSelect }) {
  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
        fontFamily: "inherit",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 860 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Bot size={24} color="#fff" />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#000000",
              margin: "0 0 6px",
            }}
          >
            Control Testing Assistants
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Choose which assistant you'd like to open.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {modules.map((mod) => {
            const disabled = !!mod.comingSoon;
            const accent = disabled ? "#94a3b8" : mod.menu.accent || "#86BC25";
            const Card = disabled ? "div" : "button";

            return (
              <Card
                key={mod.id}
                onClick={disabled ? undefined : () => onSelect(mod)}
                style={{
                  textAlign: "left",
                  background: disabled ? "#fafbfc" : "#ffffff",
                  border: `1px solid ${disabled ? "#eef2f6" : "#e2e8f0"}`,
                  borderRadius: 16,
                  padding: 22,
                  cursor: disabled ? "default" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  opacity: disabled ? 0.7 : 1,
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (disabled) return;
                  e.currentTarget.style.borderColor = accent;
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(15, 23, 42, 0.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  if (disabled) return;
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {disabled ? (
                    <Clock size={17} color="#fff" />
                  ) : (
                    <Bot size={18} color="#fff" />
                  )}
                </div>

                <div>
                  {mod.menu.badge && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: accent,
                        background: `${accent}14`,
                        borderRadius: 99,
                        padding: "3px 9px",
                        marginBottom: 8,
                      }}
                    >
                      {mod.menu.badge}
                    </span>
                  )}
                  <h2
                    style={{
                      fontSize: 15.5,
                      fontWeight: 600,
                      color: disabled ? "#64748b" : "#000000",
                      margin: "0 0 6px",
                      lineHeight: 1.35,
                    }}
                  >
                    {mod.menu.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#94a3b8",
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {mod.menu.tagline}
                  </p>
                </div>

                {!disabled && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: accent,
                      marginTop: 4,
                    }}
                  >
                    Open assistant <ArrowRight size={13} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
