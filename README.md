# VietHistoQA: Hallucination-Resistant Vietnamese History QA System

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Ollama](https://img.shields.io/badge/Ollama-GGUF_Q4__K__M-FF6B35.svg)](https://ollama.com)
[![React](https://img.shields.io/badge/React-Vite_+_TailwindCSS-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Model](https://img.shields.io/badge/Model-Qwen2.5--3B--Instruct-8B5CF6.svg)](https://huggingface.co/Qwen)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-VietHistoQA--3B--GGUF-FFD21E.svg?logo=huggingface&logoColor=black)](https://huggingface.co/ethan-pqh25/VietHistoQA-3B-GGUF)
[![License](https://img.shields.io/badge/License-MIT-22C55E.svg)](LICENSE)

*An end-to-end, multi-agent Retrieval-Augmented Generation (RAG) system specialized in Vietnamese history (905-1975), featuring Out-of-Domain verification, two-stage neural reranking, real-time voice interaction, and edge deployment on standard 8GB RAM environments.*

[English](#english) | [Tiếng Việt](#tiếng-việt)

</div>

---

<a name="english"></a>

## English Documentation

### 1. Overview

**VietHistoQA** is a standalone, production-ready software system built to resolve critical factual hallucination and chronological confusion in Large Language Models (LLMs) when answering queries on Vietnamese history. 

By integrating an Out-of-Domain (OOD) Verifier Agent, a Two-Stage Retrieval pipeline (Bi-Encoder + Cross-Encoder Reranker), and a quantized 3B foundation model deployed locally via Ollama, VietHistoQA delivers high factual accuracy while requiring only ~2.0 GB of RAM.

### 2. Key Capabilities

- **OOD Verifier Agent v2**: A hybrid gatekeeper combining a canonical entity fast-path with an L2-regularized logistic regression classifier. Filters non-historical or adversarial queries with sub-millisecond latency (< 0.01 ms) and 100% test accuracy.
- **Two-Stage RAG Pipeline**: Combines dense FAISS vector search (8,092 historical chunk vectors) with a cross-encoder reranker (`ms-marco-MiniLM-L-6-v2`), improving Top-1 retrieval precision (Hit@1) by +45.8%.
- **Client-Side Real-Time Voice Query**: Implements native Vietnamese Speech-to-Text (`vi-VN`) via browser Web Speech API, incurring zero server computational overhead and zero external API subscription costs.
- **8GB RAM Edge Sweet Spot**: Powered by `qwen-history-vn-q4km.gguf` (1.93 GB). Operates entirely within ~1.9 - 2.0 GB RAM, eliminating virtual memory swapping and sluggishness on budget school computers.

### 3. System Architecture

```text
User Query (Text or Voice)
       |
       v
[ Verifier Agent v2 ] ---> (Out-of-Domain) ---> Graceful Denial Response
       |
       | (In-Domain History Query)
       v
[ Stage 1: Dense FAISS Retriever ] (IndexFlatIP, 8,092 vectors, 768-dim)
       |
       | Top-k Candidates (k=10)
       v
[ Stage 2: Cross-Encoder Reranker ] (ms-marco-MiniLM-L-6-v2)
       |
       | Top-p Filtered Chunks (p=3)
       v
[ Generation Engine: Qwen2.5-3B ] (Ollama GGUF Q4_K_M via REST API)
       |
       v
Factual, Grounded Response with Source Attribution
```

### 4. Repository Structure

```text
VietHistoQA/
|-- backend/
|   |-- main.py                     # FastAPI REST API server
|   `-- __init__.py
|-- frontend/                       # React 19 + Vite + TailwindCSS user interface
|   |-- src/                        # React components, Voice Query mic, styles
|   |-- public/                     # Static assets
|   |-- package.json
|   `-- index.html
|-- rag/
|   |-- index/
|   |   |-- faiss_index.bin         # Prebuilt FAISS vector index (8,092 chunks)
|   |   `-- chunk_metadata.json     # Historical periods and context metadata
|   |-- retriever.py                # FAISS Bi-Encoder + Cross-Encoder Reranker
|   |-- rag_pipeline.py             # Orchestrator: Verifier -> Retriever -> Ollama
|   |-- verifier.py                 # Out-of-Domain detection agent
|   `-- verifier_model.pkl          # Trained logistic regression model
|-- models/
|   `-- Modelfile                   # Ollama manifest configuration file
|-- requirements.txt                # Python runtime dependencies
|-- .env.example                    # Environment variable configuration template
|-- .gitignore                      # Exclusion list for local caches and binary weights
`-- README.md                       # System documentation
```

### 5. Hardware and Software Prerequisites

- **Operating System**: Windows 10/11 (64-bit), Ubuntu 20.04+, or macOS.
- **Hardware Specifications**:
  - **RAM**: Minimum 8 GB.
  - **CPU**: 4 cores or higher (Intel Core i3/i5/i7 8th Gen+ or AMD Ryzen 3/5/7).
  - **GPU**: Not required (Runs efficiently on standard CPU).
  - **Disk Space**: At least 5 GB free disk space.
- **Installed Software**:
  - Python 3.10 or higher.
  - Node.js 18 or higher (with npm).
  - [Ollama](https://ollama.com/) runtime installed and accessible on PATH.

### 6. Installation & Execution Guide

Follow the steps below to set up and run VietHistoQA on your local machine:

#### Step 1: Clone the Repository
```bash
git clone https://github.com/tuannguyen-pqh25/VNHistoQA.git
cd VNHistoQA
```

#### Step 2: Prepare the Language Model in Ollama
1. Download the quantized model weights (`qwen-history-vn-q4km.gguf`, 1.93 GB) from Hugging Face:
   - **Model Repository**: [ethan-pqh25/VietHistoQA-3B-GGUF on Hugging Face](https://huggingface.co/ethan-pqh25/VietHistoQA-3B-GGUF)
   *(Navigate to the **Files and versions** tab and download `qwen-history-vn-q4km.gguf`, or use the [Direct Download Link](https://huggingface.co/ethan-pqh25/VietHistoQA-3B-GGUF/resolve/main/qwen-history-vn-q4km.gguf)).*
2. Place the downloaded file into the `models/` directory:
   ```text
   models/
   |-- Modelfile
   `-- qwen-history-vn-q4km.gguf
   ```
3. Register the model with Ollama:
   ```bash
   cd models
   ollama create vn-history-3b -f Modelfile
   cd ..
   ```
4. Verify that the model is ready:
   ```bash
   ollama list
   # You should see vn-history-3b in the list
   ```

#### Step 3: Install and Start Backend
```bash
# 1. Create and activate virtual environment
# Windows:
python -m venv .venv
call .venv\Scripts\activate

# Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Launch the FastAPI server
python backend/main.py
```
The backend server will start and listen at: `http://localhost:8000` (API documentation at: `http://localhost:8000/docs`).

#### Step 4: Install and Start Frontend
Open a new terminal window:
```bash
cd frontend

# Install Node.js dependencies
npm install

# Start the Vite development server
npm run dev
```
The user interface will be accessible at: `http://localhost:5173`.

### 7. API Specification

**Endpoint:** `POST /api/chat`

**Request Body:**
```json
{
  "question": "Chiến dịch Điện Biên Phủ diễn ra trong khoảng thời gian nào và có ý nghĩa gì?",
  "use_rag": true,
  "top_k": 3
}
```

**Response Format:**
```json
{
  "answer": "Chiến dịch Điện Biên Phủ diễn ra từ ngày 13/03/1954 đến ngày 07/05/1954...",
  "sources": [
    {
      "text": "Hỏi: Chiến dịch Điện Biên Phủ diễn ra năm nào? \nĐáp: Diễn ra năm 1954...",
      "score": 0.892,
      "metadata": { "era": "1945-1954", "year": 1954 }
    }
  ],
  "is_in_domain": true
}
```

### 8. Experimental Benchmark Summary

Quantitative evaluation on N=200 curated historical test queries:

| Configuration / Track | BLEU-4 | ROUGE-L | BERTScore | Inference RAM |
|:---|:---:|:---:|:---:|:---:|
| Base Model (3B) | 0.0713 | 0.3882 | 0.7654 | ~2.0 GB |
| Base Model + Dense RAG | 0.1000 | 0.4425 | 0.7887 | ~2.0 GB |
| Fine-Tuned + Dense RAG | 0.1045 | 0.4406 | 0.7915 | ~2.0 GB |
| **Fine-Tuned + Two-Stage Rerank (Ours)** | **0.1048** | **0.4518** | **0.7942** | **~2.0 GB** |
| Reference: 7B Model + Two-Stage Rerank | 0.1141 | 0.4591 | 0.7971 | ~5.1 GB |

*Result: The 3B model with Two-Stage RAG achieves 99.6% of the 7B model's semantic accuracy while consuming over 55% less memory.*

### 9. License

Released under the **MIT License**. Intended for academic, educational, and non-commercial research purposes.

---

<a name="tiếng-việt"></a>

## Tài Liệu Tiếng Việt

### 1. Giới Thiệu Chung

**VietHistoQA** là gói giải pháp phần mềm độc lập, hoàn chỉnh, được xây dựng nhằm giải quyết triệt để hiện tượng ảo giác tri thức (hallucination) và sai lệch mốc niên đại khi truy vấn Lịch sử Việt Nam trên các mô hình ngôn ngữ lớn.

Hệ thống kết hợp bộ kiểm duyệt câu hỏi ngoài phạm vi (OOD Verifier Agent v2), cơ chế truy xuất ngữ nghĩa hai giai đoạn (Two-Stage RAG), và mô hình nền tảng lượng tử hóa 3B vận hành offline qua Ollama, đạt độ chính xác cao trong giới hạn tài nguyên ~2.0 GB RAM.

### 2. Các Đặc Tính Nổi Bật

- **Bộ kiểm duyệt Verifier Agent v2**: Cơ chế sàng lọc lai kết hợp Fast-Path từ điển thực thể lịch sử và mô hình Hồi quy Logistic chuẩn hóa L2. Nhận diện và từ chối các câu hỏi ngoài phạm vi lịch sử với độ trễ dưới 0.01 ms và độ chính xác kiểm thử đạt 100% (20/20 mẫu đối chứng).
- **Truy xuất ngữ nghĩa hai giai đoạn (Two-Stage RAG)**: Phối hợp trích xuất dày đặc qua FAISS Bi-Encoder (8,092 vector tri thức chuẩn hóa mốc thời gian) và mô hình chấm điểm chéo Cross-Encoder MiniLM, nâng tỷ lệ trích xuất đúng tài liệu hàng đầu (Hit@1) thêm +45.8%.
- **Nhập liệu bằng giọng nói thời gian thực (Voice Query)**: Ứng dụng Web Speech API tiếng Việt (`vi-VN`) trực tiếp phía trình duyệt người dùng, không chiếm dụng tài nguyên máy chủ và không phát sinh phí API bản quyền.
- **Điểm ngọt triển khai biên (8GB RAM)**: Sử dụng mô hình `qwen-history-vn-q4km.gguf` (1.93 GB). Tổng dung lượng RAM chiếm dụng chỉ ~1.9 - 2.0 GB, loại bỏ hoàn toàn tình trạng tráo đổi đĩa ảo (disk swapping) trên máy tính học đường.

### 3. Kiến Trúc Luồng Xử Lý

```text
Câu hỏi của người dùng (Văn bản hoặc Giọng nói)
       |
       v
[ Verifier Agent v2 ] ---> (Ngoài phạm vi) ---> Từ chối lịch sự, tránh ảo giác
       |
       | (Câu hỏi Lịch sử hợp lệ)
       v
[ Giai đoạn 1: FAISS Bi-Encoder ] (IndexFlatIP, 8,092 vectors, 768 chiều)
       |
       | Top-k đoạn trích ứng viên (k=10)
       v
[ Giai đoạn 2: Cross-Encoder Reranker ] (ms-marco-MiniLM-L-6-v2)
       |
       | Top-p đoạn trích chính xác nhất (p=3)
       v
[ Bộ sinh câu trả lời: Qwen2.5-3B ] (Gọi Ollama GGUF Q4_K_M qua REST API)
       |
       v
Câu trả lời chuẩn xác kèm trích dẫn tài liệu nguồn
```

### 4. Cấu Trúc Thư Mục Module

```text
VietHistoQA/
|-- backend/
|   |-- main.py                     # API Gateway FastAPI (Endpoint POST /api/chat)
|   `-- __init__.py
|-- frontend/                       # Giao diện người dùng React 19 + Vite + TailwindCSS
|   |-- src/                        # Mã nguồn React, Voice Query mic, kiểu dáng
|   |-- public/                     # Tài nguyên tĩnh
|   |-- package.json
|   `-- index.html
|-- rag/
|   |-- index/
|   |   |-- faiss_index.bin         # Chỉ mục vector FAISS (8,092 chunks, 768 chiều)
|   |   `-- chunk_metadata.json     # Siêu dữ liệu ngữ cảnh & thời kỳ lịch sử
|   |-- retriever.py                # FAISS Bi-Encoder + Cross-Encoder Reranker
|   |-- rag_pipeline.py             # Điều phối: Verifier -> Retriever -> Ollama
|   |-- verifier.py                 # Bộ phân lớp phát hiện Out-of-Domain
|   `-- verifier_model.pkl          # Trọng số mô hình Hồi quy Logistic đã huấn luyện
|-- models/
|   `-- Modelfile                   # File cấu hình nạp GGUF vào Ollama với ChatML template
|-- requirements.txt                # Danh mục thư viện Python cần thiết
|-- .env.example                    # Cấu hình biến môi trường mẫu
|-- .gitignore                      # Chặn các file nhị phân nặng khi đẩy Git
`-- README.md                       # Tài liệu hướng dẫn này
```

### 5. Yêu Cầu Cấu Hình Hệ Thống

- **Hệ điều hành**: Windows 10/11 64-bit, Ubuntu 20.04+, hoặc macOS.
- **Phần cứng**:
  - **RAM**: Tối thiểu 8 GB.
  - **CPU**: 4 nhân trở lên (Intel Core i3/i5/i7 thế hệ 8+ hoặc AMD Ryzen 3/5/7).
  - **Card đồ họa (GPU)**: Không bắt buộc (suy luận mượt mà trên CPU).
  - **Dung lượng đĩa trống**: Tối thiểu 5 GB.
- **Môi trường yêu cầu cài trước**:
  - Python 3.10 trở lên.
  - Node.js 18 trở lên (kèm npm).
  - Phần mềm [Ollama](https://ollama.com/) đã cài đặt và có trong PATH hệ thống.

### 6. Hướng Dẫn Cài Đặt và Khởi Chạy Hệ Thống

Thực hiện lần lượt các bước sau trên máy tính của bạn:

#### Bước 1: Sao chép mã nguồn (Clone Repository)
```bash
git clone https://github.com/tuannguyen-pqh25/VNHistoQA.git
cd VNHistoQA
```

#### Bước 2: Chuẩn bị mô hình trong Ollama
1. Tải tệp trọng số mô hình `qwen-history-vn-q4km.gguf` (1.93 GB) từ Hugging Face:
   - **Trang mô hình chính thức**: [ethan-pqh25/VietHistoQA-3B-GGUF trên Hugging Face](https://huggingface.co/ethan-pqh25/VietHistoQA-3B-GGUF)
   *(Truy cập trang mô hình, chuyển sang tab **Files and versions** để xem chi tiết và tải tệp `qwen-history-vn-q4km.gguf`, hoặc bấm [Tải trực tiếp](https://huggingface.co/ethan-pqh25/VietHistoQA-3B-GGUF/resolve/main/qwen-history-vn-q4km.gguf)).*
2. Đặt tệp vừa tải vào thư mục `models/`:
   ```text
   models/
   |-- Modelfile
   `-- qwen-history-vn-q4km.gguf
   ```
3. Mở terminal tại thư mục `models` và nạp mô hình vào Ollama:
   ```bash
   cd models
   ollama create vn-history-3b -f Modelfile
   cd ..
   ```
4. Kiểm tra mô hình đã sẵn sàng trong Ollama:
   ```bash
   ollama list
   # Kết quả xuất hiện vn-history-3b là thành công
   ```

#### Bước 3: Cài đặt và khởi chạy Backend
Mở một cửa sổ dòng lệnh tại thư mục gốc của dự án:
```bash
# 1. Tạo và kích hoạt môi trường ảo
# Trên Windows:
python -m venv .venv
call .venv\Scripts\activate

# Trên Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate

# 2. Cài đặt các thư viện cần thiết
pip install --upgrade pip
pip install -r requirements.txt

# 3. Khởi chạy máy chủ FastAPI
python backend/main.py
```
Máy chủ backend sẽ khởi động và lắng nghe tại: `http://localhost:8000` (Tài liệu API Swagger tại: `http://localhost:8000/docs`).

#### Bước 4: Cài đặt và khởi chạy Frontend
Mở một cửa sổ dòng lệnh mới:
```bash
cd frontend

# Cài đặt các gói phụ thuộc Node.js
npm install

# Khởi chạy giao diện phát triển
npm run dev
```
Giao diện người dùng sẽ chạy tại địa chỉ: `http://localhost:5173`. Truy cập trình duyệt để bắt đầu đặt câu hỏi lịch sử.

### 7. Đặc Tả Giao Diện Lập Trình (API Specification)

**Endpoint:** `POST /api/chat`

**Nội dung gửi lên (Request Body):**
```json
{
  "question": "Chiến dịch Điện Biên Phủ diễn ra trong khoảng thời gian nào và có ý nghĩa gì?",
  "use_rag": true,
  "top_k": 3
}
```

**Dữ liệu phản hồi (Response):**
```json
{
  "answer": "Chiến dịch Điện Biên Phủ diễn ra từ ngày 13/03/1954 đến ngày 07/05/1954...",
  "sources": [
    {
      "text": "Hỏi: Chiến dịch Điện Biên Phủ diễn ra năm nào? \nĐáp: Diễn ra năm 1954...",
      "score": 0.892,
      "metadata": { "era": "1945-1954", "year": 1954 }
    }
  ],
  "is_in_domain": true
}
```

### 8. Bản Quyền & Giấy Phép

Phát hành dưới giấy phép mã nguồn mở **MIT License**. Toàn bộ mã nguồn phục vụ mục đích nghiên cứu khoa học, học tập và ứng dụng phi thương mại.
