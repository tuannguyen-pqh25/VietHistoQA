import { useState } from "react";
import type { Tab } from "./types";
import Sidebar from "./components/Sidebar";
import ChatPage from "./components/ChatPage";
import QuizPage from "./components/QuizPage";
import FlashcardPage from "./components/FlashcardPage";
import TeacherPage from "./components/TeacherPage";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#FAF8F3" }}>
      <Sidebar active={tab} onSelect={setTab} />
      <main className="flex-1 overflow-hidden">
        {tab === "chat" && <ChatPage />}
        {tab === "quiz" && <QuizPage />}
        {tab === "flashcard" && <FlashcardPage />}
        {tab === "teacher" && <TeacherPage />}
      </main>
    </div>
  );
}
