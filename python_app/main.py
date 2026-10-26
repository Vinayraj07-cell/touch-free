"""
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

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TouchFreeApp")

try:
    import cv2
    from PIL import Image, ImageTk
    HAS_PIL_CV = True
except ImportError:
    HAS_PIL_CV = False
    logger.warning("OpenCV or PIL missing. GUI video feed will use placeholder.")

# Import local modules
from config import DEFAULT_GESTURE_CONFIG, DEFAULT_VOICE_CONFIG, DEFAULT_SYSTEM_CONFIG, GestureConfig, VoiceConfig
from computer_actions import ComputerController
from image_processor import ImageProcessor
from nlp_processor import RuleBasedNLPProcessor, ParsedCommand
from gesture_controller import GestureController
from voice_controller import VoiceController


class TouchFreeApp:
    """Main desktop application window and lifecycle coordinator."""

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Touch-Free Computer Controller")
        self.root.geometry("1100x720")
        self.root.minsize(960, 640)
        self.root.configure(bg="#0F172A")  # Deep slate neutral background

        # Core Configuration & Controllers
        self.gesture_config = GestureConfig()
        self.voice_config = VoiceConfig()
        self.system_config = DEFAULT_SYSTEM_CONFIG

        self.computer = ComputerController(self.system_config)
        self.image_proc = ImageProcessor(self.computer.screen_width, self.computer.screen_height)
        self.nlp = RuleBasedNLPProcessor()

        # Initialize Controllers
        self.gesture_ctrl = GestureController(self.computer, self.image_proc, self.gesture_config)
        self.voice_ctrl = VoiceController(
            computer=self.computer,
            nlp=self.nlp,
            config=self.voice_config,
            on_command_callback=self._on_voice_command,
            on_status_callback=self._on_voice_status_update
        )

        # Connect inter-controller voice triggers
        self.voice_ctrl.gesture_toggle_callback = self.toggle_gesture_mode
        self.voice_ctrl.master_stop_callback = self.emergency_stop
        self.voice_ctrl.master_resume_callback = self.resume_controls

        # Video capture thread variables
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_camera_running = False
        self.camera_thread: Optional[threading.Thread] = None

        # Build UI layout
        self._setup_styles()
        self._build_ui()

        # Bind emergency shortcuts
        self.root.bind("<Escape>", lambda e: self.emergency_stop())
        self.root.bind("<F12>", lambda e: self.emergency_stop())
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _setup_styles(self):
        """Configure ttk styles for dark modern aesthetic."""
        style = ttk.Style()
        style.theme_use("clam")
        
        # Configure frames and labels
        style.configure("TFrame", background="#0F172A")
        style.configure("Card.TFrame", background="#1E293B", relief="flat")
        style.configure("Header.TLabel", background="#0F172A", foreground="#F8FAFC", font=("Segoe UI", 14, "bold"))
        style.configure("Sub.TLabel", background="#0F172A", foreground="#94A3B8", font=("Segoe UI", 9))
        style.configure("CardTitle.TLabel", background="#1E293B", foreground="#E2E8F0", font=("Segoe UI", 10, "bold"))
        style.configure("CardText.TLabel", background="#1E293B", foreground="#94A3B8", font=("Segoe UI", 9))
        style.configure("CardValue.TLabel", background="#1E293B", foreground="#38BDF8", font=("Segoe UI", 9, "bold"))

        # Sliders
        style.configure("Horizontal.TScale", background="#1E293B", troughcolor="#334155")

    def _build_ui(self):
        """Construct the dashboard layout."""
        # ================= TOP HEADER BAR =================
        header_bar = tk.Frame(self.root, bg="#0F172A", height=60)
        header_bar.pack(fill=tk.X, padx=20, pady=(15, 10))

        # Title and system subtitle
        title_box = tk.Frame(header_bar, bg="#0F172A")
        title_box.pack(side=tk.LEFT)

        title_lbl = tk.Label(
            title_box,
            text="Touch-Free Computer Controller",
            bg="#0F172A",
            fg="#F8FAFC",
            font=("Segoe UI", 15, "bold")
        )
        title_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            title_box,
            text="Hand Gesture Tracking & Natural Language Voice Automation · Press ESC to Emergency Stop",
            bg="#0F172A",
            fg="#94A3B8",
            font=("Segoe UI", 9)
        )
        sub_lbl.pack(anchor="w")

        # Top Action Buttons
        actions_box = tk.Frame(header_bar, bg="#0F172A")
        actions_box.pack(side=tk.RIGHT)

        # Emergency Stop Button
        self.btn_emergency = tk.Button(
            actions_box,
            text="🛑 EMERGENCY STOP (ESC)",
            bg="#DC2626",
            fg="#FFFFFF",
            activebackground="#B91C1C",
            activeforeground="#FFFFFF",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=14,
            pady=6,
            command=self.emergency_stop,
            cursor="hand2"
        )
        self.btn_emergency.pack(side=tk.RIGHT, padx=(10, 0))

        # Master Start / Resume Button
        self.btn_master = tk.Button(
            actions_box,
            text="▶ Start All Controls",
            bg="#0284C7",
            fg="#FFFFFF",
            activebackground="#0369A1",
            activeforeground="#FFFFFF",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=14,
            pady=6,
            command=self.toggle_master_controls,
            cursor="hand2"
        )
        self.btn_master.pack(side=tk.RIGHT)

        # ================= MAIN TWO-COLUMN CONTENT =================
        main_content = tk.Frame(self.root, bg="#0F172A")
        main_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # --- LEFT COLUMN: Video Stream & Live Telemetry ---
        left_col = tk.Frame(main_content, bg="#0F172A", width=540)
        left_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        # Video Container
        video_card = tk.Frame(left_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        video_card.pack(fill=tk.BOTH, expand=True)

        video_header = tk.Frame(video_card, bg="#1E293B")
        video_header.pack(fill=tk.X, padx=12, pady=10)

        tk.Label(video_header, text="CAMERA PREVIEW & HAND HUD", bg="#1E293B", fg="#E2E8F0", font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT)

        # Gesture Switch
        self.gesture_toggle_var = tk.BooleanVar(value=False)
        self.chk_gesture = tk.Checkbutton(
            video_header,
            text="Enable Gestures",
            variable=self.gesture_toggle_var,
            command=self._on_gesture_checkbox_changed,
            bg="#1E293B",
            fg="#38BDF8",
            selectcolor="#0F172A",
            activebackground="#1E293B",
            activeforeground="#38BDF8",
            font=("Segoe UI", 9, "bold")
        )
        self.chk_gesture.pack(side=tk.RIGHT)

        # Canvas for video display
        self.video_canvas = tk.Canvas(video_card, bg="#0B0F19", highlightthickness=0)
        self.video_canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        # Video Status strip below canvas
        telemetry_strip = tk.Frame(video_card, bg="#0B0F19", height=32)
        telemetry_strip.pack(fill=tk.X, padx=10, pady=(0, 10))

        self.lbl_tracking_status = tk.Label(
            telemetry_strip,
            text="Hand: Not Detected",
            bg="#0B0F19",
            fg="#94A3B8",
            font=("Segoe UI", 9)
        )
        self.lbl_tracking_status.pack(side=tk.LEFT, padx=10)

        self.lbl_gesture_action = tk.Label(
            telemetry_strip,
            text="Action: Idle",
            bg="#0B0F19",
            fg="#38BDF8",
            font=("Segoe UI", 9, "bold")
        )
        self.lbl_gesture_action.pack(side=tk.RIGHT, padx=10)

        # --- RIGHT COLUMN: Voice, Settings & Command History ---
        right_col = tk.Frame(main_content, bg="#0F172A", width=480)
        right_col.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))

        # 1. Voice Recognition Card
        voice_card = tk.Frame(right_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        voice_card.pack(fill=tk.X, pady=(0, 10))

        voice_header = tk.Frame(voice_card, bg="#1E293B")
        voice_header.pack(fill=tk.X, padx=12, pady=10)

        tk.Label(voice_header, text="VOICE CONTROLLER & NLP", bg="#1E293B", fg="#E2E8F0", font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT)

        self.voice_toggle_var = tk.BooleanVar(value=False)
        self.chk_voice = tk.Checkbutton(
            voice_header,
            text="Enable Voice",
            variable=self.voice_toggle_var,
            command=self._on_voice_checkbox_changed,
            bg="#1E293B",
            fg="#34D399",
            selectcolor="#0F172A",
            activebackground="#1E293B",
            activeforeground="#34D399",
            font=("Segoe UI", 9, "bold")
        )
        self.chk_voice.pack(side=tk.RIGHT)

        # Voice status display
        self.lbl_voice_status = tk.Label(
            voice_card,
            text="Voice Inactive (Check 'Enable Voice' to start)",
            bg="#1E293B",
            fg="#94A3B8",
            font=("Segoe UI", 9)
        )
        self.lbl_voice_status.pack(anchor="w", padx=12, pady=(0, 8))

        # Manual Text Command Input Box
        cmd_input_frame = tk.Frame(voice_card, bg="#1E293B")
        cmd_input_frame.pack(fill=tk.X, padx=12, pady=(0, 12))

        self.txt_command_input = tk.Entry(
            cmd_input_frame,
            bg="#0F172A",
            fg="#F8FAFC",
            insertbackground="#38BDF8",
            relief="flat",
            font=("Segoe UI", 9),
            bd=5
        )
        self.txt_command_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))
        self.txt_command_input.bind("<Return>", lambda e: self._on_text_command_submit())

        btn_run_cmd = tk.Button(
            cmd_input_frame,
            text="Execute",
            bg="#334155",
            fg="#F8FAFC",
            activebackground="#475569",
            activeforeground="#F8FAFC",
            relief="flat",
            font=("Segoe UI", 8, "bold"),
            padx=10,
            command=self._on_text_command_submit,
            cursor="hand2"
        )
        btn_run_cmd.pack(side=tk.RIGHT)

        # 2. Activity / Command History Log Card
        log_card = tk.Frame(right_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        log_card.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        log_header = tk.Frame(log_card, bg="#1E293B")
        log_header.pack(fill=tk.X, padx=12, pady=10)
        tk.Label(log_header, text="COMMAND & ACTIVITY LOG", bg="#1E293B", fg="#E2E8F0", font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT)

        btn_clear_log = tk.Button(
            log_header,
            text="Clear",
            bg="#1E293B",
            fg="#94A3B8",
            activebackground="#1E293B",
            activeforeground="#F8FAFC",
            relief="flat",
            font=("Segoe UI", 8),
            command=self._clear_log,
            cursor="hand2"
        )
        btn_clear_log.pack(side=tk.RIGHT)

        # Listbox for log
        log_inner = tk.Frame(log_card, bg="#0F172A")
        log_inner.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 10))

        self.log_listbox = tk.Listbox(
            log_inner,
            bg="#0B0F19",
            fg="#E2E8F0",
            selectbackground="#1E293B",
            selectforeground="#38BDF8",
            relief="flat",
            font=("Segoe UI", 9),
            activestyle="none",
            highlightthickness=0
        )
        log_scrollbar = tk.Scrollbar(log_inner, orient=tk.VERTICAL, command=self.log_listbox.yview)
        self.log_listbox.config(yscrollcommand=log_scrollbar.set)

        log_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self._add_log("System initialized. Screen dimensions: "
                      f"{self.computer.screen_width}x{self.computer.screen_height}")

        # 3. Settings Card (Collapsible sliders)
        settings_card = tk.Frame(right_col, bg="#1E293B", relief="solid", bd=1, highlightbackground="#334155")
        settings_card.pack(fill=tk.X)

        tk.Label(settings_card, text="CALIBRATION & SENSITIVITY", bg="#1E293B", fg="#E2E8F0", font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=12, pady=(8, 4))

        sliders_grid = tk.Frame(settings_card, bg="#1E293B")
        sliders_grid.pack(fill=tk.X, padx=12, pady=(0, 8))

        # Slider 1: Cursor Smoothing
        tk.Label(sliders_grid, text="Smoothing (EMA):", bg="#1E293B", fg="#94A3B8", font=("Segoe UI", 8)).grid(row=0, column=0, sticky="w", pady=2)
        self.scale_smoothing = tk.Scale(
            sliders_grid,
            from_=0.10, to=0.90, resolution=0.05,
            orient=tk.HORIZONTAL,
            bg="#1E293B", fg="#94A3B8", highlightthickness=0,
            activebackground="#38BDF8", troughcolor="#0F172A",
            command=self._on_smoothing_change
        )
        self.scale_smoothing.set(self.gesture_config.smoothing_factor)
        self.scale_smoothing.grid(row=0, column=1, sticky="ew", padx=(10, 0))

        # Slider 2: Pinch Threshold
        tk.Label(sliders_grid, text="Pinch Distance:", bg="#1E293B", fg="#94A3B8", font=("Segoe UI", 8)).grid(row=1, column=0, sticky="w", pady=2)
        self.scale_pinch = tk.Scale(
            sliders_grid,
            from_=0.03, to=0.10, resolution=0.005,
            orient=tk.HORIZONTAL,
            bg="#1E293B", fg="#94A3B8", highlightthickness=0,
            activebackground="#38BDF8", troughcolor="#0F172A",
            command=self._on_pinch_threshold_change
        )
        self.scale_pinch.set(self.gesture_config.pinch_threshold)
        self.scale_pinch.grid(row=1, column=1, sticky="ew", padx=(10, 0))

        sliders_grid.columnconfigure(1, weight=1)

    # ================= LOGGING HELPER =================
    def _add_log(self, text: str):
        """Append timestamped line to log listbox."""
        timestamp = time.strftime("%H:%M:%S")
        entry = f"[{timestamp}] {text}"
        self.log_listbox.insert(tk.END, entry)
        self.log_listbox.see(tk.END)

    def _clear_log(self):
        self.log_listbox.delete(0, tk.END)

    # ================= SETTINGS HANDLERS =================
    def _on_smoothing_change(self, val):
        self.gesture_config.smoothing_factor = float(val)

    def _on_pinch_threshold_change(self, val):
        self.gesture_config.pinch_threshold = float(val)

    # ================= CONTROLLER TOGGLES =================
    def toggle_master_controls(self):
        """Toggle both gesture and voice control synchronously."""
        any_active = self.gesture_ctrl.is_enabled or self.voice_ctrl.is_running
        if any_active:
            # Turn off both
            self.toggle_gesture_mode(False)
            self.toggle_voice_mode(False)
            self.btn_master.config(text="▶ Start All Controls", bg="#0284C7")
            self._add_log("Master controls paused.")
        else:
            # Turn on both
            self.computer.reset_emergency_stop()
            self.toggle_gesture_mode(True)
            self.toggle_voice_mode(True)
            self.btn_master.config(text="⏸ Pause All Controls", bg="#D97706")
            self._add_log("Master controls activated.")

    def emergency_stop(self):
        """Emergency stop handler invoked by ESC, F12, or Stop button."""
        self.computer.emergency_stop()
        self.toggle_gesture_mode(False)
        self.toggle_voice_mode(False)
        self.btn_master.config(text="▶ Resume Controls", bg="#0284C7")
        self.lbl_tracking_status.config(text="EMERGENCY STOPPED", fg="#EF4444")
        self.lbl_gesture_action.config(text="Action: HALTED", fg="#EF4444")
        self._add_log("EMERGENCY STOP TRIGGERED: All actions halted immediately.")

    def resume_controls(self):
        """Resume controls after emergency stop."""
        self.computer.reset_emergency_stop()
        self._add_log("Emergency stop cleared. Resuming controls.")
        self.toggle_master_controls()

    def toggle_gesture_mode(self, enable: bool):
        """Enable or disable gesture tracking."""
        self.gesture_toggle_var.set(enable)
        if enable:
            if not self.is_camera_running:
                self._start_camera_stream()
            self.gesture_ctrl.start()
            self._add_log("Gesture tracking started.")
        else:
            self.gesture_ctrl.stop()
            self.lbl_tracking_status.config(text="Hand: Disabled", fg="#94A3B8")
            self.lbl_gesture_action.config(text="Action: Inactive", fg="#94A3B8")
            self._add_log("Gesture tracking disabled.")

    def toggle_voice_mode(self, enable: bool):
        """Enable or disable voice recognition."""
        self.voice_toggle_var.set(enable)
        if enable:
            started = self.voice_ctrl.start()
            if started:
                self._add_log("Voice recognition listening...")
            else:
                self.voice_toggle_var.set(False)
        else:
            self.voice_ctrl.stop()
            self._add_log("Voice recognition stopped.")

    def _on_gesture_checkbox_changed(self):
        self.toggle_gesture_mode(self.gesture_toggle_var.get())

    def _on_voice_checkbox_changed(self):
        self.toggle_voice_mode(self.voice_toggle_var.get())

    # ================= VOICE / TEXT COMMAND DISPATCH =================
    def _on_voice_command(self, parsed: ParsedCommand, success: bool, message: str):
        """Thread-safe UI update when voice command parsed."""
        def update():
            status_symbol = "✓" if success else "✗"
            log_line = f"Voice [{parsed.intent}] '{parsed.raw_text}' -> {status_symbol} {message}"
            self._add_log(log_line)
            if parsed.clarification_needed and parsed.clarification_question:
                self._add_log(f"Clarification: {parsed.clarification_question}")
        self.root.after(0, update)

    def _on_voice_status_update(self, status_text: str):
        """Thread-safe voice status update."""
        def update():
            self.lbl_voice_status.config(text=status_text)
        self.root.after(0, update)

    def _on_text_command_submit(self):
        """Handle manual text command execution."""
        text = self.txt_command_input.get().strip()
        if not text:
            return
        self.txt_command_input.delete(0, tk.END)
        parsed, success, message = self.voice_ctrl.handle_text_command(text)
        self._add_log(f"Typed [{parsed.intent}] '{text}' -> {'✓' if success else '✗'} {message}")

    # ================= WEBCAM STREAM & DISPLAY LOOP =================
    def _start_camera_stream(self):
        """Initialize camera capture in background."""
        if not HAS_PIL_CV:
            return
            
        try:
            # On Windows, DirectShow starts instantly compared to MSMF
            if sys.platform == "win32" and hasattr(cv2, "CAP_DSHOW"):
                self.cap = cv2.VideoCapture(self.gesture_config.camera_id, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(self.gesture_config.camera_id)
            else:
                self.cap = cv2.VideoCapture(self.gesture_config.camera_id)

            if not self.cap.isOpened():
                raise RuntimeError(f"Webcam (device {self.gesture_config.camera_id}) could not be opened. Check privacy permissions.")

            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.gesture_config.camera_width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.gesture_config.camera_height)
            self.is_camera_running = True
            
            # Start UI refresh loop
            self._update_video_feed()
        except Exception as e:
            logger.error(f"Failed to open webcam: {e}")
            self._add_log(f"Camera open error: {e}")

    def _update_video_feed(self):
        """Fetch frame, process gestures, and render to canvas."""
        if not self.is_camera_running or self.cap is None:
            return

        ret, frame = self.cap.read()
        if ret and frame is not None:
            # Process gesture tracking & render HUD
            hud_frame, status = self.gesture_ctrl.process_frame(frame)
            
            # Update telemetry labels
            if status["hand_detected"]:
                self.lbl_tracking_status.config(text="Hand: Tracking Active", fg="#34D399")
            else:
                self.lbl_tracking_status.config(text="Hand: Searching...", fg="#F59E0B")
                
            self.lbl_gesture_action.config(text=f"Action: {status['gesture']}")

            # Convert OpenCV frame to Tkinter PhotoImage
            try:
                # Resize to fit canvas dimensions while maintaining aspect ratio
                canvas_w = max(100, self.video_canvas.winfo_width())
                canvas_h = max(100, self.video_canvas.winfo_height())
                
                rgb_frame = cv2.cvtColor(hud_frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(rgb_frame)
                img = img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
                
                self.photo = ImageTk.PhotoImage(image=img)
                self.video_canvas.create_image(0, 0, image=self.photo, anchor=tk.NW)
            except Exception as e:
                logger.debug(f"Video render frame error: {e}")

        # Schedule next frame (~30 FPS)
        if self.is_camera_running:
            self.root.after(30, self._update_video_feed)

    def on_close(self):
        """Cleanup resources on app exit."""
        self.emergency_stop()
        self.is_camera_running = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
        self.root.destroy()


def main():
    root = tk.Tk()
    app = TouchFreeApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
