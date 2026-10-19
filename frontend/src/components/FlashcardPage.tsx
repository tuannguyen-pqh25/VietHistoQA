import { useState } from "react";
import type { FlashcardData } from "../types";
import { Badge, Divider } from "./ui";

// ─── Demo Data ────────────────────────────────────────────────────────────────
const FLASHCARDS: FlashcardData[] = [
  {
    front: "Triều đại nào xây dựng Văn Miếu Quốc Tử Giám đầu tiên?",
    back: "Nhà Lý (1009–1225)",
    detail: "Văn Miếu được xây năm 1070 dưới thời Lý Thánh Tông. Quốc Tử Giám — trường đại học đầu tiên của Việt Nam — thành lập năm 1076 dưới thời Lý Nhân Tông.",
    timeline: "1009 → Nhà Lý thành lập · 1010 → Dời đô Thăng Long · 1070 → Xây Văn Miếu · 1076 → Quốc Tử Giám",
    tag: "Văn hóa",
  },
  {
    front: "Hoàng đế Quang Trung đại phá quân Thanh vào ngày mấy Tết Kỷ Dậu?",
    back: "Mùng 5 Tết Kỷ Dậu (1789)",
    detail: "Chiến thắng Đống Đa ngày 5 Tết Kỷ Dậu (30/1/1789) — Hoàng đế Quang Trung (Nguyễn Huệ) dẫn nghĩa quân Tây Sơn đánh bại 29 vạn quân Thanh xâm lược trong chưa đầy 10 ngày.",
    timeline: "1771 → Khởi nghĩa Tây Sơn · 1788 → Nguyễn Huệ lên ngôi · 1789 → Đại phá quân Thanh",
    tag: "Kháng chiến",
  },
  {
    front: "Bình Ngô Đại Cáo được ví như bản tuyên ngôn độc lập thứ mấy của Việt Nam?",
    back: "Tuyên ngôn độc lập thứ hai",
    detail: "Nguyễn Trãi soạn Bình Ngô Đại Cáo năm 1428 — sau \"Nam quốc sơn hà\" (thế kỷ XI). Tác phẩm khẳng định chủ quyền, lãnh thổ, văn hóa và lịch sử riêng biệt của dân tộc Việt Nam.",
    timeline: "XI → Nam quốc sơn hà · 1407 → Minh đô hộ · 1418 → Khởi nghĩa Lam Sơn · 1428 → Bình Ngô Đại Cáo",
    tag: "Văn học - Lịch sử",
  },
  {
    front: "Hiệp định Genève năm 1954 chia cắt Việt Nam tại vĩ tuyến bao nhiêu?",
    back: "Vĩ tuyến 17 (sông Bến Hải)",
    detail: "Hiệp định Genève ký ngày 20/7/1954 tạm thời chia đôi Việt Nam tại vĩ tuyến 17 — lấy sông Bến Hải làm ranh giới, chờ tổng tuyển cử thống nhất năm 1956 (không thực hiện được).",
    timeline: "1945 → Độc lập · 1946 → Kháng chiến · 1954 → Điện Biên Phủ → Genève · 1975 → Thống nhất",
    tag: "Lịch sử hiện đại",
  },
  {
    front: "Khởi nghĩa Hai Bà Trưng nổ ra vào năm nào sau Công nguyên?",
    back: "Năm 40 SCN",
    detail: "Năm 40 SCN, Trưng Trắc và Trưng Nhị phát động khởi nghĩa chống ách đô hộ nhà Hán, giải phóng 65 thành trì. Trưng Trắc xưng vương, đóng đô ở Mê Linh — lần đầu phụ nữ lãnh đạo kháng chiến.",
    timeline: "111 TCN → Hán chiếm Âu Lạc · 40 SCN → Khởi nghĩa · 43 SCN → Thất bại · Thế kỷ X → Độc lập",
    tag: "Thời kỳ Bắc thuộc",
  },
];

// ─── Flashcard Page Component ─────────────────────────────────────────────────
export default function FlashcardPage() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  function go(dir: 1 | -1) {
    setFlipped(false);
    setTimeout(() => setIdx((i) => (i + dir + FLASHCARDS.length) % FLASHCARDS.length), 200);
  }

  const card = FLASHCARDS[idx];

  return (
    <div className="h-full flex flex-col" style={{ background: "#FAF8F3" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-6 bg-white" style={{ borderBottom: "1px solid #E5E0D5" }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "#2C2C2C" }}>
              Flashcard lịch sử
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>Nhấp vào thẻ để xem đáp án</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] font-mono" style={{ color: "#6B7280" }}>
              {idx + 1} / {FLASHCARDS.length}
            </span>
            <Badge variant="bronze">{card.tag}</Badge>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex-shrink-0 px-8" style={{ background: "white" }}>
        <div className="max-w-2xl mx-auto pb-4">
          <div className="flex gap-1.5">
            {FLASHCARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setFlipped(false); setTimeout(() => setIdx(i), 150); }}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: i === idx ? "#8B0000" : i < idx ? "#C19A6B" : "#E5E0D5" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="fc-scene" style={{ height: 320 }}>
            <div
              className="fc-inner cursor-pointer"
              style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              onClick={() => setFlipped((f) => !f)}
            >
              {/* Front */}
              <div className="fc-face card flex flex-col items-center justify-center p-10 text-center" style={{ border: "1px solid #E5E0D5" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-5" style={{ background: "#FDF0F0" }}>
                  <span className="text-[#8B0000] text-base font-bold">?</span>
                </div>
                <p className="text-[10.5px] uppercase tracking-[0.12em] font-medium mb-4" style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>
                  Câu hỏi
                </p>
                <p className="text-[19px] font-medium leading-relaxed" style={{ fontFamily: "var(--font-serif)", color: "#2C2C2C", maxWidth: "480px" }}>
                  {card.front}
                </p>
                <p className="text-[12px] mt-6" style={{ color: "#C19A6B" }}>Nhấp để lật thẻ</p>
              </div>

              {/* Back */}
              <div className="fc-face fc-back card flex flex-col p-8" style={{ background: "#FFFDF9", border: "1px solid rgba(193,154,107,0.35)" }}>
                <div className="text-center mb-5">
                  <p className="text-[10.5px] uppercase tracking-[0.12em] font-medium mb-3" style={{ color: "#C19A6B", fontFamily: "var(--font-mono)" }}>
                    Đáp án
                  </p>
                  <p className="text-[22px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "#8B0000" }}>
                    {card.back}
                  </p>
                </div>
                <Divider className="mb-4" />
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#4A4A4A" }}>{card.detail}</p>
                <div className="mt-auto">
                  <p className="text-[10px] uppercase tracking-[0.1em] mb-1.5" style={{ color: "#C19A6B", fontFamily: "var(--font-mono)" }}>
                    Dòng thời gian
                  </p>
                  <p className="text-[11.5px]" style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>{card.timeline}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => go(-1)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13.5px] btn-secondary">
              ← Trước
            </button>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="px-6 py-2.5 rounded-lg text-[13.5px] font-medium transition-all"
              style={{ background: "#FBF5EB", color: "#92700A", border: "1.5px solid rgba(193,154,107,0.4)" }}
            >
              Lật thẻ ↩
            </button>
            <button onClick={() => go(1)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13.5px] btn-secondary">
              Tiếp →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
