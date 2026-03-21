@echo off
echo ==========================================
echo   Gemini Smart Router 打包工具 (Windows)
echo ==========================================

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装 Python 并添加到 PATH。
    pause
    exit /b
)

echo [*] 正在准备打包环境...
python -m venv build_venv
call build_venv\Scripts\activate.bat

echo [*] 正在安装依赖...
pip install pyinstaller fastapi httpx uvicorn --quiet

echo [*] 正在生成单文件 EXE...
pyinstaller --onefile --noconsole --clean --name "GeminiRouter" router_proxy.py

echo [*] 正在清理临时文件...
deactivate
rd /s /q build_venv
rd /s /q build
del /f /q GeminiRouter.spec

echo ==========================================
echo [成功] 打包完成！
echo EXE 文件位于: %cd%\dist\GeminiRouter.exe
echo ==========================================
pause
