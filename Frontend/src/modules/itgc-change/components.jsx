import { useState as useLocalState } from "react";
import { Check, CheckCircle2, ClipboardCheck, Cloud, FileSpreadsheet, Paperclip, ThumbsDown, ThumbsUp, UserCheck, X as XIcon } from "lucide-react";

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

// Reviewer decision form shown inside the chat
export function ReviewForm({ round, onSubmit }) {
  const [decision, setDecision] = useLocalState(null);
  const [comment, setComment] = useLocalState("");
  const [reviewer, setReviewer] = useLocalState("");
  const [done, setDone] = useLocalState(false);
  const needsComment = decision === "Rejected";
  const canSubmit = decision && (!needsComment || comment.trim()) && !done;

  return (
    <div style={{ border: "1px solid #D0D0CE", borderTop: `3px solid ${DG}`, borderRadius: 4, padding: 16, marginTop: 10, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 4 }}>
        <ClipboardCheck size={16} /> Reviewer sign-off – round {round}
      </div>
      <div style={{ fontSize: 12.5, color: "#53565A", marginBottom: 12 }}>Review the results and work paper, then approve them or reject with an observation for the control owner.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ToggleButton active={decision === "Approved"} onClick={() => setDecision("Approved")} Icon={ThumbsUp} disabled={done}>
          Approve
        </ToggleButton>
        <ToggleButton active={decision === "Rejected"} tone="bad" onClick={() => setDecision("Rejected")} Icon={ThumbsDown} disabled={done}>
          Reject
        </ToggleButton>
      </div>
      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Reviewer name</label>
      <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} disabled={done} placeholder="e.g. Senior Manager" style={{ ...fieldStyle, marginBottom: 10 }} />
      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>
        {needsComment ? "Observation for the control owner (required)" : "Comment (optional)"}
      </label>
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={done}
        placeholder={needsComment ? "e.g. CIDK905611 was not tested – obtain the ticket history and re-perform testing." : "Add a comment…"}
        style={{ ...fieldStyle, marginBottom: 12 }}
      />
      {done ? (
        <div style={{ fontSize: 13, color: DGD, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={15} /> Submitted
        </div>
      ) : (
        <PrimaryButton
          disabled={!canSubmit}
          onClick={() => {
            setDone(true);
            onSubmit({ decision, comment: comment.trim(), reviewer: reviewer.trim() || "Reviewer" });
          }}
        >
          Submit review
        </PrimaryButton>
      )}
    </div>
  );
}

export function ViewToggle({ view, setView, pending }) {
  const tab = (id, label, Icon) => (
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
      {id === "owner" && pending > 0 && (
        <span style={{ background: "#DA291C", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 99, padding: "1px 7px" }}>{pending}</span>
      )}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 24px", borderBottom: "1px solid #E5E5E5", background: "#fff", flexShrink: 0 }}>
      {tab("tester", "Tester view", ClipboardCheck)}
      {tab("owner", "Control owner view", UserCheck)}
    </div>
  );
}

function OwnerResponseForm({ onSubmit }) {
  const [decision, setDecision] = useLocalState(null);
  const [notes, setNotes] = useLocalState("");
  const [docs, setDocs] = useLocalState([]);
  const canSubmit = decision && (decision === "Accepted" || notes.trim());
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #E5E5E5", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ToggleButton active={decision === "Accepted"} onClick={() => setDecision("Accepted")} Icon={ThumbsUp}>
          Accept observation
        </ToggleButton>
        <ToggleButton active={decision === "Rejected"} tone="bad" onClick={() => setDecision("Rejected")} Icon={ThumbsDown}>
          Reject observation
        </ToggleButton>
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

// Control owner view – the reviewer's observations and the owner's responses
export function OwnerPanel({ reviews, onRespond, controlName }) {
  const items = reviews.map((r, i) => ({ ...r, idx: i })).filter((r) => r.decision === "Rejected");
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F7F7F7" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 24px 48px" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Control owner view</div>
        <div style={{ fontSize: 13, color: "#53565A", marginBottom: 18 }}>{controlName} · observations raised by the reviewer on the testing results</div>
        {!items.length && (
          <div style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: 4, padding: 24, textAlign: "center", color: "#53565A", fontSize: 14 }}>
            No observations from the reviewer yet. When the reviewer rejects the results, the observation appears here for you to accept or reject.
          </div>
        )}
        {items
          .slice()
          .reverse()
          .map((r) => {
            const answered = !!r.owner;
            return (
              <div key={r.idx} style={{ background: "#fff", border: "1px solid #E5E5E5", borderLeft: `4px solid ${answered ? (r.owner.decision === "Accepted" ? DG : "#DA291C") : "#ED8B00"}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>Observation – testing round {r.round}</div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 99, padding: "2px 9px", background: answered ? (r.owner.decision === "Accepted" ? "#F1F8E6" : "#FDECEA") : "#FFF1D6", color: answered ? (r.owner.decision === "Accepted" ? DGD : "#A4121D") : "#9A3412" }}>
                    {answered ? `${r.owner.decision} by owner` : "Awaiting your response"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#53565A", margin: "2px 0 10px" }}>
                  Raised by {r.reviewer} on {r.date}
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
                  <OwnerResponseForm onSubmit={(resp) => onRespond(r.idx, resp)} />
                )}
              </div>
            );
          })}
      </div>
    </div>
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
