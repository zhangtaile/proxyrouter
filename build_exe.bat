@echo off
echo ==========================================
echo   Gemini Smart Router Build Tool (Windows)
echo ==========================================

:: 1. Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not detected. Please install Python and add it to PATH.
    pause
    exit /b
)

:: 2. Create virtual environment and install dependencies
echo [*] Preparing build environment...
python -m venv build_venv
call build_venv\Scripts\activate.bat

echo [*] Installing required packages (PyInstaller, FastAPI, etc.)...
pip install pyinstaller fastapi httpx uvicorn --quiet

:: 3. Start building
echo [*] Generating single-file EXE (this may take 1-2 minutes)...
pyinstaller --onefile --noconsole --clean --name "GeminiRouter" router_proxy.py

:: 4. Clean up
echo [*] Cleaning up temporary files...
deactivate
rd /s /q build_venv
rd /s /q build
del /f /q GeminiRouter.spec

echo ==========================================
echo [SUCCESS] Build completed!
echo EXE file is located at: %cd%\dist\GeminiRouter.exe
echo ==========================================
pause
