@echo off
echo ========================================================
echo  Touch-Free Computer Controller - Windows Setup Installer
echo ========================================================
echo.

:: Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.8 - 3.11 is required but was not found in PATH.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo [1/3] Creating virtual environment (.venv)...
if not exist ".venv" (
    python -m venv .venv
)

echo [2/3] Activating virtual environment...
call .venv\Scripts\activate.bat

echo [3/3] Upgrading pip and installing required packages...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Check PyAudio install
python -c "import pyaudio" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [NOTE] If PyAudio installation failed directly from pip, install pipwin:
    echo        pip install pipwin ^&^& pipwin install pyaudio
)

echo.
echo ========================================================
echo  Installation Complete! Run 'run.bat' to start the app.
echo ========================================================
pause
