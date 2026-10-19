"""
retriever.py — Công cụ Truy xuất Ngữ cảnh từ FAISS Index
=========================================================
Class HistoryRetriever: nhận câu hỏi, nhúng thành vector,
tìm top-k đoạn văn bản gần nghĩa nhất trong FAISS index,
trả về danh sách các đoạn ngữ cảnh (context).

Chế độ truy xuất:
  - search()            : Dense Retrieval đơn giản (FAISS + Bi-Encoder)
  - search_with_rerank(): Two-Stage Retrieval
      Stage 1: FAISS Bi-Encoder lấy top_k * bi_multiplier (mặc định ×5)
      Stage 2: Cross-Encoder chấm điểm lại, trả về top_k tốt nhất

Sử dụng:
    from rag.retriever import HistoryRetriever
    retriever = HistoryRetriever()
    # Dense Retrieval (cũ)
    results = retriever.search("Ai lãnh đạo cách mạng tháng 8?", top_k=3)
    # Two-Stage Reranking (mới)
    results = retriever.search_with_rerank("Ai lãnh đạo cách mạng tháng 8?", top_k=3)
"""

import os
import json
import numpy as np


# ============================================================
# CẤU HÌNH
# ============================================================
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_DIR = os.path.join(PROJECT_DIR, "rag", "index")
INDEX_PATH = os.path.join(INDEX_DIR, "faiss_index.bin")
METADATA_PATH = os.path.join(INDEX_DIR, "chunk_metadata.json")
EMBEDDING_MODEL = "bkai-foundation-models/vietnamese-bi-encoder"

# Cross-Encoder cho Two-Stage Retrieval
# ms-marco-MiniLM-L-6-v2: ~70MB, nhanh, chấm điểm relevance score query-passage
CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# Số lượng candidates lấy từ FAISS trước khi rerank
# Ví dụ: top_k=3, bi_multiplier=5 → lấy 15 candidates → rerank → giữ 3
BI_ENCODER_MULTIPLIER = 5


class HistoryRetriever:
    """
    Truy xuất các đoạn văn bản Lịch sử Việt Nam liên quan nhất
    dựa trên câu hỏi đầu vào, sử dụng FAISS + Sentence Transformer.
    """

    def __init__(self, index_path: str = INDEX_PATH, metadata_path: str = METADATA_PATH):
        import faiss
        from sentence_transformers import SentenceTransformer

        # 1. Load FAISS index
        if not os.path.exists(index_path):
            raise FileNotFoundError(
                f"Không tìm thấy FAISS index tại: {index_path}\n"
                "Hãy chạy `python rag/build_index.py` trước!"
            )
        self.index = faiss.read_index(index_path)
        print(f"[Retriever] Da load FAISS index: {self.index.ntotal} vectors")

        # 2. Load metadata (hỗ trợ cả JSON array và JSONL)
        if not os.path.exists(metadata_path):
            raise FileNotFoundError(f"Không tìm thấy metadata tại: {metadata_path}")
        self.metadata = []
        with open(metadata_path, "r", encoding="utf-8") as f:
            first_char = f.read(1)
            f.seek(0)
            if first_char == "[":
                # JSON array format (từ finetuning.py)
                self.metadata = json.load(f)
            else:
                # JSONL format (mỗi dòng là 1 JSON object)
                for line_number, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        self.metadata.append(json.loads(line))
                    except json.JSONDecodeError as exc:
                        raise ValueError(
                            f"Metadata không hợp lệ tại dòng {line_number}: {metadata_path}"
                        ) from exc
        if self.index.ntotal != len(self.metadata):
            raise ValueError(
                f"FAISS có {self.index.ntotal} vectors nhưng metadata có "
                f"{len(self.metadata)} mục."
            )
        print(f"[Retriever] Da load metadata: {len(self.metadata)} chunks")

        # 3. Load Bi-Encoder (Embedding model)
        print(f"[Retriever] Dang tai mo hinh nhung (Bi-Encoder): {EMBEDDING_MODEL}...")
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        print(f"[Retriever] Bi-Encoder da san sang")

        # 4. Cross-Encoder: lazy-load (chỉ tải khi cần dùng rerank)
        self._cross_encoder = None
        print("[Retriever] Cross-Encoder chua duoc tai. Goi search_with_rerank() de kich hoat.")

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        """
        Tìm top-k đoạn văn bản liên quan nhất đến câu hỏi.

        Args:
            query: Câu hỏi của người dùng.
            top_k: Số lượng kết quả trả về (mặc định 3).

        Returns:
            Danh sách dict, mỗi dict chứa:
                - chunk_id: ID của đoạn văn
                - page_content: Nội dung đoạn văn (hoặc text)
                - score: Điểm tương đồng (cosine similarity)
                - metadata.historical_period: Giai đoạn lịch sử
                - metadata.year_mentions: Danh sách năm được nhắc đến
        """
        # Nhúng câu hỏi thành vector
        query_embedding = self.model.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        ).astype(np.float32)

        # Tìm kiếm trong FAISS
        scores, indices = self.index.search(query_embedding, top_k)

        # Ghép kết quả với metadata
        results = []
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if idx < 0 or idx >= len(self.metadata):
                continue
            result = self.metadata[idx].copy()
            result["score"] = float(score)
            result["rank"] = i + 1
            results.append(result)

        return results

    def _load_cross_encoder(self):
        """
        Lazy-load Cross-Encoder model.
        Chỉ tải khi cần, giữ singleton để tái sử dụng.
        """
        if self._cross_encoder is None:
            from sentence_transformers.cross_encoder import CrossEncoder
            print(f"[Retriever] Dang tai Cross-Encoder: {CROSS_ENCODER_MODEL}...")
            self._cross_encoder = CrossEncoder(CROSS_ENCODER_MODEL)
            print(f"[Retriever] Cross-Encoder da san sang")
        return self._cross_encoder

    def search_with_rerank(
        self,
        query: str,
        top_k: int = 3,
        bi_multiplier: int = BI_ENCODER_MULTIPLIER,
    ) -> list[dict]:
        """
        Two-Stage Retrieval:
          Stage 1 (Bi-Encoder): FAISS lấy top_k * bi_multiplier candidates.
          Stage 2 (Cross-Encoder): Chấm điểm lại tất cả candidates,
                                    sắp xếp giảm dần, trả về top_k tốt nhất.

        Args:
            query:          Câu hỏi của người dùng.
            top_k:          Số kết quả cuối cùng trả về.
            bi_multiplier:  Hệ số mở rộng từ Stage 1.

        Returns:
            Danh sách dict gốc của FAISS, bất đầu bạng
            thêm key 'rerank_score' và 'tạm rank' mới sau rerank.
        """
        # --- Stage 1: Bi-Encoder (Dense Retrieval) ---
        n_candidates = max(top_k * bi_multiplier, top_k)
        candidates = self.search(query, top_k=n_candidates)

        if not candidates:
            return []

        # --- Stage 2: Cross-Encoder Reranking ---
        cross_encoder = self._load_cross_encoder()

        # Cross-Encoder nhận cặp [query, passage] và trả về relevance score
        pairs = [
            [query, c.get("page_content", c.get("text", ""))]
            for c in candidates
        ]
        rerank_scores = cross_encoder.predict(pairs, show_progress_bar=False)

        # Gắn rerank_score vào mỗi candidate
        for cand, rs in zip(candidates, rerank_scores):
            cand["rerank_score"] = float(rs)
            # Giữ lại bi_score để phân tích sau (score cũ là cosine similarity)
            cand["bi_score"] = cand.pop("score", 0.0)

        # Sắp xếp theo rerank_score giảm dần
        reranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)

        # Cập nhật lại rank
        for new_rank, item in enumerate(reranked[:top_k], start=1):
            item["rank"] = new_rank

        return reranked[:top_k]

    def get_context_with_rerank(
        self,
        query: str,
        top_k: int = 3,
        bi_multiplier: int = BI_ENCODER_MULTIPLIER,
    ) -> str:
        """
        Tương tự get_context() nhưng dùng Two-Stage Reranking.
        Trả về chuỗi text ngữ cảnh sau khi rerank.
        """
        results = self.search_with_rerank(query, top_k=top_k, bi_multiplier=bi_multiplier)
        context_parts = []
        for i, r in enumerate(results):
            meta = r.get("metadata", {})
            if isinstance(meta, dict) and "historical_period" in meta:
                period = meta.get("historical_period", "Không xác định")
                years = meta.get("year_mentions", [])
                header = f"Tài liệu [{i+1}]: Thời kỳ {period} (Năm: {', '.join(map(str, years)) if years else 'N/A'})"
            else:
                header = f"Tài liệu [{i+1}]: [{r.get('bai', '')}] {r.get('muc', '')}"
            text = r.get("page_content", r.get("text", ""))
            context_parts.append(f"{header}\n{text}")
        return "\n---\n".join(context_parts)

    def get_context(self, query: str, top_k: int = 3) -> str:
        """
        Truy xuất ngữ cảnh dạng text thuần túy (để ghép vào prompt).
        Trả về chuỗi text nối các đoạn văn bản liên quan.

        Args:
            query: Câu hỏi của người dùng.
            top_k: Số lượng đoạn văn bản truy xuất.

        Returns:
            Chuỗi text chứa ngữ cảnh, phân cách bằng dấu gạch ngang.
        """
        results = self.search(query, top_k)
        context_parts = []
        for i, r in enumerate(results):
            # Hỗ trợ cả format mới (historical_period) và cũ (bai/muc)
            meta = r.get("metadata", {})
            if isinstance(meta, dict) and "historical_period" in meta:
                period = meta.get("historical_period", "Không xác định")
                years = meta.get("year_mentions", [])
                header = f"Tài liệu [{i+1}]: Thời kỳ {period} (Năm: {', '.join(map(str, years)) if years else 'N/A'})"
            else:
                header = f"Tài liệu [{i+1}]: [{r.get('bai', '')}] {r.get('muc', '')}"
            text = r.get("page_content", r.get("text", ""))
            context_parts.append(f"{header}\n{text}")
        return "\n---\n".join(context_parts)


# ============================================================
# TEST THỬ (chạy trực tiếp file này)
# ============================================================
if __name__ == "__main__":
    import sys
    import io
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

    retriever = HistoryRetriever()

    test_queries = [
        "Nguyên nhân và diễn biến cuộc khởi nghĩa Bắc Sơn?",
        "Nội dung Hiệp định Giơnevơ năm 1954 là gì?",
        "Chiến dịch Điện Biên Phủ diễn ra như thế nào?",
    ]

    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"🔍 Câu hỏi: {query}")
        print(f"{'='*60}")
        results = retriever.search(query, top_k=3)
        for r in results:
            meta = r.get("metadata", {})
            period = meta.get("historical_period", "N/A") if isinstance(meta, dict) else "N/A"
            years = meta.get("year_mentions", []) if isinstance(meta, dict) else []
            text = r.get("page_content", r.get("text", ""))
            print(f"\n📄 [{r['rank']}] Score: {r['score']:.4f}")
            print(f"   Giai đoạn: {period}")
            print(f"   Năm: {years}")
            print(f"   Text: {text[:200]}...")
