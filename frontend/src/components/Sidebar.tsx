import { useState } from "react";
import { HISTORICAL_ERAS } from "../eras";
import { Divider, DrumIcon, SectionLabel } from "./ui";

interface SidebarProps {
  onSelectQuery: (query: string) => void;
  onNewChat: () => void;
  onClearChat: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  onSelectQuery,
  onNewChat,
  onClearChat,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const [expandedEra, setExpandedEra] = useState<string | null>("era-ly-tran");

  function toggleEra(id: string) {
    setExpandedEra((prev) => (prev === id ? null : id));
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-white transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpenMobile ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        style={{
          width: 300,
          borderRight: "1px solid #E5E0D5",
          height: "100%",
        }}
      >
        {/* Header / Brand */}
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: "#8B0000",
                boxShadow: "0 2px 8px rgba(139,0,0,0.25)",
              }}
            >
              <DrumIcon size={22} />
            </div>
            <div>
              <h1
                className="text-[18px] font-bold leading-tight tracking-[-0.01em]"
                style={{ color: "#2C2C2C", fontFamily: "var(--font-display)" }}
              >
                VietHistoQA
              </h1>
              <p className="text-[11.5px] mt-0.5" style={{ color: "#8B0000", fontWeight: 500 }}>
                Lịch sử Việt Nam (905–1975)
              </p>
            </div>
          </div>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Action: New Chat */}
        <div className="px-4 pb-3 space-y-2">
          <button
            onClick={() => {
              onNewChat();
              onCloseMobile?.();
            }}
            className="w-full py-2.5 px-3.5 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium bg-[#8B0000] text-white hover:bg-[#A01010] shadow-sm transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Cuộc trò chuyện mới</span>
          </button>
        </div>

        <Divider />

        {/* Scrollable Center: Historical Eras & Questions */}
        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>Khám phá theo thời kỳ (905–1975)</SectionLabel>
          </div>

          <div className="space-y-1.5">
            {HISTORICAL_ERAS.map((era) => {
              const isExpanded = expandedEra === era.id;
              return (
                <div
                  key={era.id}
                  className={`rounded-lg border transition-all ${
                    isExpanded
                      ? "bg-[#FAF8F3] border-[#C19A6B]/50 shadow-xs"
                      : "bg-white border-[#E5E0D5]/70 hover:border-[#C19A6B]/40 hover:bg-[#FAF8F3]/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleEra(era.id)}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-[#2C2C2C] flex items-center gap-1.5">
                        <span>{era.title}</span>
                      </div>
                      <div className="text-[11px] text-[#8B0000] font-medium">
                        {era.period} · {era.badge}
                      </div>
                    </div>
                    <span className="text-[#9CA3AF] text-[12px] transform transition-transform">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-[#E5E0D5]/60 space-y-1.5">
                      <p className="text-[11.5px] text-[#6B7280] leading-snug italic mb-2">
                        {era.description}
                      </p>
                      <div className="space-y-1">
                        {era.queries.map((q, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => {
                              onSelectQuery(q);
                              onCloseMobile?.();
                            }}
                            className="w-full text-left p-2 rounded-md bg-white border border-[#E5E0D5] hover:border-[#8B0000] hover:text-[#8B0000] text-[12px] text-[#4A4A4A] transition-all cursor-pointer flex items-start gap-1.5 leading-snug group"
                          >
                            <span className="text-[#8B0000] font-bold text-[11px] group-hover:translate-x-0.5 transition-transform">
                              ➔
                            </span>
                            <span className="flex-1">{q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Divider />

        {/* Footer: Clean, Simple Actions */}
        <div className="px-5 py-3.5 bg-[#FAF8F3]/60 flex items-center justify-between">
          <span className="text-[11.5px] text-[#6B7280]">
            Tư liệu chính sử (905–1975)
          </span>
          <button
            onClick={onClearChat}
            title="Xóa toàn bộ lịch sử trò chuyện"
            className="text-[11.5px] font-medium text-[#9CA3AF] hover:text-[#DC2626] transition-colors cursor-pointer"
          >
            Xóa chat
          </button>
        </div>
      </aside>
    </>
  );
}
