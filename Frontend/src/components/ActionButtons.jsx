export default function ActionButtons({ actions, disabled, onAction }) {
  if (!actions?.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.id}
            disabled={disabled}
            onClick={() => onAction(a.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: a.primary ? "#000000" : "#ffffff",
              color: a.primary ? "#ffffff" : "#475569",
              border: a.primary ? "none" : "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            {Icon && <Icon size={14} />} {a.label}
          </button>
        );
      })}
    </div>
  );
}
