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
  table(wb, rcm.labels?.consistencySheet || "Walkthrough vs SOP", [["check", "Check", 30], ["result", "Result", 12], ["detail", "Detail", 80]], rcm.consistency, ["result"]);
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
    ["Source documents", [[rcm.labels?.doc || "SOP", `${sop.name} (${sop.docId} v${sop.version}, approved ${fmtDate(sop.approvalDate)})`], ["Design conclusion", rcm.designConclusion, true], ["Design gaps", String(rcm.gaps.length)]]],
  ]);
  rcmSheets(wb, rcm);
  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `RCM_${rcm.control.id}_${stamp()}.xlsx`);
}

// ── Test-of-design workpaper (WP-<control>-TOD) ───────────────────────────
const RES = { pass: ["FFE3F1CC", "FF26890D"], deficiency: ["FFFDE2DF", "FFC00000"], partial: ["FFFFF1D6", "FF9A3412"], "not tested": ["FFF2F2F2", "FF53565A"] };
const resCell = (cell) => {
  const c = RES[String(cell.value ?? "").toLowerCase()];
  if (!c) return;
  cell.fill = FILL(c[0]);
  cell.font = { bold: true, color: { argb: c[1] } };
};
const headRow = (row) =>
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = FILL("FF000000");
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = BORDER;
  });
const titleRows = (ws, title, sub) => {
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([sub || ""]).font = { italic: true, color: { argb: "FF53565A" } };
  ws.addRow([]);
};
function grid(ws, widths, header, rows, { resultCol, heights = 15 } = {}) {
  ws.columns = widths.map((w) => ({ width: w }));
  headRow(ws.addRow(header));
  rows.forEach((r) => {
    const row = ws.addRow(r);
    let max = 1;
    row.eachCell({ includeEmpty: true }, (c, i) => {
      c.alignment = { vertical: "top", wrapText: true };
      c.border = BORDER;
      max = Math.max(max, lines(c.value, widths[i - 1] || 12));
    });
    row.height = Math.min(320, Math.max(18, max * heights));
    if (resultCol) resCell(row.getCell(resultCol));
  });
  return ws;
}
const ownerName = (o) => {
  const m = String(o).match(/^(.*?)\s[-–]\s(.*)$/);
  return m ? `${m[2]}, ${m[1]}` : o;
};

export async function downloadWorkpaper(result) {
  const { summary, control, rcm, meta, results, annotations, observations, trace, reviewNotes } = result;
  const ref = meta.reference;
  const L = result.labels || {};
  const sampleRef = L.sampleRef || (meta.sample.match(/VCR-[\d-]+/) || [meta.sample])[0];
  const today = fmtDate(new Date());
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agentic Controls Testing";
  wb.created = new Date();

  // annotated copies of the evidence (browser canvas); skipped if unavailable
  let annotated = [];
  try {
    const { buildAnnotatedEvidence } = await import("./annotate");
    annotated = await buildAnnotatedEvidence(result.sources, annotations);
  } catch (e) {
    console.warn("annotated evidence skipped", e);
  }
  const annotatedRow = {};

  // 1. Cover
  const cover = wb.addWorksheet("Cover", { properties: { tabColor: { argb: "FF86BC25" } } });
  cover.columns = [{ width: 24 }, { width: 110 }];
  cover.addRow([`${meta.company} - Design Testing Workpaper ${ref}`]).font = { bold: true, size: 14 };
  cover.addRow([]);
  const codes = meta.inputs.map((i) => i.code).sort();
  const version = rcm.wt?.meta?.version || "";
  [
    ["Workpaper ref", ref],
    ["Engagement", `Internal Audit - ICFR design assessment${version ? ` ${version}` : ""}`],
    ["Process / sub-process", `${control.process} / ${control.subProcess}`],
    ["Control ID", L.controlName || `${control.id} - Vendor bank-detail change control`],
    ["Risk", `${control.riskId}: ${control.riskDesc}`],
    ["Control owner", ownerName(control.owner)],
    ["Objective", L.objective || `Assess whether ${control.id}, as designed, prevents or timely detects unauthorised vendor bank-detail changes before payment.`],
    ["Scope", `Design only (test of one walkthrough sample ${sampleRef}). Operating effectiveness not tested.`],
    ["Evidence inputs", `${codes[0]} to ${codes[codes.length - 1]} (see 'Annotation Index'; annotated copies in folder Annotated_Evidence)`],
    ["Walkthrough date", fmtDate(meta.walkthroughDate)],
    ["Prepared by", `DT-Agent (Assessment agent) - ${today}`],
    ["First-level review", `DT-Agent (Reviewer agent) - ${today}`],
    ["Human review", "Pending - see 'Review & Sign-off'"],
    ["Design conclusion", summary.designConclusion],
    ["Summary", `${summary.headline} ${summary.deficiency}`.trim()],
  ].forEach(([k, v]) => {
    const r = cover.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.eachCell((c) => {
      c.border = BORDER;
      c.alignment = { vertical: "top", wrapText: true };
    });
    r.height = Math.max(18, lines(v, 110) * 15);
    if (k === "Design conclusion") {
      r.getCell(2).font = { bold: true, color: { argb: summary.designEffective ? "FF26890D" : "FFC00000" } };
      r.getCell(2).fill = FILL(summary.designEffective ? "FFE3F1CC" : "FFFDE2DF");
    }
  });

  // 2. Legend
  const lg = wb.addWorksheet("Legend");
  titleRows(lg, "Tick marks and annotation legend");
  lg.spliceRows(2, 1);
  grid(lg, [26, 90], ["Symbol / colour", "Meaning"], [
    ["Green highlight / tag", "Attribute result: Pass"],
    ["Red highlight / tag", "Attribute result: Deficiency"],
    ["Amber highlight / tag", "Attribute result: Partial"],
    ["A{n}-{k}", "Annotation k supporting attribute A{n}; same ID appears on the annotated evidence, in 'Annotation Index' and in 'ToD Testing'"],
    ["✓", "Agreed to source without exception"],
    ["✗", "Exception / design gap noted"],
    ["◐", "Partially meets criterion"],
    ["T", `Corroborated in walkthrough ${L.walkthrough || "transcript"} (${meta.inputs.find((i) => /transcript|walkthrough/i.test(i.name))?.code || "walkthrough"})`],
  ]);
  [4, 5, 6].forEach((r, i) => (lg.getCell(`A${r}`).fill = FILL(["FFE3F1CC", "FFFDE2DF", "FFFFF1D6"][i])));

  // 3. ToD Testing
  const tod = wb.addWorksheet("ToD Testing");
  titleRows(tod, `${ref} - Test of design by attribute`, `Sample: ${meta.sample.replace(/\s*\(([^,]+), vendor (\d+)\)/, " ($1, vendor $2)")}`);
  grid(tod, [7, 22, 34, 44, 34, 70, 12, 10], ["Attr", "Attribute", "Design criterion", "Procedure performed", "Evidence / annotation refs", "Observation", "Result", "Tick mark"],
    results.map((r) => [r.attr.id, r.attr.label, r.attr.criterion, r.attr.procedure, r.annotations.map((a) => `${a.ref} (${a.code})`).join("; ") || "–", r.observation, r.status, r.tick]),
    { resultCol: 7 });
  tod.views = [{ state: "frozen", ySplit: 4 }];

  // 4. Walkthrough Trace
  const wtr = wb.addWorksheet("Walkthrough Trace");
  titleRows(wtr, `${ref} - Walkthrough trace of ${sampleRef}`, `Each step traced from ${L.doc || "SOP"} to evidence and ${L.walkthrough || "transcript"}`);
  grid(wtr, [6, 12, 36, 60, 22, 24, 40], ["Step", `${L.doc || "SOP"} ref`, "Designed step", "Evidence observed", L.walkthrough === "note" ? "Walkthrough note" : "Transcript", "Performed as designed?", "Annotation / note"],
    trace.map((t) => [t.step, t.sopRef, t.designed, t.observed, t.transcript, t.performed, t.note]));

  // rows where each annotated image will sit (sheet is added after the template sheets)
  const imgH = (img) => Math.round((img.height / img.width) * Math.min(860, img.width));
  let row = 4;
  annotated.forEach((img) => {
    img.refs.forEach((r) => (annotatedRow[r] = annotatedRow[r] || row));
    row += Math.ceil(imgH(img) / 20) + 3;
  });

  // 5. Annotation Index
  const idx = wb.addWorksheet("Annotation Index");
  titleRows(idx, `${ref} - Annotation index`, "Click the file name to open the annotated evidence (keep the Annotated_Evidence folder beside this workpaper)");
  grid(idx, [8, 26, 12, 9, 50, 28, 34, 60, 14], ["Ref", "Attribute", "Result", "Evidence", "Annotated file", "Location", "Highlighted text / cells", "Annotation", "In workpaper"],
    annotations.map((a) => {
      const r = results.find((x) => x.attr.id === a.attr);
      return [a.ref, `${a.attr} ${r?.attr.label || ""}`, a.result, a.code, a.file.replace(/(\.[a-z]+)$/i, "_ANNOTATED$1"), a.location, a.highlight, a.note, ""];
    }),
    { resultCol: 3 });
  const link = { color: { argb: "FF0563C1" }, underline: true };
  idx.eachRow((r, i) => {
    if (i < 5) return;
    const file = r.getCell(5);
    file.value = { text: String(file.value), hyperlink: `Annotated_Evidence/${file.value}` };
    file.font = link;
    const target = annotatedRow[r.getCell(1).value];
    if (target) {
      const v = r.getCell(9);
      v.value = { text: "View image", hyperlink: `#'Annotated Evidence'!A${target}` };
      v.font = link;
    }
  });

  // 6. Observations
  const ob = wb.addWorksheet("Observations");
  titleRows(ob, `${ref} - Design observations (draft for management response)`);
  ob.spliceRows(2, 1);
  grid(ob, [6, 9, 30, 60, 40, 60, 22, 26, 18], ["Obs", "Attr", "Title", "Condition", "Risk / effect", "Recommendation", "Annotation refs", "Management response", "Owner / due date"],
    observations.map((o) => [o.id, o.attrText, o.title, o.condition, o.effect, o.recommendation, o.refs, "", ""]));

  // 7. Review & Sign-off
  const rv = wb.addWorksheet("Review & Sign-off");
  titleRows(rv, `${ref} - Review notes and sign-off`);
  rv.spliceRows(2, 1);
  grid(rv, [8, 18, 56, 70, 10], ["Ref", "Raised by", "Review point", "Response", "Status"], reviewNotes.map((n) => [n.ref, n.by, n.point, n.response, n.status]));
  rv.addRow([]);
  ["Human reviewer name", "Review date", "Conclusion accepted? (Yes / Override)", "Severity confirmed", "Override rationale"].forEach((k) => {
    const r = rv.addRow(["", k, ""]);
    r.getCell(2).font = { bold: true };
    [2, 3].forEach((i) => (r.getCell(i).border = BORDER));
  });

  // 8. Annotated evidence
  const aev2 = wb.addWorksheet("Annotated Evidence");
  aev2.columns = Array.from({ length: 12 }, () => ({ width: 12 }));
  aev2.addRow([`${ref} - Annotated evidence`]).font = { bold: true, size: 14 };
  aev2.addRow([annotated.length ? "Highlights and tags A{n}-{k} drawn on the source documents; colour = attribute result." : "Annotated copies could not be generated in this environment – see 'Annotation Index' for locations."]).font = { italic: true, color: { argb: "FF53565A" } };
  row = 4;
  annotated.forEach((img) => {
    aev2.getCell(`A${row}`).value = `${img.code} – ${img.title}  ·  ${img.refs.join(", ")}`;
    aev2.getCell(`A${row}`).font = { bold: true };
    const id = wb.addImage({ base64: img.dataUrl, extension: "png" });
    aev2.addImage(id, { tl: { col: 0, row }, ext: { width: Math.min(860, img.width), height: imgH(img) } });
    row += Math.ceil(imgH(img) / 20) + 3;
  });

  // supporting sheets
  rcmSheets(wb, rcm);
  table(wb, "Evidence Inputs", [["code", "Ref", 9], ["name", "File", 60]], meta.inputs);
  table(
    wb,
    "Processing Log",
    [["time", "Time", 12], ["text", "Activity", 110]],
    [...(result.rcmLog || []), ...(result.log || [])].map((l) => ({ time: l.time.toLocaleTimeString([], { hour12: false }), text: l.text }))
  );
  // Workpaper + Annotated_Evidence folder, zipped together so the links in 'Annotation Index' work
  const xlsx = await wb.xlsx.writeBuffer();
  const name = `${ref}_Design_Test_Workpaper`;
  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(`${name}.xlsx`, xlsx);
    const folder = zip.folder("Annotated_Evidence");
    const { ANNOTATED_FILES } = await import("./data/constants");
    await Promise.all(
      ANNOTATED_FILES.map(async (f) => {
        const res = await fetch(`${import.meta.env.BASE_URL}demo/nfs/Annotated_Evidence/${f}`);
        if (res.ok) folder.file(f, await res.arrayBuffer());
      })
    );
    saveAs(await zip.generateAsync({ type: "blob" }), `${name}_${stamp()}.zip`);
  } catch (e) {
    console.warn("zip failed – downloading the workpaper only", e);
    saveAs(new Blob([xlsx]), `${name}_${stamp()}.xlsx`);
  }
}
