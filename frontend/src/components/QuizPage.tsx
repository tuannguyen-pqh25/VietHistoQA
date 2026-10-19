import { useState } from "react";
import type { QuizQuestion, QuizState } from "../types";
import { Badge, Divider, SectionLabel } from "./ui";

// ─── Demo Data ────────────────────────────────────────────────────────────────
const PERIODS = [
  "Thời kỳ Bắc thuộc",
  "Các triều đại phong kiến",
  "Kháng chiến chống ngoại xâm",
  "Lịch sử hiện đại",
  "Văn hóa Việt Nam",
];
const DIFFICULTIES = ["Dễ", "Trung bình", "Khó"];

const QUESTIONS: QuizQuestion[] = [
  {
    q: "Ngô Quyền đánh bại quân Nam Hán tại sông Bạch Đằng vào năm nào?",
    opts: ["905", "938", "968", "979"],
    correct: 1,
    explain: "Năm 938, Ngô Quyền sử dụng cọc gỗ và thủy triều đánh bại quân Nam Hán, chấm dứt hơn nghìn năm Bắc thuộc.",
    period: "Kháng chiến chống ngoại xâm",
  },
  {
    q: "Lý Công Uẩn dời đô từ Hoa Lư về Đại La, đặt tên mới là gì?",
    opts: ["Phú Xuân", "Thăng Long", "Đông Đô", "Đông Kinh"],
    correct: 1,
    explain: "Năm 1010, Lý Công Uẩn dời đô về Đại La và đổi tên thành Thăng Long — \"Rồng bay lên\", tiền thân của Hà Nội.",
    period: "Các triều đại phong kiến",
  },
  {
    q: "Hội nghị Diên Hồng được tổ chức để chuẩn bị kháng chiến chống lại quân đội nào?",
    opts: ["Quân Tống", "Quân Minh", "Quân Nguyên Mông", "Quân Thanh"],
    correct: 2,
    explain: "Năm 1284, Thái thượng hoàng Trần Thánh Tông triệu tập hội nghị để bàn về cuộc kháng chiến chống quân Nguyên Mông lần thứ hai.",
    period: "Kháng chiến chống ngoại xâm",
  },
  {
    q: "Văn Miếu — Quốc Tử Giám được xây dựng dưới triều đại nào?",
    opts: ["Nhà Đinh", "Nhà Tiền Lê", "Nhà Lý", "Nhà Trần"],
    correct: 2,
    explain: "Văn Miếu được xây năm 1070 dưới thời Lý Thánh Tông. Quốc Tử Giám — trường đại học đầu tiên — thành lập năm 1076.",
    period: "Văn hóa Việt Nam",
  },
  {
    q: "Bình Ngô Đại Cáo — bản tuyên ngôn độc lập của Đại Việt — do ai soạn thảo?",
    opts: ["Lê Lợi", "Nguyễn Trãi", "Trần Nguyên Hãn", "Lê Văn Hưu"],
    correct: 1,
    explain: "Nguyễn Trãi soạn Bình Ngô Đại Cáo năm 1428 theo lệnh Lê Lợi, tuyên bố nền độc lập sau 20 năm kháng chiến chống quân Minh.",
    period: "Kháng chiến chống ngoại xâm",
  },
];

// ─── Quiz Page Component ──────────────────────────────────────────────────────
export default function QuizPage() {
  const [state, setState] = useState<QuizState>("config");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [difficulty, setDifficulty] = useState("Trung bình");
  const [numQ, setNumQ] = useState(4);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const questions = QUESTIONS.slice(0, numQ);
  const score = answers.filter((a, i) => a === questions[i]?.correct).length;

  function startQuiz() {
    setAnswers(new Array(numQ).fill(null));
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setState("active");
  }

  function pick(i: number) {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
    const next = [...answers];
    next[current] = i;
    setAnswers(next);
  }

  function advance() {
    if (current + 1 >= questions.length) setState("done");
    else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  const q = questions[current];
  const pct = Math.round((score / questions.length) * 100);

  // ── Config Screen ──
  if (state === "config")
    return (
      <div className="h-full overflow-y-auto" style={{ background: "#FAF8F3" }}>
        <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
          <div>
            <h1
              className="text-[26px] font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "#2C2C2C" }}
            >
              Tạo đề kiểm tra
            </h1>
            <p className="text-[13.5px] mt-1.5" style={{ color: "#6B7280" }}>
              Cấu hình bài trắc nghiệm lịch sử Việt Nam của bạn
            </p>
          </div>

          <div className="card p-6 space-y-7">
            {/* Period */}
            <div>
              <SectionLabel>Thời kỳ lịch sử</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={`chip ${period === p ? "chip-active" : "chip-inactive"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Divider />

            {/* Difficulty */}
            <div>
              <SectionLabel>Độ khó</SectionLabel>
              <div className="flex gap-2 mt-2">
                {DIFFICULTIES.map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)} className={`chip ${difficulty === d ? "chip-active" : "chip-inactive"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <Divider />

            {/* Num questions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <SectionLabel>Số câu hỏi</SectionLabel>
                <span className="text-[13px] font-semibold" style={{ color: "#8B0000", fontFamily: "var(--font-mono)" }}>
                  {numQ}
                </span>
              </div>
              <input
                type="range" min={2} max={5} value={numQ}
                onChange={(e) => setNumQ(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: "#8B0000",
                  background: `linear-gradient(to right, #8B0000 ${((numQ - 2) / 3) * 100}%, #E5E0D5 ${((numQ - 2) / 3) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: "#9CA3AF" }}>2</span>
                <span className="text-[11px]" style={{ color: "#9CA3AF" }}>5</span>
              </div>
            </div>

            <button onClick={startQuiz} className="btn-primary w-full py-3 rounded-lg text-[14px]">
              Tạo đề thi →
            </button>
          </div>

          <div className="card p-5" style={{ background: "#FBF5EB", borderColor: "rgba(193,154,107,0.3)" }}>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "#6B7280" }}>
              <span className="font-semibold" style={{ color: "#92700A" }}>Lưu ý:</span> Câu hỏi được tuyển chọn từ ngân hàng đề đã kiểm duyệt theo chương trình lịch sử THPT và đại học Việt Nam.
            </p>
          </div>
        </div>
      </div>
    );

  // ── Results Screen ──
  if (state === "done")
    return (
      <div className="h-full flex items-center justify-center px-8" style={{ background: "#FAF8F3" }}>
        <div className="max-w-md w-full space-y-6 text-center animate-in">
          <div className="card p-8 space-y-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: pct >= 80 ? "#F0FFF4" : "#FDF0F0" }}
            >
              <span className="text-sm font-semibold" style={{ color: pct >= 80 ? "#15803D" : "#8B0000" }}>
                {pct >= 80 ? "Tốt" : pct >= 60 ? "Khá" : "Ôn tập"}
              </span>
            </div>
            <div>
              <p
                className="text-[42px] font-bold leading-none"
                style={{ fontFamily: "var(--font-display)", color: pct >= 80 ? "#15803D" : "#8B0000" }}
              >
                {pct}<span className="text-[24px]">%</span>
              </p>
              <p className="text-[15px] font-medium mt-2" style={{ color: "#2C2C2C" }}>
                {score}/{questions.length} câu đúng
              </p>
              <p className="text-[13px] mt-2" style={{ color: "#6B7280" }}>
                {pct >= 80
                  ? "Xuất sắc! Bạn nắm vững kiến thức lịch sử."
                  : pct >= 60
                    ? "Khá tốt. Hãy ôn lại phần chưa chắc."
                    : "Cần cố gắng thêm. Hãy đọc lại tài liệu."}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setState("config")} className="btn-secondary flex-1 py-2.5 rounded-lg text-[13.5px]">
                Tạo đề mới
              </button>
              <button onClick={startQuiz} className="btn-primary flex-1 py-2.5 rounded-lg text-[13.5px]">
                Làm lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  // ── Active Quiz ──
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAF8F3" }}>
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[12.5px]" style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}>
              Câu {current + 1} / {questions.length}
            </span>
            <Badge variant="red">{q.period}</Badge>
          </div>
          <div className="metric-bar-track">
            <div className="progress-fill h-full rounded-full" style={{ width: `${(current / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Question Card */}
        <div className="card p-7 space-y-6 animate-in">
          <p className="text-[17px] font-medium leading-relaxed" style={{ fontFamily: "var(--font-serif)", color: "#2C2C2C" }}>
            {q.q}
          </p>

          <div className="space-y-2.5">
            {q.opts.map((opt, i) => {
              let cls = "opt-btn";
              if (revealed) {
                if (i === q.correct) cls += " opt-correct";
                else if (i === selected) cls += " opt-wrong";
                else cls += " opt-neutral";
              }
              return (
                <button key={i} onClick={() => pick(i)} disabled={revealed} className={cls}>
                  <span className="inline-block w-6 text-[12px] font-semibold" style={{ fontFamily: "var(--font-mono)", opacity: 0.5 }}>
                    {["A", "B", "C", "D"][i]}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="animate-in p-4 rounded-lg" style={{ background: "#FBF5EB", border: "1px solid rgba(193,154,107,0.3)" }}>
              <p className="text-[10.5px] uppercase tracking-[0.1em] font-medium mb-1.5" style={{ color: "#92700A", fontFamily: "var(--font-mono)" }}>
                Giải thích
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: "#4A4A4A" }}>{q.explain}</p>
            </div>
          )}

          {revealed && (
            <button onClick={advance} className="btn-primary w-full py-3 rounded-lg text-[14px]">
              {current + 1 < questions.length ? "Câu tiếp theo →" : "Xem kết quả"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
