import NfsChatbot from "./NfsChatbot";

export const nfsVendorBankModule = {
  id: "nfs-vendor-bank",
  Chat: NfsChatbot,
  menu: {
    title: "Non-FS Control Testing – Vendor Bank-Detail Change (P2P)",
    tagline: "Builds the RCM from your SOP and walkthrough, then tests design and operating effectiveness from the evidence",
    badge: "Non-FS · Procure-to-Pay",
    accent: "#0D8390",
  },
  welcome: {
    assistantName: "Non-FS control testing assistant",
    intro: (
      <>
        I build the <strong>risk and control matrix</strong> for a process from its SOP and walkthrough, assess whether the control is designed well, then test it on the evidence you give me and write up
        the results, exceptions and workpaper – the way an auditor would.
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
        { step: "1", what: "Upload the SOP and the walkthrough file", need: "SOP (PDF / Word) and walkthrough notes or RCM extract" },
        { step: "2", what: "I check the walkthrough against the SOP, assess the design and generate the RCM and test plan", need: "Nothing – watch the processing" },
        { step: "3", what: "Upload the evidence listed in the test plan", need: "VCRF, SAP config & access extract, payment runs, weekly review" },
        { step: "4", what: "I test every attribute and give you the conclusion, exceptions, report and Excel workpaper", need: "Nothing" },
      ],
    },
    closing: <div>Shall we create the RCM? Press Create RCM, or try the whole flow with the demo files.</div>,
  },
};
