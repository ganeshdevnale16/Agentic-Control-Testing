// Testing Work Paper in the format of the "Change Template":
//   Sheet 1 "Test Sheet"                  – control header, attributes, legend, ToD details, conclusion
//   Sheet 2 "Evidence & Attribute mapping" – per-sample attribute assessment narratives
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { CONTROL, POPULATION, SAMPLES, VERDICT, evidenceRefs, testingPerformed, ACTT_IPE_STATEMENT, MANUAL_IPE_STATEMENT } from "./data/demo";

const BLUE = "FF1F3864";
const GREEN = "FF3A9B2E";
const PASS_FILL = "FF92D050";
const FAIL_FILL = "FFFF7C80";
const LABEL_FILL = "FFF2F2F2";
const THIN = { style: "thin", color: { argb: "FF808080" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const FONT = "Times New Roman";
const PAGE = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

function put(ws, ref, value, { bold, color, bg, wrap = true, align = "left", size = 10, merge } = {}) {
  if (merge) ws.mergeCells(merge);
  const c = ws.getCell(ref);
  c.value = value;
  c.font = { name: FONT, size, bold, color: color ? { argb: color } : undefined };
  c.alignment = { vertical: "middle", horizontal: align, wrapText: wrap };
  if (bg) c.fill = fill(bg);
  return c;
}

function boxRange(ws, range) {
  const [a, b] = range.split(":");
  const s = ws.getCell(a), e = ws.getCell(b);
  for (let r = s.row; r <= e.row; r++) for (let c = s.col; c <= e.col; c++) ws.getCell(r, c).border = BOX;
}

function label(ws, row, text) {
  put(ws, `A${row}`, text, { bold: true, bg: LABEL_FILL, size: 9 });
  ws.getCell(`A${row}`).border = BOX;
}

function testSheet(wb, { source, sampleMethod }) {
  const ws = wb.addWorksheet("Test Sheet", { views: [{ showGridLines: false }], pageSetup: PAGE });
  ws.columns = [24, 26, 12, 12, 12, 16, 46, 30, 52].map((width) => ({ width }));

  // Header block
  label(ws, 2, "Client"); put(ws, "B2", CONTROL.client, { merge: "B2:E2" }); boxRange(ws, "B2:E2");
  label(ws, 3, "Process"); put(ws, "B3", CONTROL.process, { bold: true, color: "FFFFFFFF", bg: BLUE, merge: "B3:E3" }); boxRange(ws, "B3:E3");
  put(ws, "F3", "In scope period (DD.MM.YYYY)", { bold: true, bg: LABEL_FILL, size: 9 }); put(ws, "G3", CONTROL.period, { merge: "G3:I3" }); boxRange(ws, "F3:I3");
  put(ws, "F4", "IT environment in scope", { bold: true, bg: LABEL_FILL, size: 9 }); put(ws, "G4", CONTROL.environment, { merge: "G4:I4" }); boxRange(ws, "F4:I4");

  const wide = [
    [5, "Control Reference", `${CONTROL.ref} – ${CONTROL.name}`, 18],
    [6, "Control Description", CONTROL.description, 54],
    [7, "ToD Test Steps", CONTROL.todSteps, 84],
    [8, "Testing Method", CONTROL.testingMethod, 18],
  ];
  wide.forEach(([r, l, v, h]) => {
    label(ws, r, l);
    put(ws, `B${r}`, v, { merge: `B${r}:I${r}` });
    boxRange(ws, `A${r}:I${r}`);
    ws.getRow(r).height = h;
  });

  const testingDate = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");
  label(ws, 9, "Population available");
  put(ws, "B9", `${POPULATION.transports} transports (${source === "actt" ? "pulled from ACTT" : "uploaded E070 / STMS extract"})`);
  put(ws, "C9", "Control frequency", { bold: true, bg: LABEL_FILL, size: 9, merge: "C9:D9" });
  put(ws, "E9", CONTROL.frequency, { merge: "E9:G9" });
  label(ws, 10, "Who performs the tests");
  put(ws, "B10", "Agentic Controls Testing (AI-assisted); reviewer: ________");
  put(ws, "C10", "Sample size", { bold: true, bg: LABEL_FILL, size: 9, merge: "C10:D10" });
  put(ws, "E10", SAMPLES.length, { merge: "E10:G10" });
  put(ws, "C11", "Testing date", { bold: true, bg: LABEL_FILL, size: 9, merge: "C11:D11" });
  put(ws, "E11", testingDate, { merge: "E11:G11" });
  boxRange(ws, "A9:G11");
  ws.getRow(10).height = 28;

  label(ws, 12, "Description of how the population was determined to be complete");
  put(ws, "B12", source === "actt" ? ACTT_IPE_STATEMENT : MANUAL_IPE_STATEMENT, { merge: "B12:I12" });
  boxRange(ws, "A12:I12");
  ws.getRow(12).height = 46;
  label(ws, 13, "Sample selection method");
  put(ws, "B13", sampleMethod, { merge: "B13:I13" });
  boxRange(ws, "A13:I13");
  ws.getRow(13).height = 28;

  label(ws, 15, "List of control attributes");
  put(ws, "B15", CONTROL.attributes.map((a, i) => `${i + 1}. ${a}`).join("\n"), { merge: "B15:I15" });
  boxRange(ws, "A15:I15");
  ws.getRow(15).height = 64;

  // Legend
  put(ws, "A17", "Legend", { bold: true });
  put(ws, "B17", "Tick Mark", { bold: true, align: "center", bg: LABEL_FILL });
  put(ws, "C17", "Description", { bold: true, bg: LABEL_FILL, merge: "C17:E17" });
  [["√", "No exceptions have been found"], ["X", "Exceptions have been found"], ["-", "N/A"], ["NT", "Not Tested"]].forEach(([t, d], i) => {
    const r = 18 + i;
    put(ws, `B${r}`, t, { align: "center", bold: true });
    put(ws, `C${r}`, d, { merge: `C${r}:E${r}` });
  });
  boxRange(ws, "B17:E21");

  // ToD details
  const H = 24;
  put(ws, `A${H}`, "ToD details", { bold: true });
  put(ws, `B${H}`, "Change Request", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `B${H}:B${H + 1}` });
  put(ws, `C${H}`, "Control attributes", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `C${H}:E${H}` });
  ["1", "2", "3"].forEach((n, i) => put(ws, `${"CDE"[i]}${H + 1}`, n, { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center" }));
  put(ws, `F${H}`, "ToD Evaluation (PASS/FAIL)", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `F${H}:F${H + 1}` });
  put(ws, `G${H}`, "Testing performed (Mandatory)", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `G${H}:H${H + 1}` });
  put(ws, `I${H}`, "Evidence Reference", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `I${H}:I${H + 1}` });

  SAMPLES.forEach((s, i) => {
    const r = H + 2 + i;
    put(ws, `B${r}`, `TR ${s.tr}\nCR ${s.cr}${s.ticket ? `\n${s.ticket}` : ""}\n${s.type}`, { size: 9 });
    s.attrs.forEach((a, k) => put(ws, `${"CDE"[k]}${r}`, a, { align: "center", bold: true, color: a === "X" ? "FFC00000" : undefined }));
    const pass = s.result === "Pass";
    put(ws, `F${r}`, pass ? "PASS" : "FAIL", { align: "center", bold: true, bg: pass ? PASS_FILL : FAIL_FILL });
    put(ws, `G${r}`, testingPerformed(s) + (s.note && s.result !== "Missing" ? `\nException: ${s.note}.` : ""), { size: 9, merge: `G${r}:H${r}` });
    put(ws, `I${r}`, evidenceRefs(s).split(" | ").join("\n"), { size: 9 });
    ws.getRow(r).height = 76;
  });
  const last = H + 1 + SAMPLES.length;
  boxRange(ws, `B${H}:I${last}`);

  // Conclusion
  const C = last + 3;
  const ineffective = VERDICT !== "Effective";
  const failed = SAMPLES.filter((s) => s.result !== "Pass");
  put(ws, `B${C}`, "Conclusion (PASS/FAIL)", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `B${C}:B${C + 1}` });
  put(ws, `C${C}`, "ToD Evaluation", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `C${C}:E${C}` });
  put(ws, `C${C + 1}`, ineffective ? "FAIL" : "PASS", { bold: true, align: "center", bg: ineffective ? FAIL_FILL : PASS_FILL, merge: `C${C + 1}:E${C + 1}` });
  put(ws, `F${C}`, "Rationale for conclusion (Mandatory)", { bold: true, color: "FFFFFFFF", bg: BLUE, align: "center", merge: `F${C}:I${C}` });
  put(
    ws,
    `F${C + 1}`,
    ineffective
      ? `${SAMPLES.length} samples tested, ${failed.length} exception(s): ${failed.map((s) => `${s.tr} (${s.note})`).join("; ")}. The control is concluded as INEFFECTIVE for the period ${CONTROL.period}.`
      : `${SAMPLES.length} samples tested with no exceptions. The control is concluded as EFFECTIVE for the period ${CONTROL.period}.`,
    { size: 9, merge: `F${C + 1}:I${C + 1}` }
  );
  boxRange(ws, `B${C}:I${C + 1}`);
  ws.getRow(C + 1).height = 58;
}

function evidenceSheet(wb) {
  const ws = wb.addWorksheet("Evidence & Attribute mapping", { views: [{ showGridLines: false }], pageSetup: PAGE });
  ws.columns = [3, 22, 22, 22, 22, 22, 22, 22].map((width) => ({ width }));
  const bar = (r, text, bg, to = "D") => put(ws, `B${r}`, text, { bold: true, color: "FFFFFFFF", bg, merge: `B${r}:${to}${r}`, size: 11 });
  const box = (r, text, h) => {
    put(ws, `B${r}`, text, { merge: `B${r}:H${r}`, size: 10 });
    boxRange(ws, `B${r}:H${r}`);
    ws.getRow(r).height = h;
  };

  let r = 2;
  bar(r, "Control Attributes Assessment", BLUE, "E");
  r += 2;
  SAMPLES.forEach((s, i) => {
    const kind = s.result === "Missing" ? "Not tested" : s.type;
    bar(r, `Sample ${i + 1} - ${kind} (TR ${s.tr} / CR ${s.cr})`, GREEN, "F");
    r += 2;
    bar(r, "Attribute 1 & 2", BLUE, "D");
    r++;
    box(r, `1. ${CONTROL.attributes[0]}\n2. ${CONTROL.attributes[1]}`, 34);
    r += 2;
    bar(r, `Figure ${String.fromCharCode(65 + i * 2)}`, GREEN, "D");
    r++;
    box(
      r,
      s.result === "Missing"
        ? `Not tested. The ticket history PDF for TR ${s.tr} (CR ${s.cr}) was not provided, so the unit testing and UAT evidence could not be inspected. Attributes 1 and 2 are marked NT and the sample is treated as an exception.`
        : `The screenshot below shows the unit testing performed and the UAT task for the ${s.type.toLowerCase()} request ${s.cr}, where the UAT evidence has been attached.\n\nThe tester noted that the Solution Manager (Solman) tracks transport tickets with unique reference numbers. Hence, change ticket ${s.ticket} (on ServiceNow) is mapped to Solman CR number ${s.cr}. This CR number was used in Solman to extract the details for the sampled change as depicted below. IT tester noted from the inspection of the Solman screen shot below that unit testing was performed by ${s.owner} on ${s.unitDate}. IT tester noted that a status of 'T' indicates that relevant testing (Unit testing) has been completed. The tester further noted that the UAT task was assigned to ${s.uatBy} and completed by ${s.uatBy} on ${s.uatDate}.\n\nEvidence: ${evidenceRefs(s)}`,
      150
    );
    r += 2;
    bar(r, "Attribute 3", BLUE, "D");
    r++;
    box(r, `3. ${CONTROL.attributes[2]}`, 34);
    r += 2;
    bar(r, `Figure ${String.fromCharCode(66 + i * 2)}`, GREEN, "D");
    r++;
    box(
      r,
      s.result === "Missing"
        ? "Not tested – no approval or transport evidence provided."
        : `${s.type === "Preapproved change" ? `The tester inspected the Pre-Approved Change List 2025 and noted that CR ${s.cr} is a pre-approved change type; change manager approval was also inspected.` : `The tester inspected the functional owner approval (RE_ Approval ${s.cr}.msg) and the change manager approval (RE_ CM Approval ${s.cr}.msg) and noted both were obtained before the transport was imported into production on ${s.importDate}.`}\n\n${s.owner === s.user ? `EXCEPTION: the tester noted from the E070 / STMS population that transport ${s.tr} was owned by user ${s.owner} and imported into production by the same user ${s.user}. Segregation of duties between development and migration was not met.` : `The tester noted from the E070 / STMS population that transport ${s.tr} was owned by user ${s.owner} and imported into production by user ${s.user}; segregation of duties is maintained.`}`,
      96
    );
    r += 3;
  });
}

export async function downloadChangeWorkpaper({ source, sampleMethod }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agentic Controls Testing";
  wb.created = new Date();
  testSheet(wb, { source, sampleMethod });
  evidenceSheet(wb);
  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `ITGC_1_1_3_TWP_${stamp}.xlsx`);
}
