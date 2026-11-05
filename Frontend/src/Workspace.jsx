import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Chatbot from "./Chatbot";

// Holds the chat sessions for one module. Every session stays mounted (just
// hidden) so switching between recent chats keeps their full state.
export default function Workspace({ config, onBack }) {
  const ChatComponent = config.Chat || Chatbot;
  const [seq, setSeq] = useState(1);
  const [sessions, setSessions] = useState([{ id: 1, title: "New chat" }]);
  const [activeId, setActiveId] = useState(1);

  const newChat = () => {
    const current = sessions.find((s) => s.id === activeId);
    if (current?.title === "New chat") return; // already on an empty chat
    const id = seq + 1;
    setSeq(id);
    setSessions((p) => [...p, { id, title: "New chat" }]);
    setActiveId(id);
  };

  const setTitle = (id, name) => {
    const short = name.length > 26 ? `${name.slice(0, 24)}…` : name;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSessions((p) => p.map((s) => (s.id === id ? { ...s, title: `${short} · ${time}` } : s)));
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: "#f0f2f5" }}>
      <Sidebar
        moduleTitle={config.menu.title}
        accent={config.menu.accent}
        onBack={onBack}
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newChat}
      />
      {sessions.map((s) => (
        <div key={s.id} style={{ flex: 1, minWidth: 0, display: s.id === activeId ? "flex" : "none" }}>
          <ChatComponent config={config} onTitle={(name) => setTitle(s.id, name)} onNewChat={newChat} />
        </div>
      ))}
    </div>
  );
}
