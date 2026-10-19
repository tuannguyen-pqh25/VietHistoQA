// ─── Shared Types ─────────────────────────────────────────────────────────────
export type Tab = "chat" | "quiz" | "flashcard" | "teacher";

export interface ChatMsg {
  id: number;
  role: "user" | "ai";
  text: string;
  sources?: string[];
  confidence?: number;
}

export interface QuizQuestion {
  q: string;
  opts: string[];
  correct: number;
  explain: string;
  period: string;
}

export interface FlashcardData {
  front: string;
  back: string;
  detail: string;
  timeline: string;
  tag: string;
}

export type QuizState = "config" | "active" | "done";
