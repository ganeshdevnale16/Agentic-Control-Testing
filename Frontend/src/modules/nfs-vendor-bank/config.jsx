import NfsChatbot from "./NfsChatbot";

export const nfsVendorBankModule = {
  id: "nfs-vendor-bank",
  Chat: NfsChatbot,
  menu: {
    title: "Non-FS Control Testing – Vendor Bank-Detail Change",
    tagline: "Builds the RCM from your SOP and walkthrough, then tests the design of the control with annotated evidence",
    badge: "Non-FS · Procure-to-Pay",
    accent: "#0D8390",
  },
  welcome: {
    assistantName: "Non-FS control testing assistant",
    intro: (
      <>
        I build the <strong>risk and control matrix</strong> for a process from its SOP, RCM and walkthrough, then perform the <strong>test of design</strong> on a walkthrough sample – every attribute
        concluded against the evidence, every finding annotated to the exact text or cells – and write up the observations and the workpaper, the way an auditor would.
      </>
    ),
    summaryTable: {
      title: "How it works",
      columns: [
        { key: "step", label: "Step", minWidth: 60 },
        { key: "what", label: "What happens", minWidth: 330 },
        { key: "need", label: "What I need from you", minWidth: 220 },
      ],
      rows: [
        { step: "1", what: "Upload the SOP, RCM extract and walkthrough transcript", need: "SOP (PDF / Word), RCM (Excel), walkthrough transcript or notes" },
        { step: "2", what: "I check the walkthrough against the SOP, read the design and generate the RCM and the test-of-design plan (A1–A10)", need: "Nothing – watch the processing" },
        { step: "3", what: "Upload the evidence for the walkthrough sample", need: "VCRF, cancelled cheque, SAP config & access extract, weekly review" },
        { step: "4", what: "I test the design of every attribute, annotate the evidence and give you the conclusion, observations, report and Excel workpaper", need: "Nothing" },
      ],
    },
    closing: <div>Shall we create the RCM? Press Create RCM, or try the whole flow with the demo files.</div>,
  },
};
