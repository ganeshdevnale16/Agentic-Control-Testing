import { CONTROL } from "./data/control";
import StepBadge from "../../components/StepBadge";

export const TOTAL_STEPS = 4;

export const itgcPasswordModule = {
  id: "itgc-password",
  menu: {
    title: "ITGC Control Testing – SAP Password Configuration",
    tagline: "Reads your password policy, pulls the settings from SAP and tests every requirement on every instance",
    badge: "ITGC · Logical access",
    accent: "#86BC25",
  },
  welcome: {
    assistantName: "ITGC control testing assistant",
    intro: (
      <>
        I test IT general controls the way an auditor would. Give me the <strong>policy document</strong> and I'll work out what needs testing,
        collect the evidence from SAP (or from an extract you upload), check the population is complete and accurate, test every requirement,
        annotate the evidence and write up the report with exceptions.
      </>
    ),
    summaryTable: {
      title: "Control Summary",
      columns: [
        { key: "field", label: "Field", minWidth: 150 },
        { key: "detail", label: "Detail", minWidth: 420 },
      ],
      rows: [
        { field: "Control ID", detail: `${CONTROL.id} · ${CONTROL.name}` },
        { field: "Control objective", detail: CONTROL.objective },
        { field: "Risk", detail: CONTROL.risk },
        { field: "Control description", detail: CONTROL.description },
        { field: "Control type", detail: `${CONTROL.type} · ${CONTROL.nature} · ${CONTROL.frequency}` },
      ],
    },
    closing: (
      <>
        <StepBadge index={1} total={TOTAL_STEPS} label="Policy document" />
        <div>Let's get started – please upload the approved password policy (.docx, .pdf or .txt), or try the demo policy.</div>
      </>
    ),
  },
};

export const comingSoonModules = [
  {
    id: "itgc-uar",
    comingSoon: true,
    menu: { title: "ITGC – User Access Review", tagline: "Periodic review of SAP user access and leavers", badge: "Coming soon" },
  },
  {
    id: "itgc-change",
    comingSoon: true,
    menu: { title: "ITGC – Change Management", tagline: "Transport approvals and segregation of duties for changes", badge: "Coming soon" },
  },
];
