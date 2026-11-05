import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Info, Pause, Play, Terminal, X } from "lucide-react";
import SpinnerIcon from "./icons/SpinnerIcon";
import { SUB_CHECK_MS, PASS_PAUSE_MS } from "../data/timingConstants";

const STATUS = {
  pass: { label: "Pass", fg: "#166534", bg: "#dcfce7", Icon: Check },
  exception: { label: "Exception", fg: "#991b1b", bg: "#fee2e2", Icon: X },
  info: { label: "Note", fg: "#9a3412", bg: "#ffedd5", Icon: Info },
};

function procStatus(check) {
  if (check.subChecks.some((s) => s.status === "exception")) return "exception";
  if (check.subChecks.some((s) => s.status === "info")) return "info";
  return "pass";
}

/**
 * Same frame-timeline animation as the reference ValidationChecklist
 * (one frame per sub-check + a result frame per procedure, pausable), but
 * every sub-check carries its real outcome and log lines. Log lines are
 * time-stamped as they are revealed and handed back via onComplete(log)
 * so the audit trail records when each step actually ran.
 */
export default function ProcessChecklist({ checks, onComplete, runningLabel, doneLabel }) {
  const frames = useMemo(() => {
    const f = [];
    checks.forEach((c, procIndex) => {
      c.subChecks.forEach((_, subIndex) => f.push({ procIndex, subIndex, kind: "sub", duration: SUB_CHECK_MS }));
      f.push({ procIndex, kind: "pass", duration: PASS_PAUSE_MS });
    });
    return f;
  }, [checks]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showLog, setShowLog] = useState(true);
  const [log, setLog] = useState(() => [{ time: new Date(), text: "[AGENT] Session started" }]);
  const stamped = useRef(0);
  const logRef = useRef(log);
  const completedRef = useRef(false);
  const logBoxRef = useRef(null);

  const bounds = useMemo(() => {
    const out = [];
    checks.forEach((c, i) => {
      const start = i === 0 ? 0 : out[i - 1].passFrame + 1;
      out.push({ start, passFrame: start + c.subChecks.length, subCount: c.subChecks.length });
    });
    return out;
  }, [checks]);

  const finished = idx >= frames.length;

  useEffect(() => {
    if (paused || finished) return;
    const t = setTimeout(() => setIdx((i) => i + 1), frames[idx].duration);
    return () => clearTimeout(t);
  }, [idx, paused, finished, frames]);

  // Stamp log lines for every sub-check that has just completed
  useEffect(() => {
    const now = new Date();
    const add = [];
    while (stamped.current < idx && stamped.current < frames.length) {
      const fr = frames[stamped.current];
      if (fr.kind === "sub") {
        const sub = checks[fr.procIndex].subChecks[fr.subIndex];
        (sub.log?.length ? sub.log : [sub.text]).forEach((text) => add.push({ time: now, text, status: sub.status }));
      } else {
        const c = checks[fr.procIndex];
        add.push({ time: now, text: `[STEP] ${c.label} – ${STATUS[procStatus(c)].label}`, status: procStatus(c) });
      }
      stamped.current++;
    }
    if (add.length) {
      logRef.current = [...logRef.current, ...add];
      setLog(logRef.current);
    }
  }, [idx, frames, checks]);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [log, showLog]);

  useEffect(() => {
    if (finished && !completedRef.current) {
      completedRef.current = true;
      const done = [...logRef.current, { time: new Date(), text: "[AGENT] Processing complete" }];
      logRef.current = done;
      setLog(done);
      onComplete?.(done);
    }
  }, [finished, onComplete]);

  const totalSubs = checks.reduce((s, c) => s + c.subChecks.length, 0);
  const subsDone = bounds.reduce((s, b) => s + Math.min(Math.max(idx - b.start, 0), b.subCount), 0);
  const proceduresDone = bounds.filter((b) => idx > b.passFrame).length;
  const lastVisible = bounds.reduce((last, b, i) => (idx >= b.start ? i : last), -1);
  const pct = Math.round((subsDone / Math.max(totalSubs, 1)) * 100);
  const exceptionCount = checks.reduce((s, c) => s + c.subChecks.filter((x) => x.status === "exception").length, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: "#000000", display: "flex", alignItems: "center", gap: 8 }}>
          {finished ? <Check size={15} color="#16a34a" strokeWidth={3} /> : paused ? <Pause size={14} color="#b45309" /> : <SpinnerIcon size={15} />}
          {finished
            ? doneLabel || `Complete – ${checks.length} procedures, ${totalSubs} checks${exceptionCount ? `, ${exceptionCount} flagged` : ""}.`
            : paused
            ? "Processing paused."
            : runningLabel}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: finished ? "#16a34a" : "#86BC25", whiteSpace: "nowrap" }}>
            {proceduresDone} / {checks.length}
          </span>
          {!finished && (
            <button
              onClick={() => setPaused((p) => !p)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: paused ? "#86BC25" : "#ffffff",
                color: paused ? "#ffffff" : "#475569",
                border: `1px solid ${paused ? "#86BC25" : "#e2e8f0"}`,
                borderRadius: 7,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
              {paused ? "Resume" : "Pause"}
            </button>
          )}
        </span>
      </div>

      <div style={{ height: 4, background: "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: finished ? "#16a34a" : paused ? "#f59e0b" : "#86BC25",
            borderRadius: 99,
            transition: "width 0.3s ease, background 0.3s ease",
          }}
        />
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", overflow: "hidden" }}>
        {checks.map((check, i) => {
          const { start, passFrame, subCount } = bounds[i];
          const isDone = idx > passFrame;
          const isPending = idx < start;
          const isActive = !isDone && !isPending;
          const subDone = Math.min(Math.max(idx - start, 0), subCount);
          const showFindings = isDone || idx === passFrame;
          const isOpen = !showFindings || !!expanded[check.id];
          const st = STATUS[procStatus(check)];
          if (isPending) return null;

          return (
            <div
              key={check.id}
              onClick={showFindings ? () => setExpanded((p) => ({ ...p, [check.id]: !p[check.id] })) : undefined}
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 14px",
                background: isActive ? "#ffffff" : "transparent",
                borderBottom: i === lastVisible ? "none" : "1px solid #eef2f6",
                cursor: showFindings ? "pointer" : "default",
                transition: "background 0.3s ease",
              }}
            >
              <span style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {showFindings ? (
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: st.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <st.Icon size={12} color={st.fg} strokeWidth={3} />
                  </span>
                ) : paused ? (
                  <Pause size={14} color="#f59e0b" />
                ) : (
                  <SpinnerIcon size={16} />
                )}
              </span>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: showFindings ? st.fg : "#000000" }}>{check.label}</span>
                  {showFindings ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.fg, background: st.bg, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {st.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: paused ? "#b45309" : "#86BC25", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {subDone} / {subCount}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, margin: "4px 0 6px" }}>{check.detail}</div>

                {showFindings && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "#94a3b8" }}>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {isOpen ? "Hide" : "Show"} {subCount} checks
                  </span>
                )}

                {isOpen && (
                  <div style={{ display: "grid", gap: 3, marginTop: 4 }}>
                    {check.subChecks.map((sub, k) => {
                      const cleared = k < subDone;
                      const running = k === subDone && !showFindings;
                      const s = STATUS[sub.status] || STATUS.pass;
                      return (
                        <div
                          key={k}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 7,
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: cleared ? s.fg : running ? "#475569" : "#b0bac7",
                            transition: "color 0.25s ease",
                          }}
                        >
                          <span style={{ width: 12, flexShrink: 0, display: "flex", justifyContent: "center", marginTop: 3 }}>
                            {cleared ? (
                              sub.status === "info" ? <AlertTriangle size={11} color={s.fg} /> : <s.Icon size={11} color={s.fg} strokeWidth={3} />
                            ) : running ? (
                              paused ? <Pause size={10} color="#f59e0b" /> : <SpinnerIcon size={11} />
                            ) : (
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#dbe1e9" }} />
                            )}
                          </span>
                          <span>{sub.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showFindings && check.points?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: st.fg, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
                      Noted that
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 15, fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
                      {check.points.map((pt, k) => (
                        <li key={k} style={{ marginBottom: 2 }}>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent activity log */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setShowLog((v) => !v)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#475569" }}
        >
          <Terminal size={13} /> Agent activity log ({log.length})
          {showLog ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {showLog && (
          <div
            ref={logBoxRef}
            style={{
              marginTop: 6,
              maxHeight: 170,
              overflowY: "auto",
              background: "#0f172a",
              borderRadius: 8,
              padding: "8px 12px",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 11.5,
              lineHeight: 1.65,
            }}
          >
            {log.map((l, i) => (
              <div key={i} style={{ color: l.status === "exception" ? "#fca5a5" : l.status === "info" ? "#fdba74" : "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ color: "#64748b" }}>{l.time.toLocaleTimeString([], { hour12: false })}</span> {l.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
