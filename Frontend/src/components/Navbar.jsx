export default function Navbar({ activeModule, onHome }) {
  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "#ffffff",
        borderBottom: "3px solid #86BC25",
        fontFamily: "inherit",
      }}
    >
      <button
        onClick={onHome}
        style={{
          display: "flex",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
              <img
                src={`${import.meta.env.BASE_URL}DeloitteLogo.png`}
                alt="Deloitte"
                style={{
                  width: 160,
                  height: 60,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <div className="h-5 w-px bg-gray-400 ml-1 mr-4"></div>

                <span style={{ fontSize: 16, fontWeight: 600, color: "#000000" }}>
          Agentic Controls Testing
        </span>
      </button>

      {activeModule && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#9a3412",
              background: "#ffedd5",
              borderRadius: 99,
              padding: "2px 10px",
              marginRight: 4,
            }}
          >
            Demo environment
          </span>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: activeModule.menu.accent || "#86BC25",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
            {activeModule.menu.title}
          </span>
        </div>
      )}
    </div>
  );
}
