import sys
import io
import os
from dotenv import load_dotenv

# Tải biến môi trường từ file .env ở thư mục gốc (để thiết lập HF_HOME, v.v.)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import asyncio

# Fix encoding cho Windows (Bỏ qua nếu chạy trên Kaggle/Jupyter)
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# Import modules từ RAG pipeline (cần set PYTHONPATH tới thư mục gốc của project)
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.rag_pipeline import (
    load_model_and_tokenizer,
    generate_answer,
    verify_and_answer,
    verify_and_answer_stream,
    get_verifier,
    _VERIFIER_AVAILABLE,
)
from rag.retriever import HistoryRetriever

# Biến toàn cục để lưu model, tokenizer và retriever
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo Lock bên trong event loop của FastAPI
    app_state["generation_lock"] = asyncio.Lock()
    
    # Khởi tạo model và retriever khi startup
    print("[Backend] Khoi dong Backend API (v2 + Verifier Agent)...")
    
    # Load model và tokenizer
    model, tokenizer = load_model_and_tokenizer()
    app_state["model"] = model
    app_state["tokenizer"] = tokenizer
    
    # Load retriever
    retriever = HistoryRetriever()
    app_state["retriever"] = retriever

    # Preload Verifier (Logistic Regression — nhẹ, load nhanh)
    if _VERIFIER_AVAILABLE:
        verifier = get_verifier()
        app_state["verifier_ready"] = verifier is not None
        if verifier is not None:
            print("[Verifier] Verifier Agent (Logistic Regression) da san sang!")
        else:
            print("[Verifier] Verifier chua duoc train. Chay: python rag/train_verifier.py")
    else:
        app_state["verifier_ready"] = False
        print("[Verifier] scikit-learn chua cai. Verifier bi tat.")
    
    print("[Backend] He thong da san sang nhan request!")
    yield
    # Cleanup khi shutdown
    app_state.clear()
    print("[Backend] Tat Backend API...")

app = FastAPI(
    title="CT550E History RAG API",
    description="Backend API cho hệ thống RAG Lịch sử Việt Nam lớp 12",
    version="1.0.0",
    lifespan=lifespan
)

# Thêm CORS để Frontend có thể gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong thực tế nên giới hạn domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str
    use_rag: bool = True
    top_k: int = 3
    use_verifier: bool = True  # Mặc định bật Verifier chặn OOD
    use_rerank: bool = True    # BẬT MẶC ĐỊNH Reranking (Cross-Encoder) vì đây là track tốt nhất

class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]] = []
    is_in_domain: bool = True             # True = câu hỏi thuộc Lịch sử VN 905–1975
    blocked_by_verifier: bool = False     # True = bị chặn, không gọi LLM
    verifier_confidence: float = 1.0      # Độ tin cậy phân loại (0.0–1.0)
    confidence_score: Optional[float] = None # Độ tin cậy trả lời (0.0-1.0)
    verifier_reason: str = ""             # Lý do phân loại (debug)
    retrieval_mode: str = "none"          # none | dense | rerank

@app.get("/")
def read_root():
    return {"message": "Chào mừng đến với API RAG Lịch sử Việt Nam. Hãy gửi POST request tới /api/chat."}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")
    
    model = app_state.get("model")
    tokenizer = app_state.get("tokenizer")
    retriever = app_state.get("retriever")
    
    if not model or not tokenizer or not retriever:
        raise HTTPException(status_code=503, detail="Hệ thống chưa khởi tạo xong.")
    
    generation_lock = app_state["generation_lock"]
    
    try:
        # Sử dụng Lock để đảm bảo chỉ có 1 request chạy LLM tại một thời điểm
        # Tránh lỗi CUDA Out of Memory khi user spam nút gửi
        async with generation_lock:
            # Gọi verify_and_answer — entry point duy nhất của pipeline
            # Pipeline tự động: Verifier → (nếu OK) Retriever → Generator
            result = verify_and_answer(
                model=model,
                tokenizer=tokenizer,
                retriever=retriever,
                question=request.question,
                use_rag=request.use_rag,
                top_k=request.top_k,
                use_verifier=request.use_verifier,
                use_rerank=request.use_rerank,
            )

        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"],
            is_in_domain=result["is_in_domain"],
            blocked_by_verifier=result["blocked_by_verifier"],
            verifier_confidence=result["verifier_confidence"],
            confidence_score=result.get("confidence_score"),
            verifier_reason=result["verifier_reason"],
            retrieval_mode=result.get("retrieval_mode", "none"),
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý câu hỏi: {str(e)}")


@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Endpoint streaming: Trả về Server-Sent Events (SSE) — token xuất hiện ngay khi Ollama sinh ra.

    Protocol SSE (mọi event đều có dạng)::
        event: meta   \u21d2 JSON metadata (verifier, sources)
        event: token  \u21d2 từng chuỗi token văn bản
        event: done   \u21d2 kết thúc stream
        event: error  \u21d2 thông báo lỗi
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    model = app_state.get("model")
    tokenizer = app_state.get("tokenizer")
    retriever = app_state.get("retriever")

    if not model or not tokenizer or not retriever:
        raise HTTPException(status_code=503, detail="Hệ thống chưa khởi tạo xong.")

    generation_lock = app_state["generation_lock"]

    async def event_generator():
        """Chạy pipeline trong thread riêng rồi yield từng SSE event."""
        loop = asyncio.get_event_loop()
        import concurrent.futures

        # Chạy generator blocking (requests) trong ThreadPoolExecutor để không block event loop
        async with generation_lock:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:

                def run_stream():
                    return list(verify_and_answer_stream(
                        model=model,
                        tokenizer=tokenizer,
                        retriever=retriever,
                        question=request.question,
                        use_rag=request.use_rag,
                        top_k=request.top_k,
                        use_verifier=request.use_verifier,
                        use_rerank=request.use_rerank,
                    ))

                # Stream từng event một cách progressive bằng cách chạy trong thread
                # và yield qua asyncio queue
                import queue as queue_module
                q = queue_module.Queue()
                SENTINEL = object()

                def producer():
                    try:
                        for event in verify_and_answer_stream(
                            model=model,
                            tokenizer=tokenizer,
                            retriever=retriever,
                            question=request.question,
                            use_rag=request.use_rag,
                            top_k=request.top_k,
                            use_verifier=request.use_verifier,
                            use_rerank=request.use_rerank,
                        ):
                            q.put(event)
                    except Exception as e:
                        import json as _json
                        q.put(f"event: error\ndata: {_json.dumps(str(e))}\n\n")
                    finally:
                        q.put(SENTINEL)

                future = executor.submit(producer)

                while True:
                    try:
                        item = await loop.run_in_executor(None, lambda: q.get(timeout=200))
                    except Exception:
                        break
                    if item is SENTINEL:
                        break
                    yield item

                future.result()  # propagate exceptions nếu có

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "model": app_state.get("model") is not None,
        "retriever": app_state.get("retriever") is not None,
        "verifier_ready": app_state.get("verifier_ready", False),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
