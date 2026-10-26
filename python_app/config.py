"""
Touch-Free Computer Controller - Configuration Module
Defines settings, thresholds, allowlists, and system constants.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


@dataclass
class GestureConfig:
    # Camera settings
    camera_id: int = 0
    camera_width: int = 640
    camera_height: int = 480
    target_fps: int = 30
    
    # Active tracking boundary margin (percentage of camera frame, 0.0 - 0.5)
    # Allows reaching screen edges without moving hand outside camera frame
    margin_x: float = 0.15
    margin_y: float = 0.20
    
    # Cursor Movement Smoothing (Exponential Moving Average)
    # Higher = smoother but more lag (0.1 to 0.9). Recommended: 0.65
    smoothing_factor: float = 0.65
    
    # Movement deadzone in camera pixels (avoids micro-shaking when hand is still)
    movement_deadzone: float = 2.0
    
    # Cursor speed multiplier
    cursor_speed: float = 1.3
    
    # Pinch detection thresholds (normalized distance relative to hand size)
    pinch_threshold: float = 0.055
    pinch_release_threshold: float = 0.075
    
    # Drag and Drop: sustained pinch duration in seconds
    drag_hold_duration: float = 0.35
    
    # Click debouncing / cooldown in seconds
    click_cooldown: float = 0.35
    double_click_window: float = 0.40
    
    # Right-click gesture: pinch between thumb and middle finger (or index+middle close together)
    right_click_pinch_threshold: float = 0.055
    
    # Scroll gesture settings
    scroll_distance_scale: int = 40
    scroll_threshold: float = 0.04
    scroll_cooldown: float = 0.08


@dataclass
class VoiceConfig:
    # Speech Recognition settings
    energy_threshold: int = 300
    dynamic_energy_threshold: bool = True
    pause_threshold: float = 0.8
    phrase_time_limit: float = 6.0
    ambient_noise_adjustment_sec: float = 1.0
    language: str = "en-US"
    
    # Audio feedback beep frequency / duration (optional)
    feedback_sound: bool = True


@dataclass
class SystemConfig:
    app_title: str = "Touch-Free Computer Controller"
    version: str = "1.0.0"
    
    # Screenshots directory
    screenshot_dir: str = os.path.join(os.path.expanduser("~"), "Pictures", "TouchFreeScreenshots")
    
    # Application Allowlist (Safe commands for Windows)
    # Maps user-spoken alias to executable name or shell command
    allowed_applications: Dict[str, str] = field(default_factory=lambda: {
        "chrome": "chrome",
        "google chrome": "chrome",
        "notepad": "notepad",
        "calculator": "calc",
        "calc": "calc",
        "file explorer": "explorer",
        "explorer": "explorer",
        "edge": "msedge",
        "microsoft edge": "msedge",
        "paint": "mspaint",
        "settings": "ms-settings:",
        "task manager": "taskmgr",
        "cmd": "cmd",
        "terminal": "wt",
    })
    
    # Volume control step
    volume_step: int = 5
    
    # Emergency Stop keyboard shortcut
    emergency_stop_key: str = "escape"
    emergency_stop_key_secondary: str = "f12"


# Global default instances
DEFAULT_GESTURE_CONFIG = GestureConfig()
DEFAULT_VOICE_CONFIG = VoiceConfig()
DEFAULT_SYSTEM_CONFIG = SystemConfig()
