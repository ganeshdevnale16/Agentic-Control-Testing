# Agentic Controls Testing – ITGC (SAP Password Configuration)

Same stack and UI as `Agentic-control-test-main`: React 19 + Vite 8 + Tailwind 4, lucide-react,
ExcelJS + file-saver (Excel download), SheetJS (reading extracts). Added: mammoth (.docx) and
pdf.js (.pdf) to read policy documents.

## Run
```bash
cd Frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Flow
1. **Policy document** – upload .docx / .pdf / .txt (or "Use demo policy"). The agent extracts every
   measurable requirement and maps it to the SAP profile parameter (A1..An). Behavioural rules are
   listed as "Manual test".
2. **Evidence source** – *Connect to SAP* (agent pulls table PAHI itself) or *Upload an extract*
   (Excel/CSV + the record count shown in SE16 + optional screenshots). A sample extract can be
   downloaded from the chat to try the manual path.
3. **Agent testing** – live checklist (pause/resume) with Pass / Exception / Note per step and a
   time-stamped activity log: connection, extraction, C&A (IPE), sample tie-out, attribute testing,
   evidence annotation.
4. **Results & report** – conclusion, KPIs, results per attribute with procedure / observation /
   conclusion narratives and annotated evidence, exceptions written as condition / criteria / cause /
   effect / recommendation. Downloads: full report (Print / Save as PDF) and Excel workpaper
   (Summary, Test Attributes, Testing, Exceptions, IPE C&A, Evidence images, Audit Trail,
   Processing Log, Population).

## Where things live
| Path | What |
|---|---|
| `src/Chatbot.jsx` | Conversation flow (stages: policy → source → testing → done) and Q&A |
| `src/engine/policyParser.js` | Policy text → test attributes |
| `src/engine/testEngine.js` | C&A, sample, per-instance tests, narratives, exceptions, conclusion |
| `src/engine/sapConnector.js` | **Simulated** SAP connector (PAHI, 2 instances) |
| `src/engine/fileReaders.js` | .docx / .pdf / .txt policy and Excel/CSV extract readers |
| `src/engine/evidenceAnnotator.js` | SE16-style annotated evidence images |
| `src/modules/itgc-password/data/` | Control context, demo policy, SAP parameter knowledge base |
| `src/components/` | Navbar, ModuleMenu, Sidebar, ProcessChecklist, ResultsDashboard, ReportView… |
| `src/utils/exportExcel.js` | Excel workpaper |

## Connecting a real SAP system
The SAP option currently returns simulated data. To go live, replace `generatePahiExtract()`,
`screenRecordCount()` and `requery()` in `src/engine/sapConnector.js` with calls to a backend that
reads PAHI via RFC_READ_TABLE (or OData) using a read-only service account, returning rows in the
same shape: `{ host, system, date, state, param, value }`. Never call SAP directly from the browser.

## Testing logic notes
- Every application server instance is tested; an attribute fails if any instance fails.
- A value of 0 for expiry / lock / idle / auto-logout parameters disables the check and is an exception.
- Parameters missing from the active population are exceptions (kernel default must be confirmed in RZ11).
- In manual mode, checks that need system access are marked "Not performed", not "Agreed".

---

# Module 2 – ITGC Change Management (demo)

Opens from the module menu. Deloitte theme (black / Deloitte green #86BC25, Open Sans) is applied app-wide.

## Flow (Tester view)
1. **RCM** – upload the Risk & Control Matrix; the tool shows a detailed Control Summary (ID, objective, risk, description, nature, frequency, key, owner, systems, test approach, test attributes).
2. **Population** – **Pull from ACTT** (IPE passed on reliance on the ACTT population) or **Upload manually** (full IPE: 11 checks).
3. **Samples** – upload a Selected Samples file or random selection.
4. **Evidence** – ticket history PDFs and approval emails; every sample is tested against attributes A1–A4.
5. **Results** – verdict, per-sample results, attribute summary, exceptions, improvement opportunities, annotated evidence preview,
   an exception summary with one bullet per sample, and **Review**.

## Review and control owner
- **Review** – the reviewer approves, or rejects with an observation.
- **Control owner view** (tab at the top) – the owner accepts or rejects the observation, adds notes and reference documents.
  - Accepted → the tester view shows it and testing is performed again (round 2), keeping the full chat history.
  - Rejected → no re-test; the tester view shows the reason and documents, and the reviewer can review again.

## Work paper (own format)
Summary (incl. one-line exception summary per sample) · RCM & Attributes (incl. attribute summary) · Population & IPE ·
Sample Testing · Evidence (annotated screenshots per sample) · Exceptions · Improvement Opportunities · Review Log.

This is a scripted demo: any uploaded file gives the same result. Round 2 tests the sample that was missing evidence in round 1.

## Where things live
| Path | What |
|---|---|
| `src/modules/itgc-change/data/demo.js` | All demo values – RCM, attributes, population, IPE, samples (round 1 and 2), improvements |
| `src/modules/itgc-change/ChangeChatbot.jsx` | Conversation flow, review and owner workflow |
| `src/modules/itgc-change/components.jsx` | Choice cards, KPI strip, banners, review form, owner panel, view toggle |
| `src/modules/itgc-change/evidenceImages.js` | Annotated evidence screenshots (canvas) |
| `src/modules/itgc-change/exportWorkpaper.js` | Work paper (Excel) |

---|---|
| `src/modules/itgc-change/data/demo.js` | All demo values – control text, population, IPE checks, samples and results. Edit here. |
| `src/modules/itgc-change/ChangeChatbot.jsx` | Conversation flow |
| `src/modules/itgc-change/exportWorkpaper.js` | Work paper in the Change Template format: **Test Sheet** + **Evidence & Attribute mapping** |
| `src/modules/itgc-change/components.jsx` | Source choice cards, KPI strip, status banner |


---

# Module 3 – Non-FS Control Testing: Vendor Bank-Detail Change (P2P-04)

Third assistant on the home menu. Own chat flow in `src/modules/nfs-vendor-bank/` (the ITGC module is unchanged;
`Workspace.jsx` now uses `config.Chat` when a module brings its own chat).

## Flow
1. **Create RCM** – user starts the RCM, then uploads the **SOP** and the **walkthrough file** (walkthrough notes or
   existing RCM extract). Files are recognised by content, not file name.
2. **Validate & generate RCM** – live processing: reads the SOP (sections, roles, approvals), splits the walkthrough
   control into activities (a)–(d), checks walkthrough vs SOP, runs a design assessment (D1–D9) and generates the RCM,
   test attributes (A1–A9), sample sizes and evidence request list (E1–E5). RCM downloadable as Excel.
3. **Evidence** – user uploads VCRF(s), SAP config/access extract, payment run calendar and weekly change report
   (any order, any number of files). Status table shows what is still missing; can run with partial evidence.
4. **Testing & results** – live processing per attribute, conclusion (design + operating), exceptions written as
   condition / criteria / cause / effect / recommendation, payment exposure, limitations and outstanding requests.
   Full report (Print / Save as PDF) and Excel workpaper (Summary, RCM, Walkthrough vs SOP, Design Assessment, Test
   Plan, Evidence Request, Testing, Narratives, Exceptions, Payment Exposure, Outstanding Requests, Evidence Index,
   Processing Log). Q&A after the test ("why did A2 fail?", "who can run payments?", "design gaps", "exposure").

Demo files live in `public/demo/nfs/` ("Try with demo files" / "Use demo evidence" buttons load them through the same
upload path).

## Where things live
| Path | What |
|---|---|
| `nfs-vendor-bank/NfsChatbot.jsx` | Conversation flow (start → docs → building → evidence → testing → done) and Q&A |
| `nfs-vendor-bank/engine/readers.js` | Read PDF/Word/Excel, classify each file by content |
| `nfs-vendor-bank/engine/sopParser.js` | SOP → header, sections, roles and design facts (callback source, maker-checker, review timing…) |
| `nfs-vendor-bank/engine/walkthroughParser.js` | Walkthrough / RCM extract → control, activities, type & frequency per activity |
| `nfs-vendor-bank/engine/rcmBuilder.js` | Walkthrough vs SOP checks, design assessment, RCM rows, test plan, evidence requests |
| `nfs-vendor-bank/engine/evidenceParser.js` | VCRF, sensitive fields, user access, payment runs, change report and sign-off |
| `nfs-vendor-bank/engine/testEngine.js` | A1–A9 tests, exceptions, exposure, conclusion, processing steps |
| `nfs-vendor-bank/exportNfs.js` | RCM and workpaper Excel |
| `nfs-vendor-bank/components/` | Results dashboard and printable report |

All logic is rule-based and runs in the browser on the actual file contents – change the data and the results change.
