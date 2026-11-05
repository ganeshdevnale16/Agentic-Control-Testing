import { Bot } from "lucide-react";

export default function AssistantBubble({ children }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "14px 32px 14px 68px",
        fontSize: 14,
        lineHeight: 1.75,
        color: "#000000",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 14,
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bot size={15} color="#86BC25" />
      </div>
      {children}
    </div>
  );
}
