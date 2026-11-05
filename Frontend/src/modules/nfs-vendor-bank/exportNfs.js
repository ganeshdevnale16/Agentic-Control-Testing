import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { fmtDate } from "./engine/util";

const BORDER = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const COLORS = {
  pass: ["FFDCFCE7", "FF166534"],
  agrees: ["FFDCFCE7", "FF166534"],
  adequate: ["FFDCFCE7", "FF166534"],
  effective: ["FFDCFCE7", "FF166534"],
  received: ["FFDCFCE7", "FF166534"],
  exception: ["FFFEE2E2", "FF991B1B"],
  gap: ["FFFEE2E2", "FF991B1B"],
  differs: ["FFFEE2E2", "FF991B1B"],
  high: ["FFFEE2E2", "FF991B1B"],
  "not effective": ["FFFEE2E2", "FF991B1B"],
  medium: ["FFFFEDD5", "FF9A3412"],
  missing: ["FFFFEDD5", "FF9A3412"],
  pending: ["FFFFEDD5", "FF9A3412"],
  noted: ["FFFFEDD5", "FF9A3412"],
  "not tested": ["FFFFEDD5", "FF9A3412"],
  "not verifiable": ["FFFFEDD5", "FF9A3412"],
  "to test": ["FFE0E7FF", "FF3730A3"],
  low: ["FFFEF9C3", "FF854D0E"],
};
const lines = (t, w) => String(t ?? "").split("\n").reduce((n, s) => n + Math.max(1, Math.ceil(s.length / Math.max(w - 2, 8))), 0);
const color = (cell) => {
  const c = COLORS[String(cell.value ?? "").toLowerCase().split(" – ")[0]];
  if (!c) return;
  cell.fill = FILL(c[0]);
  cell.font = { bold: true, color: { argb: c[1] } };
};

function table(wb, name, cols, rows, colorKeys = []) {
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map((c) => ({ header: c[1], key: c[0], width: c[2] }));
  (rows.length ? rows : [{ [cols[0][0]]: "None" }]).forEach((r) => ws.addRow(r));
  ws.eachRow((row, i) => {
    let max = 1;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = BORDER;
      if (i === 1) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = FILL("FF000000");
      }
      max = Math.max(max, lines(cell.value, ws.getColumn(col).width || 10));
    });
    row.height = Math.min(300, Math.max(20, max * 14));
  });
  colorKeys.forEach((k) => ws.getColumn(k).eachCell((c, i) => i > 1 && color(c)));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

function kvSheet(wb, name, title, sub, sections) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 30 }, { width: 100 }];
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([sub]).font = { color: { argb: "FF64748B" } };
  for (const [head, rows] of sections) {
    ws.addRow([]);
    const h = ws.addRow([head, ""]);
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = FILL("FF000000");
    });
    for (const [k, v, isResult] of rows) {
      const r = ws.addRow([k, v ?? ""]);
      r.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
      r.eachCell({ includeEmpty: true }, (c) => {
        c.border = BORDER;
        c.alignment = { vertical: "top", wrapText: true };
      });
      if (isResult) color(r.getCell(2));
      r.height = Math.min(300, Math.max(20, lines(v, 100) * 14));
    }
  }
  return ws;
}

const RCM_COLS = [
  ["process", "Process", 16],
  ["subProcess", "Sub-process", 18],
  ["riskId", "Risk ID", 11],
  ["riskDesc", "Risk description", 36],
  ["controlId", "Control ID", 12],
  ["activity", "Control activity", 26],
  ["description", "Control description", 50],
  ["type", "Type", 12],
  ["nature", "Nature", 16],
  ["frequency", "Frequency", 13],
  ["performer", "Performed by", 18],
  ["owner", "Control owner", 22],
  ["assertion", "Assertion", 22],
  ["sopRef", "SOP reference", 14],
  ["attributes", "Test attributes", 12],
  ["sample", "Sample size", 16],
  ["design", "Design assessment", 16],
];

function rcmSheets(wb, rcm) {
  table(wb, "RCM", RCM_COLS, rcm.rcmRows, ["design"]);
  table(wb, "Walkthrough vs SOP", [["check", "Check", 30], ["result", "Result", 12], ["detail", "Detail", 80]], rcm.consistency, ["result"]);
  table(
    wb,
    "Design Assessment",
    [["id", "Ref", 6], ["area", "Area", 30], ["status", "Assessment", 12], ["severity", "Severity", 10], ["observation", "Observation", 70], ["recommendation", "Recommendation", 55], ["ref", "SOP ref", 12]],
    rcm.design,
    ["status", "severity"]
  );
  table(
    wb,
    "Test Plan",
    [["id", "Attribute", 10], ["activity", "Control ID", 14], ["label", "Attribute", 45], ["procedure", "Test procedure", 70], ["evidence", "Evidence", 12], ["severity", "Severity if failed", 12]],
    rcm.attributes.map((a) => ({ ...a, evidence: a.evidence.join(", ") })),
    ["severity"]
  );
  table(wb, "Evidence Request", [["id", "Ref", 6], ["name", "Evidence requested", 60], ["for", "Used for", 18], ["note", "Note", 26]], rcm.evidenceRequests);
}

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

export async function downloadRcm(rcm, sop) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agentic Controls Testing";
  kvSheet(wb, "Summary", `RCM – ${rcm.control.subProcess}`, `${rcm.control.company} · generated ${new Date().toLocaleString()}`, [
    ["Control", [["Control ID", rcm.control.id], ["Risk", `${rcm.control.riskId} – ${rcm.control.riskDesc}`], ["Control description", rcm.control.description], ["Owner", rcm.control.owner]]],
    ["Source documents", [["SOP", `${sop.name} (${sop.docId} v${sop.version}, approved ${fmtDate(sop.approvalDate)})`], ["Design conclusion", rcm.designConclusion, true], ["Design gaps", String(rcm.gaps.length)]]],
  ]);
  rcmSheets(wb, rcm);
  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `RCM_${rcm.control.id}_${stamp()}.xlsx`);
}

export async function downloadWorkpaper(result) {
  const { summary, control, rcm, sop, meta } = result;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agentic Controls Testing";
  wb.created = new Date();
  kvSheet(wb, "Summary", `${control.id} Vendor bank-detail change – control test workpaper`, `${meta.company} · ${meta.reference}`, [
    ["Conclusion", [
      ["Overall conclusion", summary.conclusion, true],
      ["Design", summary.designConclusion],
      ["Operating effectiveness", summary.operatingConclusion],
      ["Summary", summary.headline],
      ["Deficiency assessment", summary.deficiency],
      ["Attributes tested / passed", `${summary.tested} / ${summary.passed}`],
      ["Exceptions (High)", `${summary.exceptions} (${summary.high})`],
      ["Design gaps", String(summary.gaps)],
    ]],
    ["Control", [
      ["Process", `${control.process} › ${control.subProcess}`],
      ["Risk", `${control.riskId} – ${control.riskDesc}`],
      ["Control", control.description],
      ["Type / nature / frequency", `${control.type} · ${control.nature} · ${control.frequency}`],
      ["Owner", control.owner],
      ["Assertion", control.assertion],
    ]],
    ["Test details", [
      ["SOP", `${sop.name} – ${sop.docId} v${sop.version}`],
      ["Period tested", meta.period],
      ["Evidence files", meta.files.map((f) => f.name).join("\n")],
      ["Prepared by", `Agentic Controls Testing · ${meta.testedAt.toLocaleString()}`],
      ["Reviewed by", ""],
      ["Review date", ""],
    ]],
    ["Limitations and outstanding requests", result.limitations.map((l, i) => [`L${i + 1}`, l])],
  ]);
  rcmSheets(wb, rcm);
  table(
    wb,
    "Testing",
    [["id", "Attribute", 9], ["label", "Attribute description", 34], ["item", "Item tested", 36], ["expected", "Expected", 34], ["actual", "Actual", 50], ["result", "Item result", 13], ["status", "Attribute result", 14], ["ex", "Exception", 10]],
    result.results.flatMap((r) =>
      (r.details.length ? r.details : [{ item: "–", expected: "–", actual: r.observation, result: r.status }]).map((d) => ({ id: r.attr.id, label: r.attr.label, item: d.item, expected: d.expected, actual: d.actual, result: d.result, status: r.status, ex: r.exceptionId || "" }))
    ),
    ["result", "status"]
  );
  table(
    wb,
    "Narratives",
    [["id", "Attribute", 9], ["label", "Attribute", 34], ["procedure", "Procedure", 55], ["observation", "Observation", 80], ["conclusion", "Conclusion", 30]],
    result.results.map((r) => ({ id: r.attr.id, label: r.attr.label, ...r.narrative }))
  );
  table(
    wb,
    "Exceptions",
    [["id", "ID", 8], ["title", "Exception", 32], ["type", "Type", 18], ["severity", "Severity", 10], ["condition", "Condition", 60], ["criteria", "Criteria", 45], ["cause", "Cause", 45], ["effect", "Effect / risk", 45], ["recommendation", "Recommendation", 55], ["owner", "Owner", 20], ["response", "Management response", 30], ["target", "Target date", 12], ["status", "Status", 10]],
    result.exceptions.map((e) => ({ ...e, status: "Open" })),
    ["severity"]
  );
  table(
    wb,
    "Payment Exposure",
    [["runId", "Run ID", 12], ["date", "Run date", 13], ["by", "Executed by", 12], ["vendors", "Vendors paid", 12], ["amount", "Amount (INR)", 16], ["changes", "Unreviewed bank changes at run time", 50]],
    result.exposure.map((r) => ({ ...r, changes: r.changesBefore.map((c) => `${c.code} ${c.name} (${c.by}, ${c.on})`).join("\n") }))
  );
  table(wb, "Outstanding Requests", [["ref", "VCRF", 16], ["code", "Vendor", 10], ["name", "Vendor name", 26], ["by", "Changed by", 12], ["on", "Changed on", 13]], result.pending);
  table(wb, "Evidence Index", [["name", "File", 50], ["label", "Recognised as", 40]], meta.files);
  table(
    wb,
    "Processing Log",
    [["time", "Time", 12], ["text", "Activity", 110]],
    [...(result.rcmLog || []), ...(result.log || [])].map((l) => ({ time: l.time.toLocaleTimeString([], { hour12: false }), text: l.text }))
  );
  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `Workpaper_${control.id}_Vendor_Bank_Change_${stamp()}.xlsx`);
}
