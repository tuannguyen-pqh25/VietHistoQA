@echo off
title VietHistoQA - Dung he thong

echo ==============================================================================
echo           DANG DUNG HE THONG VIETHISTOQA...
echo ==============================================================================
echo.

echo [1/3] Dang dung Backend API (Cong 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
taskkill /fi "WINDOWTITLE eq VietHistoQA - Backend API*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq VNHistoQA - Backend API*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq VNHistory - Backend API*" /f >nul 2>&1

echo [2/3] Dang dung Frontend UI (Cong 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
taskkill /fi "WINDOWTITLE eq VietHistoQA - Frontend UI*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq VNHistoQA - Frontend UI*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq VNHistory - Frontend UI*" /f >nul 2>&1

echo [3/3] Don dep hoan tat.
echo.
echo ==============================================================================
echo   DA DUNG TOAN BO HE THONG THANH CONG!
echo   (Cong 8000 va 5173 da duoc giai phong)
echo ==============================================================================
echo.
ping 127.0.0.1 -n 3 >nul
