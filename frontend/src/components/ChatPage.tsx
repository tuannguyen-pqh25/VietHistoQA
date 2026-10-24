import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import type { ChatMsg, PipelineConfig, SourceItem } from "../types";

export interface ChatPageRef {
  sendQuery: (query: string) => void;
  newChat: () => void;
  clearChat: () => void;
}

interface ChatPageProps {
  config: PipelineConfig;
  onToggleSidebar?: () => void;
}

const SUGGESTED_QUICK = [
  "Trận Bạch Đằng năm 938 của Ngô Quyền có ý nghĩa lịch sử như thế nào?",
  "Ai là người ban Chiếu dời đô từ Hoa Lư ra Thăng Long năm 1010?",
  "Quốc hiệu Đại Việt được đổi từ Đại Cồ Việt vào năm nào và dưới thời vua nào?",
  "Bộ luật Hồng Đức được ban hành năm 1483 dưới thời vua nào?",
  "Ngày 30/4/1975 gắn liền với chiến dịch nào đã thống nhất đất nước về lãnh thổ?",
];

const WELCOME_MSG: ChatMsg = {
  id: 0,
  role: "ai",
  text: "Xin chào! Tôi là VietHistoQA — trợ lý tra cứu và học tập lịch sử Việt Nam (giai đoạn 905–1975).\n\nBạn có thể đặt câu hỏi về các triều đại, sự kiện, nhân vật lịch sử bằng văn bản, giọng nói (Microphone), hoặc chọn các thời kỳ lịch sử ở thanh bên để bắt đầu.",
  sources: [],
  is_in_domain: true,
};

const ChatPage = forwardRef<ChatPageRef, ChatPageProps>(({ config, onToggleSidebar }, ref) => {
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  // Typewriter Streaming State
  const streamTimerRef = useRef<any>(null);
  const currentStreamingIdRef = useRef<number | null>(null);
  const currentFullTextRef = useRef<string>("");

  // Speech-to-Text (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Expose imperative methods to Sidebar (onSelectQuery, newChat, clearChat)
  useImperativeHandle(ref, () => ({
    sendQuery: (q: string) => {
      send(q);
    },
    newChat: () => {
      stopSpeech();
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      setMessages([
        {
          id: Date.now(),
          role: "ai",
          text: "Đã bắt đầu cuộc trò chuyện mới. Hãy đặt câu hỏi lịch sử bạn muốn tìm hiểu!",
          sources: [],
          is_in_domain: true,
        },
      ]);
    },
    clearChat: () => {
      stopSpeech();
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      setMessages([]);
    },
  }));

  useEffect(() => {
    // Kích hoạt nạp danh sách giọng đọc của trình duyệt ngay khi tải trang
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const onVoices = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
        stopSpeech();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }
      };
    }

    return () => {
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      stopSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const [ttsNotice, setTtsNotice] = useState<string | null>(null);

  // ─── Text-to-Speech (Web Speech Synthesis) ──────────────────────────────────
  function getVietnameseVoice(): SpeechSynthesisVoice | null {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Tìm giọng theo mã ngôn ngữ tiếng Việt chuẩn (vi-VN, vi_VN, vi)
    const byLang = voices.find(
      (v) =>
        v.lang === "vi-VN" ||
        v.lang === "vi_VN" ||
        v.lang.toLowerCase().startsWith("vi-") ||
        v.lang.toLowerCase() === "vi"
    );
    if (byLang) return byLang;

    // 2. Tìm theo tên giọng tiếng Việt (Google tiếng Việt, Microsoft HoaiMy, Microsoft NamMinh, etc.)
    const byName = voices.find((v) => {
      const n = v.name.toLowerCase();
      return (
        n.includes("vietnam") ||
        n.includes("tiếng việt") ||
        n.includes("hoaimy") ||
        n.includes("namminh") ||
        n.includes("vietnamese")
      );
    });
    if (byName) return byName;

    return null;
  }

  function toggleSpeech(msgId: number, text: string) {
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt của bạn không hỗ trợ tính năng đọc giọng nói.");
      return;
    }

    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setTtsNotice(null);

    // Xử lý sạch định dạng markdown trước khi đọc
    const cleanText = text
      .replace(/[*#_`~]/g, "")
      .replace(/\[Tư liệu \d+\]/g, "")
      .replace(/\n+/g, ". ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const viVoice = getVietnameseVoice();

    if (viVoice) {
      utterance.voice = viVoice;
      utterance.lang = viVoice.lang;
    } else {
      utterance.lang = "vi-VN";
      setTtsNotice(
        "Trình duyệt Chrome trên máy bạn đang thiếu gói giọng đọc tiếng Việt của hệ điều hành. Mẹo: Hãy mở web bằng Microsoft Edge (đã tích hợp sẵn giọng đọc AI tiếng Việt rất hay) hoặc thêm giọng Vietnamese trong Cài đặt Windows (Time & Language → Speech)."
      );
    }

    utterance.rate = 0.95; // Tốc độ đọc tự nhiên, rõ chữ
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingId(null);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
    };

    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }

  // ─── Copy to Clipboard ──────────────────────────────────────────────────────
  function copyText(msgId: number, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  // ─── Typewriter Streaming Engine ───────────────────────────────────────────
  function startStreaming(msgId: number, fullText: string) {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    currentStreamingIdRef.current = msgId;
    currentFullTextRef.current = fullText;

    let charIdx = 0;
    const totalLen = fullText.length;
    const chunkSize = totalLen > 800 ? 5 : totalLen > 400 ? 3 : totalLen > 150 ? 2 : 1;
    const baseDelay = 15;

    const step = () => {
      charIdx = Math.min(charIdx + chunkSize, totalLen);
      const displayedSlice = fullText.slice(0, charIdx);
      const isDone = charIdx >= totalLen;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.role === "ai"
            ? {
                ...m,
                text: displayedSlice,
                isStreaming: !isDone,
              }
            : m
        )
      );

      if (!isDone) {
        const lastChar = fullText[charIdx - 1];
        const extraDelay =
          lastChar === "." || lastChar === "!" || lastChar === "?" || lastChar === "\n"
            ? 30
            : lastChar === ","
            ? 12
            : 0;
        streamTimerRef.current = setTimeout(step, baseDelay + extraDelay);
      } else {
        currentStreamingIdRef.current = null;
        streamTimerRef.current = null;
      }
    };

    streamTimerRef.current = setTimeout(step, 40);
  }

  function skipStreaming(msgId: number) {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    const full = currentFullTextRef.current;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === "ai"
          ? { ...m, text: full || m.fullText || m.text, isStreaming: false }
          : m
      )
    );
    currentStreamingIdRef.current = null;
  }

  // ─── Speech to Text (Web Speech API) ──────────────────────────────────────────
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
        } catch {}
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
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError("Microphone bị từ chối truy cập. Hãy cấp quyền trên thanh địa chỉ.");
        } else if (event.error !== "no-speech") {
          setSpeechError(`Lỗi nhận diện giọng nói: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      setSpeechError("Không thể bật micro: " + (err.message || "Lỗi không xác định"));
      setIsListening(false);
    }
  }

  // ─── Send Message ───────────────────────────────────────────────────────────
  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || typing) return;

    // Stop speaking if active
    stopSpeech();

    const userMsgId = Date.now();
    const aiMsgId = userMsgId + 1000 + Math.floor(Math.random() * 10000);

    setMessages((m) => [...m, { id: userMsgId, role: "user", text: t }]);
    setInput("");
    setTyping(true);

    try {
      const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

      // ── True Streaming via SSE (/api/chat/stream) ─────────────────────
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          question: t,
          use_rag: config.use_rag,
          top_k: config.top_k,
          use_verifier: config.use_verifier,
          use_rerank: config.use_rerank,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mã lỗi máy chủ: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Trình duyệt không hỗ trợ ReadableStream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";
      let accumulatedText = "";
      let hasReceivedFirstToken = false;
      let cachedMeta: any = null;

      const processEvents = (raw: string) => {
        // SSE format: "event: <type>\ndata: <json>\n\n"
        const eventBlocks = raw.split("\n\n");
        for (const block of eventBlocks) {
          if (!block.trim()) continue;
          const lines = block.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!eventType || !dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);

            if (eventType === "meta") {
              cachedMeta = parsed;
            } else if (eventType === "token") {
              accumulatedText += parsed;
              const snapshot = accumulatedText;

              if (!hasReceivedFirstToken) {
                hasReceivedFirstToken = true;
                setTyping(false);

                const formattedSources: SourceItem[] = (cachedMeta?.sources || []).map((s: any) => {
                  const meta = s.metadata || {};
                  return {
                    text: s.text || s.document || "",
                    metadata: {
                      historical_period: meta.historical_period || "Lịch sử Việt Nam",
                      year_mentions: meta.year_mentions || [],
                      source_title: meta.source_title || "Kho dữ liệu Lịch sử Việt Nam",
                      chunk_id: meta.chunk_id || s.chunk_id,
                    },
                    score: s.score || s.similarity,
                  };
                });

                setMessages((prev) => [
                  ...prev,
                  {
                    id: aiMsgId,
                    role: "ai",
                    text: snapshot,
                    sources: formattedSources,
                    is_in_domain: cachedMeta?.is_in_domain ?? true,
                    blocked_by_verifier: cachedMeta?.blocked_by_verifier ?? false,
                    verifier_confidence: cachedMeta?.verifier_confidence,
                    verifier_reason: cachedMeta?.verifier_reason,
                    retrieval_mode: cachedMeta?.retrieval_mode,
                    isStreaming: true,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, text: snapshot, isStreaming: true } : m
                  )
                );
              }

            } else if (eventType === "done") {
              setTyping(false);
              const finalText = accumulatedText;
              if (!hasReceivedFirstToken) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: aiMsgId,
                    role: "ai",
                    text: finalText,
                    fullText: finalText,
                    sources: [],
                    is_in_domain: cachedMeta?.is_in_domain ?? true,
                    isStreaming: false,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, text: finalText, fullText: finalText, isStreaming: false }
                      : m
                  )
                );
              }

            } else if (eventType === "error") {
              setTyping(false);
              accumulatedText += `\n[Lỗi: ${parsed}]`;
              if (!hasReceivedFirstToken) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: aiMsgId,
                    role: "ai",
                    text: accumulatedText,
                    isStreaming: false,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, text: accumulatedText, isStreaming: false }
                      : m
                  )
                );
              }
            }
          } catch {
            // JSON parse error
          }
        }
      };

      // Đọc stream liên tục
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lastDouble = buffer.lastIndexOf("\n\n");
        if (lastDouble !== -1) {
          const toProcess = buffer.slice(0, lastDouble + 2);
          buffer = buffer.slice(lastDouble + 2);
          processEvents(toProcess);
        }
      }
      if (buffer.trim()) processEvents(buffer);

      setTyping(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId && m.isStreaming ? { ...m, isStreaming: false } : m
        )
      );
    } catch (error) {
      console.error(error);
      setTyping(false);

      const errorText =
        "Xin lỗi, không thể kết nối tới máy chủ Backend API (http://localhost:8000). Vui lòng đảm bảo backend đang hoạt động qua start.bat hoặc uvicorn.";

      setMessages((m) => [
        ...m,
        {
          id: aiMsgId,
          role: "ai",
          text: errorText,
          fullText: errorText,
          sources: [],
          is_in_domain: false,
          isStreaming: false,
        },
      ]);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      {/* Top Header */}
      <header
        className="flex-shrink-0 px-6 py-4 bg-white flex items-center justify-between"
        style={{ borderBottom: "1px solid #E5E0D5" }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile hamburger button */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-[#4A4A4A] hover:bg-[#FAF8F3] border border-[#E5E0D5] cursor-pointer"
            title="Mở menu thời kỳ"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div>
            <h1
              className="text-[20px] font-semibold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-display)", color: "#2C2C2C" }}
            >
              VietHistoQA — Hỏi đáp Lịch sử Việt Nam
            </h1>
            <p className="text-[12px] text-[#6B7280]">
              Tra cứu và học tập lịch sử Việt Nam giai đoạn 905–1975
            </p>
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${
                i > 0 ? "animate-in" : ""
              }`}
            >
              <div className="max-w-[88%] sm:max-w-[80%] space-y-2.5">

                {/* Main Message Bubble */}
                <div
                  className={`px-4 py-3.5 rounded-xl text-[13.5px] leading-relaxed relative ${
                    msg.role === "ai" ? "msg-ai" : "msg-user"
                  }`}
                  style={{ whiteSpace: "pre-line", lineHeight: "1.75" }}
                >
                  {msg.text}
                  {msg.isStreaming && (
                    <span className="streaming-cursor" title="Đang sinh phản hồi..." />
                  )}
                </div>

                {/* Action buttons (Copy, Read aloud) */}
                {msg.role === "ai" && !msg.isStreaming && (
                  <div className="flex items-center gap-2 pl-0.5 pt-1">
                    {/* Copy Button */}
                    <button
                      onClick={() => copyText(msg.id, msg.fullText || msg.text)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E5E0D5] text-[12px] text-[#4A4A4A] hover:text-[#8B0000] hover:border-[#8B0000] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      title="Sao chép câu trả lời"
                    >
                      <svg className="w-3.5 h-3.5 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{copiedId === msg.id ? "Đã sao chép!" : "Sao chép"}</span>
                    </button>

                    {/* Speech Synthesis Button */}
                    <button
                      onClick={() => toggleSpeech(msg.id, msg.fullText || msg.text)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border text-[12px] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                        speakingId === msg.id
                          ? "border-[#8B0000] text-[#8B0000] font-semibold bg-[#FDF0F0]"
                          : "border-[#E5E0D5] text-[#4A4A4A] hover:text-[#8B0000] hover:border-[#8B0000]"
                      }`}
                      title={speakingId === msg.id ? "Dừng đọc" : "Đọc bằng giọng nói tiếng Việt"}
                    >
                      {speakingId === msg.id ? (
                        <>
                          <span className="animate-pulse">⏹</span>
                          <span>Đang đọc... (Bấm dừng)</span>
                        </>
                      ) : (
                        <>
                          <span>🔊</span>
                          <span>Đọc câu trả lời</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {typing && (
            <div className="flex justify-start animate-in">
              <div className="msg-ai px-4 py-3.5 rounded-xl flex items-center gap-2.5">
                <div className="flex gap-1.5 items-center">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
                <span className="text-[13px] text-[#6B7280]">
                  AI đang phân tích câu hỏi lịch sử...
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <footer
        className="flex-shrink-0 px-4 sm:px-8 py-4 bg-white"
        style={{ borderTop: "1px solid #E5E0D5" }}
      >
        <div className="max-w-3xl mx-auto space-y-2.5">
          {/* Quick Suggestions Chips when few messages */}
          {messages.length <= 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-semibold text-[#8B0000] uppercase tracking-wider flex-shrink-0">
                Gợi ý:
              </span>
              {SUGGESTED_QUICK.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="chip chip-inactive text-[12px] whitespace-nowrap flex-shrink-0 cursor-pointer hover:border-[#8B0000] hover:text-[#8B0000]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Microphone banner when listening */}
          {isListening && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#FDF0F0] border border-[rgba(139,0,0,0.25)] text-[12.5px] text-[#8B0000] animate-in">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B0000]"></span>
                </span>
                <span className="font-semibold">Đang lắng nghe...</span>
                <span className="text-[#6B7280]">Nói câu hỏi về lịch sử Việt Nam (VD: "Trận Bạch Đằng năm 938")</span>
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

          {/* Speech error toast */}
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

          {/* TTS notification toast */}
          {ttsNotice && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[12px] text-[#1E40AF] animate-in">
              <div className="flex items-center gap-2">
                <span>ℹ️</span>
                <span>{ttsNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setTtsNotice(null)}
                className="text-[14px] leading-none text-[#1E40AF] font-bold hover:opacity-70 ml-2 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* Input Box & Action Buttons */}
          <div className="flex gap-2.5 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                isListening
                  ? "Đang nhận diện giọng nói của bạn..."
                  : "Hỏi về sự kiện, nhân vật, triều đại lịch sử Việt Nam (905–1975)..."
              }
              rows={1}
              className={`input-field flex-1 px-4 py-3 resize-none transition-all ${
                isListening
                  ? "border-[#8B0000] shadow-[0_0_0_3px_rgba(139,0,0,0.08)] bg-[#FFFDFD]"
                  : ""
              }`}
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />

            {/* Microphone Button (Speech-to-Text) */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={typing}
              title={isListening ? "Đang lắng nghe... Bấm để dừng" : "Hỏi bằng giọng nói tiếng Việt"}
              className={`h-[44px] px-3.5 rounded-lg text-[13.5px] flex items-center justify-center transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? "bg-[#8B0000] text-white ring-4 ring-red-200 animate-pulse shadow-md"
                  : "bg-[#F5F0E8] text-[#8B0000] border border-[#E5E0D5] hover:bg-[#EDE8DF] hover:border-[#C19A6B]"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>

            {/* Send Button */}
            <button
              onClick={() => send()}
              disabled={!input.trim() || typing}
              className="btn-primary px-5 py-3 rounded-lg text-[13.5px] flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none cursor-pointer flex items-center gap-1.5"
              style={{ minHeight: "44px" }}
            >
              <span>Gửi</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <div className="text-[11.5px] text-[#9CA3AF] px-0.5">
            Enter để gửi · Shift+Enter xuống dòng · Hỗ trợ micro giọng nói tiếng Việt
          </div>
        </div>
      </footer>
    </div>
  );
});

export default ChatPage;
