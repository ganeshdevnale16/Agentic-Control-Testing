import { FolderUp, Paperclip, Send, X } from "lucide-react";
import SpinnerIcon from "./icons/SpinnerIcon";

const PILL_SUMMARY_THRESHOLD = 8;

export default function InputArea({
  input,
  setInput,
  stagedFiles,
  onFileChange,
  onFolderChange,
  onRemoveStagedFile,
  onClearStagedFiles,
  onSend,
  processing,
  fileInputRef,
  folderInputRef,
  placeholder = "Type your message...",
  accept,
  footnote = "AI can make mistakes. Verify important information.",
}) {
  const canSend = (stagedFiles.length > 0 || input.trim().length > 0) && !processing;
  const showSummary = stagedFiles.length > PILL_SUMMARY_THRESHOLD;

  return (
    <div
      style={{
        borderTop: "1px solid #e2e8f0",
        padding: "12px 32px 16px",
        backgroundColor: "#ffffff",
        flexShrink: 0,
      }}
    >
      <div style={{ width: "100%" }}>
        {/* Staged files - a scrollable pill list normally, or a single summary
            chip once the count gets large (e.g. an entire folder), so this
            area can never grow tall enough to push the Send button off screen. */}
        {stagedFiles.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 8,
              maxHeight: 110,
              overflowY: "auto",
            }}
          >
            {showSummary ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                <Paperclip size={12} style={{ flexShrink: 0 }} />
                <span>{stagedFiles.length} files ready - press Send</span>
                <button
                  onClick={onClearStagedFiles}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    color: "#94a3b8",
                    flexShrink: 0,
                  }}
                  title="Clear all"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              stagedFiles.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 12,
                    color: "#475569",
                    maxWidth: 220,
                  }}
                >
                  <Paperclip size={12} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name}
                  </span>
                  <button
                    onClick={() => onRemoveStagedFile(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      color: "#94a3b8",
                      flexShrink: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Input box */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "10px 14px",
          }}
        >
          <label
            title="Attach files"
            style={{
              cursor: processing ? "not-allowed" : "pointer",
              opacity: processing ? 0.5 : 1,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Paperclip size={19} />
            <input
              type="file"
              multiple
              accept={accept}
              ref={fileInputRef}
              onChange={onFileChange}
              disabled={processing}
              style={{ display: "none" }}
            />
          </label>

          {onFolderChange && (
            <label
              title="Attach a whole folder"
              style={{
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1,
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <FolderUp size={19} />
              <input
                type="file"
                multiple
                webkitdirectory="true"
                directory="true"
                ref={folderInputRef}
                onChange={onFolderChange}
                disabled={processing}
                style={{ display: "none" }}
              />
            </label>
          )}

          {processing && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <SpinnerIcon size={14} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Processing...</span>
            </span>
          )}

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              stagedFiles.length > 0
                ? `${stagedFiles.length} file(s) ready - press Send`
                : placeholder
            }
            disabled={processing}
            style={{
              flex: 1,
              background: "transparent",
              resize: "none",
              outline: "none",
              border: "none",
              fontSize: 14,
              color: "#000000",
              maxHeight: 120,
              fontFamily: "inherit",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <button
            onClick={onSend}
            disabled={!canSend}
            style={{
              background: canSend ? "#000000" : "#e2e8f0",
              color: canSend ? "#fff" : "#94a3b8",
              border: "none",
              borderRadius: 10,
              padding: "7px 10px",
              cursor: canSend ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            <Send size={16} />
          </button>
        </div>

        <p
          style={{
            fontSize: 11,
            textAlign: "center",
            color: "#94a3b8",
            marginTop: 8,
          }}
        >
          {footnote}
        </p>
      </div>
    </div>
  );
}
