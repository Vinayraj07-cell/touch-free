# Touch-Free Computer Controller

A practical, lightweight, and safety-focused Windows desktop application that lets you control your computer using **hand gestures** and **natural-language voice commands**.

Built with **MediaPipe**, **OpenCV**, **PyAutoGUI**, **SpeechRecognition**, **PyCaw**, and rule-based NLP.

---

## 🚀 Quick Start (Windows 10 / 11)

### Prerequisites
- **Python 3.8 to 3.11** (Download from [python.org](https://www.python.org/downloads/)).  
  *Important:* Check **"Add Python to PATH"** during setup.
- A standard **Webcam** (built-in or USB).
- A **Microphone** (built-in or headset).

### 1-Click Automated Setup
1. Double-click `install.bat`. This automatically:
   - Creates an isolated virtual environment (`.venv`)
   - Installs all dependencies from `requirements.txt`
2. Double-click `run.bat` to launch the application.

---

## 🛠 Manual Installation (Terminal)

```bash
# 1. Open Command Prompt or PowerShell in this folder
cd python_app

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# 3. Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 4. Run the application
python main.py
```

### Note on PyAudio for Windows:
If `pip install pyaudio` produces a compilation error on your machine:
```bash
pip install pipwin
pipwin install pyaudio
```

---

## ✋ Hand Gesture Controls Guide

| Gesture | Action | Description |
| :--- | :--- | :--- |
| **Index Fingertip Pointing** | Cursor Move | Move your hand; the cursor glides with Exponential Moving Average (EMA) smoothing to eliminate hand jitter. |
| **Thumb + Index Pinch** | Left Click | Pinch thumb and index finger together quickly (<350ms) and release. |
| **Sustained Thumb + Index Pinch** | Drag & Drop | Pinch and hold (>350ms). The mouse button stays pressed until you release the pinch. |
| **Thumb + Middle Finger Pinch** | Right Click | Pinch thumb and middle finger together to trigger context menus. |
| **Index + Middle Fingers Extended** | Vertical Scroll | Hold index and middle finger upright side-by-side; move hand up to scroll up, down to scroll down. |
| **Hand Out of Frame / Closed Fist** | Safe Neutral | Pauses cursor movement safely without triggering stray clicks. |

---

## 🗣 Spoken Voice Commands & Variations

The system features lightweight rule-based NLP that parses natural intent without latency:

| Voice Command | Supported Variations | Action Taken |
| :--- | :--- | :--- |
| **"Open Chrome"** | "Launch Google Chrome", "Open browser", "Start Chrome" | Safely launches Google Chrome |
| **"Open Calculator"** | "Launch calculator", "calc", "Open calc" | Safely launches Windows Calculator |
| **"Open Notepad"** | "Launch Notepad", "Open text editor", "Start Notepad" | Safely launches Notepad |
| **"Take a screenshot"** | "Capture screen", "Save screenshot", "Take screenshot" | Saves timestamped PNG to `Pictures/TouchFreeScreenshots` |
| **"Set volume to 50 percent"** | "Volume 80%", "Set sound to 40", "Volume half" | Sets Windows master volume to exact level |
| **"Increase volume"** | "Volume up", "Turn up sound", "Raise volume" | Steps volume up by 10% |
| **"Decrease volume"** | "Volume down", "Turn down sound", "Lower volume" | Steps volume down by 10% |
| **"Scroll down"** | "Page down", "Scroll downwards" | Scrolls active document down |
| **"Scroll up"** | "Page up", "Scroll upwards" | Scrolls active document up |
| **"Press Enter"** | "Hit enter", "Enter", "Press return" | Sends keyboard Enter key |
| **"Copy selected text"** | "Copy selection", "Copy this", "Copy" | Sends Ctrl+C |
| **"Paste"** | "Paste text", "Paste here", "Paste clipboard" | Sends Ctrl+V |
| **"Stop gesture control"** | "Disable gestures", "Turn off hand tracking" | Turns off webcam tracking |
| **"Disable voice control"** | "Stop voice", "Mute listening" | Stops microphone listener |
| **"Stop all controls"** | "Emergency stop", "Pause all", "Halt system" | Immediately halts all mouse and keyboard actions |

*Ambiguity Protection:* If you speak an unrecognized or unsupported command, the system will speak/display a clarification prompt rather than executing an erroneous action.

---

## 🛑 Safety & Reliability Features

1. **Physical Emergency Stop**:
   - Press **`ESC`** or **`F12`** at any moment on your keyboard to instantly cut off mouse and keyboard control.
   - Click the prominent **EMERGENCY STOP** button in the top toolbar.
   - Say **"Stop all controls"** to trigger hands-free emergency cutoff.
2. **Command Allowlist**:
   - Spoken commands CANNOT execute arbitrary shell scripts or PowerShell directives.
   - Applications are strictly launched from a vetted allowlist (`chrome`, `notepad`, `calc`, `explorer`, `msedge`, `mspaint`, `taskmgr`).
3. **Fail-Safe Mouse Boundary**:
   - PyAutoGUI `FAILSAFE = True` is active: slamming the cursor into any screen corner aborts automation.
4. **Privacy First**:
   - Webcam frames and audio streams are processed in local memory only. No data is recorded, saved, or uploaded to external servers.

---

## ⚙️ Architecture & Code Layout

```
python_app/
├── main.py                # Modern Tkinter desktop UI & multi-threaded coordinator
├── gesture_controller.py  # MediaPipe hand tracker, smoothing math, gesture state machine
├── voice_controller.py    # Non-blocking SpeechRecognition worker thread & dispatcher
├── nlp_processor.py       # Rule-based NLP intent parser & clarification generator
├── computer_actions.py    # PyAutoGUI & Windows PyCaw volume & screenshot automation
├── image_processor.py     # OpenCV mirroring, coordinate mapping, and HUD overlays
├── config.py              # Central thresholds, margins, hotkeys, and app allowlists
├── requirements.txt       # Dependencies with version bounds
├── run.bat                # 1-click Windows runner
├── install.bat            # 1-click Windows installer
├── test_suite.py          # Automated self-tests for NLP and safety allowlists
└── README.md              # Documentation and troubleshooting
```

---

## 🔧 Windows Troubleshooting

- **Webcam Access Blocked:** Go to Windows *Settings > Privacy & Security > Camera* and ensure "Let desktop apps access your camera" is enabled.
- **Microphone Access Blocked:** Go to Windows *Settings > Privacy & Security > Microphone* and ensure "Let desktop apps access your microphone" is enabled.
- **Cursor Jitter:** Increase the **Smoothing (EMA)** slider in the settings panel (e.g., set to 0.70 - 0.80).
- **Accidental Clicks:** Decrease the **Pinch Distance** slider slightly or increase the **Click Cooldown** in `config.py`.
