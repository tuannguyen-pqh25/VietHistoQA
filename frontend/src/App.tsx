import { useState, useRef } from "react";
import type { PipelineConfig } from "./types";
import Sidebar from "./components/Sidebar";
import ChatPage, { type ChatPageRef } from "./components/ChatPage";

const DEFAULT_CONFIG: PipelineConfig = {
  use_rag: true,
  top_k: 3,
  use_verifier: true,
  use_rerank: true,
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatRef = useRef<ChatPageRef>(null);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#FAF8F3" }}>
      {/* Sidebar: VietHistoQA + Historical Eras exploration + New chat */}
      <Sidebar
        onSelectQuery={(q) => chatRef.current?.sendQuery(q)}
        onNewChat={() => chatRef.current?.newChat()}
        onClearChat={() => chatRef.current?.clearChat()}
        isOpenMobile={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Main Historical Chat Interface */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <ChatPage
          ref={chatRef}
          config={DEFAULT_CONFIG}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
      </main>
    </div>
  );
}
