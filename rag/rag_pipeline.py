"""
rag_pipeline.py — RAG Pipeline hoàn chỉnh (v3 + Verifier + Reranker)
================================================================
Kết hợp:
  1. DomainVerifier  — phân loại Logistic Regression chặn OOD trước khi gọi LLM
  2. Retriever       — truy xuất ngữ cảnh từ FAISS index (8,092 chunks)
                       Hỗ trợ Dense (Bi-Encoder) và Two-Stage (Bi + Cross-Encoder)
  3. Generator (LLM) — Qwen2.5-3B + LoRA sinh câu trả lời

Luồng:
  Câu hỏi
    → Verifier (LR classify: Yes/No)
        → NO  (OOD): Trả lời "Tôi chỉ là chatbot Lịch sử VN..."
        → YES (In-Domain):
              [use_rag=False]: Generator trực tiếp → Answer
              [use_rag=True, use_rerank=False]: Dense Retrieval → Generator → Answer
              [use_rag=True, use_rerank=True ]: Two-Stage Rerank → Generator → Answer

Chạy thử:
    python rag/rag_pipeline.py
"""

import sys
import io
import os
import json
import torch
import math
from dotenv import load_dotenv

# Fix encoding cho Windows
try:
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
except Exception:
    pass
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# ============================================================
# CẤU HÌNH
# ============================================================
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Mặc định sử dụng Qwen2.5-3B (Sweet Spot: nhẹ ~1.93GB RAM, đạt BLEU & ROUGE cao nhất)
BASE_MODEL_ID = os.getenv("BASE_MODEL_ID", "Qwen/Qwen2.5-3B-Instruct")
ADAPTER_DIR = os.getenv(
    "ADAPTER_DIR",
    os.path.join(PROJECT_DIR, "models", "qwen25-3b-history-vn-adapter")
    if os.path.exists(os.path.join(PROJECT_DIR, "models", "qwen25-3b-history-vn-adapter"))
    else os.path.join(PROJECT_DIR, "models", "qwen25-7b-history-vn-adapter")
)

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "vn-history-3b")

SYSTEM_PROMPT = (
    "Bạn là chuyên gia sử học Việt Nam. "
    "Có thể nêu bối cảnh - diễn biến - kết quả khi cần."
)

RAG_SYSTEM_PROMPT = (
    "Bạn là trợ lý AI chuyên gia về Lịch sử Việt Nam. "
    "Hãy trả lời câu hỏi DỰA TRÊN các tài liệu được cung cấp bên dưới. "
    "TUYỆT ĐỐI KHÔNG được chép nguyên xi tài liệu. BẠN PHẢI TÓM TẮT VÀ VIẾT LẠI câu trả lời bằng văn phong tự nhiên, lịch sự và dễ hiểu nhất. "
    "Nếu tài liệu không chứa thông tin, hãy nói 'Tôi không tìm thấy thông tin'."
)

# Import Verifier (lazy — không bắt buộc phải có sklearn)
try:
    from rag.verifier import DomainVerifier
    _VERIFIER_AVAILABLE = True
except ImportError:
    _VERIFIER_AVAILABLE = False
    print("[Pipeline] sklearn chua cai -> Verifier bi tat. Chay: pip install scikit-learn")


def load_model_and_tokenizer():
    """
    Không load model vào VRAM nữa. 
    Sử dụng Ollama chạy ngầm ở localhost:11434.
    """
    print(f"[Pipeline] Da chuyen sang che do goi API Ollama cuc bo (model: {OLLAMA_MODEL}).")
    return "ollama", "ollama"


def generate_answer(
    model,
    tokenizer,
    question: str,
    context: str = None,
    max_new_tokens: int = 512,
    temperature: float = 0.1,
) -> str:
    """
    Sinh câu trả lời bằng cách gọi API của Ollama (non-streaming, giữ nguyên để backward-compat).
    """
    import requests

    if context:
        user_content = f"Ngữ cảnh tham khảo: {context}\n\nDựa vào ngữ cảnh trên, hãy trả lời câu hỏi: {question}"
        messages = [
            {"role": "system", "content": RAG_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
    else:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ]

    url = "http://localhost:11434/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "keep_alive": -1,
        "options": {
            "temperature": temperature,
            "num_predict": max_new_tokens,
            "top_p": 0.9,
            "repeat_penalty": 1.1
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=180)
        response.raise_for_status()
        return response.json()["message"]["content"].strip()
    except Exception as e:
        print(f"[Ollama] Loi khi goi Ollama: {e}")
        return "Lỗi: Không thể kết nối tới Ollama. Vui lòng đảm bảo Ollama đang chạy bằng lệnh: ollama run vn-history"


def generate_answer_stream(
    model,
    tokenizer,
    question: str,
    context: str = None,
    max_new_tokens: int = 512,
    temperature: float = 0.1,
):
    """
    Sinh câu trả lời theo chế độ streaming — yield từng token khi Ollama trả về.
    Dùng cho Server-Sent Events (SSE) ở /api/chat/stream.
    """
    import requests

    if context:
        user_content = f"Ngữ cảnh tham khảo: {context}\n\nDựa vào ngữ cảnh trên, hãy trả lời câu hỏi: {question}"
        messages = [
            {"role": "system", "content": RAG_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
    else:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ]

    url = "http://localhost:11434/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "keep_alive": -1,
        "options": {
            "temperature": temperature,
            "num_predict": max_new_tokens,
            "top_p": 0.9,
            "repeat_penalty": 1.1
        }
    }

    try:
        with requests.post(url, json=payload, stream=True, timeout=180) as response:
            response.raise_for_status()
            for raw_line in response.iter_lines():
                if not raw_line:
                    continue
                try:
                    chunk = json.loads(raw_line.decode("utf-8"))
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        # Lọc bỏ ** markdown inline như generate_answer() gốc
                        token = token.replace("**", "")
                        yield token
                    if chunk.get("done", False):
                        break
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
    except Exception as e:
        print(f"[Ollama Stream] Loi: {e}")
        yield "Lỗi: Không thể kết nối tới Ollama."


# ============================================================
# VERIFIER + PIPELINE ENTRY POINT
# ============================================================

# Singleton Verifier (load 1 lần khi import module)
_verifier_instance = None


def get_verifier() -> "DomainVerifier | None":
    """
    Trả về singleton DomainVerifier.
    Gọi lần đầu sẽ load model, các lần sau dùng cache.
    """
    global _verifier_instance
    if _verifier_instance is None and _VERIFIER_AVAILABLE:
        _verifier_instance = DomainVerifier()
    return _verifier_instance


def verify_and_answer(
    model,
    tokenizer,
    retriever,
    question: str,
    use_rag: bool = True,
    top_k: int = 3,
    max_new_tokens: int = 512,
    temperature: float = 0.3,
    use_verifier: bool = True,
    use_rerank: bool = False,
) -> dict:
    """
    Entry point chính của pipeline. Kết hợp Verifier → Retriever → Generator.

    Args:
        model:          LLM đã load.
        tokenizer:      Tokenizer đã load.
        retriever:      HistoryRetriever đã khởi tạo.
        question:       Câu hỏi của người dùng.
        use_rag:        Có dùng RAG không?
        top_k:          Số chunks RAG truy xuất (sau rerank).
        max_new_tokens: Độ dài tối đa câu trả lời.
        temperature:    Nhiệt độ sampling.
        use_verifier:   Có bật Verifier không? (Mặc định True)
        use_rerank:     Có dùng Cross-Encoder Reranking không? (Mặc định False)
                        Khi True: FAISS lấy top_k×5 candidates rồi rerank xuống top_k.

    Returns:
        dict với các key:
          - answer (str):              Câu trả lời cuối cùng.
          - sources (list):            Danh sách nguồn tài liệu RAG.
          - is_in_domain (bool):       True nếu câu hỏi thuộc domain.
          - verifier_confidence (float): Độ tin cậy phân loại.
          - verifier_reason (str):     Lý do phân loại.
          - blocked_by_verifier (bool): True nếu bị chặn.
          - retrieval_mode (str):      'dense' hoặc 'rerank' để debug.
    """
    # ----------------------------------------------------------------
    # BƯỚC 1: DOMAIN VERIFICATION
    # ----------------------------------------------------------------
    is_in_domain = True
    verifier_confidence = 1.0
    verifier_reason = "verifier_disabled"
    blocked = False

    if use_verifier and _VERIFIER_AVAILABLE:
        verifier = get_verifier()
        if verifier is not None:
            is_in_domain, verifier_confidence, verifier_reason = verifier.predict_with_score(question)

            if not is_in_domain:
                # === CHẶN: Câu hỏi ngoài domain ===
                print(
                    f"[Verifier] OOD detected - conf={verifier_confidence:.2f} "
                    f"| reason: {verifier_reason}"
                )
                return {
                    "answer": verifier.get_ood_response(),
                    "sources": [],
                    "is_in_domain": False,
                    "verifier_confidence": verifier_confidence,
                    "verifier_reason": verifier_reason,
                    "blocked_by_verifier": True,
                }
            else:
                print(
                    f"[Verifier] In-Domain - conf={verifier_confidence:.2f} "
                    f"| reason: {verifier_reason}"
                )

    # ----------------------------------------------------------------
    # BƯỚC 2: RETRIEVAL (nếu dùng RAG)
    # ----------------------------------------------------------------
    context = None
    sources = []
    retrieval_mode = "none"

    if use_rag:
        if use_rerank:
            # Two-Stage Reranking: FAISS lấy top_k*5 → Cross-Encoder rerank → top_k
            retrieval_mode = "rerank"
            context = retriever.get_context_with_rerank(question, top_k=top_k)
            sources = retriever.search_with_rerank(question, top_k=top_k)
            print(f"[Pipeline] Two-Stage Reranking (top_k={top_k}, candidates={top_k*5})")
        else:
            # Dense Retrieval đơn giản
            retrieval_mode = "dense"
            context = retriever.get_context(question, top_k=top_k)
            sources = retriever.search(question, top_k=top_k)

    # ----------------------------------------------------------------
    # BƯỚC 3: GENERATION
    # ----------------------------------------------------------------
    answer = generate_answer(
        model=model,
        tokenizer=tokenizer,
        question=question,
        context=context,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
    )

    # Lọc bỏ dấu markdown in đậm để frontend hiển thị text thường đẹp hơn
    answer = answer.replace("**", "")

    # ----------------------------------------------------------------
    # BƯỚC 4: TÍNH ĐIỂM TIN CẬY (CONFIDENCE SCORE)
    # ----------------------------------------------------------------
    confidence_score = 1.0
    if use_rag and sources:
        if use_rerank:
            # Cross-encoder logits: thường từ -10 đến +10. Sigmoid để ép về 0-1
            top_score = sources[0].get("rerank_score", 0.0)
            confidence_score = 1.0 / (1.0 + math.exp(-top_score))
        else:
            # IP score (mang tính tương đối)
            top_score = sources[0].get("score", 0.0)
            confidence_score = min(max(top_score, 0.0), 1.0)
            
    # Phạt điểm tin cậy nếu verifier thấy câu hỏi ở mức ranh giới
    if _VERIFIER_AVAILABLE and is_in_domain and verifier_confidence < 0.7:
        confidence_score *= 0.8

    # Nếu độ tin cậy quá thấp, từ chối trả lời và ẩn thanh tin cậy
    if confidence_score < 0.6:
        answer = "Tôi chưa đủ tài liệu để trả lời câu hỏi này một cách chính xác."
        confidence_score = None

    return {
        "answer": answer,
        "sources": sources,
        "is_in_domain": is_in_domain,
        "verifier_confidence": verifier_confidence,
        "confidence_score": confidence_score,
        "verifier_reason": verifier_reason,
        "blocked_by_verifier": False,
        "retrieval_mode": retrieval_mode,
    }


def verify_and_answer_stream(
    model,
    tokenizer,
    retriever,
    question: str,
    use_rag: bool = True,
    top_k: int = 3,
    max_new_tokens: int = 512,
    temperature: float = 0.3,
    use_verifier: bool = True,
    use_rerank: bool = False,
):
    """
    Phiên bản streaming của verify_and_answer.
    Yield các SSE event strings để dùng trong StreamingResponse của FastAPI.
    
    Protocol SSE:
      - event: meta   → JSON metadata (verifier, sources, retrieval_mode)
      - event: token  → từng token văn bản
      - event: done   → kết thúc stream
      - event: error  → lỗi
    """
    # ── Bước 1: Verifier ──────────────────────────────────────────────
    is_in_domain = True
    verifier_confidence = 1.0
    verifier_reason = "verifier_disabled"

    if use_verifier and _VERIFIER_AVAILABLE:
        verifier = get_verifier()
        if verifier is not None:
            is_in_domain, verifier_confidence, verifier_reason = verifier.predict_with_score(question)
            if not is_in_domain:
                meta = {
                    "is_in_domain": False,
                    "blocked_by_verifier": True,
                    "verifier_confidence": verifier_confidence,
                    "verifier_reason": verifier_reason,
                    "sources": [],
                    "retrieval_mode": "none",
                }
                yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n"
                ood_text = verifier.get_ood_response()
                yield f"event: token\ndata: {json.dumps(ood_text, ensure_ascii=False)}\n\n"
                yield "event: done\ndata: {}\n\n"
                return

    # ── Bước 2: Retrieval ─────────────────────────────────────────────
    context = None
    sources = []
    retrieval_mode = "none"

    if use_rag:
        if use_rerank:
            retrieval_mode = "rerank"
            context = retriever.get_context_with_rerank(question, top_k=top_k)
            sources = retriever.search_with_rerank(question, top_k=top_k)
        else:
            retrieval_mode = "dense"
            context = retriever.get_context(question, top_k=top_k)
            sources = retriever.search(question, top_k=top_k)

    # ── Gửi metadata trước khi stream token ───────────────────────────
    meta = {
        "is_in_domain": True,
        "blocked_by_verifier": False,
        "verifier_confidence": verifier_confidence,
        "verifier_reason": verifier_reason,
        "sources": sources,
        "retrieval_mode": retrieval_mode,
    }
    yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n"

    # ── Bước 3: Stream tokens từ Ollama ──────────────────────────────
    try:
        for token in generate_answer_stream(
            model=model,
            tokenizer=tokenizer,
            question=question,
            context=context,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
        ):
            yield f"event: token\ndata: {json.dumps(token, ensure_ascii=False)}\n\n"
    except Exception as e:
        yield f"event: error\ndata: {json.dumps(str(e), ensure_ascii=False)}\n\n"
        return

    yield "event: done\ndata: {}\n\n"


# ============================================================
# MAIN — Test so sánh Track A vs Track B + Verifier
# ============================================================
def main():
    from rag.retriever import HistoryRetriever

    print("=" * 65)
    print("[Pipeline] RAG PIPELINE v2 - Verifier + Track A vs Track B")
    print("=" * 65)

    # 1. Load model
    model, tokenizer = load_model_and_tokenizer()

    # 2. Load retriever
    print()
    retriever = HistoryRetriever()

    # 3. Danh sách câu hỏi test — bao gồm cả OOD để kiểm tra Verifier
    test_cases = [
        # (câu hỏi, dùng_rag)
        ("Nội dung và ý nghĩa của Hội nghị lần thứ 8 Ban Chấp hành Trung ương Đảng (5-1941)?", True),
        ("Chiến dịch Biên giới Thu-Đông 1950 diễn ra như thế nào và có ý nghĩa gì?", True),
        ("Nguyên nhân chính nào khiến nước ta bị chia cắt làm hai miền sau Hiệp định Giơnevơ 1954?", True),
        # --- OOD test cases ---
        ("Python là ngôn ngữ lập trình gì?", True),
        ("Bài hát nào đang hot nhất hiện nay?", True),
    ]

    # 4. Lặp qua từng câu hỏi, chạy qua verify_and_answer
    for i, (question, use_rag) in enumerate(test_cases, 1):
        print(f"\n{'='*65}")
        print(f"Cau {i}: {question}")
        print(f"{'='*65}")

        result = verify_and_answer(
            model=model,
            tokenizer=tokenizer,
            retriever=retriever,
            question=question,
            use_rag=use_rag,
            top_k=3,
        )

        if result["blocked_by_verifier"]:
            print(f"[Verifier] Bi chan (conf={result['verifier_confidence']:.2f})")
            print(f"   Tra loi: {result['answer']}")
        else:
            print(f"[Verifier] In-Domain (conf={result['verifier_confidence']:.2f})")
            print(f"   Cau tra loi:\n   {result['answer']}")
            if result["sources"]:
                print(f"\n   [Nguon] ({len(result['sources'])} chunks):")
                for r in result["sources"]:
                    meta = r.get("metadata", {})
                    period = meta.get("historical_period", "N/A") if isinstance(meta, dict) else "N/A"
                    print(f"      [{r['rank']}] score={r['score']:.4f} | {period}")

    print(f"\n{'='*65}")
    print("[OK] Test hoan tat!")
    print("="*65)


if __name__ == "__main__":
    main()
