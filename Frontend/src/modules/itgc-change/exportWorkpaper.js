// Testing Work Paper – Agentic Controls Testing format (Deloitte styling).
// Sheets: Summary · RCM & Attributes · Population & IPE · Sample Testing ·
// Evidence (annotated screenshots) · Exceptions · Improvement Opportunities · Review Log
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  ACTT_IPE_STATEMENT, ATTRIBUTES, IMPROVEMENTS, IPE_ACTT, IPE_MANUAL, MANUAL_IPE_STATEMENT, POPULATION, RCM,
  attributeSummary, evidenceRefs, sampleSummary, stats, testingPerformed,
} from "./data/demo";
import { evidenceImagesFor } from "./evidenceImages";

const BLACK = "FF000000";
const GREEN = "FF86BC25";
const DGREEN = "FF26890D";
const GREY = "FFF2F2F2";
const PASS = "FFE3F1CC";
const FAIL = "FFFDE2DF";
const WARN = "FFFFF1D6";
const WHITE = "FFFFFFFF";
const THIN = { style: "thin", color: { argb: "FFBFBFBF" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT = "Arial";
const PAGE = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function sheet(wb, name, widths) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], pageSetup: PAGE, properties: { tabColor: { argb: GREEN } } });
  ws.columns = widths.map((width) => ({ width }));
  return ws;
}

function cell(ws, r, c, value, o = {}) {
  const x = ws.getCell(r, c);
  x.value = value;
  x.font = { name: FONT, size: o.size || 10, bold: o.bold, color: { argb: o.color || BLACK }, italic: o.italic };
  x.alignment = { vertical: o.valign || "top", horizontal: o.align || "left", wrapText: o.wrap !== false };
  if (o.bg) x.fill = fill(o.bg);
  if (o.border) x.border = BOX;
  return x;
}

function banner(ws, title, sub, lastCol) {
  ws.mergeCells(1, 1, 1, lastCol);
  cell(ws, 1, 1, title, { bold: true, size: 15, color: WHITE, bg: BLACK, valign: "middle" });
  ws.getRow(1).height = 30;
  ws.mergeCells(2, 1, 2, lastCol);
  cell(ws, 2, 1, sub, { size: 9, color: "FF53565A", bg: GREY, valign: "middle" });
  for (let c = 1; c <= lastCol; c++) ws.getCell(3, c).fill = fill(GREEN);
  ws.getRow(3).height = 4;
}

function section(ws, r, text, lastCol) {
  ws.mergeCells(r, 1, r, lastCol);
  cell(ws, r, 1, text, { bold: true, size: 11, color: BLACK, valign: "middle" });
  ws.getCell(r, 1).border = { bottom: { style: "medium", color: { argb: GREEN } } };
  ws.getRow(r).height = 20;
  return r + 1;
}

function headerRow(ws, r, labels) {
  labels.forEach((l, i) => cell(ws, r, i + 1, l, { bold: true, color: WHITE, bg: BLACK, border: true, valign: "middle", size: 9.5 }));
  ws.getRow(r).height = 22;
}

function kv(ws, r, label, value, lastCol, height) {
  cell(ws, r, 1, label, { bold: true, bg: GREY, border: true, size: 9.5 });
  ws.mergeCells(r, 2, r, lastCol);
  cell(ws, r, 2, value, { border: true });
  for (let c = 2; c <= lastCol; c++) ws.getCell(r, c).border = BOX;
  if (height) ws.getRow(r).height = height;
  return r + 1;
}

const resultFill = (s) => (s.result === "Pass" ? PASS : s.result === "Missing" ? WARN : FAIL);
const resultText = (s) => (s.result === "Pass" ? "PASS" : s.result === "Missing" ? "NOT TESTED" : "FAIL");
const today = () => new Date().toLocaleDateString("en-GB").replace(/\//g, ".");

// ── 1. Summary ──────────────────────────────────────────────────────────────
function summarySheet(wb, d) {
  const L = 6;
  const ws = sheet(wb, "Summary", [30, 22, 22, 22, 22, 30]);
  banner(ws, "Testing Work Paper – ITGC Change Management", `${RCM.controlId} · ${RCM.name} · Agentic Controls Testing · Prepared ${today()}`, L);
  let r = section(ws, 5, "Engagement", L);
  r = kv(ws, r, "Client", "Client name", L);
  r = kv(ws, r, "Control", `${RCM.controlId} – ${RCM.name}`, L);
  r = kv(ws, r, "In-scope period", RCM.period, L);
  r = kv(ws, r, "Environment", RCM.environment, L);
  r = kv(ws, r, "Population source", d.source === "actt" ? "Pulled from ACTT (system-generated)" : "Uploaded by the engagement team (E070 / STMS extracts)", L);
  r = kv(ws, r, "Sample selection", d.sampleMethod, L, 28);
  r = kv(ws, r, "Testing round", d.round > 1 ? `Round ${d.round} (re-performed after control owner accepted the reviewer observation)` : "Round 1", L, d.round > 1 ? 28 : undefined);
  r = kv(ws, r, "Prepared by / date", `Agentic Controls Testing (AI-assisted) · ${today()}`, L);
  const last = d.reviews[d.reviews.length - 1];
  r = kv(ws, r, "Review status", last ? `${last.decision} by reviewer on ${last.date}${last.owner ? ` · owner ${last.owner.decision.toLowerCase()} the observation` : ""}` : "Not yet reviewed", L);

  r = section(ws, r + 1, "Conclusion", L);
  const st = stats(d.samples);
  cell(ws, r, 1, "Overall conclusion", { bold: true, bg: GREY, border: true });
  ws.mergeCells(r, 2, r, 3);
  cell(ws, r, 2, st.verdict.toUpperCase(), { bold: true, size: 12, border: true, align: "center", valign: "middle", bg: st.exceptions ? FAIL : PASS });
  cell(ws, r, 4, "Samples / passed / exceptions", { bold: true, bg: GREY, border: true, size: 9.5 });
  ws.mergeCells(r, 5, r, 6);
  cell(ws, r, 5, `${d.samples.length} / ${st.passed} / ${st.exceptions}`, { bold: true, border: true, align: "center", valign: "middle" });
  ws.getRow(r).height = 24;
  r += 2;

  r = section(ws, r, `Exception summary – one point per sample (${d.samples.length})`, L);
  d.samples.forEach((s, i) => {
    const b = sampleSummary(s, i);
    ws.mergeCells(r, 1, r, L);
    cell(ws, r, 1, `•  ${b.head}: ${b.text}`, { border: true, bg: b.tone === "ok" ? undefined : b.tone === "bad" ? FAIL : WARN });
    ws.getRow(r).height = 30;
    r++;
  });
}

// ── 2. RCM & Attributes ─────────────────────────────────────────────────────
function rcmSheet(wb, d) {
  const L = 7;
  const ws = sheet(wb, "RCM & Attributes", [28, 30, 12, 12, 12, 18, 44]);
  banner(ws, "RCM & control attributes", "Control details as read from the uploaded Risk & Control Matrix", L);
  let r = section(ws, 5, "Control summary", L);
  [
    ["Control ID", RCM.controlId],
    ["Control objective", RCM.objective, 30],
    ["Risk", RCM.risk, 30],
    ["Control description", RCM.description, 58],
    ["Type / nature", RCM.nature],
    ["Frequency", RCM.frequency],
    ["Key control", RCM.key],
    ["Control owner", RCM.owner],
    ["Systems", RCM.systems],
    ["Test approach", RCM.testApproach],
  ].forEach(([l, v, h]) => (r = kv(ws, r, l, v, L, h)));

  r = section(ws, r + 1, "List of control attributes", L);
  headerRow(ws, r, ["#", "Attribute", "", "", "", "", ""]);
  ws.mergeCells(r, 2, r, L);
  r++;
  ATTRIBUTES.forEach((a, i) => {
    cell(ws, r, 1, `Attribute ${i + 1}`, { bold: true, border: true });
    ws.mergeCells(r, 2, r, L);
    cell(ws, r, 2, `${a.short} – ${a.text}`, { border: true });
    ws.getRow(r).height = 30;
    r++;
  });

  r = section(ws, r + 1, "Attribute summary", L);
  headerRow(ws, r, ["Attribute", "Description", "Tested", "√", "X", "Conclusion", "Comment"]);
  r++;
  attributeSummary(d.samples).forEach((a) => {
    cell(ws, r, 1, `Attribute ${a.n}`, { bold: true, border: true });
    cell(ws, r, 2, a.attribute, { border: true });
    cell(ws, r, 3, a.tested, { border: true, align: "center" });
    cell(ws, r, 4, a.ok, { border: true, align: "center" });
    cell(ws, r, 5, a.x, { border: true, align: "center", bold: !!a.x, color: a.x ? "FFC00000" : BLACK });
    cell(ws, r, 6, a.conclusion, { border: true, bold: true, bg: a.x ? FAIL : a.nt ? WARN : PASS });
    cell(ws, r, 7, a.comment, { border: true });
    ws.getRow(r).height = 28;
    r++;
  });

  r = section(ws, r + 1, "Legend", L);
  [["√", "No exception found"], ["X", "Exception found"], ["NT", "Not tested"]].forEach(([t, dsc]) => {
    cell(ws, r, 1, t, { bold: true, border: true, align: "center" });
    ws.mergeCells(r, 2, r, 3);
    cell(ws, r, 2, dsc, { border: true });
    ws.getCell(r, 3).border = BOX;
    r++;
  });
}

// ── 3. Population & IPE ─────────────────────────────────────────────────────
function populationSheet(wb, d) {
  const L = 7;
  const ws = sheet(wb, "Population & IPE", [18, 60, 26, 14, 14, 14, 14]);
  banner(ws, "Population & IPE validation", `${POPULATION.transports} transports · ${POPULATION.period}`, L);
  let r = section(ws, 5, "Population", L);
  r = kv(ws, r, "Source", d.source === "actt" ? "ACTT – system-generated extract from CIP, client 500" : "Manual upload – E070 and STMS_IMPORT extracts with screenshots", L);
  r = kv(ws, r, "Transports", `${POPULATION.transports} (STMS matched ${POPULATION.stmsMatched}, unique owners ${POPULATION.owners}, unique CRs ${POPULATION.uniqueCRs})`, L);
  r = kv(ws, r, "Landscape", `Transport target ${POPULATION.target} · TR prefix ${POPULATION.prefix}`, L);
  r = kv(ws, r, "Completeness & accuracy", d.source === "actt" ? ACTT_IPE_STATEMENT : MANUAL_IPE_STATEMENT, L, 40);

  r = section(ws, r + 1, "IPE checks", L);
  headerRow(ws, r, ["Layer", "Check", "Value", "Result", "", "", ""]);
  r++;
  (d.source === "actt" ? IPE_ACTT : IPE_MANUAL).forEach((c) => {
    cell(ws, r, 1, c.layer, { border: true });
    cell(ws, r, 2, c.check, { border: true });
    cell(ws, r, 3, c.value, { border: true });
    cell(ws, r, 4, "PASS", { border: true, bold: true, bg: PASS, align: "center" });
    r++;
  });

  r = section(ws, r + 1, "Row match proof (sample)", L);
  headerRow(ws, r, ["TR number", "CR number", "E070 row", "STMS row", "Owner", "Import user", "Date"]);
  r++;
  POPULATION.matchProof.forEach((m) => {
    [m.tr, m.cr, m.e070, m.stms, m.owner, m.user, m.date].forEach((v, i) => cell(ws, r, i + 1, v, { border: true }));
    r++;
  });
}

// ── 4. Sample Testing ───────────────────────────────────────────────────────
function testingSheet(wb, d) {
  const heads = ["#", "TR number", "CR number", "Ticket", "Change type", "Owner", "Import user", "Unit test", "UAT", "Approved", "Imported", "A1", "A2", "A3", "A4", "Result", "Testing performed", "Evidence reference"];
  const L = heads.length;
  const ws = sheet(wb, "Sample Testing", [5, 13, 12, 12, 16, 10, 11, 11, 11, 11, 11, 6, 6, 6, 6, 12, 60, 46]);
  banner(ws, "Sample testing", `${d.samples.length} samples · attributes A1–A4 per the RCM · round ${d.round}`, L);
  let r = 5;
  headerRow(ws, r, heads);
  r++;
  d.samples.forEach((s, i) => {
    const vals = [i + 1, s.tr, s.cr, s.ticket || "–", s.type, s.owner || "–", s.user || "–", s.unitDate || "–", s.uatDate || "–", s.apprDate || "–", s.importDate || "–"];
    vals.forEach((v, k) => cell(ws, r, k + 1, v, { border: true, size: 9 }));
    s.attrs.forEach((a, k) => cell(ws, r, 12 + k, a, { border: true, align: "center", bold: true, color: a === "X" ? "FFC00000" : BLACK }));
    cell(ws, r, 16, resultText(s), { border: true, bold: true, align: "center", bg: resultFill(s) });
    cell(ws, r, 17, testingPerformed(s) + (s.note && s.result === "Fail" ? ` Exception: ${s.note}.` : ""), { border: true, size: 9 });
    cell(ws, r, 18, evidenceRefs(s).split(" | ").join("\n"), { border: true, size: 8.5 });
    ws.getRow(r).height = 72;
    r++;
  });
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 5, xSplit: 3 }];
}

// ── 5. Evidence with annotated screenshots ──────────────────────────────────
function evidenceSheet(wb, d) {
  const L = 10;
  const ws = sheet(wb, "Evidence", Array(L).fill(12));
  banner(ws, "Evidence & attribute mapping", "Annotated screenshots for every tested sample · green = attribute met, red = exception", L);
  let r = 5;
  d.samples.forEach((s, i) => {
    ws.mergeCells(r, 1, r, L);
    cell(ws, r, 1, `Sample ${i + 1} – ${s.tr} / CR ${s.cr} – ${s.type} – ${resultText(s)}`, { bold: true, size: 11, color: WHITE, bg: s.result === "Pass" ? DGREEN : s.result === "Missing" ? "FFED8B00" : "FFDA291C", valign: "middle" });
    ws.getRow(r).height = 22;
    r++;
    ws.mergeCells(r, 1, r, L);
    cell(ws, r, 1, testingPerformed(s), { border: true });
    ws.getRow(r).height = 44;
    r += 2;
    const imgs = evidenceImagesFor(s);
    if (!imgs.length) {
      ws.mergeCells(r, 1, r, L);
      cell(ws, r, 1, "No screenshot – source document not provided.", { italic: true, color: "FF9A3412" });
      r += 3;
      return;
    }
    imgs.forEach((img) => {
      ws.mergeCells(r, 1, r, L);
      cell(ws, r, 1, `${img.title} – ${img.caption}`, { bold: true, size: 9.5 });
      r++;
      const id = wb.addImage({ base64: img.dataUrl, extension: "png" });
      const w = 700;
      const h = Math.round((img.height / img.width) * w);
      ws.addImage(id, { tl: { col: 0, row: r - 1 }, ext: { width: w, height: h } });
      r += Math.ceil(h / 20) + 1;
    });
    r += 1;
  });
}

// ── 6. Exceptions ───────────────────────────────────────────────────────────
function exceptionsSheet(wb, d) {
  const L = 6;
  const ws = sheet(wb, "Exceptions", [14, 13, 14, 50, 40, 30]);
  banner(ws, "Exceptions", `${stats(d.samples).exceptions} exception(s) in ${d.samples.length} samples`, L);
  let r = 5;
  headerRow(ws, r, ["TR number", "CR number", "Attribute", "Exception", "Impact", "Proposed action"]);
  r++;
  const ex = d.samples.filter((s) => s.result !== "Pass");
  if (!ex.length) {
    ws.mergeCells(r, 1, r, L);
    cell(ws, r, 1, "No exceptions noted.", { border: true, bg: PASS });
    return;
  }
  ex.forEach((s) => {
    const sod = s.result === "Fail";
    [
      s.tr,
      s.cr,
      sod ? "A4 – Segregation of duties" : "A1–A4 – Not tested",
      s.note,
      sod ? "A developer could move untested or unauthorised code to production without independent oversight." : "Operating effectiveness cannot be concluded for this change without the source document.",
      sod ? "Confirm with the control owner whether the change was reviewed after import; see IO-1." : "Obtain the ticket history and re-perform testing; see IO-2.",
    ].forEach((v, k) => cell(ws, r, k + 1, v, { border: true, bg: k === 2 ? FAIL : undefined }));
    ws.getRow(r).height = 46;
    r++;
  });
}

// ── 7. Improvement Opportunities ────────────────────────────────────────────
function improvementSheet(wb) {
  const L = 5;
  const ws = sheet(wb, "Improvement Opportunities", [8, 22, 11, 48, 60]);
  banner(ws, "Improvement opportunities", "Control design and operation improvements identified during testing", L);
  let r = 5;
  headerRow(ws, r, ["Ref", "Area", "Priority", "Observation", "Recommendation"]);
  r++;
  IMPROVEMENTS.forEach((io) => {
    const pf = io.priority === "High" ? FAIL : io.priority === "Medium" ? WARN : PASS;
    [io.ref, io.area, io.priority, io.observation, io.recommendation].forEach((v, k) => cell(ws, r, k + 1, v, { border: true, bg: k === 2 ? pf : undefined, bold: k === 2 }));
    ws.getRow(r).height = 44;
    r++;
  });
}

// ── 8. Review Log ───────────────────────────────────────────────────────────
function reviewSheet(wb, d) {
  const L = 8;
  const ws = sheet(wb, "Review Log", [8, 13, 12, 44, 13, 12, 40, 30]);
  banner(ws, "Review log", "Reviewer decisions and control owner responses", L);
  let r = 5;
  headerRow(ws, r, ["Round", "Reviewer decision", "Date", "Reviewer observation / comment", "Owner response", "Date", "Owner notes", "Reference documents"]);
  r++;
  if (!d.reviews.length) {
    ws.mergeCells(r, 1, r, L);
    cell(ws, r, 1, "Not yet reviewed.", { border: true, italic: true });
    return;
  }
  d.reviews.forEach((v) => {
    [
      v.round,
      v.decision,
      v.date,
      v.comment || "–",
      v.owner?.decision || (v.decision === "Rejected" ? "Pending" : "–"),
      v.owner?.date || "–",
      v.owner?.notes || "–",
      v.owner?.docs?.length ? v.owner.docs.join("\n") : "–",
    ].forEach((val, k) => cell(ws, r, k + 1, val, { border: true, bg: k === 1 ? (v.decision === "Approved" ? PASS : FAIL) : undefined, bold: k === 1 }));
    ws.getRow(r).height = 46;
    r++;
  });
}

export async function buildChangeWorkpaper(d) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agentic Controls Testing";
  wb.created = new Date();
  summarySheet(wb, d);
  rcmSheet(wb, d);
  populationSheet(wb, d);
  testingSheet(wb, d);
  evidenceSheet(wb, d);
  exceptionsSheet(wb, d);
  improvementSheet(wb);
  reviewSheet(wb, d);
  return wb.xlsx.writeBuffer();
}

export async function downloadChangeWorkpaper(d) {
  const buf = await buildChangeWorkpaper(d);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `ITGC_Change_Management_TWP_R${d.round}_${stamp}.xlsx`);
}
