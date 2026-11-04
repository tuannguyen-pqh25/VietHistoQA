import os
import re
import json
import hashlib
import unicodedata
from typing import Optional, Dict, Any

try:
    import redis
    REDIS_LIB_AVAILABLE = True
except ImportError:
    REDIS_LIB_AVAILABLE = False


class HistoryCacheManager:
    """
    Quan ly cache truy van cho he thong VietHistoQA bang Redis.
    Ap dung co che Normalized Exact Match:
      1. Chuan hoa Unicode (NFC), chuyen chu thuong, xoa khoang trang du thua.
      2. Loai bo dau cau o cuoi cau hoi (?, ., !, ...).
      3. Bam khoa SHA-256 kem theo cac tham so RAG (use_rag, top_k, use_rerank).
      4. Luu tru du lieu duoi dang JSON kem thoi gian song (TTL).
      5. Co che Graceful Fallback tu dong chuyen tiep khi Redis khong kha dung.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        db: Optional[int] = None,
        password: Optional[str] = None,
        default_ttl: int = 86400 * 7,  # Mac dinh 7 ngay
        enabled: bool = True,
    ):
        self.host = host or os.getenv("REDIS_HOST", "127.0.0.1")
        self.port = port or int(os.getenv("REDIS_PORT", "6379"))
        self.db = db if db is not None else int(os.getenv("REDIS_DB", "0"))
        self.password = password or os.getenv("REDIS_PASSWORD", None)
        self.default_ttl = int(os.getenv("REDIS_TTL", str(default_ttl)))
        self.enabled = enabled and os.getenv("REDIS_ENABLED", "true").lower() in ("true", "1", "yes")

        self.client: Optional[Any] = None
        self._is_connected = False

        if self.enabled and REDIS_LIB_AVAILABLE:
            self._connect()

    def _connect(self) -> None:
        """Thiet lap ket noi toi Redis server voi giao thuc RESP2 tuong thich."""
        try:
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                protocol=2,  # Tuong thich voi Redis 3.x tren Windows va RESP2
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
                decode_responses=True,
            )
            if self.client.ping():
                self._is_connected = True
                print(f"[Cache] Ket noi thanh cong toi Redis Server tai {self.host}:{self.port} (DB {self.db})")
        except Exception as e:
            self._is_connected = False
            self.client = None
            print(f"[Cache] Khong the ket noi toi Redis Server ({e}). Che do cache tam dung, tiep tuc chay RAG truc tiep.")

    def is_available(self) -> bool:
        """Kiem tra xem Redis co dang san sang nhan yeu cau hay khong."""
        if not self.enabled or not self.client:
            return False
        try:
            return bool(self.client.ping())
        except Exception:
            self._is_connected = False
            return False

    @staticmethod
    def normalize_question(question: str) -> str:
        """
        Chuan hoa noi dung cau hoi:
        - Chuan hoa Unicode ve chuan NFC.
        - Chuyen toan bo sang chu thuong.
        - Gom nhieu khoang trang lien tiep thanh mot khoang trang don.
        - Loai bo cac dau cau dac biet o dau va cuoi cau (?, !, ., :, ;).
        """
        if not question:
            return ""
        # 1. Unicode NFC
        text = unicodedata.normalize("NFC", question)
        # 2. Lowercase
        text = text.lower()
        # 3. Replace multiple spaces with single space
        text = re.sub(r"\s+", " ", text).strip()
        # 4. Remove leading/trailing punctuation commonly found in queries
        text = re.sub(r"^[^\w\s]+|[?!.,;:\s]+$", "", text).strip()
        return text

    def build_cache_key(
        self,
        question: str,
        use_rag: bool = True,
        top_k: int = 3,
        use_rerank: bool = True,
    ) -> str:
        """Tao khoa băm SHA-256 duy nhat cho bo tham so truy van."""
        norm_q = self.normalize_question(question)
        payload = f"q={norm_q}|rag={int(use_rag)}|top_k={top_k}|rerank={int(use_rerank)}"
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return f"viethistoqa:qa:{digest}"

    def get(
        self,
        question: str,
        use_rag: bool = True,
        top_k: int = 3,
        use_rerank: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """
        Lay ket qua tu Cache neu ton tai.
        Tra ve None neu khong tim thay hoac Redis mat ket noi.
        """
        if not self.is_available():
            return None

        key = self.build_cache_key(question, use_rag=use_rag, top_k=top_k, use_rerank=use_rerank)
        try:
            cached_val = self.client.get(key)
            if cached_val:
                data = json.loads(cached_val)
                data["cached"] = True
                return data
        except Exception as e:
            print(f"[Cache] Loi khi doc key {key}: {e}")
        return None

    def set(
        self,
        question: str,
        data: Dict[str, Any],
        use_rag: bool = True,
        top_k: int = 3,
        use_rerank: bool = True,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Luu ket qua truy van vao Cache kem thoi gian song TTL (giay).
        """
        if not self.is_available():
            return False

        key = self.build_cache_key(question, use_rag=use_rag, top_k=top_k, use_rerank=use_rerank)
        effective_ttl = ttl if ttl is not None else self.default_ttl

        try:
            payload = json.dumps(data, ensure_ascii=False)
            self.client.set(key, payload, ex=effective_ttl)
            return True
        except Exception as e:
            print(f"[Cache] Loi khi ghi key {key}: {e}")
            return False

    def clear(self) -> bool:
        """Xoa toan bo cac key cache thuoc namespace viethistoqa:qa:*"""
        if not self.is_available():
            return False
        try:
            cursor = 0
            while True:
                cursor, keys = self.client.scan(cursor=cursor, match="viethistoqa:qa:*", count=100)
                if keys:
                    self.client.delete(*keys)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            print(f"[Cache] Loi khi xoa cache: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Lay thong tin thong ke trang thai cache."""
        available = self.is_available()
        total_keys = 0
        if available:
            try:
                # Dem so luong key thuoc namespace
                cursor = 0
                while True:
                    cursor, keys = self.client.scan(cursor=cursor, match="viethistoqa:qa:*", count=100)
                    total_keys += len(keys)
                    if cursor == 0:
                        break
            except Exception:
                total_keys = -1

        return {
            "enabled": self.enabled,
            "connected": available,
            "host": self.host,
            "port": self.port,
            "db": self.db,
            "cached_queries_count": total_keys,
            "default_ttl_seconds": self.default_ttl,
        }


# Khoi tao the hien mac dinh (Singleton pattern)
cache_manager = HistoryCacheManager()

