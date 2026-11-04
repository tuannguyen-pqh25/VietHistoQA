@echo off
title VietHistoQA Launcher

echo ==============================================================================
echo           VIETHISTOQA - HE THONG HOI DAP LICH SU VIET NAM
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

:: 3. Kiem tra va khoi dong dich vu Ollama
echo [1/4] Kiem tra dich vu Ollama...
ollama list >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo       Ollama chua chay. Dang khoi dong Ollama serve...
    start "VietHistoQA - Ollama" /min cmd /c "ollama serve"
    ping 127.0.0.1 -n 6 >nul
) else (
    echo       [OK] Dich vu Ollama dang hoat dong.
)

:: 4. Kiem tra va nap model viethistoqa neu chua co
ollama list | findstr "viethistoqa" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       [OK] Model viethistoqa da san sang trong Ollama.
    goto :warmup_model
)

ollama list | findstr "vn-history-3b" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       [OK] Model vn-history-3b da san sang trong Ollama.
    goto :warmup_model
)

echo       Model viethistoqa chua co trong Ollama. Dang khoi tao...
cd models
if exist "Modelfile_viethistoqa" (
    ollama create viethistoqa -f Modelfile_viethistoqa
) else (
    ollama create vn-history-3b -f Modelfile
)
cd ..
echo       [OK] Da tao thanh cong model trong Ollama.

:warmup_model
echo       Dang nap truoc model vao RAM...
call .venv\Scripts\activate.bat
python -c "import os, requests; model=os.getenv('OLLAMA_MODEL', 'viethistoqa'); requests.post('http://localhost:11434/api/generate', json={'model': model, 'keep_alive': -1}, timeout=180)" >nul 2>&1
echo       [OK] Model da san sang trong RAM.

:: 5. Kiem tra va khoi dong Redis Cache Server neu co
echo       Kiem tra Redis Cache Server...
tasklist /fi "imagename eq redis-server.exe" | findstr /i "redis-server.exe" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       [OK] Redis Server da dang hoat dong.
) else (
    if exist "D:\Tools\Redis\redis-server.exe" (
        echo       Dang khoi dong Redis Cache Server (Port 6379)...
        start "VietHistoQA - Redis Server" /min "D:\Tools\Redis\redis-server.exe" "D:\Tools\Redis\redis.windows.conf"
        ping 127.0.0.1 -n 3 >nul
        echo       [OK] Da khoi dong Redis Server thanh cong.
    ) else (
        echo       [THONG BAO] Khong tim thay Redis tai D:\Tools\Redis. Backend se tiep tuc che do khong cache.
    )
)

:: 6. Khoi dong Backend API trong moi truong ao
echo [2/4] Dang kich hoat moi truong ao va khoi dong Backend API (FastAPI - Port 8000)...
start "VietHistoQA - Backend API" cmd /k "title VietHistoQA - Backend API && cd /d %~dp0 && call .venv\Scripts\activate.bat && python backend\main.py"

:: 7. Khoi dong Frontend UI
echo [3/4] Dang khoi dong Frontend UI (React + Vite - Port 5173)...
start "VietHistoQA - Frontend UI" cmd /k "title VietHistoQA - Frontend UI && cd /d %~dp0frontend && npm run dev"

:: 8. Cho he thong san sang va mo trinh duyet
echo [4/4] Dang mo trinh duyet web...
ping 127.0.0.1 -n 5 >nul
start http://localhost:5173

echo.
echo ==============================================================================
echo   HE THONG DA KHOI DONG THANH CONG
echo ==============================================================================
echo   - Giao dien Web:     http://localhost:5173
echo   - Backend API Docs:  http://localhost:8000/docs
echo   - Ollama Model:      viethistoqa (3B Finetuned V2 - Port 11434)
echo   - Redis Cache:       Port 6379
echo.
echo   Luu y:
echo   - Backend dang chay trong moi truong ao (.venv).
echo   - De tat toan bo he thong: chay file stop.bat
echo ==============================================================================
echo.
echo Nhan phim bat ky de dong cua so nay (cac dich vu van tiep tuc chay)...
pause >nul
