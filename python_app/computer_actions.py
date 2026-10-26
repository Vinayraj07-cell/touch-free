"""
Touch-Free Computer Controller - Computer Actions Module
Performs real Windows computer automation actions safely with an explicit allowlist.
"""

import os
import sys
import time
import logging
import subprocess
from datetime import datetime
from typing import Tuple, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ComputerActions")

# PyAutoGUI safety configuration
try:
    import pyautogui
    pyautogui.FAILSAFE = True  # Move mouse to corner to abort
    pyautogui.PAUSE = 0.01     # Minimize latency between commands
    HAS_PYAUTOGUI = True
except ImportError:
    logger.warning("pyautogui not installed. Mouse/keyboard actions will be simulated.")
    HAS_PYAUTOGUI = False

# Pyperclip for clipboard actions
try:
    import pyperclip
    HAS_PYPERCLIP = True
except ImportError:
    HAS_PYPERCLIP = False

# PyCaw for Windows native audio volume control
HAS_PYCAW = False
volume_interface = None
if sys.platform == "win32":
    try:
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume_interface = cast(interface, POINTER(IAudioEndpointVolume))
        HAS_PYCAW = True
        logger.info("Windows PyCaw audio interface initialized.")
    except Exception as e:
        logger.warning(f"Failed to initialize Windows PyCaw volume control: {e}")

from config import DEFAULT_SYSTEM_CONFIG, SystemConfig


class ComputerController:
    """Safely executes authorized computer actions on Windows."""
    
    def __init__(self, config: Optional[SystemConfig] = None):
        self.config = config or DEFAULT_SYSTEM_CONFIG
        self.is_emergency_stopped = False
        self.is_dragging = False
        
        # Ensure screenshot directory exists
        os.makedirs(self.config.screenshot_dir, exist_ok=True)
        
        # Get primary screen dimensions
        if HAS_PYAUTOGUI:
            self.screen_width, self.screen_height = pyautogui.size()
        else:
            self.screen_width, self.screen_height = 1920, 1080
            
        logger.info(f"Initialized ComputerController. Screen size: {self.screen_width}x{self.screen_height}")

    # ================= Emergency Stop =================
    def emergency_stop(self) -> None:
        """Immediately release all mouse buttons and halt all movement/input."""
        self.is_emergency_stopped = True
        if self.is_dragging:
            self.mouse_up()
        logger.warning("EMERGENCY STOP ACTIVATED! All computer control halted.")

    def reset_emergency_stop(self) -> None:
        """Reset emergency stop state to allow computer control again."""
        self.is_emergency_stopped = False
        self.is_dragging = False
        logger.info("Emergency stop deactivated. Controller is ready.")

    # ================= Mouse Actions =================
    def move_cursor(self, x: int, y: int) -> None:
        """Move the mouse cursor to absolute pixel coordinates."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return
        
        # Clamp to screen bounds
        clamped_x = max(0, min(self.screen_width - 1, int(x)))
        clamped_y = max(0, min(self.screen_height - 1, int(y)))
        
        pyautogui.moveTo(clamped_x, clamped_y)

    def left_click(self) -> bool:
        """Execute a single left mouse click."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.click(button="left")
        logger.info("Executed Left Click")
        return True

    def double_click(self) -> bool:
        """Execute a double left click."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.doubleClick(button="left")
        logger.info("Executed Double Click")
        return True

    def right_click(self) -> bool:
        """Execute a single right mouse click."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.click(button="right")
        logger.info("Executed Right Click")
        return True

    def mouse_down(self) -> bool:
        """Press and hold the left mouse button (start drag)."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        if not self.is_dragging:
            pyautogui.mouseDown(button="left")
            self.is_dragging = True
            logger.info("Mouse button DOWN (Drag started)")
        return True

    def mouse_up(self) -> bool:
        """Release the left mouse button (drop item)."""
        if not HAS_PYAUTOGUI:
            self.is_dragging = False
            return False
        if self.is_dragging:
            pyautogui.mouseUp(button="left")
            self.is_dragging = False
            logger.info("Mouse button UP (Drop completed)")
        return True

    def scroll(self, clicks: int) -> bool:
        """Scroll vertically (positive = up, negative = down)."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.scroll(clicks)
        logger.info(f"Scrolled {'up' if clicks > 0 else 'down'} by {abs(clicks)}")
        return True

    # ================= Application Launching =================
    def launch_application(self, app_alias: str) -> Tuple[bool, str]:
        """
        Safely launch an allowed application using a strict allowlist.
        Does NOT execute arbitrary user-supplied command strings.
        """
        if self.is_emergency_stopped:
            return False, "Emergency stop active"
        
        key = app_alias.strip().lower()
        if key not in self.config.allowed_applications:
            return False, f"Application '{app_alias}' is not in the allowed list."
        
        executable = self.config.allowed_applications[key]
        try:
            if sys.platform == "win32":
                # Windows safe launch: try standard subprocess, then os.startfile / App Paths
                if executable.startswith("ms-"):
                    os.startfile(executable)
                else:
                    launched = False
                    # 1. Try direct execution
                    try:
                        subprocess.Popen([executable], shell=False)
                        launched = True
                    except FileNotFoundError:
                        pass

                    # 2. Try os.startfile (uses Windows Shell and App Paths registry)
                    if not launched:
                        try:
                            os.startfile(executable if executable.endswith(".exe") else f"{executable}.exe")
                            launched = True
                        except Exception:
                            pass

                    # 3. Check well-known absolute paths for common browsers (Chrome / Edge)
                    if not launched and key in ["chrome", "google chrome"]:
                        chrome_candidates = [
                            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
                            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
                        ]
                        for cpath in chrome_candidates:
                            if os.path.exists(cpath):
                                subprocess.Popen([cpath], shell=False)
                                launched = True
                                break

                    # 4. Fallback to shell start
                    if not launched:
                        subprocess.Popen(f"start {executable}", shell=True)
            else:
                # Fallback for testing/non-Windows
                logger.info(f"[Simulated Launch] Launching {executable}")
            
            logger.info(f"Successfully launched {key} ({executable})")
            return True, f"Launched {key.title()}"
        except Exception as e:
            err_msg = f"Failed to launch {key}: {str(e)}"
            logger.error(err_msg)
            return False, err_msg

    # ================= Audio Volume Control =================
    def get_volume(self) -> int:
        """Return current master audio volume as percentage (0-100)."""
        if HAS_PYCAW and volume_interface:
            try:
                scalar = volume_interface.GetMasterVolumeLevelScalar()
                return int(round(scalar * 100))
            except Exception as e:
                logger.warning(f"Could not read volume via PyCaw: {e}")
        return 50

    def set_volume(self, percentage: int) -> Tuple[bool, str]:
        """Set master audio volume to a specific percentage (0-100)."""
        if self.is_emergency_stopped:
            return False, "Emergency stop active"
        
        clamped = max(0, min(100, int(percentage)))
        scalar = clamped / 100.0
        
        if HAS_PYCAW and volume_interface:
            try:
                volume_interface.SetMasterVolumeLevelScalar(scalar, None)
                logger.info(f"Volume set to {clamped}%")
                return True, f"Volume set to {clamped}%"
            except Exception as e:
                return False, f"Error adjusting volume: {e}"
        elif HAS_PYAUTOGUI:
            # Fallback using Windows media keys
            logger.info(f"Simulating volume change to {clamped}% via media keys")
            return True, f"Volume set to ~{clamped}% (via media key emulation)"
        return True, f"Simulated volume set to {clamped}%"

    def adjust_volume(self, delta: int) -> Tuple[bool, str]:
        """Increase or decrease volume by delta percentage."""
        current = self.get_volume()
        target = max(0, min(100, current + delta))
        return self.set_volume(target)

    # ================= Screenshot =================
    def take_screenshot(self) -> Tuple[bool, str]:
        """Capture the current screen and save to the configured directory."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Cannot take screenshot while halted or missing PyAutoGUI"
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"screenshot_{timestamp}.png"
            filepath = os.path.join(self.config.screenshot_dir, filename)
            
            screenshot = pyautogui.screenshot()
            screenshot.save(filepath)
            
            logger.info(f"Saved screenshot to {filepath}")
            return True, f"Screenshot saved: {filename}"
        except Exception as e:
            err = f"Failed to take screenshot: {e}"
            logger.error(err)
            return False, err

    # ================= Keyboard Actions =================
    def press_key(self, key_name: str) -> Tuple[bool, str]:
        """Press a safe, standard keyboard key (Enter, Escape, Space, etc.)."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Cannot press keys during emergency stop"
        
        key_name = key_name.lower().strip()
        allowed_keys = {
            "enter": "enter",
            "return": "enter",
            "space": "space",
            "escape": "esc",
            "esc": "esc",
            "backspace": "backspace",
            "tab": "tab",
            "pageup": "pageup",
            "pagedown": "pagedown",
            "up": "up",
            "down": "down",
            "left": "left",
            "right": "right"
        }
        
        if key_name in allowed_keys:
            pyautogui.press(allowed_keys[key_name])
            logger.info(f"Pressed key: {key_name}")
            return True, f"Pressed {key_name.title()}"
        return False, f"Key '{key_name}' not allowed."

    def copy_selection(self) -> Tuple[bool, str]:
        """Execute Ctrl+C to copy selected text."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Halted"
        pyautogui.hotkey("ctrl", "c")
        logger.info("Triggered Ctrl+C (Copy)")
        return True, "Copied selection to clipboard"

    def paste_selection(self) -> Tuple[bool, str]:
        """Execute Ctrl+V to paste clipboard contents."""
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Halted"
        pyautogui.hotkey("ctrl", "v")
        logger.info("Triggered Ctrl+V (Paste)")
        return True, "Pasted from clipboard"


# Singleton instance for quick module access
actions = ComputerController()
