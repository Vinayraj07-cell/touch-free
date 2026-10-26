@echo off
echo ========================================================
echo  Starting Touch-Free Computer Controller...
echo  (Press ESC or F12 at any time for Emergency Stop)
echo ========================================================
echo.

if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

python main.py

if %errorlevel% neq 0 (
    echo.
    echo Application exited with an error code: %errorlevel%
    pause
)
