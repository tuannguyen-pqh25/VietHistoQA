import { useState, useRef, useEffect } from "react";
import type { ChatMsg } from "../types";
import { DrumIconSmall } from "./ui";

// ─── Demo Data ────────────────────────────────────────────────────────────────
const SUGGESTED = [
  "Trận Bạch Đằng năm 938",
  "Nhà Trần chống quân Nguyên Mông",
  "Cuộc khởi nghĩa Hai Bà Trưng",
  "Vương triều Lý dời đô về Thăng Long",
];

const AI_REPLIES: Array<{ text: string; sources: string[] }> = [
  {
    text: "Trận Bạch Đằng năm 938 là chiến thắng mang tính bước ngoặt của Ngô Quyền trước quân Nam Hán. Ông đã tận dụng thủy triều và cọc gỗ nhọn để tiêu diệt hạm đội địch, chấm dứt hơn nghìn năm Bắc thuộc và mở ra kỷ nguyên tự chủ của dân tộc.\n\nSau chiến thắng, Ngô Quyền xưng vương, đặt nền tảng cho nhà nước độc lập đầu tiên, đóng đô ở Cổ Loa (Hà Nội ngày nay).",
    sources: ["Đại Việt Sử Ký Toàn Thư, Quyển III", "Lịch Sử Việt Nam — Phan Huy Lê (2012)", "Vietnam: A History — Stanley Karnow"],
  },
  {
    text: "Nhà Trần (1225–1400) ba lần đánh bại quân Nguyên Mông xâm lược: năm 1258, 1285 và 1288. Chiến thắng vang dội nhất là trận Bạch Đằng năm 1288 dưới sự chỉ huy của Hưng Đạo Vương Trần Quốc Tuấn.\n\nHội nghị Diên Hồng năm 1284 thể hiện tinh thần đoàn kết toàn dân, khi các bô lão cùng đồng thanh đáp \"Đánh!\" trước câu hỏi về kháng chiến.",
    sources: ["Đại Việt Sử Ký Toàn Thư, Quyển V", "Hưng Đạo Vương — Nguyễn Khắc Thuần", "The Tran Dynasty & Mongol Wars"],
  },
  {
    text: "Hai Bà Trưng — Trưng Trắc và Trưng Nhị — phát động cuộc khởi nghĩa năm 40 SCN chống lại ách đô hộ nhà Hán. Chỉ trong thời gian ngắn, nghĩa quân giải phóng 65 thành trì, lập nên nhà nước độc lập ngắn ngủi.\n\nTrưng Trắc xưng vương, đóng đô ở Mê Linh. Đây là lần đầu tiên trong lịch sử, một phụ nữ lãnh đạo cuộc giải phóng dân tộc.",
    sources: ["Hậu Hán Thư (中文)", "Đại Việt Sử Ký Toàn Thư, Quyển I", "Việt Điện U Linh Tập"],
  },
  {
    text: "Năm 1010, Lý Công Uẩn dời đô từ Hoa Lư về Đại La, đổi tên thành Thăng Long — có nghĩa là \"Rồng bay lên\". Sự kiện này đánh dấu bước phát triển mới của nhà nước phong kiến Việt Nam.\n\nThăng Long trở thành trung tâm chính trị, kinh tế và văn hóa, là tiền thân của Hà Nội ngày nay.",
    sources: ["Chiếu Dời Đô — Lý Công Uẩn (1010)", "Đại Việt Sử Ký Toàn Thư, Quyển II", "Thăng Long — Hà Nội: Lịch sử 1000 năm"],
  },
];

const WELCOME: ChatMsg = {
  id: 0,
  role: "ai",
  text: "Xin chào! Tôi là Sử Việt AI — trợ lý học lịch sử Việt Nam được hỗ trợ bởi trí tuệ nhân tạo.\n\nBạn có thể hỏi tôi về các triều đại, sự kiện, nhân vật lịch sử, hoặc chọn một chủ đề gợi ý bên dưới để bắt đầu.",
  sources: [],
};

// ─── Chat Page Component ──────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [aiIdx, setAiIdx] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  // ─── Speech to Text (Web Speech API) ──────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, []);

  function toggleListening() {
    setSpeechError(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        "Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy sử dụng Google Chrome, Cốc Cốc hoặc Microsoft Edge."
      );
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError(
            "Microphone bị từ chối truy cập. Vui lòng cấp quyền micro trên thanh địa chỉ trình duyệt."
          );
        } else if (event.error === "no-speech") {
          // Không phát hiện tiếng nói - kết thúc nhẹ nhàng
        } else if (event.error === "network") {
          setSpeechError("Lỗi kết nối mạng của dịch vụ nhận diện giọng nói.");
        } else {
          setSpeechError(`Lỗi nhận diện: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error(err);
      setSpeechError(
        "Không thể kích hoạt microphone: " + (err.message || "Lỗi không xác định")
      );
      setIsListening(false);
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || typing) return;
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: t }]);
    setInput("");
    setTyping(true);

    try {
      const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, '');
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ question: t, use_rag: true, top_k: 3 }),
      });

      if (!response.ok) {
        throw new Error(`Lỗi: ${response.status}`);
      }

      const data = await response.json();
      
      const formattedSources = data.sources ? data.sources.map((s: any, idx: number) => {
        const meta = s.metadata || {};
        const period = meta.historical_period || "Không xác định";
        const years = meta.year_mentions && meta.year_mentions.length > 0 ? meta.year_mentions.join(", ") : "N/A";
        return `Tài liệu [${idx + 1}]: Thời kỳ ${period} (Liên quan đến năm: ${years})`;
      }) : [];

      setMessages((m) => [
        ...m,
        { 
          id: Date.now() + 1, 
          role: "ai", 
          text: data.answer, 
          sources: formattedSources,
          confidence: data.confidence_score 
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: "ai", text: "Xin lỗi, đã có lỗi xảy ra khi kết nối tới máy chủ.", sources: [] },
      ]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-6 bg-[#FAF8F3]" style={{ borderBottom: "1px solid #E5E0D5" }}>
        <div className="max-w-3xl mx-auto">
          <h1
            className="text-[26px] font-semibold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-display)", color: "#2C2C2C" }}
          >
            Hỏi đáp lịch sử
          </h1>
          <p className="text-[13.5px] mt-1.5" style={{ color: "#6B7280" }}>
            Trợ lý AI học lịch sử Việt Nam — nguồn tài liệu học thuật được kiểm duyệt
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6" style={{ background: "#FAF8F3" }}>
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${i > 0 ? "animate-in" : ""}`}>
              {msg.role === "ai" && (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5 mr-3 flex items-center justify-center"
                  style={{ background: "#8B0000" }}
                >
                  <DrumIconSmall />
                </div>
              )}
              <div className="max-w-[80%] space-y-2.5">
                <div
                  className={`px-4 py-3.5 rounded-xl text-[13.5px] leading-relaxed ${msg.role === "ai" ? "msg-ai" : "msg-user"}`}
                  style={{ whiteSpace: "pre-line", lineHeight: "1.7" }}
                >
                  {msg.text}
                </div>
                {msg.role === "ai" && msg.confidence !== undefined && (
                  <div className="flex items-center gap-1.5 mt-1 mb-2">
                  </div>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start animate-in">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5 mr-3 flex items-center justify-center"
                style={{ background: "#8B0000" }}
              >
                <DrumIconSmall />
              </div>
              <div className="msg-ai px-4 py-3.5 rounded-xl flex gap-1.5 items-center">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-8 py-5 bg-white" style={{ borderTop: "1px solid #E5E0D5" }}>
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip chip-inactive text-[12.5px]">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Banner khi đang nhận diện giọng nói */}
          {isListening && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#FDF0F0] border border-[rgba(139,0,0,0.25)] text-[12.5px] text-[#8B0000] animate-in">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B0000]"></span>
                </span>
                <span className="font-semibold">Đang lắng nghe...</span>
                <span className="text-[#6B7280]">Hãy nói câu hỏi về lịch sử Việt Nam (VD: "Trận Bạch Đằng năm 938")</span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[12px] font-medium text-[#8B0000] hover:underline cursor-pointer ml-3 flex-shrink-0"
              >
                Dừng
              </button>
            </div>
          )}

          {/* Thông báo lỗi khi không thể dùng Micro */}
          {speechError && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[12.5px] text-[#92400E] animate-in">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{speechError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-[14px] leading-none text-[#92400E] font-bold hover:opacity-70 ml-2 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex gap-2.5 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={isListening ? "Đang nhận diện giọng nói của bạn..." : "Hỏi về lịch sử Việt Nam... (hoặc bấm biểu tượng Micro để nói)"}
              rows={1}
              className={`input-field flex-1 px-4 py-3 resize-none transition-all ${
                isListening ? "border-[#8B0000] shadow-[0_0_0_3px_rgba(139,0,0,0.08)] bg-[#FFFDFD]" : ""
              }`}
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />

            {/* Nút Microphone (Speech-to-Text) */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={typing}
              title={isListening ? "Đang lắng nghe... Nhấn để dừng" : "Hỏi bằng giọng nói (Speech-to-Text)"}
              className={`h-[44px] px-3.5 rounded-lg text-[13.5px] flex items-center justify-center transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? "bg-[#8B0000] text-white ring-4 ring-red-200 animate-pulse shadow-md"
                  : "bg-[#F5F0E8] text-[#8B0000] border border-[#E5E0D5] hover:bg-[#EDE8DF] hover:border-[#C19A6B]"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              onClick={() => send()}
              disabled={!input.trim() || typing}
              className="btn-primary px-5 py-3 rounded-lg text-[13.5px] flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
              style={{ minHeight: "44px" }}
            >
              Gửi
            </button>
          </div>
          <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
            Enter để gửi · Shift+Enter xuống dòng · Bấm Micro để nói tiếng Việt (hỗ trợ Chrome/Edge)
          </p>
        </div>
      </div>
    </div>
  );
}
