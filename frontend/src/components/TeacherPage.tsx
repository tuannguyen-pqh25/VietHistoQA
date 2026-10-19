import { useState } from "react";
import { Badge } from "./ui";

// ─── Demo Data ────────────────────────────────────────────────────────────────
const METRICS = [
  {
    label: "BLEU Score",
    desc: "Đánh giá độ chính xác n-gram so với câu trả lời tham chiếu",
    trackA: 0.412,
    trackB: 0.389,
    max: 0.6,
  },
  {
    label: "ROUGE-L",
    desc: "F1 dựa trên dãy con chung dài nhất (LCS)",
    trackA: 0.681,
    trackB: 0.643,
    max: 1.0,
  },
  {
    label: "BERTScore",
    desc: "Độ tương đồng ngữ nghĩa sử dụng BERT embeddings",
    trackA: 0.874,
    trackB: 0.851,
    max: 1.0,
  },
];

const QUESTIONS_PERF = [
  { topic: "Trận Bạch Đằng 938", correct: 87, total: 100, difficulty: "Trung bình" },
  { topic: "Hội nghị Diên Hồng", correct: 72, total: 100, difficulty: "Khó" },
  { topic: "Nhà Lý dời đô Thăng Long", correct: 91, total: 100, difficulty: "Dễ" },
  { topic: "Bình Ngô Đại Cáo", correct: 65, total: 100, difficulty: "Khó" },
  { topic: "Chiến thắng Điện Biên Phủ", correct: 88, total: 100, difficulty: "Trung bình" },
];

const STUDENT_DATA = [
  { name: "Nguyễn Minh Anh", sessions: 12, score: 88, streak: 7 },
  { name: "Trần Thị Bích", sessions: 8, score: 74, streak: 3 },
  { name: "Lê Văn Cường", sessions: 15, score: 92, streak: 14 },
  { name: "Phạm Hương Lan", sessions: 6, score: 61, streak: 1 },
  { name: "Vũ Đức Minh", sessions: 11, score: 83, streak: 5 },
];

// ─── Teacher Page Component ───────────────────────────────────────────────────
export default function TeacherPage() {
  const [evalTab, setEvalTab] = useState<"metrics" | "students" | "questions">("metrics");

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAF8F3" }}>
      <div className="px-8 py-8 space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-[26px] font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "#2C2C2C" }}
            >
              Bảng điều khiển giáo viên
            </h1>
            <p className="text-[13.5px] mt-1.5" style={{ color: "#6B7280" }}>
              Kết quả đánh giá mô hình AI · Cập nhật lần cuối: 25/09/2026
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="green">Track A: FT+RAG</Badge>
            <Badge variant="gray">Track B: Base</Badge>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Học sinh", value: "248", sub: "+12 tuần này" },
            { label: "Phiên học", value: "1,847", sub: "30 ngày qua" },
            { label: "Câu hỏi", value: "4,293", sub: "Đã xử lý" },
            { label: "Độ hài lòng", value: "94%", sub: "Đánh giá tốt" },
          ].map((s) => (
            <div key={s.label} className="card p-5">
              <p className="text-[12px] mb-1" style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>
                {s.label}
              </p>
              <p className="text-[28px] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: "#2C2C2C" }}>
                {s.value}
              </p>
              <p className="text-[12px] mt-1" style={{ color: "#C19A6B" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#EDE8DF", width: "fit-content" }}>
          {(["metrics", "students", "questions"] as const).map((t) => {
            const labels: Record<string, string> = { metrics: "Đánh giá mô hình", students: "Học sinh", questions: "Câu hỏi" };
            return (
              <button
                key={t}
                onClick={() => setEvalTab(t)}
                className="px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150"
                style={{
                  background: evalTab === t ? "#FFFFFF" : "transparent",
                  color: evalTab === t ? "#2C2C2C" : "#6B7280",
                  boxShadow: evalTab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  fontFamily: "var(--font-body)",
                }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Metrics tab */}
        {evalTab === "metrics" && (
          <div className="space-y-5 animate-in-fast">
            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-4">
              {METRICS.map((m) => {
                const aWins = m.trackA > m.trackB;
                const diff = Math.abs(m.trackA - m.trackB);
                return (
                  <div key={m.label} className="card p-6 space-y-4">
                    <div>
                      <p className="font-semibold text-[14.5px]" style={{ color: "#2C2C2C" }}>{m.label}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>{m.desc}</p>
                    </div>
                    <div className="space-y-3">
                      {/* Track A */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[12px] font-medium" style={{ color: "#8B0000", fontFamily: "var(--font-mono)" }}>Track A</span>
                          <span className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#2C2C2C" }}>
                            {m.trackA.toFixed(3)}
                          </span>
                        </div>
                        <div className="metric-bar-track">
                          <div className="progress-fill h-full rounded-full" style={{ width: `${(m.trackA / m.max) * 100}%` }} />
                        </div>
                      </div>
                      {/* Track B */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[12px] font-medium" style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>Track B</span>
                          <span className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#9CA3AF" }}>
                            {m.trackB.toFixed(3)}
                          </span>
                        </div>
                        <div className="metric-bar-track">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(m.trackB / m.max) * 100}%`, background: "#C19A6B", transition: "width 0.4s ease" }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11.5px] font-mono" style={{ color: "#9CA3AF" }}>Δ {diff.toFixed(3)}</span>
                      <Badge variant={aWins ? "red" : "bronze"}>{aWins ? "A tốt hơn" : "B tốt hơn"}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Radar / bar chart representation */}
            <div className="card p-6">
              <p className="font-semibold text-[14.5px] mb-1" style={{ color: "#2C2C2C" }}>So sánh tổng quan</p>
              <p className="text-[12.5px] mb-6" style={{ color: "#9CA3AF" }}>Điểm chuẩn hóa 0–100 theo từng chỉ số</p>
              <div className="space-y-5">
                {METRICS.map((m) => (
                  <div key={m.label} className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
                    <p className="text-[12.5px] font-medium" style={{ color: "#4A4A4A" }}>{m.label}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 metric-bar-track">
                          <div className="progress-fill h-full rounded-full" style={{ width: `${(m.trackA / m.max) * 100}%` }} />
                        </div>
                        <span className="text-[11px] w-10 text-right font-mono" style={{ color: "#8B0000" }}>
                          {m.trackA.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 metric-bar-track">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(m.trackB / m.max) * 100}%`, background: "#C19A6B", transition: "width 0.4s ease" }}
                          />
                        </div>
                        <span className="text-[11px] w-10 text-right font-mono" style={{ color: "#C19A6B" }}>
                          {m.trackB.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <div />
                  </div>
                ))}
                <div className="flex items-center gap-5 pt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-1 rounded-full" style={{ background: "#8B0000" }} />
                    <span className="text-[11.5px] font-mono" style={{ color: "#6B7280" }}>Track A (FT+RAG)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-1 rounded-full" style={{ background: "#C19A6B" }} />
                    <span className="text-[11.5px] font-mono" style={{ color: "#6B7280" }}>Track B (Base)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Students tab */}
        {evalTab === "students" && (
          <div className="card animate-in-fast overflow-hidden">
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #E5E0D5" }}>
              <p className="font-semibold text-[14.5px]" style={{ color: "#2C2C2C" }}>Học sinh</p>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #EDE8DF", background: "#FAFAF8" }}>
                  {["Họ tên", "Phiên học", "Điểm TB", "Streak", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.1em]"
                      style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)", fontWeight: 500 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STUDENT_DATA.map((s, i) => (
                  <tr
                    key={i}
                    className="transition-colors hover:bg-[#FAFAF8]"
                    style={{ borderBottom: i < STUDENT_DATA.length - 1 ? "1px solid #EDE8DF" : "none" }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                          style={{ background: "#FDF0F0", color: "#8B0000" }}
                        >
                          {s.name.split(" ").pop()?.charAt(0)}
                        </div>
                        <span className="text-[13.5px]" style={{ color: "#2C2C2C" }}>{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13.5px] font-mono" style={{ color: "#6B7280" }}>{s.sessions}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 metric-bar-track">
                          <div className="progress-fill h-full rounded-full" style={{ width: `${s.score}%` }} />
                        </div>
                        <span
                          className="text-[13px] font-mono"
                          style={{ color: s.score >= 80 ? "#15803D" : s.score >= 70 ? "#92700A" : "#8B0000" }}
                        >
                          {s.score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-mono" style={{ color: "#6B7280" }}>{s.streak} ngày</span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-[12.5px] font-medium" style={{ color: "#8B0000" }}>Chi tiết →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Questions tab */}
        {evalTab === "questions" && (
          <div className="card animate-in-fast overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #E5E0D5" }}>
              <p className="font-semibold text-[14.5px]" style={{ color: "#2C2C2C" }}>Hiệu suất câu hỏi</p>
              <button className="btn-primary px-4 py-2 rounded-lg text-[12.5px]">+ Thêm câu hỏi</button>
            </div>
            <div className="divide-y" style={{ borderColor: "#EDE8DF" }}>
              {QUESTIONS_PERF.map((q, i) => {
                const pct = Math.round((q.correct / q.total) * 100);
                return (
                  <div key={i} className="px-6 py-4 flex items-center gap-6 hover:bg-[#FAFAF8] transition-colors">
                    <div className="flex-1">
                      <p className="text-[13.5px] font-medium" style={{ color: "#2C2C2C" }}>{q.topic}</p>
                      <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>
                        {q.correct}/{q.total} học sinh trả lời đúng
                      </p>
                    </div>
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px]" style={{ color: "#9CA3AF" }}>Tỉ lệ đúng</span>
                        <span
                          className="text-[12px] font-mono font-semibold"
                          style={{ color: pct >= 80 ? "#15803D" : pct >= 70 ? "#92700A" : "#8B0000" }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="metric-bar-track">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: pct >= 80 ? "#22C55E" : pct >= 70 ? "#C19A6B" : "#8B0000", transition: "width 0.4s" }}
                        />
                      </div>
                    </div>
                    <Badge variant={q.difficulty === "Dễ" ? "green" : q.difficulty === "Khó" ? "red" : "bronze"}>
                      {q.difficulty}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
