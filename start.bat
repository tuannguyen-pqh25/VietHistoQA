@echo off
title VNHistory-RAG Launcher

echo ==============================================================================
echo           VNHISTORY-RAG - HE THONG HOI DAP LICH SU VIET NAM
echo ==============================================================================
echo.

cd /d "%~dp0"

:: 1. Kiem tra va khoi tao moi truong ao Python neu chua co
if not exist ".venv\Scripts\activate.bat" (
    echo [THONG BAO] Khong tim thay moi truong ao .venv. Dang tien hanh tao moi...
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [LOI] Khong the tao moi truong ao Python. Vui long kiem tra lai trinh cai dat Python.
        pause
        exit /b 1
    )
    echo [THONG BAO] Dang kich hoat moi truong ao va cai dat thu vien tu requirements.txt...
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [LOI] Co loi xay ra trong qua trinh cai dat thu vien.
        pause
        exit /b 1
    )
    echo [OK] Da thiet lap xong moi truong ao .venv.
    echo.
)

:: 2. Kiem tra va cai dat thu vien Frontend neu chua co
if not exist "frontend\node_modules" (
    echo [THONG BAO] Thu vien frontend chua duoc cai dat. Dang chay npm install...
    cd frontend
    call npm install
    cd ..
    echo [OK] Da cai dat xong thu vien frontend.
    echo.
)

:: 3. Kiem tra va khoi dong Ollama
echo [1/4] Kiem tra dich vu Ollama...
ollama list >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo       Ollama chua chay. Dang khoi dong Ollama serve...
    start "VNHistory - Ollama" /min cmd /c "ollama serve"
    ping 127.0.0.1 -n 5 >nul
) else (
    echo       [OK] Dich vu Ollama dang hoat dong.
)
echo       Dang nap truoc model vn-history-3b vao RAM (keep-alive)...
call .venv\Scripts\activate.bat
python -c "import os, requests; model=os.getenv('OLLAMA_MODEL', 'vn-history-3b'); requests.post('http://localhost:11434/api/generate', json={'model': model, 'keep_alive': -1}, timeout=180)" >nul 2>&1
echo       [OK] Model vn-history-3b da san sang trong RAM.

:: 4. Khoi dong Backend API trong moi truong ao
echo [2/4] Dang kich hoat moi truong ao va khoi dong Backend API (FastAPI - Port 8000)...
start "VNHistory - Backend API" cmd /k "title VNHistory - Backend API && cd /d %~dp0 && call .venv\Scripts\activate.bat && python backend\main.py"

:: 5. Khoi dong Frontend UI
echo [3/4] Dang khoi dong Frontend UI (React + Vite - Port 5173)...
start "VNHistory - Frontend UI" cmd /k "title VNHistory - Frontend UI && cd /d %~dp0frontend && npm run dev"

:: 6. Cho he thong san sang va mo trinh duyet
echo [4/4] Dang mo trinh duyet web...
ping 127.0.0.1 -n 5 >nul
start http://localhost:5173

echo.
echo ==============================================================================
echo   HE THONG DA KHOI DONG THANH CONG
echo ==============================================================================
echo   - Giao dien Web:     http://localhost:5173
echo   - Backend API Docs:  http://localhost:8000/docs
echo   - Ollama Model:      vn-history-3b (Port 11434)
echo.
echo   Luu y:
echo   - Backend dang chay trong moi truong ao (.venv).
echo   - De tat toan bo he thong: chay file stop.bat
echo ==============================================================================
echo.
echo Nhan phim bat ky de dong cua so nay (cac dich vu van tiep tuc chay)...
pause >nul
