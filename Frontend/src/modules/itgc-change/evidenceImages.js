// Builds annotated evidence screenshots (PNG data URLs) for each sample with a
// <canvas>. They are mock screens for the demo: a Solman change request with the
// testing / approval tasks, and the STMS import history for the transport, each
// annotated with the attribute it supports.
import { isPre } from "./data/demo";

const W = 1000;
const H = 540;
const H_STMS = 300;
const RED = "#DA291C";
const GREEN = "#26890D";
const FONT = "Arial, Helvetica, sans-serif";

function windowFrame(ctx, title, sub, h = H) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = "#1F3864";
  ctx.fillRect(0, 0, W, 38);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(title, 16, 24);
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(sub, W - 16, 24);
  ctx.textAlign = "left";
  ctx.fillStyle = "#EEF1F5";
  ctx.fillRect(0, 38, W, 30);
  ctx.fillStyle = "#53565A";
  ctx.font = `12px ${FONT}`;
  ctx.fillText("Display   Edit   Goto   Extras   System   Help", 16, 58);
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(0.5, 0.5, W - 1, h - 1);
  // status bar
  ctx.fillStyle = "#EEF1F5";
  ctx.fillRect(0, h - 26, W, 26);
  ctx.fillStyle = "#53565A";
  ctx.font = `11px ${FONT}`;
  ctx.fillText("CIP (1) 500  |  Demo evidence – generated for the testing work paper", 12, h - 9);
}

function field(ctx, x, y, label, value, w = 300) {
  ctx.fillStyle = "#53565A";
  ctx.font = `12px ${FONT}`;
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#F7F8FA";
  ctx.fillRect(x + 130, y - 15, w, 22);
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(x + 130.5, y - 14.5, w, 22);
  ctx.fillStyle = "#000";
  ctx.font = `13px ${FONT}`;
  ctx.fillText(value, x + 138, y + 1);
}

function table(ctx, x, y, cols, rows, rowH = 28) {
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  ctx.fillStyle = "#DCE3EC";
  ctx.fillRect(x, y, totalW, rowH);
  ctx.fillStyle = "#000";
  ctx.font = `bold 12px ${FONT}`;
  let cx = x;
  cols.forEach((c) => {
    ctx.fillText(c.label, cx + 8, y + 18);
    cx += c.w;
  });
  rows.forEach((r, i) => {
    const ry = y + rowH * (i + 1);
    ctx.fillStyle = i % 2 ? "#F7F8FA" : "#fff";
    ctx.fillRect(x, ry, totalW, rowH);
    ctx.fillStyle = "#000";
    ctx.font = `12px ${FONT}`;
    let cx2 = x;
    cols.forEach((c) => {
      ctx.fillText(String(r[c.key] ?? ""), cx2 + 8, ry + 18);
      cx2 += c.w;
    });
  });
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(x + 0.5, y + 0.5, totalW, rowH * (rows.length + 1));
  return { totalW, rowH };
}

function annotate(ctx, box, n, text, ok, calloutAt) {
  const color = ok ? GREEN : RED;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 6);
  ctx.stroke();
  // callout
  const [cx, cy] = calloutAt;
  ctx.font = `bold 13px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const bw = tw + 52;
  ctx.beginPath();
  ctx.moveTo(box.x + box.w / 2, box.y + (cy > box.y ? box.h : 0));
  ctx.lineTo(cx + bw / 2, cy + (cy > box.y ? 0 : 30));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx, cy, bw, 30, 15);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx + 15, cy + 15, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(String(n), cx + 15, cy + 19);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(`${text} ${ok ? "✓" : "✗"}`, cx + 32, cy + 20);
  ctx.lineWidth = 1;
}

function canvas(h = H) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = h;
  return c;
}

function solmanImage(s) {
  const c = canvas();
  const ctx = c.getContext("2d");
  windowFrame(ctx, `SAP Solution Manager – Change Request ${s.cr}`, `ServiceNow ${s.ticket}`);
  field(ctx, 24, 100, "Change request", s.cr, 180);
  field(ctx, 24, 132, "Change type", s.type, 180);
  field(ctx, 520, 100, "ServiceNow ticket", s.ticket, 180);
  field(ctx, 520, 132, "Transport", s.tr, 180);

  ctx.fillStyle = "#000";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("Testing tasks", 24, 182);
  table(
    ctx,
    24,
    192,
    [
      { key: "task", label: "Task", w: 230 },
      { key: "status", label: "Status", w: 90 },
      { key: "by", label: "Performed by", w: 140 },
      { key: "on", label: "Completed on", w: 130 },
      { key: "att", label: "Attachment", w: 200 },
    ],
    [
      { task: "Unit testing", status: "T", by: s.owner, on: s.unitDate, att: `UnitTest_${s.tr}.pdf` },
      { task: "User acceptance testing (UAT)", status: "Completed", by: s.uatBy, on: s.uatDate, att: `UAT_Evidence_${s.cr}.pdf` },
    ]
  );

  ctx.fillStyle = "#000";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("Approvals", 24, 312);
  const approvals = isPre(s)
    ? [
        { step: "Pre-approved change list 2025", by: "Change Manager", on: "01.01.2025", st: "Listed" },
        { step: "Change manager approval", by: "CM Office", on: s.apprDate, st: "Approved" },
      ]
    : [
        { step: "Functional owner approval", by: "Functional Owner", on: s.apprDate, st: "Approved" },
        { step: "Change manager approval", by: "CM Office", on: s.apprDate, st: "Approved" },
      ];
  table(
    ctx,
    24,
    322,
    [
      { key: "step", label: "Approval step", w: 300 },
      { key: "by", label: "Approver", w: 200 },
      { key: "on", label: "Date", w: 130 },
      { key: "st", label: "Status", w: 160 },
    ],
    approvals
  );
  field(ctx, 24, 444, "Imported to PRD", s.importDate, 180);

  annotate(ctx, { x: 18, y: 214, w: 802, h: 62 }, 1, `Tested before import (${s.unitDate} / ${s.uatDate})`, true, [560, 140]);
  annotate(ctx, { x: 650, y: 214, w: 176, h: 62 }, 2, "Evidence retained in Solman", true, [600, 290]);
  annotate(ctx, { x: 18, y: 344, w: 802, h: 62 }, 3, `Approved ${s.apprDate}, before import ${s.importDate}`, true, [420, 470]);
  return c.toDataURL("image/png");
}

function stmsImage(s) {
  const c = canvas(H_STMS);
  const ctx = c.getContext("2d");
  windowFrame(ctx, "STMS – Import History: CIP", `Transport ${s.tr}`, H_STMS);
  ctx.fillStyle = "#000";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("Import history for system CIP, client 500 (filtered on transport)", 24, 98);
  table(
    ctx,
    24,
    112,
    [
      { key: "tr", label: "Request", w: 130 },
      { key: "desc", label: "Short text", w: 300 },
      { key: "owner", label: "Owner", w: 110 },
      { key: "user", label: "Import user", w: 120 },
      { key: "date", label: "Date", w: 110 },
      { key: "rc", label: "RC", w: 60 },
    ],
    [
      { tr: s.tr, desc: `CR ${s.cr} ${s.type}`, owner: s.owner, user: s.user, date: s.importDate, rc: "0" },
    ],
    32
  );
  const sod = s.owner !== s.user;
  annotate(
    ctx,
    { x: 450, y: 140, w: 240, h: 40 },
    4,
    sod ? `Owner ${s.owner} ≠ import user ${s.user}` : `SoD: owner ${s.owner} = import user ${s.user}`,
    sod,
    [330, 205]
  );
  ctx.fillStyle = "#53565A";
  ctx.font = `12px ${FONT}`;
  ctx.fillText("Return code 0 – transport imported successfully into production.", 24, 255);
  return c.toDataURL("image/png");
}

// Returns [{ title, caption, dataUrl, width, height }] for a sample
export function evidenceImagesFor(s) {
  if (s.result === "Missing") return [];
  return [
    { title: `Figure – Solman CR ${s.cr}`, caption: "Attributes 1–3: testing, evidence retention and approval", dataUrl: solmanImage(s), width: W, height: H },
    { title: `Figure – STMS import history ${s.tr}`, caption: "Attribute 4: segregation of duties", dataUrl: stmsImage(s), width: W, height: H_STMS },
  ];
}
