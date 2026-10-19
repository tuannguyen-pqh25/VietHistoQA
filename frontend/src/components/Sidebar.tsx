import type { Tab } from "../types";
import { Divider, DrumIcon, SectionLabel } from "./ui";

const NAV_ITEMS: { id: Tab; label: string; sub: string }[] = [
  { id: "chat", label: "Hỏi đáp", sub: "AI history conversation" },
  { id: "quiz", label: "Trắc nghiệm", sub: "Interactive quiz" },
  { id: "flashcard", label: "Flashcard", sub: "Historical memory cards" },
  { id: "teacher", label: "Dành cho giáo viên", sub: "Teacher dashboard" },
];

interface SidebarProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

export default function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside
      className="flex-shrink-0 flex flex-col bg-white"
      style={{ width: 260, borderRight: "1px solid #E5E0D5", height: "100%" }}
    >
      {/* Logo */}
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#8B0000", boxShadow: "0 2px 8px rgba(139,0,0,0.25)" }}
          >
            <DrumIcon size={24} />
          </div>
          <div>
            <h1
              className="text-[18px] font-semibold leading-tight tracking-[-0.01em]"
              style={{ color: "#2C2C2C", fontFamily: "var(--font-display)" }}
            >
              Sử Việt AI
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF", fontFamily: "var(--font-body)" }}>
              Vietnamese History Tutor
            </p>
          </div>
        </div>
      </div>

      <Divider />

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
        <SectionLabel>Học tập</SectionLabel>
        {NAV_ITEMS.slice(0, 3).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`nav-item w-full ${active === item.id ? "active" : ""}`}
          >
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        ))}

        <div className="pt-4 pb-1">
          <SectionLabel>Quản lý</SectionLabel>
        </div>
        {NAV_ITEMS.slice(3).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`nav-item w-full ${active === item.id ? "active" : ""}`}
          >
            <div className="flex-1 text-left">
              <div>{item.label}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#9CA3AF", fontWeight: 400 }}>
                {item.sub}
              </div>
            </div>
          </button>
        ))}
      </nav>

      <Divider />

      {/* Footer */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-[12px]" style={{ color: "#6B7280", fontFamily: "var(--font-body)" }}>
            Mô hình đang hoạt động
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#9CA3AF" }}>
          Qwen2.5-7B-Instruct · QLoRA · RAG Pipeline
        </p>
      </div>
    </aside>
  );
}
