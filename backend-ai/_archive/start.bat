@echo off
echo.
echo ============================================================
echo   BARSHA E-COMMERCE PLATFORM - UNIFIED BACKEND
echo ============================================================
echo.
echo   Starting server at http://localhost:8000
echo.
echo   Endpoints:
echo     - AI Chat:        /api/chat
echo     - Visual Search:  /api/like-this
echo     - Admin API:      /api/admin/*
echo     - Documentation:  /docs
echo.
echo ============================================================
echo.

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

python api.py

pause
