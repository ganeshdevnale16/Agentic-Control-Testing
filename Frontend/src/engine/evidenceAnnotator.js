import { OPS, formatValue } from "../modules/itgc-password/data/sapParameters";

const COLS = [
  { label: "HOSTNAME", x: 14 },
  { label: "SYSTEMID", x: 200 },
  { label: "PARDATE", x: 280 },
  { label: "PARSTATE", x: 380 },
  { label: "PARNAME", x: 460 },
  { label: "PARVALUE", x: 760 },
  { label: "Row", x: 880 },
];
const WIDTH = 940;
const ROW_H = 26;

function wrap(g, text, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

/**
 * Renders an SE16-style view of the evidence rows for one test attribute,
 * with the tested parameter and value boxed and an annotation panel
 * underneath (source, population, criteria, result per instance). Returns a
 * { url, width, height } PNG data URL used on screen, in the PDF report and in the Excel workbook.
 */
export function annotateEvidence(result, testResult) {
  const { attr, instances, status } = result;
  const { meta } = testResult;
  const allRows = testResult.__rows;

  // Context rows: the hit row plus one row either side, per instance
  const view = [];
  instances.forEach((inst) => {
    if (!inst.row) {
      view.push({ missing: true, host: inst.host });
      return;
    }
    const idx = allRows.indexOf(inst.row);
    [idx - 1, idx, idx + 1].forEach((i) => {
      if (i >= 0 && i < allRows.length) view.push({ row: allRows[i], hit: i === idx, inst });
    });
  });

  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = "12px Arial";
  const noteLines = [
    `Source: ${meta.sourceLabel} · ${meta.fileName}${meta.sheetName ? ` › ${meta.sheetName}` : ""}`,
    `Population: ${meta.activeRows.toLocaleString()} active of ${meta.totalRows.toLocaleString()} entries${meta.screenCount != null ? ` · system screen ${meta.screenCount.toLocaleString()} (${meta.screenCount === meta.activeRows ? "agreed" : "differs"})` : ""}`,
    `Criteria: policy ${attr.clauseRef} – ${attr.key} ${OPS[attr.op]} ${formatValue(attr.value, attr.unit)}${attr.zeroMeaning ? ` (${attr.zeroMeaning})` : ""}`,
    ...instances.map((i) => `${i.ok ? "✓" : "✗"} ${i.host}: ${i.display}${i.row ? ` (row ${i.row.n})` : ""} → ${i.ok ? "meets policy" : i.reason === "missing" ? "not maintained" : i.reason === "disabled" ? "control disabled" : "does not meet policy"}`),
    `Conclusion: ${status === "Pass" ? "No exception noted" : `Exception${result.exceptionId ? ` ${result.exceptionId}` : ""} – ${result.type}`}`,
    `Tested by Agentic Controls Testing · ${meta.testedAt.toLocaleString()} · ref ${meta.reference}`,
  ];
  const wrapped = noteLines.flatMap((t, i) => wrap(g, t, WIDTH - 60).map((l, k) => ({ text: l, idx: i, first: k === 0 })));

  const tableTop = 70;
  const tableH = view.length * ROW_H;
  const panelTop = tableTop + tableH + 22;
  const H = panelTop + 34 + wrapped.length * 18 + 14;
  c.width = WIDTH;
  c.height = H;

  // Window chrome
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, WIDTH, H);
  g.fillStyle = "#dbe4f0";
  g.fillRect(0, 0, WIDTH, 30);
  g.fillStyle = "#000000";
  g.font = "bold 13px Arial";
  g.fillText(`Data Browser: Table ${meta.table === "Extract provided by user" ? "(uploaded extract)" : meta.table}   Select Entries ${meta.activeRows.toLocaleString()}`, 12, 20);
  g.font = "11px Arial";
  g.fillStyle = "#475569";
  g.textAlign = "right";
  g.fillText(meta.system, WIDTH - 12, 20);
  g.textAlign = "left";

  // Header row
  g.fillStyle = "#f1f5f9";
  g.fillRect(0, 40, WIDTH, 30);
  g.fillStyle = "#475569";
  g.font = "bold 12px Arial";
  COLS.forEach((col) => g.fillText(col.label, col.x, 60));

  // Rows
  view.forEach((v, k) => {
    const y = tableTop + k * ROW_H;
    if (v.missing) {
      g.fillStyle = "#fef2f2";
      g.fillRect(0, y, WIDTH, ROW_H);
      g.fillStyle = "#991b1b";
      g.font = "italic 12px Arial";
      g.fillText(`${v.host} – ${attr.key} not found in the active population`, 14, y + 17);
      return;
    }
    const r = v.row;
    g.fillStyle = v.hit ? "#fef9c3" : k % 2 ? "#fafbfc" : "#ffffff";
    g.fillRect(0, y, WIDTH, ROW_H);
    g.fillStyle = v.hit ? "#000000" : "#64748b";
    g.font = `${v.hit ? "bold " : ""}12px Arial`;
    const cells = [r.host, r.system || "", r.date || "", r.state || "", r.param, String(r.value), String(r.n)];
    cells.forEach((t, i) => g.fillText(String(t).slice(0, i === 0 ? 26 : 40), COLS[i].x, y + 17));

    if (v.hit) {
      const ok = v.inst.ok;
      g.lineWidth = 2.5;
      // parameter box
      g.strokeStyle = "#86BC25";
      const pw = g.measureText(r.param).width;
      g.strokeRect(COLS[4].x - 5, y + 2, pw + 10, ROW_H - 4);
      // value box
      g.strokeStyle = ok ? "#16a34a" : "#dc2626";
      const vw = Math.max(g.measureText(String(r.value)).width, 18);
      g.strokeRect(COLS[5].x - 5, y + 2, vw + 10, ROW_H - 4);
      // tick / cross mark
      g.fillStyle = ok ? "#16a34a" : "#dc2626";
      g.font = "bold 14px Arial";
      g.fillText(ok ? "✓" : "✗", COLS[5].x + vw + 12, y + 18);
    }
  });
  g.strokeStyle = "#e2e8f0";
  g.lineWidth = 1;
  g.strokeRect(0.5, 40.5, WIDTH - 1, tableH + 30);

  // Legend above the panel
  g.font = "bold 10.5px Arial";
  g.fillStyle = "#86BC25";
  g.fillText("■ parameter tested", 14, panelTop - 6);
  g.fillStyle = "#16a34a";
  g.fillText("■ value meets policy", 140, panelTop - 6);
  g.fillStyle = "#dc2626";
  g.fillText("■ value fails policy", 280, panelTop - 6);

  // Annotation panel
  g.fillStyle = "#f8fafc";
  g.fillRect(8, panelTop, WIDTH - 16, H - panelTop - 8);
  g.strokeStyle = status === "Pass" ? "#16a34a" : "#dc2626";
  g.lineWidth = 2;
  g.strokeRect(8, panelTop, WIDTH - 16, H - panelTop - 8);
  g.fillStyle = "#000000";
  g.font = "bold 13px Arial";
  g.fillText(`EVIDENCE ANNOTATION · ${attr.id} ${attr.label}`, 22, panelTop + 22);
  wrapped.forEach((l, i) => {
    const isResult = l.idx >= 3 && l.idx < 3 + instances.length;
    const ok = isResult ? instances[l.idx - 3].ok : null;
    const isConclusion = l.idx === 3 + instances.length;
    g.fillStyle = isResult ? (ok ? "#166534" : "#991b1b") : isConclusion ? (status === "Pass" ? "#166534" : "#991b1b") : "#475569";
    g.font = `${isResult || isConclusion ? "bold " : ""}12px Arial`;
    g.fillText(l.text, 22, panelTop + 44 + i * 18);
  });

  return { url: c.toDataURL("image/png"), width: WIDTH, height: H };
}
