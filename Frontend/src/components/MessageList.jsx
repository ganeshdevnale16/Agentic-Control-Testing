import { forwardRef } from "react";
import { Paperclip, User } from "lucide-react";
import AssistantBubble from "./AssistantBubble";
import DataTablesBlock from "./DataTablesBlock";
import ProcessChecklist from "./ProcessChecklist";
import SourcePicker from "./SourcePicker";
import ResultsDashboard, { ExceptionCard } from "./ResultsDashboard";
import ActionButtons from "./ActionButtons";

function Welcome({ welcome }) {
  return (
    <>
      Hello! I'm your <strong>{welcome.assistantName}</strong>.
      <br />
      <br />
      {welcome.intro}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <DataTablesBlock tables={[welcome.summaryTable]} />
      </div>
      {welcome.closing}
    </>
  );
}

function UserRow({ children }) {
  return (
    <div className="msg-in" style={{ display: "flex", justifyContent: "flex-end", padding: "4px 32px", gap: 10 }}>
      <div style={{ background: "#e2e8f0", color: "#000000", borderRadius: 16, padding: "9px 14px", maxWidth: "70%", fontSize: 14, lineHeight: 1.7 }}>{children}</div>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#86BC25", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-end" }}>
        <User size={15} color="#000000" />
      </div>
    </div>
  );
}

const MessageList = forwardRef(function MessageList({ messages, config, onAction }, endRef) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
      <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto" }}>
        {messages.map((msg) => {
          if (msg.role === "user") {
            if (msg.type === "fileGroup") {
              const preview = msg.content.names.slice(0, 4);
              const more = msg.content.count - preview.length;
              return (
                <UserRow key={msg.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <Paperclip size={13} style={{ color: "#64748b" }} /> {msg.content.count} files attached
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-all" }}>
                    {preview.join(", ")}
                    {more > 0 ? `, +${more} more` : ""}
                  </div>
                </UserRow>
              );
            }
            return (
              <UserRow key={msg.id}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {msg.type === "file" && <Paperclip size={13} style={{ color: "#64748b", flexShrink: 0 }} />}
                  <span style={{ wordBreak: "break-word" }}>{msg.content}</span>
                </span>
              </UserRow>
            );
          }

          let body;
          switch (msg.type) {
            case "typing":
              body = (
                <span className="typing" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </span>
              );
              break;
            case "welcome":
              body = <Welcome welcome={config.welcome} />;
              break;
            case "checks":
              body = (
                <>
                  {msg.intro && <div style={{ marginBottom: 10 }}>{msg.intro}</div>}
                  <ProcessChecklist checks={msg.checks} runningLabel={msg.runningLabel} doneLabel={msg.doneLabel} onComplete={msg.onComplete} />
                </>
              );
              break;
            case "tables":
              body = <DataTablesBlock intro={msg.intro} tables={msg.tables} />;
              break;
            case "source":
              body = (
                <>
                  {msg.content}
                  <SourcePicker chosen={msg.chosen} system={msg.system} onChoose={(id) => onAction(msg.id, `source:${id}`)} />
                </>
              );
              break;
            case "results":
              body = (
                <>
                  {msg.header}
                  <ResultsDashboard result={msg.result} onOpenReport={() => onAction(msg.id, "report")} onDownloadExcel={() => onAction(msg.id, "excel")} />
                </>
              );
              break;
            case "exceptions":
              body = (
                <>
                  {msg.content}
                  {msg.exceptions.map((ex) => (
                    <ExceptionCard key={ex.id} ex={ex} />
                  ))}
                </>
              );
              break;
            case "evidence":
              body = (
                <>
                  {msg.content}
                  <img src={msg.url} alt={msg.alt} style={{ display: "block", maxWidth: "100%", marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 8 }} />
                </>
              );
              break;
            default:
              body = <div>{msg.content}</div>;
          }

          return (
            <div key={msg.id} className="msg-in">
              <AssistantBubble>
                {body}
                <ActionButtons actions={msg.actions} disabled={msg.used} onAction={(a) => onAction(msg.id, a)} />
              </AssistantBubble>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
});

export default MessageList;
