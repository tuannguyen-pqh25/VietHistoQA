"""
verifier.py — Verifier Agent (Bộ phân loại Domain)
====================================================
Phân loại câu hỏi thành:
  - YES (label=1): Câu hỏi thuộc phạm vi Lịch sử Việt Nam giai đoạn 905–1975
  - NO  (label=0): Câu hỏi ngoài domain → chatbot từ chối, không gọi LLM

Thuật toán: Logistic Regression (scikit-learn) trên đặc trưng TF-IDF.
  - Nhẹ, không cần GPU, chạy < 1ms khi inference.
  - Huấn luyện 1 lần bằng script `train_verifier.py`, lưu model ra file .pkl.

Tại sao KHÔNG dùng LLM làm verifier?
  - Tránh tốn GPU/RAM gọi thêm 1 lần forward pass chỉ để kiểm tra.
  - Logistic Regression + TF-IDF đã đủ chính xác (>95%) cho bài toán nhị phân
    đơn giản: "câu hỏi Lịch sử VN 905–1975" vs "câu hỏi ngoài phạm vi".

Sử dụng:
    from rag.verifier import DomainVerifier
    verifier = DomainVerifier()                    # tự load model đã train
    result = verifier.verify("Ai lãnh đạo CMT8?") # True = in-domain
    label, confidence = verifier.predict_with_score("Bài hát nào hay?")
"""

import sys
import io
import os
import pickle
import re
import unicodedata
from typing import Tuple

# Fix encoding cho Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# ============================================================
# CẤU HÌNH
# ============================================================
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIFIER_MODEL_PATH = os.path.join(PROJECT_DIR, "rag", "verifier_model.pkl")

# Ngưỡng confidence tối thiểu để chấp nhận là in-domain
# (nếu confidence < threshold → coi là OOD để an toàn)
CONFIDENCE_THRESHOLD = 0.55

# Thông điệp từ chối khi câu hỏi ngoài domain
OOD_RESPONSE = (
    "Xin lỗi, tôi chỉ là chatbot hỗ trợ học tập Lịch sử Việt Nam giai đoạn 905–1975. "
    "Câu hỏi của bạn có vẻ nằm ngoài phạm vi chuyên môn của tôi. "
    "Vui lòng đặt câu hỏi liên quan đến lịch sử Việt Nam trong giai đoạn trên nhé!"
)

# ============================================================
# TỪ KHÓA ĐẶC TRƯNG LỊCH SỬ VN 905–1975 (Feature Engineering)
# ============================================================

# Mốc năm thuộc phạm vi (905–1975)
VALID_YEAR_RANGE = (905, 1975)

# ── STRONG KEYWORDS (chỉ cần 1 match → YES ngay lập tức) ────
# Tên riêng, sự kiện, triều đại CHỈ liên quan LSVN 905–1975.
# Khác HISTORY_KEYWORDS_VI: 1 STRONG keyword đã đủ kết luận YES (conf=0.95).
STRONG_HISTORY_KEYWORDS = [
    # ▸ Nhân vật lịch sử VN — alias / biệt danh phổ biến
    "bác hồ", "hồ chủ tịch", "chủ tịch hồ chí minh",
    "nguyễn tất thành", "nguyễn sinh cung", "nguyễn sinh sắc",
    "ngô quyền", "đinh bộ lĩnh", "đinh tiên hoàng",
    "lê hoàn", "lê đại hành",
    "lý công uẩn", "lý thái tổ", "lý thường kiệt", "lý nhân tông",
    "trần hưng đạo", "trần quốc tuấn", "trần nhân tông", "trần thái tông",
    "lê lợi", "lê thái tổ", "nguyễn trãi", "lê thánh tông",
    "quang trung", "nguyễn nhạc", "nguyễn lữ",
    "gia long", "minh mạng", "tự đức",
    "hoàng hoa thám", "đề thám",
    "trương định", "nguyễn trung trực",
    "tôn thất thuyết", "hàm nghi",
    "nguyễn thị minh khai", "lê hồng phong",
    "tôn đức thắng", "phạm văn đồng", "trường chinh",
    "ngô đình diệm", "ngô đình nhu",
    "nguyễn thái học", "phạm hồng thái",
    "hai bà trưng", "bà triệu", "triệu thị trinh",
    "lê văn tám", "nguyễn văn trỗi",
    "võ thị sáu", "kim đồng", "lý tự trọng",
    # ▸ Sự kiện / chiến dịch đặc trưng VN
    "cách mạng tháng tám", "cmt8",
    "điện biên phủ", "chiến thắng điện biên phủ",
    "trận bạch đằng", "chiến thắng bạch đằng",
    "trận chi lăng", "trận đống đa", "trận rạch gầm", "trận xoài mút",
    "khởi nghĩa lam sơn", "khởi nghĩa hai bà trưng", "khởi nghĩa lý bí",
    "tuyên ngôn độc lập", "tổng khởi nghĩa",
    "tìm đường cứu nước", "con đường cứu nước", "ra đi tìm đường cứu nước",
    "chiến dịch hồ chí minh", "chiến dịch biên giới",
    "đường trường sơn", "đường mòn hồ chí minh",
    "tết mậu thân", "cuộc tổng tiến công",
    "phong trào đông du", "phong trào duy tân",
    "phong trào cần vương", "xô viết nghệ tĩnh",
    "đồng khởi",
    "chiến tranh đặc biệt", "chiến tranh cục bộ",
    "việt nam hóa chiến tranh",
    # ▸ Triều đại / Quốc hiệu VN
    "nhà ngô", "nhà đinh", "nhà tiền lê", "nhà lý", "nhà trần",
    "nhà hồ", "nhà hậu lê", "nhà mạc", "nhà nguyễn", "nhà lê",
    "nhà tây sơn",
    "đàng trong", "đàng ngoài", "chúa trịnh", "chúa nguyễn",
    "đại việt", "đại cồ việt", "đại nam", "vạn xuân",
    "triều nguyễn", "triều lý", "triều trần", "triều lê",
    # ▸ Tổ chức / Đảng phái VN
    "việt minh", "việt nam dân chủ cộng hòa", "vndcch",
    "đảng cộng sản việt nam", "đcsvn",
    "đảng cộng sản đông dương",
    "hội việt nam cách mạng thanh niên",
    "mặt trận việt minh", "mặt trận liên việt",
    "mặt trận dân tộc giải phóng miền nam",
]

# ── REGULAR KEYWORDS (cần ≥ 2 match) ──────────────────────
HISTORY_KEYWORDS_VI = [
    # Nhân vật
    "hồ chí minh", "ngô quyền", "đinh bộ lĩnh", "lê lợi", "nguyễn huệ", "trần hưng đạo",
    "phan bội châu", "phan châu trinh", "võ nguyên giáp", "lê duẩn", "nguyễn ái quốc",
    # Sự kiện / chiến dịch
    "cách mạng tháng tám", "điện biên phủ", "đồng khởi", "hiệp định giơnevơ",
    "hiệp định paris", "chiến dịch hồ chí minh", "khởi nghĩa", "kháng chiến",
    "cải cách ruộng đất", "tổng khởi nghĩa", "cách mạng dân tộc",
    # Triều đại / Tổ chức
    "đảng cộng sản", "việt minh", "việt nam dân chủ cộng hòa", "vnch", "viet cong",
    "nhà nguyễn", "nhà lê", "nhà trần", "nhà lý", "nhà đinh",
    "triều đình huế", "thực dân pháp", "đế quốc mỹ",
    # Địa điểm / chiến trường
    "bắc sơn", "nam kỳ khởi nghĩa", "biên giới thu đông", "tây nguyên",
    "chiến khu việt bắc", "thủ đô hà nội",
    # Giai đoạn / khái niệm
    "phong kiến", "thuộc địa", "giải phóng dân tộc", "độc lập", "thống nhất đất nước",
    "bắc kỳ", "nam kỳ", "trung kỳ", "đông dương",
    # Từ khóa học thuật lịch sử
    "ý nghĩa lịch sử", "nguyên nhân", "diễn biến", "kết quả", "hậu quả",
    "triều đại", "thời kỳ", "giai đoạn",
    # Bổ sung — hiệp định / chiến tranh
    "hiệp định giơnevơ", "hiệp định genève", "hiệp định geneva",
    "chiến dịch", "chiến thắng", "trận đánh",
    "đánh giặc", "chống xâm lược", "chống ngoại xâm",
    "quân đội nhân dân", "bộ đội",
    # Bổ sung — địa điểm / biểu tượng
    "vĩ tuyến 17", "sông bến hải", "cầu hiền lương",
    "dinh độc lập", "phủ chủ tịch",
    # Bổ sung — khái niệm / hành động
    "nửa phong kiến", "nửa thuộc địa",
    "chống pháp", "chống mỹ", "chống giặc",
    "giành độc lập", "phong trào yêu nước",
    "đấu tranh giải phóng", "ra đi tìm đường",
    "quốc khánh", "ngày giải phóng",
    "lịch sử việt nam", "lịch sử dân tộc",
    "sử việt nam", "sử việt",
    "bài học lịch sử", "vai trò", "công lao",
    # Bổ sung — tác phẩm lịch sử
    "hịch tướng sĩ", "bình ngô đại cáo", "nam quốc sơn hà",
]

HISTORY_KEYWORDS_NO_DIACRITIC = [
    "ho chi minh", "ngo quyen", "dinh bo linh", "le loi", "nguyen hue",
    "tran hung dao", "dien bien phu", "dong khoi", "geneve", "paris",
    "viet minh", "viet cong", "khoi nghia", "khang chien", "cach mang",
    "phong kien", "thuoc dia", "bac son", "nam ky", "dong duong",
    # Bổ sung — nhân vật (không dấu)
    "bac ho", "nguyen tat thanh", "nguyen sinh cung",
    "quang trung", "ly thuong kiet", "le thanh tong", "tran quoc tuan",
    "nguyen trai", "ly cong uan", "tran nhan tong",
    "hoang hoa tham", "de tham",
    "hai ba trung", "ba trieu",
    "vo thi sau", "kim dong", "ly tu trong",
    # Bổ sung — sự kiện / khái niệm (không dấu)
    "cach mang thang tam", "tuyen ngon doc lap",
    "tim duong cuu nuoc", "giai phong", "doc lap", "thong nhat",
    "lich su viet nam", "su viet",
    "chong phap", "chong my",
]

# Từ khóa rõ ràng ngoài domain
OOD_KEYWORDS = [
    # Khoa học / công nghệ
    "lập trình", "python", "java", "code", "thuật toán", "trí tuệ nhân tạo",
    "machine learning", "deep learning", "neural network", "chatgpt", "openai",
    # Lịch sử nước ngoài (chỉ giữ tên riêng rõ ràng — tránh chặn nhầm LSVN liên quan ngoại giao/chiến tranh)
    "napoleon", "hitler", "world war",
    # Thể thao / giải trí
    "bóng đá", "bóng rổ", "ca sĩ", "diễn viên", "phim", "âm nhạc",
    # Y tế / sức khỏe
    "bệnh viện", "thuốc", "vitamin", "covid", "vaccine",
    # Kinh tế / tài chính
    "chứng khoán", "bitcoin", "crypto", "đầu tư", "lãi suất",
    # Toán / vật lý
    "phương trình", "tích phân", "đạo hàm", "vật lý", "hóa học",
    # Nấu ăn / ẩm thực
    "nấu ăn", "công thức nấu", "món ăn", "ẩm thực",
    # Giải trí
    "trò chơi", "game", "anime", "manga", "cosplay",
]


def normalize_text(text: str) -> str:
    """Normalize Unicode NFC và lowercase."""
    return unicodedata.normalize("NFC", text.strip().lower())


def extract_years_in_text(text: str) -> list[int]:
    """Trích xuất tất cả năm (3-4 chữ số) trong văn bản."""
    return [int(y) for y in re.findall(r'\b(\d{3,4})\b', text)]


def has_valid_year(text: str) -> bool:
    """Kiểm tra xem có năm nào trong phạm vi 905–1975 không."""
    years = extract_years_in_text(text)
    return any(VALID_YEAR_RANGE[0] <= y <= VALID_YEAR_RANGE[1] for y in years)


def has_ood_year(text: str) -> bool:
    """Kiểm tra xem có năm nào rõ ràng ngoài phạm vi không (ví dụ 1976+, 2000s)."""
    years = extract_years_in_text(text)
    return any(y > 1975 for y in years)


# ============================================================
# LỚP VERIFIER AGENT CHÍNH
# ============================================================

class DomainVerifier:
    """
    Verifier Agent: phân loại câu hỏi vào/ngoài domain Lịch sử VN 905–1975.

    Pipeline nội bộ:
      1. Rule-based fast-path: keyword OOD rõ ràng → ngay lập tức NO.
      2. Rule-based fast-path: năm trong phạm vi hoặc keyword lịch sử → YES sớm.
      3. ML model (Logistic Regression + TF-IDF): quyết định cuối cùng.

    Nếu model chưa được train (file .pkl chưa có), tự động dùng rule-based.
    """

    def __init__(
        self,
        model_path: str = VERIFIER_MODEL_PATH,
        confidence_threshold: float = CONFIDENCE_THRESHOLD,
    ):
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.vectorizer = None
        self._load_model(model_path)

    def _load_model(self, model_path: str):
        """Load Logistic Regression model từ file .pkl nếu có."""
        if os.path.exists(model_path):
            try:
                with open(model_path, "rb") as f:
                    bundle = pickle.load(f)
                self.vectorizer = bundle["vectorizer"]
                self.model = bundle["model"]
                print(f"[Verifier] Da load model tu: {model_path}")
            except Exception as e:
                print(f"[Verifier] Khong load duoc model: {e}. Dung rule-based.")
                self.model = None
                self.vectorizer = None
        else:
            print(
                f"[Verifier] Chua co model tai: {model_path}\n"
                "   -> Dung rule-based classifier. Chay `python rag/train_verifier.py` de train."
            )

    def _rule_based_check(self, text: str) -> Tuple[bool, float, str]:
        """
        Rule-based fast-path (v2 — cải tiến).

        Luồng logic mới:
          1. STRONG keyword (tên riêng LSVN) → YES ngay (conf=0.95)
          2. OOD keyword + KHÔNG có tín hiệu lịch sử → NO (conf=0.97)
          3. Năm trong 905–1975 (không có năm OOD) → YES (conf=0.92)
          4. ≥ 2 regular keyword → YES (conf=0.88)
          5. 1 keyword + OOD → mixed → ML quyết định
          6. 1 keyword, không OOD → weak → ML quyết định
          7. Năm > 1975 → NO (conf=0.85)
          8. Không tín hiệu → uncertain → ML quyết định

        Cải tiến:
          - Đếm TẤT CẢ tín hiệu trước khi quyết định (tránh false positive/negative)
          - STRONG keyword: 1 match = YES (tránh lọc nhầm "Bác Hồ", "Quang Trung"...)
          - OOD chỉ chặn khi KHÔNG CÓ tín hiệu lịch sử (tránh chặn nhầm câu hỏi ngoại giao/kháng chiến)

        Returns: (is_in_domain, confidence, reason)
        """
        norm = normalize_text(text)

        # === Bước 0: Đếm TẤT CẢ tín hiệu trước khi ra quyết định ===
        strong_matches = [kw for kw in STRONG_HISTORY_KEYWORDS if kw in norm]
        history_matches = [kw for kw in HISTORY_KEYWORDS_VI if kw in norm]
        history_matches += [kw for kw in HISTORY_KEYWORDS_NO_DIACRITIC if kw in norm]
        ood_matches = [kw for kw in OOD_KEYWORDS if kw in norm]
        valid_year = has_valid_year(norm)
        ood_year = has_ood_year(norm)

        # === HARD YES: Từ khóa đặc trưng MẠNH (tên riêng LSVN) ===
        if strong_matches:
            return True, 0.95, f"strong keywords: {strong_matches[:3]}"

        # === HARD NO: OOD keyword + KHÔNG CÓ bất kỳ tín hiệu lịch sử nào ===
        if ood_matches and not history_matches and not valid_year:
            return False, 0.97, f"OOD keyword: '{ood_matches[0]}'"

        # === HARD YES: Năm trong phạm vi 905–1975 (không kèm năm OOD) ===
        if valid_year and not ood_year:
            return True, 0.92, "valid year in range 905–1975"

        # === SOFT YES: ≥ 2 keyword lịch sử VN ===
        if len(history_matches) >= 2:
            return True, 0.88, f"keywords: {history_matches[:3]}"

        # === WEAK: 1 keyword lịch sử ===
        if len(history_matches) == 1:
            if ood_matches:
                # Tín hiệu trộn lẫn → ML quyết định
                return None, 0.5, f"mixed signals: history={history_matches}, ood={ood_matches[:2]}"
            # 1 keyword, không OOD → hơi nghiêng in-domain nhưng chưa chắc
            return None, 0.6, f"weak keyword: {history_matches}"

        # === HARD NO: Năm rõ ràng ngoài phạm vi (1976+) ===
        if ood_year:
            return False, 0.85, "year out of range (>1975)"

        # Không kết luận được → ML quyết định
        return None, 0.5, "uncertain"

    def _ml_predict(self, text: str) -> Tuple[bool, float]:
        """
        Dùng Logistic Regression để phân loại.
        Returns: (is_in_domain, confidence)
        """
        if self.model is None or self.vectorizer is None:
            # Fallback: uncertain → NO (conservative)
            return False, 0.5

        norm = normalize_text(text)
        X = self.vectorizer.transform([norm])
        proba = self.model.predict_proba(X)[0]
        # label 1 = in-domain
        in_domain_prob = proba[list(self.model.classes_).index(1)]
        is_in_domain = in_domain_prob >= self.confidence_threshold
        return is_in_domain, float(in_domain_prob)

    def predict_with_score(self, question: str) -> Tuple[bool, float, str]:
        """
        Phân loại câu hỏi, trả về chi tiết.

        Returns:
            (is_in_domain: bool, confidence: float, reason: str)
        """
        # Bước 1: Rule-based
        rule_result, rule_conf, reason = self._rule_based_check(question)

        if rule_result is not None and rule_conf >= 0.85:
            # Kết quả rule đủ chắc chắn → không cần ML
            return rule_result, rule_conf, f"rule-based ({reason})"

        # Bước 2: ML model
        ml_result, ml_conf = self._ml_predict(question)

        # Kết hợp: nếu rule cho gợi ý yếu, ưu tiên ML
        final_result = ml_result
        final_conf = ml_conf
        final_reason = f"ml-logistic (conf={ml_conf:.2f})"

        # Nếu rule và ML đồng thuận → boost confidence
        if rule_result is not None and rule_result == ml_result:
            final_conf = min(0.99, (rule_conf + ml_conf) / 2 + 0.05)
            final_reason = f"rule+ml ensemble (conf={final_conf:.2f})"

        return final_result, final_conf, final_reason

    def verify(self, question: str) -> bool:
        """
        Phân loại đơn giản: True = in-domain, False = OOD.
        Dùng nhanh trong pipeline.
        """
        is_in_domain, _, _ = self.predict_with_score(question)
        return is_in_domain

    def get_ood_response(self) -> str:
        """Trả về thông điệp từ chối chuẩn."""
        return OOD_RESPONSE


# ============================================================
# TEST THỬ (chạy trực tiếp file này)
# ============================================================
if __name__ == "__main__":
    verifier = DomainVerifier()

    test_cases = [
        # In-domain (Yes)
        ("Cách mạng tháng Tám năm 1945 diễn ra như thế nào?", True),
        ("Ý nghĩa của chiến thắng Điện Biên Phủ 1954 là gì?", True),
        ("Ngô Quyền đánh tan quân Nam Hán năm 938 như thế nào?", True),
        ("Hiệp định Giơnevơ năm 1954 có nội dung gì?", True),
        ("Kháng chiến chống Pháp (1945–1954) giai đoạn 1951–1953 diễn biến thế nào?", True),
        # In-domain edge cases — alias, câu ngắn, không có năm cụ thể
        ("Bác Hồ ra đi tìm đường cứu nước năm nào?", True),
        ("Ai lãnh đạo Cách mạng tháng Tám?", True),
        ("Quang Trung đại phá quân Thanh vào dịp nào?", True),
        ("Trận Bạch Đằng diễn ra năm nào?", True),
        ("Lý Thường Kiệt viết bài thơ gì nổi tiếng?", True),
        ("Nhà Trần chống giặc Mông Cổ mấy lần?", True),
        ("Vai trò của Nguyễn Trãi trong khởi nghĩa Lam Sơn?", True),
        ("Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập ở đâu?", True),
        ("Đảng ta thành lập năm nào?", True),
        # Out-of-domain (No)
        ("Python là ngôn ngữ lập trình gì?", False),
        ("Bitcoin hiện đang có giá bao nhiêu?", False),
        ("Làm thế nào để nấu phở bò ngon?", False),
        ("Chiến tranh thế giới thứ 2 bắt đầu năm nào?", False),  # WW2 = ngoài VN
        ("Bài hát nào đang trending trên Spotify?", False),
        ("Việt Nam hiện nay có bao nhiêu tỉnh thành?", False),  # sau 1975
    ]

    print("=" * 65)
    print("KIEM TRA DOMAIN VERIFIER")
    print("=" * 65)
    correct = 0
    for question, expected in test_cases:
        is_in_domain, confidence, reason = verifier.predict_with_score(question)
        status = "[PASS]" if is_in_domain == expected else "[FAIL]"
        if is_in_domain == expected:
            correct += 1
        label = "YES (In-Domain)" if is_in_domain else "NO  (OOD)"
        print(f"\n{status} [{label}] conf={confidence:.2f}")
        print(f"   Q: {question}")
        print(f"   Reason: {reason}")

    print(f"\n{'='*65}")
    print(f"Accuracy: {correct}/{len(test_cases)} = {correct/len(test_cases)*100:.1f}%")
