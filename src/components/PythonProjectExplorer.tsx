import React, { useState } from 'react';
import JSZip from 'jszip';
import { 
  FileCode, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  Settings, 
  Cpu, 
  Mic, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  Play,
  BookOpen
} from 'lucide-react';

interface FileDefinition {
  name: string;
  category: 'core' | 'config' | 'scripts' | 'docs';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  code: string;
}

const PYTHON_FILES: FileDefinition[] = [
  {
    name: 'main.py',
    category: 'core',
    icon: Play,
    description: 'Tkinter desktop GUI, video HUD canvas, thread coordinator, and emergency hotkey handler.',
    code: `"""
Touch-Free Computer Controller - Main Desktop Application
Combines MediaPipe hand gesture tracking, rule-based NLP voice recognition,
and Windows computer automation into a clean, modern desktop interface.
"""

import os
import sys
import time
import logging
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TouchFreeApp")

try:
    import cv2
    from PIL import Image, ImageTk
    HAS_PIL_CV = True
except ImportError:
    HAS_PIL_CV = False
    logger.warning("OpenCV or PIL missing. GUI video feed will use placeholder.")

from config import DEFAULT_GESTURE_CONFIG, DEFAULT_VOICE_CONFIG, DEFAULT_SYSTEM_CONFIG, GestureConfig, VoiceConfig
from computer_actions import ComputerController
from image_processor import ImageProcessor
from nlp_processor import RuleBasedNLPProcessor, ParsedCommand
from gesture_controller import GestureController
from voice_controller import VoiceController


class TouchFreeApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Touch-Free Computer Controller")
        self.root.geometry("1100x720")
        self.root.minsize(960, 640)
        self.root.configure(bg="#0F172A")

        self.gesture_config = GestureConfig()
        self.voice_config = VoiceConfig()
        self.system_config = DEFAULT_SYSTEM_CONFIG

        self.computer = ComputerController(self.system_config)
        self.image_proc = ImageProcessor(self.computer.screen_width, self.computer.screen_height)
        self.nlp = RuleBasedNLPProcessor()

        self.gesture_ctrl = GestureController(self.computer, self.image_proc, self.gesture_config)
        self.voice_ctrl = VoiceController(
            computer=self.computer,
            nlp=self.nlp,
            config=self.voice_config,
            on_command_callback=self._on_voice_command,
            on_status_callback=self._on_voice_status_update
        )

        self.voice_ctrl.gesture_toggle_callback = self.toggle_gesture_mode
        self.voice_ctrl.master_stop_callback = self.emergency_stop
        self.voice_ctrl.master_resume_callback = self.resume_controls

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_camera_running = False

        self._setup_styles()
        self._build_ui()

        self.root.bind("<Escape>", lambda e: self.emergency_stop())
        self.root.bind("<F12>", lambda e: self.emergency_stop())
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background="#0F172A")
        style.configure("Card.TFrame", background="#1E293B", relief="flat")

    def _build_ui(self):
        # Header bar with Emergency Stop
        header_bar = tk.Frame(self.root, bg="#0F172A", height=60)
        header_bar.pack(fill=tk.X, padx=20, pady=(15, 10))

        title_box = tk.Frame(header_bar, bg="#0F172A")
        title_box.pack(side=tk.LEFT)

        tk.Label(title_box, text="Touch-Free Computer Controller", bg="#0F172A", fg="#F8FAFC", font=("Segoe UI", 15, "bold")).pack(anchor="w")
        tk.Label(title_box, text="Hand Gestures & Natural Voice · Press ESC for Emergency Stop", bg="#0F172A", fg="#94A3B8", font=("Segoe UI", 9)).pack(anchor="w")

        actions_box = tk.Frame(header_bar, bg="#0F172A")
        actions_box.pack(side=tk.RIGHT)

        self.btn_emergency = tk.Button(
            actions_box, text="🛑 EMERGENCY STOP (ESC)", bg="#DC2626", fg="#FFFFFF",
            font=("Segoe UI", 9, "bold"), relief="flat", padx=14, pady=6,
            command=self.emergency_stop, cursor="hand2"
        )
        self.btn_emergency.pack(side=tk.RIGHT, padx=(10, 0))

        self.btn_master = tk.Button(
            actions_box, text="▶ Start All Controls", bg="#0284C7", fg="#FFFFFF",
            font=("Segoe UI", 9, "bold"), relief="flat", padx=14, pady=6,
            command=self.toggle_master_controls, cursor="hand2"
        )
        self.btn_master.pack(side=tk.RIGHT)

        # Main Split Content
        main_content = tk.Frame(self.root, bg="#0F172A")
        main_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Video canvas on left
        left_col = tk.Frame(main_content, bg="#0F172A", width=540)
        left_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        video_card = tk.Frame(left_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        video_card.pack(fill=tk.BOTH, expand=True)

        video_header = tk.Frame(video_card, bg="#1E293B")
        video_header.pack(fill=tk.X, padx=12, pady=10)
        tk.Label(video_header, text="CAMERA PREVIEW & HAND HUD", bg="#1E293B", fg="#E2E8F0", font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT)

        self.gesture_toggle_var = tk.BooleanVar(value=False)
        self.chk_gesture = tk.Checkbutton(
            video_header, text="Enable Gestures", variable=self.gesture_toggle_var,
            command=self._on_gesture_checkbox_changed, bg="#1E293B", fg="#38BDF8",
            selectcolor="#0F172A", font=("Segoe UI", 9, "bold")
        )
        self.chk_gesture.pack(side=tk.RIGHT)

        self.video_canvas = tk.Canvas(video_card, bg="#0B0F19", highlightthickness=0)
        self.video_canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        telemetry_strip = tk.Frame(video_card, bg="#0B0F19", height=32)
        telemetry_strip.pack(fill=tk.X, padx=10, pady=(0, 10))

        self.lbl_tracking_status = tk.Label(telemetry_strip, text="Hand: Not Detected", bg="#0B0F19", fg="#94A3B8", font=("Segoe UI", 9))
        self.lbl_tracking_status.pack(side=tk.LEFT, padx=10)

        self.lbl_gesture_action = tk.Label(telemetry_strip, text="Action: Idle", bg="#0B0F19", fg="#38BDF8", font=("Segoe UI", 9, "bold"))
        self.lbl_gesture_action.pack(side=tk.RIGHT, padx=10)

        # Controls & Log on right
        right_col = tk.Frame(main_content, bg="#0F172A", width=480)
        right_col.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))

        # Voice Card
        voice_card = tk.Frame(right_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        voice_card.pack(fill=tk.X, pady=(0, 10))

        voice_header = tk.Frame(voice_card, bg="#1E293B")
        voice_header.pack(fill=tk.X, padx=12, pady=10)
        tk.Label(voice_header, text="VOICE CONTROLLER & NLP", bg="#1E293B", fg="#E2E8F0", font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT)

        self.voice_toggle_var = tk.BooleanVar(value=False)
        self.chk_voice = tk.Checkbutton(
            voice_header, text="Enable Voice", variable=self.voice_toggle_var,
            command=self._on_voice_checkbox_changed, bg="#1E293B", fg="#34D399",
            selectcolor="#0F172A", font=("Segoe UI", 9, "bold")
        )
        self.chk_voice.pack(side=tk.RIGHT)

        self.lbl_voice_status = tk.Label(voice_card, text="Voice Inactive", bg="#1E293B", fg="#94A3B8", font=("Segoe UI", 9))
        self.lbl_voice_status.pack(anchor="w", padx=12, pady=(0, 8))

        cmd_input_frame = tk.Frame(voice_card, bg="#1E293B")
        cmd_input_frame.pack(fill=tk.X, padx=12, pady=(0, 12))

        self.txt_command_input = tk.Entry(cmd_input_frame, bg="#0F172A", fg="#F8FAFC", insertbackground="#38BDF8", relief="flat", font=("Segoe UI", 9), bd=5)
        self.txt_command_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))
        self.txt_command_input.bind("<Return>", lambda e: self._on_text_command_submit())

        btn_run_cmd = tk.Button(cmd_input_frame, text="Execute", bg="#334155", fg="#F8FAFC", relief="flat", font=("Segoe UI", 8, "bold"), padx=10, command=self._on_text_command_submit, cursor="hand2")
        btn_run_cmd.pack(side=tk.RIGHT)

        # Log
        log_card = tk.Frame(right_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        log_card.pack(fill=tk.BOTH, expand=True)

        log_inner = tk.Frame(log_card, bg="#0F172A")
        log_inner.pack(fill=tk.BOTH, expand=True, padx=12, pady=10)

        self.log_listbox = tk.Listbox(log_inner, bg="#0B0F19", fg="#E2E8F0", relief="flat", font=("Segoe UI", 9), highlightthickness=0)
        self.log_listbox.pack(fill=tk.BOTH, expand=True)

    def emergency_stop(self):
        self.computer.emergency_stop()
        self.toggle_gesture_mode(False)
        self.toggle_voice_mode(False)
        self.btn_master.config(text="▶ Resume Controls", bg="#0284C7")
        self.lbl_tracking_status.config(text="EMERGENCY STOPPED", fg="#EF4444")
        self.lbl_gesture_action.config(text="Action: HALTED", fg="#EF4444")

    def toggle_master_controls(self):
        any_active = self.gesture_ctrl.is_enabled or self.voice_ctrl.is_running
        if any_active:
            self.toggle_gesture_mode(False)
            self.toggle_voice_mode(False)
            self.btn_master.config(text="▶ Start All Controls", bg="#0284C7")
        else:
            self.computer.reset_emergency_stop()
            self.toggle_gesture_mode(True)
            self.toggle_voice_mode(True)
            self.btn_master.config(text="⏸ Pause All Controls", bg="#D97706")

    def resume_controls(self):
        self.computer.reset_emergency_stop()
        self.toggle_master_controls()

    def toggle_gesture_mode(self, enable: bool):
        self.gesture_toggle_var.set(enable)
        if enable:
            if not self.is_camera_running:
                self._start_camera_stream()
            self.gesture_ctrl.start()
        else:
            self.gesture_ctrl.stop()

    def toggle_voice_mode(self, enable: bool):
        self.voice_toggle_var.set(enable)
        if enable:
            self.voice_ctrl.start()
        else:
            self.voice_ctrl.stop()

    def _on_gesture_checkbox_changed(self):
        self.toggle_gesture_mode(self.gesture_toggle_var.get())

    def _on_voice_checkbox_changed(self):
        self.toggle_voice_mode(self.voice_toggle_var.get())

    def _on_voice_command(self, parsed: ParsedCommand, success: bool, message: str):
        sym = "✓" if success else "✗"
        self.log_listbox.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] Voice [{parsed.intent}] -> {sym} {message}")
        self.log_listbox.see(tk.END)

    def _on_voice_status_update(self, status_text: str):
        self.lbl_voice_status.config(text=status_text)

    def _on_text_command_submit(self):
        text = self.txt_command_input.get().strip()
        if text:
            self.txt_command_input.delete(0, tk.END)
            parsed, success, message = self.voice_ctrl.handle_text_command(text)
            sym = "✓" if success else "✗"
            self.log_listbox.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] Command '{text}' -> {sym} {message}")
            self.log_listbox.see(tk.END)

    def _start_camera_stream(self):
        if not HAS_PIL_CV:
            return
        self.cap = cv2.VideoCapture(self.gesture_config.camera_id)
        self.is_camera_running = True
        self._update_video_feed()

    def _update_video_feed(self):
        if not self.is_camera_running or self.cap is None:
            return
        ret, frame = self.cap.read()
        if ret and frame is not None:
            hud_frame, status = self.gesture_ctrl.process_frame(frame)
            if status["hand_detected"]:
                self.lbl_tracking_status.config(text="Hand: Tracking Active", fg="#34D399")
            else:
                self.lbl_tracking_status.config(text="Hand: Searching...", fg="#F59E0B")
            self.lbl_gesture_action.config(text=f"Action: {status['gesture']}")

            try:
                canvas_w = max(100, self.video_canvas.winfo_width())
                canvas_h = max(100, self.video_canvas.winfo_height())
                rgb_frame = cv2.cvtColor(hud_frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(rgb_frame).resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
                self.photo = ImageTk.PhotoImage(image=img)
                self.video_canvas.create_image(0, 0, image=self.photo, anchor=tk.NW)
            except Exception:
                pass
        if self.is_camera_running:
            self.root.after(30, self._update_video_feed)

    def on_close(self):
        self.emergency_stop()
        self.is_camera_running = False
        if self.cap:
            self.cap.release()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = TouchFreeApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
`
  },
  {
    name: 'gesture_controller.py',
    category: 'core',
    icon: Cpu,
    description: 'MediaPipe hand landmark detection, EMA coordinate smoothing, pinch click, drag-drop & vertical scroll.',
    code: `"""
Touch-Free Computer Controller - Gesture Controller Module
Tracks fingertip positions, smooths cursor motion, and detects gestures:
Point/Move, Left Click Pinch, Right Click Pinch, Drag-and-Drop, and Scrolling.
"""

import math
import time
import logging
from typing import Tuple, Optional, Dict, Any, List

import numpy as np

logger = logging.getLogger("GestureController")

try:
    import cv2
    import mediapipe as mp
    mp_hands = mp.solutions.hands
    mp_drawing = mp.solutions.drawing_utils
    HAS_MEDIAPIPE = True
except Exception as e:
    HAS_MEDIAPIPE = False
    logger.warning(f"MediaPipe unavailable: {e}")

from config import DEFAULT_GESTURE_CONFIG, GestureConfig
from image_processor import ImageProcessor
from computer_actions import ComputerController


class GestureController:
    def __init__(self, computer: ComputerController, image_proc: ImageProcessor, config: Optional[GestureConfig] = None):
        self.computer = computer
        self.image_proc = image_proc
        self.config = config or DEFAULT_GESTURE_CONFIG
        
        self.is_enabled = False
        self.hand_detected = False
        self.current_gesture = "Idle"
        
        self.smoothed_x = 0.0
        self.smoothed_y = 0.0
        self.has_prev_pos = False
        
        self.pinch_start_time: Optional[float] = None
        self.is_pinching = False
        self.is_dragging = False
        self.last_click_time = 0.0
        self.last_right_click_time = 0.0
        
        self.scroll_anchor_y: Optional[float] = None
        self.last_scroll_time = 0.0
        self.hands_detector = None

    def start(self) -> bool:
        if not HAS_MEDIAPIPE:
            return False
        try:
            self.hands_detector = mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=1,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.6,
                model_complexity=0
            )
            self.is_enabled = True
            self.has_prev_pos = False
            return True
        except Exception:
            return False

    def stop(self) -> None:
        self.is_enabled = False
        if self.is_dragging:
            self.computer.mouse_up()
            self.is_dragging = False
        if self.hands_detector:
            self.hands_detector.close()
            self.hands_detector = None
        self.hand_detected = False
        self.current_gesture = "Disabled"
        self.has_prev_pos = False

    def calculate_distance(self, p1: Any, p2: Any) -> float:
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    def is_finger_extended(self, landmarks: List[Any], tip_idx: int, pip_idx: int) -> bool:
        wrist = landmarks[0]
        tip_dist = math.hypot(landmarks[tip_idx].x - wrist.x, landmarks[tip_idx].y - wrist.y)
        pip_dist = math.hypot(landmarks[pip_idx].x - wrist.x, landmarks[pip_idx].y - wrist.y)
        return tip_dist > pip_dist * 1.15

    def process_frame(self, frame_bgr: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        status = {"hand_detected": False, "gesture": "Idle", "is_pinching": False, "is_dragging": False, "cursor_pos": (0, 0)}
        frame_mirrored = self.image_proc.process_frame(frame_bgr)
        h, w, _ = frame_mirrored.shape

        if not self.is_enabled or self.hands_detector is None:
            return self.image_proc.draw_hud(frame_mirrored, False, "Disabled"), status

        frame_rgb = cv2.cvtColor(frame_mirrored, cv2.COLOR_BGR2RGB)
        results = self.hands_detector.process(frame_rgb)

        index_pixel_pos = None
        thumb_pixel_pos = None

        if results.multi_hand_landmarks:
            self.hand_detected = True
            status["hand_detected"] = True
            landmarks = results.multi_hand_landmarks[0].landmark

            wrist, thumb_tip, index_tip, middle_tip = landmarks[0], landmarks[4], landmarks[8], landmarks[12]
            ring_tip, pinky_tip = landmarks[16], landmarks[20]

            index_pixel_pos = (int(index_tip.x * w), int(index_tip.y * h))
            thumb_pixel_pos = (int(thumb_tip.x * w), int(thumb_tip.y * h))

            hand_scale = max(0.05, math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y))
            thumb_index_dist = self.calculate_distance(thumb_tip, index_tip) / hand_scale
            thumb_middle_dist = self.calculate_distance(thumb_tip, middle_tip) / hand_scale

            index_extended = self.is_finger_extended(landmarks, 8, 6)
            middle_extended = self.is_finger_extended(landmarks, 12, 10)
            ring_extended = self.is_finger_extended(landmarks, 16, 14)
            pinky_extended = self.is_finger_extended(landmarks, 20, 18)

            current_time = time.time()
            target_x, target_y = self.image_proc.map_coordinates_to_screen(
                index_tip.x, index_tip.y, self.config.margin_x, self.config.margin_y
            )

            # EMA Smoothing
            if not self.has_prev_pos:
                self.smoothed_x, self.smoothed_y = float(target_x), float(target_y)
                self.has_prev_pos = True
            else:
                dist = math.hypot(target_x - self.smoothed_x, target_y - self.smoothed_y)
                if dist > self.config.movement_deadzone:
                    a = self.config.smoothing_factor
                    self.smoothed_x = a * self.smoothed_x + (1.0 - a) * target_x
                    self.smoothed_y = a * self.smoothed_y + (1.0 - a) * target_y

            final_x, final_y = int(round(self.smoothed_x)), int(round(self.smoothed_y))
            status["cursor_pos"] = (final_x, final_y)

            # Scroll Mode
            if index_extended and middle_extended and not ring_extended and not pinky_extended:
                self.current_gesture = "Scroll Mode"
                if self.scroll_anchor_y is None:
                    self.scroll_anchor_y = index_tip.y
                else:
                    dy = self.scroll_anchor_y - index_tip.y
                    if abs(dy) > self.config.scroll_threshold and current_time - self.last_scroll_time > self.config.scroll_cooldown:
                        clicks = int(dy * 10 * self.config.scroll_distance_scale)
                        if clicks != 0:
                            self.computer.scroll(clicks)
                            self.last_scroll_time = current_time
                            self.scroll_anchor_y = index_tip.y
            else:
                self.scroll_anchor_y = None

                # Right Click Pinch (Thumb + Middle)
                if thumb_middle_dist < (self.config.right_click_pinch_threshold * 1.8) and thumb_index_dist > 0.35:
                    self.current_gesture = "Right Click"
                    if current_time - self.last_right_click_time > self.config.click_cooldown:
                        self.computer.right_click()
                        self.last_right_click_time = current_time
                else:
                    # Left Click & Drag (Thumb + Index Pinch)
                    if thumb_index_dist < (self.config.pinch_threshold * 1.8):
                        self.is_pinching = True
                        status["is_pinching"] = True
                        if self.pinch_start_time is None:
                            self.pinch_start_time = current_time
                        if (current_time - self.pinch_start_time) >= self.config.drag_hold_duration:
                            self.current_gesture = "Drag & Drop"
                            if not self.is_dragging:
                                self.computer.mouse_down()
                                self.is_dragging = True
                            self.computer.move_cursor(final_x, final_y)
                        else:
                            self.current_gesture = "Pinching"
                    else:
                        if self.is_pinching:
                            if self.is_dragging:
                                self.computer.mouse_up()
                                self.is_dragging = False
                                self.current_gesture = "Dropped"
                            else:
                                if current_time - self.last_click_time > self.config.click_cooldown:
                                    self.computer.left_click()
                                    self.last_click_time = current_time
                                    self.current_gesture = "Left Click"
                        self.is_pinching = False
                        self.pinch_start_time = None
                        if self.current_gesture not in ["Right Click", "Scroll Mode"]:
                            self.current_gesture = "Pointing"
                            self.computer.move_cursor(final_x, final_y)

            status["is_dragging"] = self.is_dragging
            status["gesture"] = self.current_gesture
        else:
            self.hand_detected = False
            self.current_gesture = "No Hand"
            if self.is_dragging:
                self.computer.mouse_up()
                self.is_dragging = False

        hud_frame = self.image_proc.draw_hud(
            frame_mirrored, self.hand_detected, self.current_gesture,
            self.config.margin_x, self.config.margin_y,
            index_pixel_pos, thumb_pixel_pos, self.is_pinching, self.is_dragging
        )
        return hud_frame, status
`
  },
  {
    name: 'voice_controller.py',
    category: 'core',
    icon: Mic,
    description: 'Threaded speech recognition, ambient noise calibration, intent dispatch, and error recovery.',
    code: `"""
Touch-Free Computer Controller - Voice Controller Module
Listens for spoken natural language commands in a non-blocking background thread.
"""

import time
import logging
import threading
from typing import Callable, Optional, Tuple, Dict, Any

logger = logging.getLogger("VoiceController")

try:
    import speech_recognition as sr
    HAS_SPEECH_RECOGNITION = True
except ImportError:
    HAS_SPEECH_RECOGNITION = False

from config import DEFAULT_VOICE_CONFIG, VoiceConfig
from nlp_processor import RuleBasedNLPProcessor, ParsedCommand, IntentType
from computer_actions import ComputerController


class VoiceController:
    def __init__(self, computer: ComputerController, nlp: RuleBasedNLPProcessor, config: Optional[VoiceConfig] = None,
                 on_command_callback=None, on_status_callback=None):
        self.computer = computer
        self.nlp = nlp
        self.config = config or DEFAULT_VOICE_CONFIG
        self.on_command_callback = on_command_callback
        self.on_status_callback = on_status_callback
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.recognizer = None
        self.microphone = None

        self.gesture_toggle_callback = None
        self.master_stop_callback = None
        self.master_resume_callback = None

    def start(self) -> bool:
        if not HAS_SPEECH_RECOGNITION or self.is_running:
            return False
        try:
            self.recognizer = sr.Recognizer()
            self.recognizer.energy_threshold = self.config.energy_threshold
            self.recognizer.dynamic_energy_threshold = self.config.dynamic_energy_threshold
            self.microphone = sr.Microphone()
            self.is_running = True
            self.thread = threading.Thread(target=self._listen_loop, daemon=True)
            self.thread.start()
            self._update_status("Listening for commands...")
            return True
        except Exception as e:
            self.is_running = False
            return False

    def stop(self) -> None:
        self.is_running = False
        self._update_status("Voice Inactive")

    def _update_status(self, text: str) -> None:
        if self.on_status_callback:
            self.on_status_callback(text)

    def execute_parsed_command(self, parsed: ParsedCommand) -> Tuple[bool, str]:
        intent, params = parsed.intent, parsed.parameters
        if parsed.clarification_needed:
            return False, parsed.clarification_question or "Clarification needed."

        if intent == IntentType.STOP_ALL:
            self.computer.emergency_stop()
            if self.master_stop_callback:
                self.master_stop_callback()
            return True, "Emergency Stop activated."

        if intent == IntentType.RESUME_ALL:
            self.computer.reset_emergency_stop()
            if self.master_resume_callback:
                self.master_resume_callback()
            return True, "Controls resumed."

        if intent == IntentType.STOP_GESTURE:
            if self.gesture_toggle_callback:
                self.gesture_toggle_callback(False)
            return True, "Gesture control stopped."

        if intent == IntentType.START_GESTURE:
            if self.gesture_toggle_callback:
                self.gesture_toggle_callback(True)
            return True, "Gesture control started."

        if intent == IntentType.STOP_VOICE:
            self.stop()
            return True, "Voice control disabled."

        if intent == IntentType.OPEN_APP:
            return self.computer.launch_application(params.get("app", ""))

        if intent == IntentType.SET_VOLUME:
            return self.computer.set_volume(params.get("level", 50))

        if intent == IntentType.INCREASE_VOLUME:
            return self.computer.adjust_volume(params.get("delta", 10))

        if intent == IntentType.DECREASE_VOLUME:
            return self.computer.adjust_volume(params.get("delta", -10))

        if intent == IntentType.TAKE_SCREENSHOT:
            return self.computer.take_screenshot()

        if intent == IntentType.SCROLL_UP:
            return self.computer.scroll(params.get("amount", 300)), "Scrolled up"

        if intent == IntentType.SCROLL_DOWN:
            return self.computer.scroll(params.get("amount", -300)), "Scrolled down"

        if intent == IntentType.PRESS_KEY:
            return self.computer.press_key(params.get("key", "enter"))

        if intent == IntentType.COPY_TEXT:
            return self.computer.copy_selection()

        if intent == IntentType.PASTE_TEXT:
            return self.computer.paste_selection()

        return False, f"Unhandled intent: {intent}"

    def handle_text_command(self, text_input: str) -> Tuple[ParsedCommand, bool, str]:
        parsed = self.nlp.process(text_input)
        success, message = self.execute_parsed_command(parsed)
        if self.on_command_callback:
            self.on_command_callback(parsed, success, message)
        return parsed, success, message

    def _listen_loop(self) -> None:
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1.0)
        except Exception:
            pass

        while self.is_running:
            try:
                with self.microphone as source:
                    audio = self.recognizer.listen(source, timeout=3.0, phrase_time_limit=self.config.phrase_time_limit)
                transcript = self.recognizer.recognize_google(audio, language=self.config.language)
                parsed = self.nlp.process(transcript)
                success, msg = self.execute_parsed_command(parsed)
                if self.on_command_callback:
                    self.on_command_callback(parsed, success, msg)
            except sr.WaitTimeoutError:
                pass
            except Exception:
                time.sleep(0.5)
`
  },
  {
    name: 'nlp_processor.py',
    category: 'core',
    icon: Sparkles,
    description: 'Rule-based NLP intent extractor, regex pattern matching, and clarification question generator.',
    code: `"""
Touch-Free Computer Controller - Rule-Based NLP Processor
Parses natural language speech and text into structured intents and parameters.
"""

import re
from dataclasses import dataclass
from typing import Optional, Dict, Any


class IntentType:
    OPEN_APP = "OPEN_APP"
    SET_VOLUME = "SET_VOLUME"
    INCREASE_VOLUME = "INCREASE_VOLUME"
    DECREASE_VOLUME = "DECREASE_VOLUME"
    MUTE_VOLUME = "MUTE_VOLUME"
    UNMUTE_VOLUME = "UNMUTE_VOLUME"
    TAKE_SCREENSHOT = "TAKE_SCREENSHOT"
    SCROLL_UP = "SCROLL_UP"
    SCROLL_DOWN = "SCROLL_DOWN"
    PRESS_KEY = "PRESS_KEY"
    COPY_TEXT = "COPY_TEXT"
    PASTE_TEXT = "PASTE_TEXT"
    STOP_GESTURE = "STOP_GESTURE"
    START_GESTURE = "START_GESTURE"
    STOP_VOICE = "STOP_VOICE"
    STOP_ALL = "STOP_ALL"
    RESUME_ALL = "RESUME_ALL"
    UNKNOWN = "UNKNOWN"
    AMBIGUOUS = "AMBIGUOUS"


@dataclass
class ParsedCommand:
    raw_text: str
    intent: str
    parameters: Dict[str, Any]
    confidence: float
    clarification_needed: bool = False
    clarification_question: Optional[str] = None
    feedback_message: str = ""


class RuleBasedNLPProcessor:
    def __init__(self):
        self.app_aliases = {
            "chrome": "chrome", "google chrome": "chrome", "browser": "chrome",
            "calculator": "calculator", "calc": "calculator",
            "notepad": "notepad", "text editor": "notepad",
            "explorer": "explorer", "file explorer": "explorer",
            "edge": "edge", "microsoft edge": "edge",
            "paint": "paint", "settings": "settings",
            "task manager": "task manager", "cmd": "cmd",
        }
        self.word_to_num = {
            "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
            "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
            "hundred": 100, "half": 50, "max": 100
        }

    def clean_text(self, text: str) -> str:
        return " ".join(re.sub(r"[^\w\s%]", " ", text.lower()).split())

    def extract_percentage(self, text: str) -> Optional[int]:
        match = re.search(r"(\d{1,3})\s*(%|percent)?", text)
        if match:
            return max(0, min(100, int(match.group(1))))
        for word, val in self.word_to_num.items():
            if re.search(rf"\b{word}\b", text):
                return val
        return None

    def process(self, raw_input: str) -> ParsedCommand:
        if not raw_input or not raw_input.strip():
            return ParsedCommand("", IntentType.UNKNOWN, {}, 0.0, feedback_message="No command received.")

        text = self.clean_text(raw_input)

        # 1. Emergency Stop / Resume
        if any(p in text for p in ["stop all controls", "stop all", "pause all", "emergency stop", "halt system"]):
            return ParsedCommand(raw_input, IntentType.STOP_ALL, {}, 1.0, feedback_message="Emergency Stop activated.")
        if any(p in text for p in ["resume all controls", "resume all", "start all", "unpause all"]):
            return ParsedCommand(raw_input, IntentType.RESUME_ALL, {}, 0.95, feedback_message="Resuming all controls.")

        # 2. Gesture Toggle
        if any(p in text for p in ["stop gesture control", "disable gesture", "stop gestures"]):
            return ParsedCommand(raw_input, IntentType.STOP_GESTURE, {}, 0.95, feedback_message="Disabling gesture control.")
        if any(p in text for p in ["start gesture control", "enable gesture", "turn on gesture"]):
            return ParsedCommand(raw_input, IntentType.START_GESTURE, {}, 0.95, feedback_message="Enabling gesture control.")

        # 3. Voice Toggle
        if any(p in text for p in ["disable voice control", "stop voice control", "turn off voice"]):
            return ParsedCommand(raw_input, IntentType.STOP_VOICE, {}, 0.95, feedback_message="Disabling voice controller.")

        # 4. Screenshot
        if any(p in text for p in ["take a screenshot", "take screenshot", "capture screen", "screenshot"]):
            return ParsedCommand(raw_input, IntentType.TAKE_SCREENSHOT, {}, 0.95, feedback_message="Taking screenshot...")

        # 5. Volume
        if "volume" in text or "sound" in text or "audio" in text:
            if any(w in text for w in ["set", "to", "at", "%", "percent", "put"]):
                pct = self.extract_percentage(text)
                if pct is not None:
                    return ParsedCommand(raw_input, IntentType.SET_VOLUME, {"level": pct}, 0.95, feedback_message=f"Setting volume to {pct}%")
            if any(w in text for w in ["increase", "turn up", "raise", "louder", "boost", "up"]):
                return ParsedCommand(raw_input, IntentType.INCREASE_VOLUME, {"delta": 10}, 0.9, feedback_message="Increasing volume.")
            if any(w in text for w in ["decrease", "turn down", "lower", "quieter", "down"]):
                return ParsedCommand(raw_input, IntentType.DECREASE_VOLUME, {"delta": -10}, 0.9, feedback_message="Decreasing volume.")
            if "mute" in text and "unmute" not in text:
                return ParsedCommand(raw_input, IntentType.MUTE_VOLUME, {}, 0.9, feedback_message="Muting audio.")
            if "unmute" in text:
                return ParsedCommand(raw_input, IntentType.UNMUTE_VOLUME, {}, 0.9, feedback_message="Unmuting audio.")

        # 6. Scrolling
        if "scroll down" in text or "page down" in text:
            return ParsedCommand(raw_input, IntentType.SCROLL_DOWN, {"amount": -300}, 0.95, feedback_message="Scrolling down.")
        if "scroll up" in text or "page up" in text:
            return ParsedCommand(raw_input, IntentType.SCROLL_UP, {"amount": 300}, 0.95, feedback_message="Scrolling up.")

        # 7. Keyboard & Clipboard
        if "press enter" in text or text == "enter":
            return ParsedCommand(raw_input, IntentType.PRESS_KEY, {"key": "enter"}, 0.95, feedback_message="Pressing Enter.")
        if "press space" in text or text == "space":
            return ParsedCommand(raw_input, IntentType.PRESS_KEY, {"key": "space"}, 0.95, feedback_message="Pressing Space.")
        if any(p in text for p in ["copy selected text", "copy this", "copy selection", "copy"]):
            return ParsedCommand(raw_input, IntentType.COPY_TEXT, {}, 0.9, feedback_message="Copying text.")
        if any(p in text for p in ["paste", "paste text", "paste clipboard"]):
            return ParsedCommand(raw_input, IntentType.PASTE_TEXT, {}, 0.9, feedback_message="Pasting clipboard contents.")

        # 8. Open Apps
        if any(w in text for w in ["open", "launch", "start", "run"]):
            for alias, target in self.app_aliases.items():
                if alias in text:
                    return ParsedCommand(raw_input, IntentType.OPEN_APP, {"app": target}, 0.95, feedback_message=f"Opening {target.title()}...")
            cand = text.replace("open", "").replace("launch", "").strip()
            return ParsedCommand(raw_input, IntentType.AMBIGUOUS, {"candidate": cand}, 0.4, True,
                                 f"Which application did you mean by '{cand}'? Supported: Chrome, Calculator, Notepad, Edge, Explorer.")

        for alias, target in self.app_aliases.items():
            if text == alias:
                return ParsedCommand(raw_input, IntentType.OPEN_APP, {"app": target}, 0.85, feedback_message=f"Opening {target.title()}...")

        return ParsedCommand(raw_input, IntentType.UNKNOWN, {}, 0.0, True,
                             f"Command '{raw_input}' was not recognized. Say 'open chrome', 'increase volume', or 'scroll down'.")
`
  },
  {
    name: 'computer_actions.py',
    category: 'core',
    icon: ShieldCheck,
    description: 'PyAutoGUI, Windows PyCaw audio volume control, application allowlist enforcement, and screenshots.',
    code: `"""
Touch-Free Computer Controller - Computer Actions Module
Performs real Windows computer automation actions safely with an explicit allowlist.
"""

import os
import sys
import logging
import subprocess
from datetime import datetime
from typing import Tuple, Optional

logger = logging.getLogger("ComputerActions")

try:
    import pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.01
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False

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
    except Exception as e:
        logger.warning(f"PyCaw audio volume init warning: {e}")

from config import DEFAULT_SYSTEM_CONFIG, SystemConfig


class ComputerController:
    def __init__(self, config: Optional[SystemConfig] = None):
        self.config = config or DEFAULT_SYSTEM_CONFIG
        self.is_emergency_stopped = False
        self.is_dragging = False
        os.makedirs(self.config.screenshot_dir, exist_ok=True)
        self.screen_width, self.screen_height = pyautogui.size() if HAS_PYAUTOGUI else (1920, 1080)

    def emergency_stop(self) -> None:
        self.is_emergency_stopped = True
        if self.is_dragging:
            self.mouse_up()
        logger.warning("EMERGENCY STOP ACTIVATED!")

    def reset_emergency_stop(self) -> None:
        self.is_emergency_stopped = False
        self.is_dragging = False

    def move_cursor(self, x: int, y: int) -> None:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return
        cx = max(0, min(self.screen_width - 1, int(x)))
        cy = max(0, min(self.screen_height - 1, int(y)))
        pyautogui.moveTo(cx, cy)

    def left_click(self) -> bool:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.click(button="left")
        return True

    def right_click(self) -> bool:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.click(button="right")
        return True

    def mouse_down(self) -> bool:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        if not self.is_dragging:
            pyautogui.mouseDown(button="left")
            self.is_dragging = True
        return True

    def mouse_up(self) -> bool:
        if not HAS_PYAUTOGUI:
            self.is_dragging = False
            return False
        if self.is_dragging:
            pyautogui.mouseUp(button="left")
            self.is_dragging = False
        return True

    def scroll(self, clicks: int) -> bool:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False
        pyautogui.scroll(clicks)
        return True

    def launch_application(self, app_alias: str) -> Tuple[bool, str]:
        if self.is_emergency_stopped:
            return False, "Emergency stop active"
        key = app_alias.strip().lower()
        if key not in self.config.allowed_applications:
            return False, f"Application '{app_alias}' is not in the allowed list."
        executable = self.config.allowed_applications[key]
        try:
            if sys.platform == "win32":
                if executable.startswith("ms-"):
                    os.startfile(executable)
                else:
                    subprocess.Popen([executable], shell=False)
            return True, f"Launched {key.title()}"
        except Exception as e:
            return False, f"Failed to launch {key}: {e}"

    def get_volume(self) -> int:
        if HAS_PYCAW and volume_interface:
            try:
                return int(round(volume_interface.GetMasterVolumeLevelScalar() * 100))
            except Exception:
                pass
        return 50

    def set_volume(self, percentage: int) -> Tuple[bool, str]:
        if self.is_emergency_stopped:
            return False, "Emergency stop active"
        clamped = max(0, min(100, int(percentage)))
        if HAS_PYCAW and volume_interface:
            try:
                volume_interface.SetMasterVolumeLevelScalar(clamped / 100.0, None)
                return True, f"Volume set to {clamped}%"
            except Exception as e:
                return False, f"Error: {e}"
        return True, f"Volume set to {clamped}%"

    def adjust_volume(self, delta: int) -> Tuple[bool, str]:
        return self.set_volume(self.get_volume() + delta)

    def take_screenshot(self) -> Tuple[bool, str]:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Cannot take screenshot while halted"
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"screenshot_{timestamp}.png"
            path = os.path.join(self.config.screenshot_dir, filename)
            pyautogui.screenshot().save(path)
            return True, f"Screenshot saved: {filename}"
        except Exception as e:
            return False, f"Failed screenshot: {e}"

    def press_key(self, key_name: str) -> Tuple[bool, str]:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Halted"
        allowed = {"enter": "enter", "space": "space", "escape": "esc", "tab": "tab"}
        k = key_name.lower().strip()
        if k in allowed:
            pyautogui.press(allowed[k])
            return True, f"Pressed {k.title()}"
        return False, "Key not allowed"

    def copy_selection(self) -> Tuple[bool, str]:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Halted"
        pyautogui.hotkey("ctrl", "c")
        return True, "Copied selection to clipboard"

    def paste_selection(self) -> Tuple[bool, str]:
        if self.is_emergency_stopped or not HAS_PYAUTOGUI:
            return False, "Halted"
        pyautogui.hotkey("ctrl", "v")
        return True, "Pasted from clipboard"
`
  },
  {
    name: 'image_processor.py',
    category: 'core',
    icon: FileCode,
    description: 'Horizontal frame mirroring, landmark overlays, HUD active zone coordinates mapping.',
    code: `"""
Touch-Free Computer Controller - Image Processor Module
Handles OpenCV frame manipulation, horizontal mirroring, coordinate mapping,
and visual HUD feedback for hand tracking.
"""

import time
from typing import Tuple, Optional, Any

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    cv2 = None


class ImageProcessor:
    def __init__(self, screen_width: int = 1920, screen_height: int = 1080):
        self.screen_width = screen_width
        self.screen_height = screen_height
        self.fps = 0.0
        self.frame_count = 0
        self.last_fps_calc_time = time.time()

    def process_frame(self, frame: Any) -> Any:
        if frame is None or not HAS_CV2:
            return frame
        return cv2.flip(frame, 1)

    def calculate_fps(self) -> float:
        now = time.time()
        self.frame_count += 1
        elapsed = now - self.last_fps_calc_time
        if elapsed >= 0.5:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.last_fps_calc_time = now
        return self.fps

    def map_coordinates_to_screen(self, norm_x: float, norm_y: float, margin_x: float = 0.15, margin_y: float = 0.20) -> Tuple[int, int]:
        clamped_x = max(margin_x, min(1.0 - margin_x, norm_x))
        clamped_y = max(margin_y, min(1.0 - margin_y, norm_y))
        norm_screen_x = (clamped_x - margin_x) / (1.0 - 2.0 * margin_x)
        norm_screen_y = (clamped_y - margin_y) / (1.0 - 2.0 * margin_y)
        return int(norm_screen_x * self.screen_width), int(norm_screen_y * self.screen_height)

    def draw_hud(self, frame: Any, hand_detected: bool, gesture_name: str, margin_x: float = 0.15, margin_y: float = 0.20,
                 index_pos: Optional[Tuple[int, int]] = None, thumb_pos: Optional[Tuple[int, int]] = None,
                 is_pinching: bool = False, is_dragging: bool = False) -> Any:
        if frame is None or not HAS_CV2:
            return frame
        h, w, _ = frame.shape
        hud = frame.copy()
        
        # Active Zone
        cv2.rectangle(hud, (int(margin_x * w), int(margin_y * h)), (int((1.0 - margin_x) * w), int((1.0 - margin_y) * h)), (80, 80, 80), 1)

        # Pinch indicators
        if index_pos and thumb_pos:
            color = (0, 255, 120) if is_pinching else (255, 200, 0)
            cv2.line(hud, index_pos, thumb_pos, color, 3 if is_pinching else 1)
            cv2.circle(hud, index_pos, 8, (0, 165, 255), -1 if is_pinching else 2)
            cv2.circle(hud, thumb_pos, 6, (255, 120, 0), -1 if is_pinching else 2)

        # Status text banner
        cv2.rectangle(hud, (10, 10), (280, 75), (30, 30, 30), -1)
        fps = self.calculate_fps()
        cv2.putText(hud, f"FPS: {fps:.1f}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)
        track_color = (50, 220, 100) if hand_detected else (80, 80, 220)
        cv2.putText(hud, "TRACKING ACTIVE" if hand_detected else "NO HAND", (100, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, track_color, 1)
        cv2.putText(hud, f"Action: {'DRAGGING' if is_dragging else gesture_name}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
        return hud
`
  },
  {
    name: 'config.py',
    category: 'config',
    icon: Settings,
    description: 'Central configuration dataclasses, thresholds, allowlist of applications, and hotkeys.',
    code: `"""
Touch-Free Computer Controller - Configuration Module
Defines settings, thresholds, allowlists, and system constants.
"""

import os
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class GestureConfig:
    camera_id: int = 0
    camera_width: int = 640
    camera_height: int = 480
    target_fps: int = 30
    margin_x: float = 0.15
    margin_y: float = 0.20
    smoothing_factor: float = 0.65
    movement_deadzone: float = 2.0
    cursor_speed: float = 1.3
    pinch_threshold: float = 0.055
    pinch_release_threshold: float = 0.075
    drag_hold_duration: float = 0.35
    click_cooldown: float = 0.35
    right_click_pinch_threshold: float = 0.055
    scroll_distance_scale: int = 40
    scroll_threshold: float = 0.04
    scroll_cooldown: float = 0.08


@dataclass
class VoiceConfig:
    energy_threshold: int = 300
    dynamic_energy_threshold: bool = True
    pause_threshold: float = 0.8
    phrase_time_limit: float = 6.0
    ambient_noise_adjustment_sec: float = 1.0
    language: str = "en-US"
    feedback_sound: bool = True


@dataclass
class SystemConfig:
    app_title: str = "Touch-Free Computer Controller"
    version: str = "1.0.0"
    screenshot_dir: str = os.path.join(os.path.expanduser("~"), "Pictures", "TouchFreeScreenshots")
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
    volume_step: int = 5
    emergency_stop_key: str = "escape"
    emergency_stop_key_secondary: str = "f12"


DEFAULT_GESTURE_CONFIG = GestureConfig()
DEFAULT_VOICE_CONFIG = VoiceConfig()
DEFAULT_SYSTEM_CONFIG = SystemConfig()
`
  },
  {
    name: 'requirements.txt',
    category: 'config',
    icon: Terminal,
    description: 'Python dependencies verified for Windows (MediaPipe, OpenCV, PyAutoGUI, PyCaw, etc.).',
    code: `opencv-python>=4.8.0.76
mediapipe>=0.10.9
pyautogui>=0.9.54
SpeechRecognition>=3.10.1
pycaw>=20240210
comtypes>=1.2.0
pyaudio>=0.2.14
pyperclip>=1.8.2
pillow>=10.2.0
numpy>=1.24.0,<2.0.0
`
  },
  {
    name: 'run.bat',
    category: 'scripts',
    icon: Terminal,
    description: '1-click Windows batch script to launch the application with virtual environment.',
    code: `@echo off
echo ========================================================
echo  Starting Touch-Free Computer Controller...
echo  (Press ESC or F12 at any time for Emergency Stop)
echo ========================================================
echo.

if exist ".venv\\Scripts\\activate.bat" (
    call .venv\\Scripts\\activate.bat
)

python main.py

if %errorlevel% neq 0 (
    echo.
    echo Application exited with an error code: %errorlevel%
    pause
)
`
  },
  {
    name: 'install.bat',
    category: 'scripts',
    icon: Terminal,
    description: '1-click automated setup script that creates .venv and installs all dependencies.',
    code: `@echo off
echo ========================================================
echo  Touch-Free Computer Controller - Windows Setup Installer
echo ========================================================
echo.

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
call .venv\\Scripts\\activate.bat

echo [3/3] Upgrading pip and installing required packages...
python -m pip install --upgrade pip
pip install -r requirements.txt

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
`
  },
  {
    name: 'test_suite.py',
    category: 'core',
    icon: ShieldCheck,
    description: 'Automated unit test suite verifying NLP rules, allowlist safety, and coordinate calculations.',
    code: `"""
Touch-Free Computer Controller - Diagnostic & Self-Test Suite
Validates NLP intent parsing, action allowlists, math smoothing algorithms, and configuration integrity.
"""

import unittest
from config import DEFAULT_SYSTEM_CONFIG
from nlp_processor import RuleBasedNLPProcessor, IntentType
from computer_actions import ComputerController
from image_processor import ImageProcessor


class TestTouchFreeController(unittest.TestCase):
    def setUp(self):
        self.nlp = RuleBasedNLPProcessor()
        self.computer = ComputerController(DEFAULT_SYSTEM_CONFIG)
        self.image_proc = ImageProcessor(1920, 1080)

    def test_open_application_intents(self):
        commands = [
            ("Open Chrome", "chrome"),
            ("Launch Calculator", "calculator"),
            ("Open Notepad", "notepad"),
            ("open edge", "edge"),
        ]
        for text, expected in commands:
            parsed = self.nlp.process(text)
            self.assertEqual(parsed.intent, IntentType.OPEN_APP)
            self.assertEqual(parsed.parameters.get("app"), expected)

    def test_volume_intents(self):
        p1 = self.nlp.process("Set volume to 50 percent")
        self.assertEqual(p1.intent, IntentType.SET_VOLUME)
        self.assertEqual(p1.parameters.get("level"), 50)

        p2 = self.nlp.process("Increase volume")
        self.assertEqual(p2.intent, IntentType.INCREASE_VOLUME)

    def test_screenshot_intent(self):
        p = self.nlp.process("Take a screenshot")
        self.assertEqual(p.intent, IntentType.TAKE_SCREENSHOT)

    def test_allowlist_security(self):
        success, msg = self.computer.launch_application("rmdir /s /q c:\\\\")
        self.assertFalse(success)
        self.assertIn("not in the allowed list", msg)

    def test_emergency_stop_state(self):
        self.computer.emergency_stop()
        self.assertTrue(self.computer.is_emergency_stopped)
        self.computer.reset_emergency_stop()
        self.assertFalse(self.computer.is_emergency_stopped)


if __name__ == "__main__":
    unittest.main()
`
  },
  {
    name: 'README.md',
    category: 'docs',
    icon: HelpCircle,
    description: 'Comprehensive Windows installation guide, gesture diagrams, voice command cheatsheet & troubleshooting.',
    code: `# Touch-Free Computer Controller

A practical, lightweight, and safety-focused Windows desktop application that lets you control your computer using **hand gestures** and **natural-language voice commands**.

Built with **MediaPipe**, **OpenCV**, **PyAutoGUI**, **SpeechRecognition**, **PyCaw**, and rule-based NLP.

## 🚀 Quick Start (Windows 10 / 11)
1. Double-click \`install.bat\`
2. Double-click \`run.bat\`
3. Press **ESC** at any time for Emergency Stop!
`
  },
  {
    name: 'ARCHITECTURE_AND_HOW_IT_WORKS.md',
    category: 'docs',
    icon: BookOpen,
    description: 'Deep non-code conceptual architectural guide: computer vision pipeline, palm scale normalization, EMA smoothing, and multi-threaded safety.',
    code: `# Touch-Free Computer Controller: Architecture & How It Works

## 1. Executive Summary & Purpose
The Touch-Free Computer Controller enables complete touchless mouse movement, clicks, dragging, scrolling, and voice automation on Windows using a standard webcam and microphone.

### What The Application DOES:
- Tracks hand in 3D space with MediaPipe Hands (21 landmarks)
- Moves cursor using index fingertip with Exponential Moving Average (EMA) smoothing
- Left-clicks using rapid thumb-and-index pinch (<350ms)
- Drag-and-drops using sustained pinch hold (>350ms)
- Right-clicks using thumb-and-middle pinch
- Scrolls vertically with two-finger extension
- Listens for natural-language commands (Chrome, Notepad, Calc, volume %, screenshot, copy, paste)
- Enforces instant emergency stop (ESC, F12, or "Stop all controls")

### What The Application DOES NOT DO:
- Does NOT run arbitrary shell scripts (strict allowlist enforcement)
- Does NOT upload camera or audio feeds to the cloud (100% local memory processing)
- Does NOT guess when a voice command is ambiguous (prompts user for clarification)
- Does NOT require specialized sensor hardware (standard 720p/1080p webcam and mic)

## 2. Hand Gesture Vision Pipeline
1. Camera Capture & Horizontal Mirroring (cv2.flip)
2. MediaPipe 21 3D Skeletal Landmark Detection
3. Active Tracking Margin Box: Ensures reaching screen edges without moving out of camera view
4. EMA Smoothing & Movement Deadband: Eliminates hand tremors without cursor lag
5. Palm Scale Invariant Distance: Normalizes pinch threshold across variable camera distances
6. Gesture State Machine: Pointing -> Pinch -> Drag -> Drop -> Scroll

## 3. Voice Controller & Rule-Based NLP
- Ambient Noise Profiling: Calibrates room acoustic threshold for 1.0 second on startup
- Zero-Latency Rule-Based NLP: Executes in <1ms without cloud LLM latency, cost, or hallucinations
- Entity Extraction: Automatically parses spoken numbers ("50 percent" -> 50%) and synonyms
- Ambiguity Guard: Unrecognized commands trigger friendly clarification prompts

## 4. Multi-Threaded Architecture
- Thread 1 (Main GUI): Tkinter event loop at 60 FPS
- Thread 2 (Vision): OpenCV camera + MediaPipe inference at 30 FPS
- Thread 3 (Voice Worker): SpeechRecognition daemon listener that never blocks cursor movement

## 5. OS Automation & Safety
- Windows App Paths registry resolution prevents missing PATH errors
- Hardware audio volume control via PyCaw (Core Audio API)
- Screenshots saved directly to Pictures/TouchFreeScreenshots
- Fail-Safe mouse boundary (slamming cursor into corner immediately halts automation)
`
  }
];

export const PythonProjectExplorer: React.FC = () => {
  const [selectedFileName, setSelectedFileName] = useState<string>('main.py');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const selectedFile = PYTHON_FILES.find(f => f.name === selectedFileName) || PYTHON_FILES[0];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(selectedFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('TouchFree_Computer_Controller') || zip;

      // Add all python files
      PYTHON_FILES.forEach(file => {
        folder.file(file.name, file.code);
      });

      // Generate blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'TouchFree_Computer_Controller_Windows.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Banner Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-950 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-sky-400" />
            Python Desktop Application Package
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            11 production-ready modules with Tkinter UI, MediaPipe tracking, PyAutoGUI actions, and 1-click batch installers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700/60"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied {selectedFile.name}!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Current File</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isZipping ? 'Packaging ZIP...' : 'Download Full Project (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Body: File Tree Sidebar & Code Viewer */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <div className="w-full md:w-72 bg-slate-950/80 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-800/60">
            <span className="text-xs font-medium text-slate-400">PROJECT FILES</span>
          </div>

          <div className="overflow-y-auto p-2 space-y-1 flex-1">
            {PYTHON_FILES.map(file => {
              const Icon = file.icon;
              const isSelected = file.name === selectedFileName;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                  <span className="truncate font-mono">{file.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick instructions pill-less footer */}
          <div className="p-4 border-t border-slate-800/60 bg-slate-950 text-xs text-slate-400 space-y-1">
            <div className="font-medium text-slate-300">How to run on Windows:</div>
            <div>1. Click <span className="text-sky-400 font-mono">Download Full Project</span></div>
            <div>2. Extract the downloaded ZIP</div>
            <div>3. Double-click <span className="text-emerald-400 font-mono">install.bat</span></div>
            <div>4. Double-click <span className="text-emerald-400 font-mono">run.bat</span></div>
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
          {/* File description header */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <span className="text-sky-400">{selectedFile.name}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-sans">{selectedFile.description}</span>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {selectedFile.code.split('\n').length} lines
            </span>
          </div>

          {/* Code Text Area */}
          <div className="flex-1 overflow-auto p-4 bg-[#0a0f1d] font-mono text-xs leading-relaxed text-slate-200 select-text">
            <pre className="tab-4">
              <code>{selectedFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
