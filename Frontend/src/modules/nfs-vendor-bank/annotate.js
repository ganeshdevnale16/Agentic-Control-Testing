// Annotated copies of the evidence for the workpaper: each annotation A{n}-{k}
// is drawn on the source – a highlight box on the PDF page text, or on the Excel
// cells – with its tag, coloured by the attribute result.
const TONE = { Pass: "#26890D", Deficiency: "#DA291C", Partial: "#ED8B00", "Not tested": "#53565A" };
const FILL = { Pass: "rgba(134,188,37,0.28)", Deficiency: "rgba(218,41,28,0.20)", Partial: "rgba(237,139,0,0.25)", "Not tested": "rgba(83,86,90,0.15)" };
const norm = (s) => String(s ?? "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLowerCase();

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function tag(ctx, x, y, text, color) {
  ctx.font = "bold 13px Arial";
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y - 18, w, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + 6, y - 3);
  return w;
}

// Rectangles (viewport coords) covering `quote` on one PDF page
const measurer = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
const frac = (str, n, size) => {
  if (!measurer || !str.length) return n / Math.max(1, str.length);
  measurer.font = `${Math.max(6, size)}px Arial`;
  const full = measurer.measureText(str).width || 1;
  return measurer.measureText(str.slice(0, n)).width / full;
};

function findRects(items, viewport, quote) {
  let text = "";
  const map = [];
  items.forEach((it, i) => {
    for (let k = 0; k < it.str.length; k++) {
      text += it.str[k];
      map.push({ i, k });
    }
    text += " ";
    map.push({ i, k: -1 });
  });
  // normalised search keeping an index map
  const chars = [];
  const back = [];
  let prevSpace = false;
  for (let p = 0; p < text.length; p++) {
    const c = text[p] === "’" || text[p] === "‘" ? "'" : text[p];
    const sp = /\s/.test(c);
    if (sp && prevSpace) continue;
    chars.push(sp ? " " : c.toLowerCase());
    back.push(p);
    prevSpace = sp;
  }
  const hay = chars.join("");
  const at = hay.indexOf(norm(quote).trim());
  if (at < 0) return [];
  const start = back[at];
  const end = back[at + norm(quote).trim().length - 1];
  const byItem = new Map();
  for (let p = start; p <= end; p++) {
    const m = map[p];
    if (!m || m.k < 0) continue;
    const r = byItem.get(m.i) || { a: m.k, b: m.k };
    r.a = Math.min(r.a, m.k);
    r.b = Math.max(r.b, m.k);
    byItem.set(m.i, r);
  }
  const rects = [];
  for (const [i, r] of byItem) {
    const it = items[i];
    const [, , , d, x, y] = it.transform;
    const h = Math.abs(d) || it.height || 10;
    const x0 = x + it.width * frac(it.str, r.a, h);
    const x1 = x + it.width * frac(it.str, r.b + 1, h);
    const [vx0, vy0, vx1, vy1] = viewport.convertToViewportRectangle([x0, y - h * 0.25, x1, y + h * 0.95]);
    rects.push({ x: Math.min(vx0, vx1), y: Math.min(vy0, vy1), w: Math.abs(vx1 - vx0), h: Math.abs(vy1 - vy0) });
  }
  return rects;
}

async function pdfPages(file, anns) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [...new Set(anns.map((a) => +(a.location.match(/Page (\d+)/) || [])[1] || 1))].sort();
  const out = [];
  for (const p of pages) {
    if (p > doc.numPages) continue;
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const items = (await page.getTextContent()).items.filter((i) => i.str !== undefined);
    // find every highlight first, then place tags top-to-bottom so they stay in order
    const marks = anns
      .filter((x) => (+(x.location.match(/Page (\d+)/) || [])[1] || 1) === p)
      .map((a) => ({ a, rects: findRects(items, viewport, a.highlight) }))
      .filter((m) => m.rects.length)
      .map((m) => ({ ...m, last: m.rects.reduce((q, r) => (r.y > q.y || (r.y === q.y && r.x + r.w > q.x + q.w) ? r : q), m.rects[0]) }))
      .sort((m, n) => m.last.y - n.last.y || m.last.x - n.last.x);
    let prevTy = -Infinity;
    for (const { a, rects, last } of marks) {
      const tone = TONE[a.result] || TONE.Pass;
      ctx.fillStyle = FILL[a.result] || FILL.Pass;
      ctx.strokeStyle = tone;
      ctx.lineWidth = 2;
      rects.forEach((r) => {
        ctx.fillRect(r.x - 2, r.y - 1, r.w + 4, r.h + 2);
        ctx.strokeRect(r.x - 2, r.y - 1, r.w + 4, r.h + 2);
      });
      const tx = canvas.width - 74;
      const ty = Math.max(last.y + last.h / 2 + 9, prevTy + 21);
      prevTy = ty;
      // dashed leader along the gap under the text line, out to the margin tag
      const ly = last.y + last.h + 1.5;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(last.x + last.w + 2, ly);
      ctx.lineTo(tx - 6, ly);
      ctx.lineTo(tx - 2, ty - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      tag(ctx, tx, ty, a.ref, tone);
    }
    out.push({ page: p, dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
  }
  return out;
}

const colNum = (l) => l.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const colLetter = (i) => String.fromCharCode(65 + i);
function parseRange(loc) {
  const m = String(loc).match(/'([^']+)'!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/);
  if (!m) return null;
  return { sheet: m[1], c0: colNum(m[2]), r0: +m[3], c1: colNum(m[4] || m[2]), r1: +(m[5] || m[3]) };
}

function sheetImage(sheet, anns) {
  const ranges = anns.map((a) => ({ a, rg: parseRange(a.location) })).filter((x) => x.rg);
  const aoa = sheet.aoa;
  const lastRow = Math.min(aoa.length, Math.max(...ranges.map((x) => x.rg.r1)) + 2, 24);
  const nCols = Math.min(Math.max(...aoa.slice(0, lastRow).map((r) => r.length), ...ranges.map((x) => x.rg.c1 + 1)), 11);
  const canvas = document.createElement("canvas");
  const ctx0 = canvas.getContext("2d");
  ctx0.font = "12px Arial";
  const widths = Array.from({ length: nCols }, (_, c) =>
    Math.min(260, Math.max(70, ...aoa.slice(0, lastRow).map((r, ri) => (ri < 3 && c === 0 ? 0 : ctx0.measureText(String(r[c] ?? "")).width + 14))))
  );
  const RH = 24;
  const LW = 36;
  const W = LW + widths.reduce((a, b) => a + b, 0) + 90;
  const H = RH * (lastRow + 1) + 30;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const xOf = (c) => LW + widths.slice(0, c).reduce((a, b) => a + b, 0);
  // headers
  ctx.fillStyle = "#EEF1F5";
  ctx.fillRect(0, 0, W, RH);
  ctx.fillRect(0, 0, LW, H);
  ctx.fillStyle = "#53565A";
  ctx.font = "bold 11px Arial";
  for (let c = 0; c < nCols; c++) ctx.fillText(colLetter(c), xOf(c) + widths[c] / 2 - 4, 16);
  for (let r = 1; r <= lastRow; r++) ctx.fillText(String(r), 8, RH * r + 16);
  // cells
  ctx.font = "12px Arial";
  for (let r = 1; r <= lastRow; r++) {
    const row = aoa[r - 1] || [];
    const filled = row.slice(0, nCols).filter((v) => String(v ?? "").trim()).length;
    if (filled === 1 && String(row[0] ?? "").trim()) {
      // title line: one wide cell
      ctx.strokeStyle = "#D9DEE5";
      ctx.strokeRect(LW + 0.5, RH * r + 0.5, xOf(nCols) - LW, RH);
      ctx.fillStyle = "#000";
      ctx.font = r === 1 ? "bold 12px Arial" : "12px Arial";
      ctx.fillText(String(row[0]), LW + 6, RH * r + 16);
      ctx.font = "12px Arial";
      continue;
    }
    for (let c = 0; c < nCols; c++) {
      ctx.strokeStyle = "#D9DEE5";
      ctx.strokeRect(xOf(c) + 0.5, RH * r + 0.5, widths[c], RH);
      const v = String(row[c] ?? "");
      if (!v) continue;
      ctx.fillStyle = "#000";
      ctx.save();
      ctx.beginPath();
      ctx.rect(xOf(c), RH * r, widths[c], RH);
      ctx.clip();
      ctx.fillText(v, xOf(c) + 6, RH * r + 16);
      ctx.restore();
    }
  }
  // highlights + tags
  ranges.forEach(({ a, rg }) => {
    const x = xOf(rg.c0);
    const y = RH * rg.r0;
    const w = xOf(rg.c1 + 1) - x;
    const h = RH * (rg.r1 - rg.r0 + 1);
    ctx.fillStyle = FILL[a.result] || FILL.Pass;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = TONE[a.result] || TONE.Pass;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    const tx = xOf(nCols) + 12;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x + w, y + h / 2);
    ctx.lineTo(tx - 2, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    tag(ctx, tx, y + 18, a.ref, TONE[a.result] || TONE.Pass);
  });
  return { dataUrl: canvas.toDataURL("image/png"), width: W, height: H };
}

// sources: { [fileName]: { file, doc } } ; annotations: [{ ref, file, location, highlight, result }]
// returns [{ file, code, title, dataUrl, width, height, refs }]
export async function buildAnnotatedEvidence(sources, annotations) {
  const out = [];
  const byFile = new Map();
  annotations.forEach((a) => byFile.set(a.file, [...(byFile.get(a.file) || []), a]));
  for (const [name, anns] of byFile) {
    const src = sources?.[name];
    if (!src) continue;
    try {
      if (/\.pdf$/i.test(name)) {
        const pages = await pdfPages(src.file, anns);
        pages.forEach((p) => out.push({ file: name, code: anns[0].code, title: `${name} – page ${p.page}`, ...p, refs: anns.filter((a) => (+(a.location.match(/Page (\d+)/) || [])[1] || 1) === p.page).map((a) => a.ref) }));
      } else if (src.doc?.kind === "sheets") {
        const sheets = [...new Set(anns.map((a) => parseRange(a.location)?.sheet).filter(Boolean))];
        sheets.forEach((sn) => {
          const sheet = src.doc.sheets.find((s) => s.name === sn);
          if (!sheet) return;
          const these = anns.filter((a) => parseRange(a.location)?.sheet === sn);
          out.push({ file: name, code: anns[0].code, title: `${name} – ${sn}`, ...sheetImage(sheet, these), refs: these.map((a) => a.ref) });
        });
      }
    } catch (e) {
      console.warn("annotation failed", name, e);
    }
  }
  const order = (c) => c.code;
  return out.sort((a, b) => order(a).localeCompare(order(b)));
}
