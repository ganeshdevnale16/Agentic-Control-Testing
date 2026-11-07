import FsChatbot from "./FsChatbot";

export const fsCreditSanctionModule = {
  id: "fs-credit-sanction",
  Chat: FsChatbot,
  menu: {
    title: "FS Control Testing – Credit Sanction within Delegated Authority",
    tagline: "Builds the RCM from the credit policy and walkthrough, then tests the design of the DoA control with annotated evidence",
    badge: "FS · Lending",
    accent: "#046A38",
  },
  welcome: {
    assistantName: "FS control testing assistant",
    intro: (
      <>
        I build the <strong>risk and control matrix</strong> for credit sanction from the credit policy (delegation of authority), the RCM and the walkthrough note, then perform the{" "}
        <strong>test of design</strong> on the walkthrough sample – every attribute concluded against the LOS configuration and the sanction memo, every finding annotated to the exact text or cells
        – and write up the observations and the workpaper.
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
        { step: "1", what: "Upload the credit policy, RCM extract and walkthrough note", need: "Credit policy (DoA), RCM (Excel), walkthrough note" },
        { step: "2", what: "I check the RCM and walkthrough against the policy and generate the RCM and test-of-design plan (A1–A10)", need: "Nothing – watch the processing" },
        { step: "3", what: "Upload the evidence for the walkthrough sample", need: "LOS role-limit & workflow extract, sanction memo" },
        { step: "4", what: "I test the design of every attribute, annotate the evidence and give you the conclusion, observations, report and Excel workpaper", need: "Nothing" },
      ],
    },
    closing: <div>Shall we create the RCM? Press Create RCM, or try the whole flow with the demo files.</div>,
  },
};
