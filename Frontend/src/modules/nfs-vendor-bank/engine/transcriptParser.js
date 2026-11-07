import { clean, parseDate } from "./util";

const norm = (s) => clean(String(s ?? "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"')).toLowerCase();

// Walkthrough transcript: "[hh:mm:ss] Speaker (Role): statement" lines across pages.
// Keeps page numbers so quotes can be referenced as annotations.
export function parseTranscript(text, name) {
  const raw = String(text || "");
  // page markers ("… Page 2") appear once per page in the extracted text
  const markers = [...raw.matchAll(/Page (\d+)\s*$/gm)].map((m) => ({ at: m.index, page: +m[1] }));
  const pageAt = (idx) => markers.filter((m) => m.at <= idx).pop()?.page || 1;

  const lines = [];
  const re = /\[(\d{2}:\d{2}:\d{2})\]\s*([^:\n]+?)(?:\s*\(([^)]+)\))?:\s*([\s\S]*?)(?=\n\[\d{2}:\d{2}:\d{2}\]|\nDUMMY DATA|$)/g;
  for (const m of raw.matchAll(re)) {
    lines.push({ time: m[1], speaker: clean(m[2]), role: clean(m[3] || ""), text: clean(m[4].replace(/\n.*\|\s*.*Page \d+\s*$/gm, "")), page: pageAt(m.index) });
  }
  const dateLine = (raw.match(/walkthrough date\s*:?\s*(\d{1,2}-[A-Za-z]{3}-\d{4})/i) || [])[1];
  const sample = clean((raw.match(/sample traced\s*:?\s*(.+)/i) || [])[1] || "");
  const participants = clean((raw.match(/participants\s*:?\s*([\s\S]+?)\nRecorded by/i) || [])[1] || "");

  // Find a quote; returns the line and page it is on
  const find = (quote) => {
    const q = norm(quote);
    const l = lines.find((x) => norm(x.text).includes(q));
    return l ? { ...l, quote } : null;
  };
  const by = (speakerRe) => lines.filter((l) => speakerRe.test(l.speaker));

  return { name, date: parseDate(dateLine), sample, participants, lines, find, by };
}
