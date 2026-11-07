export const TOTAL_STEPS = 4;

// Demo files served from public/demo/nfs. This is a scripted demo: whatever the
// user uploads, these files are what the tool reads, so the result is always the
// same (predefined by the Design Testing Evidence Pack v3).
// Step 1 – only the SOP and the walkthrough are asked for.
export const DEMO_DOCS = ["NFS-01_SOP_Vendor_Master_Maintenance_v3.0.pdf", "NFS-06_Walkthrough_Transcript_14-Oct-2026.pdf"];
// Step 3 – evidence for the walkthrough sample (incl. the client's existing RCM extract)
export const DEMO_EVIDENCE = [
  "NFS-02_RCM_Vendor_Bank_Change.xlsx",
  "NFS-03_SAP_Config_and_Access_Extract.xlsx",
  "NFS-04_VCRF_VCR-2026-0389.pdf",
  "NFS-05_Weekly_Vendor_Change_Review_W38.xlsx",
  "NFS-07_Cancelled_Cheque_KVB_Vendor_100458.pdf",
];
// Annotated copies from the evidence pack (zipped with the workpaper) and their page images
export const ANNOTATED_FILES = [
  "NFS-01_SOP_Vendor_Master_Maintenance_v3.0_ANNOTATED.pdf",
  "NFS-02_RCM_Vendor_Bank_Change_ANNOTATED.xlsx",
  "NFS-03_SAP_Config_and_Access_Extract_ANNOTATED.xlsx",
  "NFS-04_VCRF_VCR-2026-0389_ANNOTATED.pdf",
  "NFS-05_Weekly_Vendor_Change_Review_W38_ANNOTATED.xlsx",
  "NFS-06_Walkthrough_Transcript_14-Oct-2026_ANNOTATED.pdf",
  "NFS-07_Cancelled_Cheque_KVB_Vendor_100458_ANNOTATED.pdf",
];
