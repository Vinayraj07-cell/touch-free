"""
Touch-Free Computer Controller - Image Processor Module
Handles OpenCV frame manipulation, horizontal mirroring, coordinate mapping,
and visual HUD feedback for hand tracking.
"""

import time
from typing import Tuple, Optional, List, Any

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    cv2 = None

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    np = None


class ImageProcessor:
    """Preprocesses camera frames and renders visual overlays for gestures."""

    def __init__(self, screen_width: int = 1920, screen_height: int = 1080):
        self.screen_width = screen_width
        self.screen_height = screen_height
        
        # FPS calculation
        self.prev_time = time.time()
        self.fps = 0.0
        self.frame_count = 0
        self.fps_update_interval = 0.5  # update every 500ms
        self.last_fps_calc_time = time.time()

    def process_frame(self, frame: Any) -> Any:
        """Flip frame horizontally for natural mirror view."""
        if frame is None:
            return frame
        # cv2.flip with 1 flips around y-axis (horizontal mirror)
        return cv2.flip(frame, 1)

    def calculate_fps(self) -> float:
        """Compute smoothed frames per second."""
        current_time = time.time()
        self.frame_count += 1
        elapsed = current_time - self.last_fps_calc_time
        if elapsed >= self.fps_update_interval:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.last_fps_calc_time = current_time
        return self.fps

    def map_coordinates_to_screen(
        self,
        norm_x: float,
        norm_y: float,
        margin_x: float = 0.15,
        margin_y: float = 0.20
    ) -> Tuple[int, int]:
        """
        Map normalized hand landmark coordinates [0.0, 1.0] to screen pixel coordinates.
        Uses inner active margin box so users don't have to stretch out of camera view.
        """
        # Clamp within active margin box
        clamped_x = max(margin_x, min(1.0 - margin_x, norm_x))
        clamped_y = max(margin_y, min(1.0 - margin_y, norm_y))
        
        # Scale active box to [0.0, 1.0]
        norm_screen_x = (clamped_x - margin_x) / (1.0 - 2.0 * margin_x)
        norm_screen_y = (clamped_y - margin_y) / (1.0 - 2.0 * margin_y)
        
        # Convert to screen pixels
        screen_x = int(norm_screen_x * self.screen_width)
        screen_y = int(norm_screen_y * self.screen_height)
        
        return screen_x, screen_y

    def draw_hud(
        self,
        frame: Any,
        hand_detected: bool,
        gesture_name: str,
        margin_x: float = 0.15,
        margin_y: float = 0.20,
        index_pos: Optional[Tuple[int, int]] = None,
        thumb_pos: Optional[Tuple[int, int]] = None,
        is_pinching: bool = False,
        is_dragging: bool = False
    ) -> Any:
        """Render HUD indicators, active area boundary, and state feedback."""
        h, w, _ = frame.shape
        hud_frame = frame.copy()

        # 1. Draw Active Tracking Box (Safe Margin Area)
        min_x = int(margin_x * w)
        max_x = int((1.0 - margin_x) * w)
        min_y = int(margin_y * h)
        max_y = int((1.0 - margin_y) * h)
        
        # Border box with subtle rounded corners appearance
        cv2.rectangle(hud_frame, (min_x, min_y), (max_x, max_y), (80, 80, 80), 1)
        cv2.putText(
            hud_frame,
            "ACTIVE ZONE",
            (min_x + 8, min_y + 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (150, 150, 150),
            1,
            cv2.LINE_AA
        )

        # 2. Draw Pinch connection line if both index and thumb detected
        if index_pos and thumb_pos:
            line_color = (0, 255, 120) if is_pinching else (255, 200, 0)
            thickness = 3 if is_pinching else 1
            cv2.line(hud_frame, index_pos, thumb_pos, line_color, thickness)
            
            # Draw fingertip rings
            cv2.circle(hud_frame, index_pos, 8, (0, 165, 255), -1 if is_pinching else 2)
            cv2.circle(hud_frame, thumb_pos, 6, (255, 120, 0), -1 if is_pinching else 2)

        # 3. Status text in top-left banner
        status_bg_color = (30, 30, 30)
        cv2.rectangle(hud_frame, (10, 10), (280, 75), status_bg_color, -1)
        cv2.rectangle(hud_frame, (10, 10), (280, 75), (60, 60, 60), 1)

        fps = self.calculate_fps()
        fps_text = f"FPS: {fps:.1f}"
        cv2.putText(hud_frame, fps_text, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1, cv2.LINE_AA)

        # Tracking status
        if hand_detected:
            track_color = (50, 220, 100)
            track_str = "TRACKING ACTIVE"
        else:
            track_color = (80, 80, 220)
            track_str = "NO HAND DETECTED"
            
        cv2.putText(hud_frame, track_str, (100, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, track_color, 1, cv2.LINE_AA)

        # Current Gesture / State
        state_str = f"Action: {gesture_name}"
        if is_dragging:
            state_str = "Action: DRAGGING"
        cv2.putText(hud_frame, state_str, (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

        return hud_frame
