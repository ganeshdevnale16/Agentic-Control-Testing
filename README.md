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

## Reviewer and control owner workflow
Three tabs at the top of the module: **Tester view**, **Reviewer view**, **Control owner view** (red badges show what is waiting).

1. **Tester** finishes testing and clicks **Send to reviewer**.
2. **Reviewer view** – shows the verdict, KPIs and the exception summary (one bullet per sample). The reviewer **approves**, or **rejects**.
   A rejection needs (a) the **phase where the issue is** – RCM, Population & IPE, Samples, or Evidence & testing – and (b) an observation.
3. **Control owner is notified** in both cases (badge on the owner tab + message in the tester chat).
   - Approved → notification card, owner acknowledges. Work paper can be downloaded as final.
   - Rejected → owner **accepts** or **rejects** the observation, adds notes and reference documents.
4. **Owner accepts** → the tester chat shows it and testing restarts **from the phase the reviewer flagged** (not from evidence), keeping the full chat history:
   - RCM → upload RCM again → population → samples → evidence → testing
   - Population & IPE → choose / upload population again → samples → evidence → testing
   - Samples → select samples again → evidence → testing
   - Evidence & testing → upload evidence (or re-test with the owner's documents) → testing
5. **Owner rejects** → no re-test. The reason and documents are shown to the reviewer in the Reviewer view (review history) and the results come back to the reviewer to review again.

## Work paper (own format)
Summary (incl. one-line exception summary per sample) · RCM & Attributes (incl. attribute summary) · Population & IPE ·
Sample Testing · Evidence (annotated screenshots per sample) · Exceptions · Improvement Opportunities · Review Log
(reviewer decision, **phase flagged**, observation, owner response, notes, reference documents).

This is a scripted demo: any uploaded file gives the same result. Round 2 tests the sample that was missing evidence in round 1.

## Where things live
| Path | What |
|---|---|
| `src/modules/itgc-change/data/demo.js` | All demo values – RCM, attributes, population, IPE, samples (round 1 and 2), improvements |
| `src/modules/itgc-change/ChangeChatbot.jsx` | Conversation flow, send-to-reviewer, review decision, owner response, restart-from-phase |
| `src/modules/itgc-change/components.jsx` | Choice cards, KPI strip, banners, Reviewer panel, Owner panel, view tabs, `PHASES` |
| `src/modules/itgc-change/evidenceImages.js` | Annotated evidence screenshots (canvas) |
| `src/modules/itgc-change/exportWorkpaper.js` | Work paper (Excel) |

---

# Module 3 – Non-FS Control Testing: Vendor bank-detail change (P2P-04) – test of design

Flow (unchanged): **1** upload SOP, RCM and walkthrough transcript → **2** walkthrough checked against the SOP, RCM and
test-of-design plan generated → **3** upload evidence → **4** test of design, observations, report and workpaper.

## What it tests (aligned to WP-P2P-04-TOD)
Ten design attributes, each concluded Pass / Deficiency / Partial with tick marks (✓ ✗ ◐, T = corroborated in the transcript):
A1 Risk linkage · A2 Policy governance · A3 Ownership and authority · A4 Precision and criteria · A5 Frequency and timing ·
A6 System alignment · A7 Segregation of duties · A8 Information used (IPE) · A9 Exceptions and escalation · A10 Evidence of performance.

Every finding is an annotation **A{n}-{k}** pointing to the exact text (PDF page) or cells (Excel range) in the source,
found by reading the files – e.g. A4-2: the cheque is in the name of *Sri Murugan Casting Works*, not the vendor *Sri Murugan Castings*.

## Demo files (`public/demo/nfs`)
| Ref | File | Step |
|---|---|---|
| NFS-01 | SOP-FIN-012 v3.0 (5.3 = document check: letter and cheque attached) | 1 |
| NFS-02 | RCM extract – P2P-04 | 1 |
| NFS-06 | Walkthrough transcript 14-Oct-2026 | 1 |
| NFS-03 | SAP sensitive fields, user access (SUIM), F110 calendar | 3 |
| NFS-04 | VCRF VCR-2026-0389 with document check and sender email | 3 |
| NFS-05 | Weekly change report W38 with sign-off | 3 |
| NFS-07 | Cancelled cheque (VCRF attachment 2) | 3 |

## Workpaper (Excel) – same layout as WP-P2P-04-TOD
Cover · Legend · ToD Testing · Walkthrough Trace · Annotation Index (links to the annotated copy) · Observations (O1–O5, draft for
management response) · Review & Sign-off (reviewer-agent notes RN-1… and human sign-off fields) · **Annotated Evidence** (each
source page / sheet with highlights and A{n}-{k} tags, coloured by result) · RCM, evidence inputs and processing log.

## Code
| Path | What |
|---|---|
| `engine/transcriptParser.js` | Reads the walkthrough transcript (time stamp, speaker, page) |
| `engine/evidenceParser.js` | VCRF (document check, sender), cancelled cheque, Excel evidence |
| `engine/rcmBuilder.js` | RCM, preliminary design read, A1–A10 test-of-design plan |
| `engine/testEngine.js` | Test of design, annotations, walkthrough trace, observations, review notes |
| `annotate.js` | Draws the annotated evidence (PDF pages via pdf.js, Excel ranges) |
| `exportNfs.js` | RCM download and the WP-…-TOD workpaper |
