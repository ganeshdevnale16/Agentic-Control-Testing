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

# Module 2 – ITGC 1.1.3 Change Management (demo)

Opens from the module menu. Deloitte theme (black / Deloitte green #86BC25, Open Sans) is applied app-wide.

## Flow
1. **Population** – choose **Pull from ACTT** (IPE passed on reliance on the system-generated ACTT population) or
   **Upload manually** (full IPE: 3 completeness, 4 accuracy, 4 screenshot checks).
2. **Samples** – upload a Selected Samples file or let the tool select randomly.
3. **Evidence** – upload ticket history PDFs and GPO / LPO approval emails (.msg); the agent tests every sample
   against attributes 1–3 with a live checklist.
4. **Results** – verdict, per-sample results, exceptions, and **Download Testing Work Paper**.

This is a scripted demo: any uploaded file gives the same result.

## Where things live
| Path | What |
|---|---|
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
