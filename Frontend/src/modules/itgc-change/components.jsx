import { useState as useLocalState } from "react";
import { Bell, Check, ClipboardCheck, Cloud, Eye, FileSpreadsheet, Paperclip, ThumbsDown, ThumbsUp, UserCheck, X as XIcon } from "lucide-react";

const DG = "#86BC25";
const DGD = "#26890D";

export function ChoiceCards({ options, chosen, onChoose }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 10 }}>
      {options.map((o) => {
        const isChosen = chosen === o.id;
        const disabled = !!chosen;
        const Icon = o.Icon;
        return (
          <button
            key={o.id}
            disabled={disabled}
            onClick={() => onChoose(o.id)}
            style={{
              textAlign: "left",
              background: isChosen ? "#F1F8E6" : "#ffffff",
              border: `1px solid ${isChosen ? DG : "#D0D0CE"}`,
              borderRadius: 4,
              padding: "14px 16px",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled && !isChosen ? 0.45 : 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => !disabled && (e.currentTarget.style.borderColor = DG)}
            onMouseLeave={(e) => !disabled && (e.currentTarget.style.borderColor = "#D0D0CE")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 4, background: isChosen ? DG : "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isChosen ? <Check size={16} color="#000" strokeWidth={3} /> : <Icon size={16} color="#fff" />}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>{o.title}</span>
              {o.tag && !disabled && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: DGD, background: "#F1F8E6", borderRadius: 99, padding: "2px 8px" }}>{o.tag}</span>
              )}
            </span>
            {o.lines.map((l, i) => (
              <span key={i} style={{ fontSize: 12.5, color: "#53565A", lineHeight: 1.55 }}>{l}</span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

export const SOURCE_OPTIONS = [
  {
    id: "actt",
    Icon: Cloud,
    title: "Pull from ACTT",
    lines: ["I pull the E070 / STMS transport population for CIP client 500 through ACTT.", "System-generated, so IPE reliance is placed on ACTT."],
    tag: "Recommended",
  },
  {
    id: "manual",
    Icon: FileSpreadsheet,
    title: "Upload manually",
    lines: ["You upload the population file (E070 and STMS extracts) with screenshots.", "I run the full IPE validation: completeness, accuracy and screenshot checks."],
  },
];

export function KpiStrip({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`, border: "1px solid #D0D0CE", borderRadius: 4, overflow: "hidden", margin: "10px 0 14px" }}>
      {items.map((k, i) => (
        <div key={k.label} style={{ padding: "10px 14px", borderLeft: i ? "1px solid #D0D0CE" : "none", background: "#fff" }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: k.tone === "bad" ? "#DA291C" : k.tone === "ok" ? DGD : "#000", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          <div style={{ fontSize: 12, color: "#53565A" }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StatusBanner({ tone, title, children }) {
  const ok = tone === "ok";
  return (
    <div style={{ borderLeft: `4px solid ${ok ? DG : "#DA291C"}`, background: ok ? "#F1F8E6" : "#FDECEA", padding: "10px 14px", margin: "8px 0 12px" }}>
      <div style={{ fontWeight: 700, color: ok ? DGD : "#A4121D", fontSize: 14 }}>{title}</div>
      {children && <div style={{ fontSize: 13, color: "#1A1A1A", marginTop: 2 }}>{children}</div>}
    </div>
  );
}

// ── review / owner workflow ───────────────────────────────────────────────

const fieldStyle = {
  width: "100%",
  border: "1px solid #D0D0CE",
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 13.5,
  fontFamily: "inherit",
  resize: "vertical",
  boxSizing: "border-box",
};

function ToggleButton({ active, tone, onClick, Icon, children, disabled }) {
  const c = tone === "bad" ? "#DA291C" : DGD;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 16px",
        borderRadius: 4,
        fontSize: 13.5,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        border: `1.5px solid ${active ? c : "#D0D0CE"}`,
        background: active ? (tone === "bad" ? "#FDECEA" : "#F1F8E6") : "#fff",
        color: active ? c : "#53565A",
      }}
    >
      <Icon size={15} /> {children}
    </button>
  );
}

function PrimaryButton({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: disabled ? "#BFBFBF" : "#000",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        padding: "9px 18px",
        fontSize: 13.5,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Phases of the test flow. When the reviewer rejects, they name the phase where
// the issue is, and re-testing restarts from that phase (not from evidence).
export const PHASES = [
  { id: "rcm", label: "RCM", hint: "Control details or attributes are wrong – the RCM has to be uploaded again." },
  { id: "population", label: "Population & IPE", hint: "Population source or IPE is not adequate – the population is obtained again." },
  { id: "samples", label: "Samples", hint: "Sample selection is not acceptable – samples are selected again." },
  { id: "evidence", label: "Evidence & testing", hint: "Evidence is missing or testing is wrong – evidence is provided and samples re-tested." },
];
export const phaseLabel = (id) => PHASES.find((p) => p.id === id)?.label || "–";

const pill = (bg, color, text) => (
  <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 99, padding: "2px 9px", background: bg, color, whiteSpace: "nowrap" }}>{text}</span>
);

function PageShell({ title, subtitle, children }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F7F7F7" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 24px 48px" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#53565A", marginBottom: 18 }}>{subtitle}</div>
        {children}
      </div>
    </div>
  );
}

const cardStyle = (accent) => ({ background: "#fff", border: "1px solid #E5E5E5", borderLeft: `4px solid ${accent}`, borderRadius: 4, padding: 16, marginBottom: 14 });

function ReviewerDecisionForm({ onSubmit }) {
  const [decision, setDecision] = useLocalState(null);
  const [phase, setPhase] = useLocalState(null);
  const [comment, setComment] = useLocalState("");
  const [reviewer, setReviewer] = useLocalState("");
  const rejecting = decision === "Rejected";
  const canSubmit = decision && (!rejecting || (phase && comment.trim()));
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #E5E5E5", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ToggleButton active={decision === "Approved"} onClick={() => setDecision("Approved")} Icon={ThumbsUp}>
          Approve
        </ToggleButton>
        <ToggleButton active={rejecting} tone="bad" onClick={() => setDecision("Rejected")} Icon={ThumbsDown}>
          Reject
        </ToggleButton>
      </div>
      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Reviewer name</label>
      <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. Senior Manager" style={{ ...fieldStyle, marginBottom: 10 }} />
      {rejecting && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Where is the issue? Re-testing restarts from this phase (required)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
            {PHASES.map((p, i) => {
              const on = phase === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhase(p.id)}
                  style={{ textAlign: "left", fontFamily: "inherit", cursor: "pointer", borderRadius: 4, padding: "10px 12px", border: `1.5px solid ${on ? "#DA291C" : "#D0D0CE"}`, background: on ? "#FDECEA" : "#fff" }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? "#A4121D" : "#000" }}>
                    {i + 1}. {p.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#53565A", marginTop: 2, lineHeight: 1.45 }}>{p.hint}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>{rejecting ? "Observation for the control owner (required)" : "Comment (optional)"}</label>
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={rejecting ? "e.g. CIDK905611 was not tested – obtain the ticket history and re-perform testing." : "Add a comment…"}
        style={{ ...fieldStyle, marginBottom: 12 }}
      />
      <PrimaryButton
        disabled={!canSubmit}
        onClick={() => onSubmit({ decision, comment: comment.trim(), reviewer: reviewer.trim() || "Reviewer", phase: rejecting ? phase : null })}
      >
        {rejecting ? "Reject and notify control owner" : "Approve and notify control owner"}
      </PrimaryButton>
    </div>
  );
}

function ownerStatus(r) {
  if (r.decision === "Approved") return { text: "Approved – owner notified", bg: "#F1F8E6", color: DGD };
  if (!r.owner) return { text: "Waiting for the control owner", bg: "#FFF1D6", color: "#9A3412" };
  if (r.owner.decision === "Accepted") return { text: `Owner accepted – re-tested from ${phaseLabel(r.phase)}`, bg: "#F1F8E6", color: DGD };
  return { text: "Owner rejected the observation", bg: "#FDECEA", color: "#A4121D" };
}

// Reviewer view – submissions sent by the tester, and the review history
export function ReviewerPanel({ submission, summary, reviews, onSubmit, controlName }) {
  const history = reviews.slice().reverse();
  return (
    <PageShell title="Reviewer view" subtitle={`${controlName} · testing results sent by the tester for your review`}>
      {!submission && (
        <div style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: 4, padding: 24, textAlign: "center", color: "#53565A", fontSize: 14, marginBottom: 14 }}>
          Nothing is waiting for your review. When the tester sends the results, they appear here for you to approve or reject.
        </div>
      )}
      {submission && (
        <div style={cardStyle("#ED8B00")}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700 }}>Testing results – round {submission.round}</div>
            {pill("#FFF1D6", "#9A3412", "Awaiting your review")}
          </div>
          <div style={{ fontSize: 12, color: "#53565A", margin: "2px 0 6px" }}>Sent by the tester on {submission.date}</div>
          {submission.note && <div style={{ fontSize: 13, background: "#FFF8E8", borderRadius: 4, padding: "8px 12px", marginBottom: 6 }}>{submission.note}</div>}
          <StatusBanner tone={summary.exceptions ? "bad" : "ok"} title={`Overall verdict: ${summary.verdict}`}>
            {summary.total} samples tested · {summary.exceptions} exception(s)
          </StatusBanner>
          <KpiStrip
            items={[
              { label: "Samples tested", value: summary.total },
              { label: "Passed", value: summary.passed, tone: "ok" },
              { label: "Exceptions", value: summary.exceptions, tone: summary.exceptions ? "bad" : "ok" },
            ]}
          />
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Exception summary – one point per sample</div>
          <SummaryBullets items={summary.bullets} />
          <div style={{ fontSize: 12.5, color: "#53565A", marginTop: 10 }}>The full work paper (annotated evidence, attribute summary, improvement opportunities) can be downloaded from the tester view.</div>
          <ReviewerDecisionForm key={submission.id} onSubmit={onSubmit} />
        </div>
      )}
      {history.length > 0 && <div style={{ fontWeight: 700, margin: "20px 0 10px" }}>Review history</div>}
      {history.map((r, i) => {
        const st = ownerStatus(r);
        return (
          <div key={i} style={cardStyle(r.decision === "Approved" ? DG : "#DA291C")}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>
                Round {r.round} – {r.decision} by {r.reviewer}
              </div>
              {pill(st.bg, st.color, st.text)}
            </div>
            <div style={{ fontSize: 12, color: "#53565A", margin: "2px 0 8px" }}>
              {r.date}
              {r.phase ? ` · issue raised in: ${phaseLabel(r.phase)}` : ""}
            </div>
            {r.comment && <div style={{ fontSize: 14, background: "#F7F7F7", borderRadius: 4, padding: "10px 12px" }}>{r.comment}</div>}
            {r.owner && (
              <div style={{ marginTop: 10, fontSize: 13.5 }}>
                <strong>Control owner response:</strong> {r.owner.decision} on {r.owner.date}
                {r.owner.notes && <div style={{ marginTop: 4 }}>{r.owner.notes}</div>}
                {r.owner.docs?.length > 0 && <div style={{ marginTop: 4, color: "#53565A", fontSize: 12.5 }}>Reference documents: {r.owner.docs.join(", ")}</div>}
                {r.owner.decision === "Rejected" && <div style={{ marginTop: 6, color: "#A4121D", fontSize: 12.5 }}>No re-test was performed. Review the results again above.</div>}
              </div>
            )}
          </div>
        );
      })}
    </PageShell>
  );
}

export function ViewToggle({ view, setView, badges }) {
  const tab = (id, label, Icon) => {
    const n = badges?.[id] || 0;
    return (
      <button
        type="button"
        onClick={() => setView(id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 14px",
          border: "none",
          borderBottom: `3px solid ${view === id ? DG : "transparent"}`,
          background: "none",
          fontSize: 13.5,
          fontWeight: 600,
          color: view === id ? "#000" : "#53565A",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Icon size={15} /> {label}
        {n > 0 && <span style={{ background: "#DA291C", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 99, padding: "1px 7px" }}>{n}</span>}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 24px", borderBottom: "1px solid #E5E5E5", background: "#fff", flexShrink: 0 }}>
      {tab("tester", "Tester view", ClipboardCheck)}
      {tab("reviewer", "Reviewer view", Eye)}
      {tab("owner", "Control owner view", UserCheck)}
    </div>
  );
}

function OwnerResponseForm({ phase, onSubmit }) {
  const [decision, setDecision] = useLocalState(null);
  const [notes, setNotes] = useLocalState("");
  const [docs, setDocs] = useLocalState([]);
  const canSubmit = decision && (decision === "Accepted" || notes.trim());
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #E5E5E5", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ToggleButton active={decision === "Accepted"} onClick={() => setDecision("Accepted")} Icon={ThumbsUp}>
          Accept observation
        </ToggleButton>
        <ToggleButton active={decision === "Rejected"} tone="bad" onClick={() => setDecision("Rejected")} Icon={ThumbsDown}>
          Reject observation
        </ToggleButton>
      </div>
      <div style={{ fontSize: 12.5, color: "#53565A", marginBottom: 12 }}>
        {decision === "Accepted" && `Testing is performed again, starting from: ${phaseLabel(phase)}.`}
        {decision === "Rejected" && "No re-test. The reviewer sees your reason and documents and reviews again."}
        {!decision && "Accepting restarts testing from the phase the reviewer flagged; rejecting sends your reason back to the reviewer."}
      </div>
      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>
        {decision === "Rejected" ? "Reason for rejecting (required)" : "Notes"}
      </label>
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={decision === "Rejected" ? "Explain why the observation does not apply…" : "e.g. Ticket history attached – please re-test."}
        style={{ ...fieldStyle, marginBottom: 10 }}
      />
      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Reference documents</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
        {docs.map((d, i) => (
          <span key={d + i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, background: "#F2F2F2", borderRadius: 4, padding: "4px 8px" }}>
            <Paperclip size={12} /> {d}
            <button type="button" aria-label={`Remove ${d}`} onClick={() => setDocs(docs.filter((_, k) => k !== i))} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              <XIcon size={12} />
            </button>
          </span>
        ))}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, border: "1px dashed #A0A0A0", borderRadius: 4, padding: "5px 10px", cursor: "pointer" }}>
          <Paperclip size={13} /> Attach file
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const names = Array.from(e.target.files).map((f) => f.name);
              e.target.value = "";
              setDocs((p) => [...p, ...names]);
            }}
          />
        </label>
      </div>
      <PrimaryButton disabled={!canSubmit} onClick={() => onSubmit({ decision, notes: notes.trim(), docs })}>
        Send response
      </PrimaryButton>
    </div>
  );
}

// Control owner view – notifications from the reviewer and the owner's responses
export function OwnerPanel({ reviews, onRespond, onAck, controlName }) {
  const items = reviews.map((r, i) => ({ ...r, idx: i }));
  return (
    <PageShell title="Control owner view" subtitle={`${controlName} · notifications and observations from the reviewer`}>
      {!items.length && (
        <div style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: 4, padding: 24, textAlign: "center", color: "#53565A", fontSize: 14 }}>
          No notifications yet. When the reviewer approves or rejects the results, you are notified here.
        </div>
      )}
      {items
        .slice()
        .reverse()
        .map((r) => {
          if (r.decision === "Approved") {
            return (
              <div key={r.idx} style={cardStyle(DG)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                    <Bell size={15} /> Reviewer approved the testing – round {r.round}
                  </div>
                  {r.ack ? pill("#F2F2F2", "#53565A", "Acknowledged") : pill("#F1F8E6", DGD, "New notification")}
                </div>
                <div style={{ fontSize: 12, color: "#53565A", margin: "2px 0 8px" }}>
                  Approved by {r.reviewer} on {r.date} · no action needed
                </div>
                {r.comment && <div style={{ fontSize: 14, background: "#F7F7F7", borderRadius: 4, padding: "10px 12px" }}>{r.comment}</div>}
                {!r.ack && (
                  <div style={{ marginTop: 12 }}>
                    <PrimaryButton onClick={() => onAck(r.idx)}>Acknowledge</PrimaryButton>
                  </div>
                )}
              </div>
            );
          }
          const answered = !!r.owner;
          const accent = answered ? (r.owner.decision === "Accepted" ? DG : "#DA291C") : "#ED8B00";
          const st = ownerStatus(r);
          return (
            <div key={r.idx} style={cardStyle(accent)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>Observation – testing round {r.round}</div>
                {pill(st.bg, st.color, answered ? `${r.owner.decision} by owner` : "Awaiting your response")}
              </div>
              <div style={{ fontSize: 12, color: "#53565A", margin: "2px 0 10px" }}>
                Raised by {r.reviewer} on {r.date} · issue in: <strong>{phaseLabel(r.phase)}</strong>
              </div>
              <div style={{ fontSize: 14, background: "#F7F7F7", borderRadius: 4, padding: "10px 12px" }}>{r.comment}</div>
              {answered ? (
                <div style={{ marginTop: 12, fontSize: 13.5 }}>
                  <div>
                    <strong>Your response:</strong> {r.owner.decision} on {r.owner.date}
                  </div>
                  {r.owner.notes && <div style={{ marginTop: 4 }}>{r.owner.notes}</div>}
                  {r.owner.docs?.length > 0 && <div style={{ marginTop: 4, color: "#53565A", fontSize: 12.5 }}>Reference: {r.owner.docs.join(", ")}</div>}
                </div>
              ) : (
                <OwnerResponseForm phase={r.phase} onSubmit={(resp) => onRespond(r.idx, resp)} />
              )}
            </div>
          );
        })}
    </PageShell>
  );
}

export function SummaryBullets({ items }) {
  const dot = { ok: DGD, bad: "#DA291C", warn: "#ED8B00" };
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
      {items.map((b) => (
        <li key={b.head} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0F0F0", fontSize: 13.5, lineHeight: 1.6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot[b.tone], flexShrink: 0, marginTop: 7 }} />
          <span>
            <strong>{b.head}:</strong> {b.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
