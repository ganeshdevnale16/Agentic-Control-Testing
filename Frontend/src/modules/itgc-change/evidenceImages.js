// Builds annotated evidence screenshots (PNG data URLs) for each sample with a
// <canvas>. They are mock screens for the demo, one per evidence source:
//   1. SNOW change request   – request details, business justification and back-out plan (A1, A4)
//   2. SNOW change tasks     – planning, development, testing and implementation tasks, and approvals (A2, A3, A4)
//   3. STMS import history   – developer vs implementer of the transport request (A5)
// Each is annotated with the attribute it supports: green = met, red = exception,
// blue = not applicable (reason recorded).
import { approvalsFor, isEmergency, isStd, tasksFor, typeLabel } from "./data/demo";

const W = 1200;
const W_STMS = 1000;
const H_STMS = 300;
const RED = "#DA291C";
const GREEN = "#26890D";
const NA = "#3A6EA5";
const FONT = "Arial, Helvetica, sans-serif";
const TONE = { ok: GREEN, bad: RED, na: NA };
const MARK = { ok: " ✓", bad: " ✗", na: "" };

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function windowFrame(ctx, w, h, title, sub, menu, status) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1F3864";
  ctx.fillRect(0, 0, w, 38);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(title, 16, 24);
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(sub, w - 16, 24);
  ctx.textAlign = "left";
  ctx.fillStyle = "#EEF1F5";
  ctx.fillRect(0, 38, w, 30);
  ctx.fillStyle = "#53565A";
  ctx.font = `12px ${FONT}`;
  ctx.fillText(menu, 16, 58);
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.fillStyle = "#EEF1F5";
  ctx.fillRect(0, h - 26, w, 26);
  ctx.fillStyle = "#53565A";
  ctx.font = `11px ${FONT}`;
  ctx.fillText(`${status}  |  Demo evidence – generated for the testing work paper`, 12, h - 9);
}

function wrap(ctx, text, x, y, maxW, lineH, maxLines = 4) {
  const words = String(text).split(" ");
  let line = "";
  let n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (n === maxLines - 1) {
        ctx.fillText(`${line}…`, x, y + n * lineH);
        return;
      }
      ctx.fillText(line, x, y + n * lineH);
      n++;
      line = words[i];
    } else line = test;
  }
  ctx.fillText(line, x, y + n * lineH);
}

function field(ctx, x, y, label, value, w, labelW = 130) {
  ctx.fillStyle = "#53565A";
  ctx.font = `12px ${FONT}`;
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#F7F8FA";
  ctx.fillRect(x + labelW, y - 15, w, 22);
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(x + labelW + 0.5, y - 14.5, w, 22);
  ctx.fillStyle = "#000";
  ctx.font = `13px ${FONT}`;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + labelW, y - 15, w - 4, 22);
  ctx.clip();
  ctx.fillText(value || "–", x + labelW + 8, y + 1);
  ctx.restore();
}

function textBox(ctx, x, y, w, h, label, text) {
  ctx.fillStyle = "#000";
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(label, x, y - 6);
  ctx.fillStyle = "#F7F8FA";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.fillStyle = "#000";
  ctx.font = `12px ${FONT}`;
  wrap(ctx, text, x + 8, y + 17, w - 16, 16, Math.floor((h - 4) / 16));
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
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx2, ry, c.w - 4, rowH);
      ctx.clip();
      ctx.fillText(String(r[c.key] ?? ""), cx2 + 8, ry + 18);
      ctx.restore();
      cx2 += c.w;
    });
  });
  ctx.strokeStyle = "#C9CED6";
  ctx.strokeRect(x + 0.5, y + 0.5, totalW, rowH * (rows.length + 1));
  return { totalW, rowH, bottom: y + rowH * (rows.length + 1) };
}

// Box around the evidence + numbered callout with a leader line.
// tone: "ok" (attribute met), "bad" (exception), "na" (not applicable)
function annotate(ctx, box, n, text, tone, calloutAt) {
  const color = TONE[tone];
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 6);
  ctx.stroke();
  const [cx, cy] = calloutAt;
  ctx.font = `bold 13px ${FONT}`;
  const label = `${text}${MARK[tone]}`;
  const bw = ctx.measureText(label).width + 44;
  ctx.beginPath();
  if (cx >= box.x + box.w) {
    // callout to the right of the box – leave the box at the callout's height where possible
    ctx.moveTo(box.x + box.w, Math.min(Math.max(cy + 15, box.y + 6), box.y + box.h - 6));
    ctx.lineTo(cx, cy + 15);
  } else {
    ctx.moveTo(box.x + box.w / 2, box.y + (cy > box.y ? box.h : 0));
    ctx.lineTo(cx + bw / 2, cy + (cy > box.y ? 0 : 30));
  }
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
  ctx.fillText(label, cx + 32, cy + 20);
  ctx.lineWidth = 1;
}

// 1. SNOW change request form – A1 (request details, justification) and A4 (back-out plan)
const SNOW_H = 560;
function snowRequestImage(s) {
  const c = canvas(W, SNOW_H);
  const ctx = c.getContext("2d");
  windowFrame(ctx, W, SNOW_H, `ServiceNow – Change Request ${s.chg}`, typeLabel(s), "Update   Follow   Attachments   Related records   Approvals", "ServiceNow (SNOW)");
  const left = [
    ["SNOW change request", s.chg],
    ["Type", s.type],
    ["State", s.state],
    ["Requested by", s.requestedBy],
    ["Requested date", s.requestedOn],
  ];
  const right = [
    ["Assigned to", s.developer],
    ["Assignment group", "SAP AMS – Finance"],
    ["Solman request", s.cr],
    ["Transport request", s.tr],
    ["Catalogue item", isStd(s) ? s.catalogue : "–"],
  ];
  left.forEach(([l, v], i) => field(ctx, 24, 100 + i * 32, l, v, 195, 135));
  right.forEach(([l, v], i) => field(ctx, 364, 100 + i * 32, l, v, 175, 126));
  field(ctx, 24, 268, "Short description", s.short, 506, 135);
  textBox(ctx, 24, 304, 641, 66, "Description / business justification", s.justification);
  textBox(ctx, 24, 400, 641, 38, "Implementation plan", `Import transport request ${s.tr} to CIP client 500 via STMS after approval; post-import check by the functional team.`);
  textBox(ctx, 24, 468, 641, 52, "Back-out (rollback) plan", s.backout);

  annotate(ctx, { x: 16, y: 80, w: 657, h: 162 }, 1, "Request logged – requestor, date, assignee, state", "ok", [700, 120]);
  annotate(ctx, { x: 16, y: 286, w: 657, h: 92 }, 1, isEmergency(s) ? "Justification and emergency reason recorded" : "Business justification recorded", "ok", [700, 300]);
  annotate(ctx, { x: 16, y: 452, w: 657, h: 76 }, 4, "Back-out (rollback) plan documented", "ok", [700, 465]);
  return { dataUrl: c.toDataURL("image/png"), width: W, height: SNOW_H };
}

// 2. SNOW change tasks and approvals – A2 / A3 (testing) and A4 (approval)
function snowTasksImage(s) {
  const tasks = tasksFor(s);
  const approvals = approvalsFor(s);
  const rowH = 28;
  const tasksTop = 106;
  const tasksBottom = tasksTop + rowH * (tasks.length + 1);
  const noteTop = tasksBottom + 12;
  const apprLabel = (s.testNA ? noteTop + 56 : tasksBottom) + 32;
  const apprTop = apprLabel + 10;
  const h = apprTop + rowH * (approvals.length + 1) + 60;

  const c = canvas(W, h);
  const ctx = c.getContext("2d");
  windowFrame(ctx, W, h, `ServiceNow – Change Tasks & Approvals ${s.chg}`, `Solman request ${s.cr} · Transport request ${s.tr}`, "Change tasks   Approvers   Attachments   Activity log", "ServiceNow (SNOW)");
  ctx.fillStyle = "#000";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("Change tasks", 24, 96);
  const cols = [
    { key: "task", label: "Task", w: 290 },
    { key: "by", label: "Assigned to", w: 130 },
    { key: "state", label: "State", w: 95 },
    { key: "on", label: "Closed on", w: 85 },
    { key: "att", label: "Evidence attached", w: 190 },
  ];
  table(ctx, 24, tasksTop, cols, tasks, rowH);
  const testIdx = tasks.map((t, i) => (t.test || t.na ? i : -1)).filter((i) => i >= 0);
  const tTop = tasksTop + rowH * (testIdx[0] + 1);
  const tH = rowH * testIdx.length;

  if (s.testNA) {
    ctx.fillStyle = "#EEF4FB";
    ctx.fillRect(24, noteTop, 790, 44);
    ctx.strokeStyle = "#C9CED6";
    ctx.strokeRect(24.5, noteTop + 0.5, 790, 44);
    ctx.fillStyle = "#000";
    ctx.font = `12px ${FONT}`;
    wrap(ctx, `Reason: ${s.testNA}`, 32, noteTop + 17, 775, 16, 2);
    annotate(ctx, { x: 18, y: tTop - 2, w: 802, h: noteTop + 50 - tTop }, 2, "N/A – testing not required, reason recorded", "na", [845, tTop - 10]);
    annotate(ctx, { x: 627, y: tTop + 1, w: 190, h: tH - 2 }, 3, "N/A – no test evidence required", "na", [845, tTop + 40]);
  } else {
    const t2 = isEmergency(s) ? `Unit test before import; verified ${s.verifyDate}` : `Tested before import (${s.unitDate} / ${s.uatDate})`;
    annotate(ctx, { x: 18, y: tTop - 2, w: 802, h: tH + 4 }, 2, t2, "ok", [845, tTop - 24]);
    annotate(ctx, { x: 627, y: tTop + 1, w: 190, h: tH - 2 }, 3, "Test evidence attached", "ok", [845, tTop + tH - 4]);
  }

  ctx.fillStyle = "#000";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("Approvals", 24, apprLabel);
  table(
    ctx,
    24,
    apprTop,
    [
      { key: "step", label: "Approval step", w: 290 },
      { key: "by", label: "Approver", w: 175 },
      { key: "on", label: "Date", w: 95 },
      { key: "status", label: "Status", w: 90 },
      { key: "timing", label: "Timing", w: 140 },
    ],
    approvals,
    rowH
  );
  const t4 = isEmergency(s) ? `ECAB before import; CAB review ${s.retroDate}` : `Approved ${s.apprDate}, before import ${s.importDate}`;
  annotate(ctx, { x: 18, y: apprTop + rowH - 2, w: 802, h: rowH * approvals.length + 4 }, 4, t4, "ok", [845, apprTop + rowH + 6]);
  return { dataUrl: c.toDataURL("image/png"), width: W, height: h };
}

// 3. STMS import history – A5 (developer vs implementer)
function stmsImage(s) {
  const c = canvas(W_STMS, H_STMS);
  const ctx = c.getContext("2d");
  windowFrame(ctx, W_STMS, H_STMS, "STMS – Import History: CIP", `Transport request ${s.tr}`, "Display   Edit   Goto   Extras   System   Help", "CIP (1) 500");
  ctx.fillStyle = "#000";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("Import history for system CIP, client 500 (filtered on transport request)", 24, 98);
  table(
    ctx,
    24,
    112,
    [
      { key: "tr", label: "Transport request", w: 140 },
      { key: "desc", label: "Short text", w: 270 },
      { key: "owner", label: "Owner (developer)", w: 145 },
      { key: "user", label: "Import user (implementer)", w: 190 },
      { key: "date", label: "Date", w: 90 },
      { key: "rc", label: "RC", w: 50 },
    ],
    [{ tr: s.tr, desc: `${s.cr} ${s.short}`, owner: s.developer, user: s.implementer, date: s.importDate, rc: "0" }],
    32
  );
  const ok = s.developer !== s.implementer;
  annotate(
    ctx,
    { x: 430, y: 140, w: 345, h: 40 },
    5,
    ok ? `Developer ${s.developer} ≠ implementer ${s.implementer}` : `SoD conflict: developer ${s.developer} = implementer ${s.implementer}`,
    ok ? "ok" : "bad",
    [300, 205]
  );
  ctx.fillStyle = "#53565A";
  ctx.font = `12px ${FONT}`;
  ctx.fillText("Return code 0 – transport request imported successfully into production.", 24, 258);
  return { dataUrl: c.toDataURL("image/png"), width: W_STMS, height: H_STMS };
}

// Returns [{ title, caption, dataUrl, width, height }] for a sample
export function evidenceImagesFor(s) {
  if (s.result === "Missing") return [];
  return [
    { title: `Figure – SNOW change request ${s.chg}`, caption: "Attribute 1: request details and business justification · Attribute 4: back-out plan", ...snowRequestImage(s) },
    { title: `Figure – SNOW change tasks and approvals ${s.chg}`, caption: "Attributes 2–4: planning, development, testing and implementation tasks; approvals", ...snowTasksImage(s) },
    { title: `Figure – STMS import history ${s.tr}`, caption: "Attribute 5: segregation of duties (developer vs implementer)", ...stmsImage(s) },
  ];
}
