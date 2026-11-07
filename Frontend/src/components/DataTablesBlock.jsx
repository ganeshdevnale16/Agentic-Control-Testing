import { Download } from "lucide-react";

const BADGE_COLORS = {
  pass: { bg: "#dcfce7", fg: "#166534" },
  agrees: { bg: "#dcfce7", fg: "#166534" },
  exception: { bg: "#fee2e2", fg: "#991b1b" },
  difference: { bg: "#ffedd5", fg: "#9a3412" },
  "n/a": { bg: "#f1f5f9", fg: "#64748b" },
  agreed: { bg: "#dcfce7", fg: "#166534" },
  effective: { bg: "#dcfce7", fg: "#166534" },
  differs: { bg: "#fee2e2", fg: "#991b1b" },
  fail: { bg: "#fee2e2", fg: "#991b1b" },
  "not effective": { bg: "#fee2e2", fg: "#991b1b" },
  high: { bg: "#fee2e2", fg: "#991b1b" },
  medium: { bg: "#ffedd5", fg: "#9a3412" },
  low: { bg: "#fef9c3", fg: "#854d0e" },
  "not performed": { bg: "#ffedd5", fg: "#9a3412" },
  "not verifiable": { bg: "#ffedd5", fg: "#9a3412" },
  "tester to agree": { bg: "#ffedd5", fg: "#9a3412" },
  noted: { bg: "#ffedd5", fg: "#9a3412" },
  adequate: { bg: "#dcfce7", fg: "#166534" },
  received: { bg: "#dcfce7", fg: "#166534" },
  gap: { bg: "#fee2e2", fg: "#991b1b" },
  missing: { bg: "#ffedd5", fg: "#9a3412" },
  awaiting: { bg: "#f1f5f9", fg: "#475569" },
  pending: { bg: "#ffedd5", fg: "#9a3412" },
  "not tested": { bg: "#ffedd5", fg: "#9a3412" },
  "to test": { bg: "#E3F1CC", fg: "#26890D" },
  "no exception": { bg: "#dcfce7", fg: "#166534" },
  "not fully tested": { bg: "#ffedd5", fg: "#9a3412" },
  high: { bg: "#fee2e2", fg: "#991b1b" },
  medium: { bg: "#ffedd5", fg: "#9a3412" },
  low: { bg: "#dcfce7", fg: "#166534" },
  deficiency: { bg: "#fee2e2", fg: "#991b1b" },
  partial: { bg: "#ffedd5", fg: "#9a3412" },
  closed: { bg: "#dcfce7", fg: "#166534" },
  open: { bg: "#ffedd5", fg: "#9a3412" },
  yes: { bg: "#dcfce7", fg: "#166534" },
  "yes - but criterion too weak": { bg: "#ffedd5", fg: "#9a3412" },
  "not designed": { bg: "#fee2e2", fg: "#991b1b" },
  "n/a": { bg: "#f1f5f9", fg: "#475569" },
  "manual test": { bg: "#E3F1CC", fg: "#26890D" },
};

export { Badge };

function Badge({ value }) {
  const key = String(value).toLowerCase();
  const colors = BADGE_COLORS[key] || BADGE_COLORS[key.split(" – ")[0]] || {
    bg: "#f1f5f9",
    fg: "#334155",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 99,
        background: colors.bg,
        color: colors.fg,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

function formatCell(value, col) {
  if (value === null || value === undefined) return "";
  if (col.type === "number" && typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value;
}

function DataTable({ table }) {
  const { title, note, columns, rows } = table;
  return (
    <div style={{ marginBottom: 18 }}>
      {title && (
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#000000", marginBottom: 2 }}>
          {title}
        </div>
      )}
      {note && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{note}</div>
      )}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12.5,
            minWidth: 600,
          }}
        >
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "9px 12px",
                    textAlign: col.align || "left",
                    color: "#64748b",
                    fontWeight: 600,
                    borderBottom: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                    fontSize: 11.5,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? "#ffffff" : "#fafbfc",
                  verticalAlign: "top",
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "8px 12px",
                      textAlign: col.align || "left",
                      color: "#334155",
                      borderBottom: "1px solid #f1f5f9",
                      minWidth: col.minWidth,
                      whiteSpace: col.minWidth ? "normal" : "nowrap",
                      fontFamily: col.mono ? "monospace" : undefined,
                      fontSize: col.mono ? 12 : undefined,
                    }}
                  >
                    {col.type === "badge" ? (
                      <Badge value={row[col.key]} />
                    ) : (
                      formatCell(row[col.key], col)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DataTablesBlock({ intro, tables, onDownload, downloadLabel, children }) {
  return (
    <div>
      {intro && (
        <p style={{ fontSize: 14, color: "#000000", marginTop: 0, marginBottom: 14 }}>
          {intro}
        </p>
      )}
      {tables.map((table, i) => (
        <DataTable key={table.title || i} table={table} />
      ))}
      {children}
      {onDownload && (
        <button
          onClick={onDownload}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#000000",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Download size={14} /> {downloadLabel || "Download Excel Report"}
        </button>
      )}
    </div>
  );
}
