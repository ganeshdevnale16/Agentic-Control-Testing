import * as XLSX from "xlsx";
import { readPolicyText } from "../../../engine/fileReaders";
import { clean } from "./util";

export const isSheetFile = (n) => /\.(xlsx|xlsm|xls|csv)$/i.test(n);
export const isTextFile = (n) => /\.(pdf|docx|txt|md)$/i.test(n);

// Workbook → { kind: "sheets", sheets: [{ name, aoa }], text }
export function sheetsDoc(name, wb) {
  const sheets = wb.SheetNames.map((s) => ({
    name: s,
    aoa: XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: "", raw: false }),
  }));
  const text = sheets.map((s) => `${s.name}\n${s.aoa.map((r) => r.map(clean).join(" ")).join("\n")}`).join("\n");
  return { name, kind: "sheets", sheets, text };
}

export async function readDoc(file) {
  if (isSheetFile(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return sheetsDoc(file.name, wb);
  }
  if (isTextFile(file.name)) return { name: file.name, kind: "text", text: await readPolicyText(file) };
  throw new Error("unsupported file type – use PDF, Word, text, Excel or CSV");
}

// What kind of document is this? Decided from the content, not the file name.
export function classify(doc) {
  const t = doc.text || "";
  if (doc.kind === "text") {
    if (/cancell?ed/i.test(t) && /\bIFSC\b/.test(t) && /A\/c\s*No|account no/i.test(t) && !/vendor code/i.test(t)) return "cheque";
    if (/walk[\s-]?through/i.test(t) && (/transcript/i.test(t) || /\[\d{2}:\d{2}:\d{2}\]/.test(t))) return "transcript";
    if (/\bVCR-\d{4}-\d{3,}/.test(t) && /vendor code/i.test(t)) return "vcrf";
    if (/standard operating procedure|\bSOP[-\s]?[A-Z]{2,}-?\d/i.test(t)) return "sop";
    if (/walk[\s-]?through/i.test(t)) return "walkthrough";
    if (/procedure|shall/i.test(t) && /\b\d\.\d\b/.test(t)) return "sop";
    return "unknown";
  }
  const kinds = new Set(doc.sheets.map(sheetKind));
  if (kinds.has("rcm")) return "rcm";
  if (kinds.has("changes") || kinds.has("signoff")) return "review";
  if (kinds.has("sensitive") || kinds.has("access") || kinds.has("calendar")) return "config";
  if (/walk[\s-]?through/i.test(t)) return "walkthrough";
  return "unknown";
}

export function sheetKind(sheet) {
  const top = sheet.aoa.slice(0, 20).map((r) => r.map(clean).join(" | ")).join("\n");
  if (/control id/i.test(top) && /risk/i.test(top)) return "rcm";
  if (/field changed/i.test(top) && /vendor/i.test(top)) return "changes";
  if (/sign[\s-]?off/i.test(sheet.name) || /sign[\s-]?off/i.test(top.split("\n")[0] || "")) return "signoff";
  if (/sensitive/i.test(top) && /field/i.test(top)) return "sensitive";
  if (/user id/i.test(top) && /role/i.test(top)) return "access";
  if (/run date/i.test(top) || /payment run/i.test(top)) return "calendar";
  return "other";
}

export const KIND_LABEL = {
  sop: "Standard operating procedure",
  rcm: "Walkthrough / existing RCM",
  walkthrough: "Walkthrough notes",
  transcript: "Walkthrough transcript",
  cheque: "Cancelled cheque (VCRF attachment)",
  vcrf: "Vendor change request form (VCRF)",
  config: "SAP configuration & access extract",
  review: "Weekly change report & sign-off",
  unknown: "Not recognised",
};
