import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { ruleText } from "../engine/testEngine";
import { extractToAoa } from "../engine/sapConnector";

const LINE_HEIGHT = 14;
const MIN_ROW_HEIGHT = 20;
const MAX_ROW_HEIGHT = 320;
const BORDER = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const RESULT_COLORS = {
  pass: ["FFDCFCE7", "FF166534"],
  agreed: ["FFDCFCE7", "FF166534"],
  effective: ["FFDCFCE7", "FF166534"],
  exception: ["FFFEE2E2", "FF991B1B"],
  differs: ["FFFEE2E2", "FF991B1B"],
  high: ["FFFEE2E2", "FF991B1B"],
  "not effective": ["FFFEE2E2", "FF991B1B"],
  medium: ["FFFFEDD5", "FF9A3412"],
  low: ["FFFEF9C3", "FF854D0E"],
  "not performed": ["FFFFEDD5", "FF9A3412"],
  "not verifiable": ["FFFFEDD5", "FF9A3412"],
  "tester to agree": ["FFFFEDD5", "FF9A3412"],
  noted: ["FFFFEDD5", "FF9A3412"],
};

function lines(text, width) {
  if (text === undefined || text === null) return 1;
  const per = Math.max(Math.floor(width - 2), 8);
  return String(text).split("\n").reduce((n, seg) => n + Math.max(1, Math.ceil(seg.length / per)), 0);
}

function colorResult(cell) {
  const c = RESULT_COLORS[String(cell.value ?? "").toLowerCase()];
  if (!c) return;
  cell.fill = FILL(c[0]);
  cell.font = { bold: true, color: { argb: c[1] } };
}

// Table sheet: header row + data rows, wrapped text, borders, estimated heights
function tableSheet(wb, name, columns, rows, { resultKeys = [], freeze = true } = {}) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  rows.forEach((r) => ws.addRow(r));
  ws.eachRow((row, i) => {
    let max = 1;
    row.eachCell((cell, col) => {
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.border = BORDER;
      if (i === 1) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = FILL("FF000000");
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
      max = Math.max(max, lines(cell.value, ws.getColumn(col).width || 10));
    });
    row.height = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, max * LINE_HEIGHT));
  });
  resultKeys.forEach((k) => ws.getColumn(k).eachCell((cell, i) => i > 1 && colorResult(cell)));
  if (freeze) ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

function summarySheet(wb, result) {
  const { meta, control, summary } = result;
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 30 }, { width: 95 }];
  const title = ws.addRow(["SAP password configuration – control test workpaper"]);
  title.font = { bold: true, size: 14 };
  ws.addRow([`${control.id} · ${meta.reference}`]).font = { color: { argb: "FF64748B" } };
  ws.addRow([]);
  const section = (t) => {
    const r = ws.addRow([t]);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.getCell(1).fill = FILL("FF000000");
    r.getCell(2).fill = FILL("FF000000");
  };
  const kv = (k, v, opts = {}) => {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
    [1, 2].forEach((c) => {
      r.getCell(c).border = BORDER;
      r.getCell(c).alignment = { vertical: "top", wrapText: true };
    });
    if (opts.result) colorResult(r.getCell(2));
    r.height = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, lines(v, 95) * LINE_HEIGHT));
  };

  section("Conclusion");
  kv("Control conclusion", summary.conclusion, { result: true });
  kv("Summary", summary.headline);
  kv("Deficiency assessment", summary.deficiency);
  kv("Population reliance (IPE)", summary.caConclusion);
  kv("Attributes tested", summary.tested);
  kv("Attributes passed", summary.passed);
  kv("Exceptions (total)", summary.exceptions);
  kv("Exceptions High / Medium / Low", `${summary.high} / ${summary.medium} / ${summary.low}`);
  ws.addRow([]);
  section("Control information");
  kv("Control ID", control.id);
  kv("Control", control.name);
  kv("Domain", control.domain);
  kv("Control objective", control.objective);
  kv("Risk addressed", control.risk);
  kv("Control description", control.description);
  kv("Control type", `${control.type} · ${control.nature}`);
  kv("Frequency", control.frequency);
  kv("Control owner", control.owner);
  kv("Test approach", control.approach);
  ws.addRow([]);
  section("Test details");
  kv("System", meta.system);
  kv("Policy tested", meta.policyName);
  kv("Evidence source", meta.sourceLabel);
  kv("Extract", `${meta.fileName}${meta.sheetName ? ` › ${meta.sheetName}` : ""}`);
  kv("Population", `${meta.activeRows} active of ${meta.totalRows} entries`);
  kv("Instances tested", meta.instances.join(", "));
  kv("Performed by", `Agentic Controls Testing · ${meta.testedAt.toLocaleString()}`);
  kv("Reviewed by", "");
  kv("Review date", "");
  return ws;
}

async function evidenceSheet(wb, result) {
  const ws = wb.addWorksheet("Evidence");
  ws.columns = [{ width: 130 }];
  let row = 1;
  for (const r of result.results) {
    if (!r.evidence) continue;
    const cap = ws.getCell(row, 1);
    cap.value = `${r.attr.id} ${r.attr.label} – ${r.attr.key} – ${r.status}${r.exceptionId ? ` (${r.exceptionId})` : ""}`;
    cap.font = { bold: true, color: { argb: r.status === "Pass" ? "FF166534" : "FF991B1B" } };
    row++;
    const id = wb.addImage({ base64: r.evidence.url, extension: "png" });
    const w = 820;
    const h = Math.round((r.evidence.height / r.evidence.width) * w);
    ws.addImage(id, { tl: { col: 0, row: row - 1 }, ext: { width: w, height: h } });
    row += Math.ceil(h / 20) + 2;
  }
  return ws;
}

export async function downloadWorkpaper(result) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agentic Controls Testing";
  wb.created = new Date();

  summarySheet(wb, result);

  tableSheet(
    wb,
    "Test Attributes",
    [
      { header: "Attribute", key: "id", width: 10 },
      { header: "Policy ref", key: "ref", width: 10 },
      { header: "Policy wording", key: "clause", width: 60 },
      { header: "Requirement", key: "label", width: 34 },
      { header: "SAP parameter", key: "key", width: 34 },
      { header: "Rule", key: "rule", width: 22 },
      { header: "Severity", key: "sev", width: 11 },
      { header: "Note", key: "note", width: 30 },
    ],
    [
      ...result.attributes.map((a) => ({ id: a.id, ref: a.clauseRef, clause: a.clause, label: a.label, key: a.key, rule: ruleText(a), sev: a.severity, note: a.conversion || (a.zeroMeaning ? `${a.zeroMeaning} – treated as exception` : "") })),
      ...result.unmapped.map((u) => ({ id: "–", ref: u.ref, clause: u.text, label: "Not system-testable", key: "–", rule: "–", sev: "–", note: "Manual test required" })),
    ],
    { resultKeys: ["sev"] }
  );

  tableSheet(
    wb,
    "Testing",
    [
      { header: "Attribute", key: "id", width: 10 },
      { header: "Requirement", key: "label", width: 28 },
      { header: "SAP parameter", key: "key", width: 32 },
      { header: "Policy rule", key: "rule", width: 16 },
      { header: "Instance", key: "host", width: 22 },
      { header: "Extract row", key: "row", width: 11 },
      { header: "Actual value", key: "actual", width: 16 },
      { header: "Instance result", key: "iresult", width: 14 },
      { header: "Attribute result", key: "result", width: 14 },
      { header: "Test procedure", key: "procedure", width: 60 },
      { header: "Observation", key: "observation", width: 60 },
      { header: "Conclusion", key: "conclusion", width: 40 },
      { header: "Exception ref", key: "ex", width: 12 },
    ],
    result.results.flatMap((r) =>
      r.instances.map((i, k) => ({
        id: r.attr.id,
        label: r.attr.label,
        key: r.attr.key,
        rule: ruleText(r.attr),
        host: i.host,
        row: i.row ? i.row.n : "–",
        actual: i.display,
        iresult: i.ok ? "Pass" : "Exception",
        result: r.status,
        procedure: k === 0 ? r.narrative.procedure : "",
        observation: k === 0 ? r.narrative.observation : "",
        conclusion: k === 0 ? r.narrative.conclusion : "",
        ex: r.exceptionId || "",
      }))
    ),
    { resultKeys: ["iresult", "result"] }
  );

  tableSheet(
    wb,
    "Exceptions",
    [
      { header: "Exception ID", key: "id", width: 12 },
      { header: "Attribute", key: "attrId", width: 10 },
      { header: "Parameter", key: "key", width: 30 },
      { header: "Exception", key: "title", width: 34 },
      { header: "Type", key: "type", width: 22 },
      { header: "Severity", key: "severity", width: 10 },
      { header: "Condition", key: "condition", width: 50 },
      { header: "Criteria", key: "criteria", width: 50 },
      { header: "Cause", key: "cause", width: 50 },
      { header: "Effect / risk", key: "effect", width: 45 },
      { header: "Recommendation", key: "recommendation", width: 55 },
      { header: "Affected instances", key: "inst", width: 24 },
      { header: "Owner", key: "owner", width: 20 },
      { header: "Management response", key: "managementResponse", width: 35 },
      { header: "Target date", key: "targetDate", width: 12 },
      { header: "Status", key: "status", width: 10 },
    ],
    result.exceptions.length
      ? result.exceptions.map((e) => ({ ...e, inst: e.instances.join(", "), status: "Open" }))
      : [{ id: "–", title: "No exceptions noted" }],
    { resultKeys: ["severity"] }
  );

  tableSheet(
    wb,
    "IPE C&A",
    [
      { header: "Ref", key: "id", width: 9 },
      { header: "Check", key: "check", width: 44 },
      { header: "Result", key: "result", width: 15 },
      { header: "Detail", key: "detail", width: 80 },
    ],
    [
      ...result.ca,
      {},
      { id: "Sample", check: "Row · instance · parameter", result: "Result", detail: "Extract value / source value" },
      ...result.sample.map((s) => ({ id: s.n, check: `${s.host} · ${s.param}`, result: s.result, detail: `${s.value} / ${s.sourceValue}` })),
      {},
      { id: "", check: "Conclusion", result: "", detail: result.summary.caConclusion },
    ],
    { resultKeys: ["result"] }
  );

  await evidenceSheet(wb, result);

  tableSheet(
    wb,
    "Audit Trail",
    [
      { header: "Procedure", key: "proc", width: 40 },
      { header: "Check no.", key: "no", width: 10 },
      { header: "Check performed", key: "check", width: 70 },
      { header: "Result", key: "result", width: 12 },
      { header: "Noted that", key: "noted", width: 70 },
    ],
    [...(result.policyProcedures || []), ...result.procedures].flatMap((p) =>
      p.subChecks.map((s, i) => ({
        proc: i === 0 ? p.label : "",
        no: `${p.id.toUpperCase()}.${i + 1}`,
        check: s.text,
        result: s.status === "pass" ? "Pass" : s.status === "exception" ? "Exception" : "Noted",
        noted: i === 0 ? (p.points || []).join("\n") : "",
      }))
    ),
    { resultKeys: ["result"] }
  );

  tableSheet(
    wb,
    "Processing Log",
    [
      { header: "Time", key: "time", width: 22 },
      { header: "Activity", key: "text", width: 120 },
    ],
    [...(result.policyLog || []), ...(result.log || [])].map((l) => ({ time: l.time.toLocaleString(), text: l.text }))
  );

  // Full population, flagging the rows that were in scope
  const inScope = new Set(result.attributes.map((a) => a.key.toLowerCase()));
  const pop = wb.addWorksheet("Population");
  pop.columns = [
    { header: "Row", key: "n", width: 8 },
    { header: "HOSTNAME", key: "host", width: 22 },
    { header: "SYSTEMID", key: "system", width: 10 },
    { header: "PARDATE", key: "date", width: 12 },
    { header: "PARSTATE", key: "state", width: 10 },
    { header: "PARNAME", key: "param", width: 40 },
    { header: "PARVALUE", key: "value", width: 16 },
    { header: "In scope", key: "scope", width: 10 },
  ];
  result.__rows.forEach((r) => pop.addRow({ ...r, scope: r.active && inScope.has(r.param.toLowerCase()) ? "Yes" : "" }));
  pop.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  pop.getRow(1).eachCell((c) => (c.fill = FILL("FF000000")));
  pop.eachRow((row, i) => {
    if (i > 1 && row.getCell(8).value === "Yes") row.eachCell((c) => (c.fill = FILL("FFFEF9C3")));
  });
  pop.views = [{ state: "frozen", ySplit: 1 }];
  pop.autoFilter = { from: "A1", to: "H1" };

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${result.meta.reference}_ITGC_Password_Workpaper.xlsx`);
}

// Sample extract so the manual-upload path can be tried without SAP access
export function downloadSampleExtract(rows) {
  const ws = XLSX.utils.aoa_to_sheet(extractToAoa(rows));
  ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PAHI");
  XLSX.writeFile(wb, "Sample_PAHI_extract_DS4.xlsx");
}
