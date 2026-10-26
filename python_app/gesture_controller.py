"""
Touch-Free Computer Controller - Gesture Controller Module
Detects hand landmarks using MediaPipe, tracks fingertip positions, smooths cursor motion,
and detects gestures: Point/Move, Left Click Pinch, Right Click Pinch, Drag-and-Drop, and Scrolling.
"""

import math
import time
import logging
from typing import Tuple, Optional, Dict, Any, List

import numpy as np

# Setup logger
logger = logging.getLogger("GestureController")

# Try importing MediaPipe and OpenCV
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    logger.warning("OpenCV (cv2) not installed.")

try:
    import mediapipe as mp
    mp_hands = mp.solutions.hands
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles
    HAS_MEDIAPIPE = True
except (ImportError, AttributeError) as e:
    HAS_MEDIAPIPE = False
    logger.warning(f"MediaPipe hands solution unavailable: {e}")

from config import DEFAULT_GESTURE_CONFIG, GestureConfig
from image_processor import ImageProcessor
from computer_actions import ComputerController


class GestureController:
    """Manages hand tracking loop, gesture recognition state machine, and computer input mapping."""

    def __init__(
        self,
        computer: ComputerController,
        image_proc: ImageProcessor,
        config: Optional[GestureConfig] = None
    ):
        self.computer = computer
        self.image_proc = image_proc
        self.config = config or DEFAULT_GESTURE_CONFIG
        
        # State Flags
        self.is_enabled = False
        self.hand_detected = False
        self.current_gesture = "Idle"
        
        # Cursor smoothing state
        self.smoothed_x = 0.0
        self.smoothed_y = 0.0
        self.has_prev_pos = False
        
        # Pinch / Click state machine
        self.pinch_start_time: Optional[float] = None
        self.is_pinching = False
        self.is_dragging = False
        self.last_click_time = 0.0
        self.last_right_click_time = 0.0
        
        # Scroll state tracking
        self.scroll_anchor_y: Optional[float] = None
        self.last_scroll_time = 0.0
        
        # MediaPipe instance (initialized when enabled)
        self.hands_detector = None

    def start(self) -> bool:
        """Initialize MediaPipe Hands and enable tracking."""
        if not HAS_MEDIAPIPE:
            logger.error("Cannot start GestureController: MediaPipe is not installed.")
            return False

        try:
            self.hands_detector = mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=1,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.6,
                model_complexity=0  # Lightweight for low latency
            )
            self.is_enabled = True
            self.has_prev_pos = False
            logger.info("GestureController successfully started.")
            return True
        except Exception as e:
            logger.error(f"Failed to start MediaPipe Hands: {e}")
            return False

    def stop(self) -> None:
        """Disable tracking and release detector resources."""
        self.is_enabled = False
        if self.is_dragging:
            self.computer.mouse_up()
            self.is_dragging = False
            
        if self.hands_detector:
            try:
                self.hands_detector.close()
            except Exception:
                pass
            self.hands_detector = None
            
        self.hand_detected = False
        self.current_gesture = "Disabled"
        self.has_prev_pos = False
        logger.info("GestureController stopped.")

    def calculate_distance(self, p1: Any, p2: Any) -> float:
        """Euclidean distance between two landmarks (normalized coordinates)."""
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    def is_finger_extended(self, landmarks: List[Any], tip_idx: int, pip_idx: int) -> bool:
        """Check if a finger is extended by comparing tip y-position to pip y-position (relative to wrist)."""
        # In inverted/normal coords, extended finger tip is further from wrist (idx 0) than PIP
        wrist = landmarks[0]
        tip_dist = math.hypot(landmarks[tip_idx].x - wrist.x, landmarks[tip_idx].y - wrist.y)
        pip_dist = math.hypot(landmarks[pip_idx].x - wrist.x, landmarks[pip_idx].y - wrist.y)
        return tip_dist > pip_dist * 1.15

    def process_frame(self, frame_bgr: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Processes a single video frame:
        1. Preprocesses & mirrors frame
        2. Detects hand landmarks
        3. Identifies gestures
        4. Dispatches computer actions
        5. Renders HUD overlays
        """
        status: Dict[str, Any] = {
            "hand_detected": False,
            "gesture": "Idle",
            "is_pinching": False,
            "is_dragging": False,
            "cursor_pos": (0, 0),
        }

        # 1. Flip horizontally for natural mirror view
        frame_mirrored = self.image_proc.process_frame(frame_bgr)
        h, w, _ = frame_mirrored.shape

        if not self.is_enabled or self.hands_detector is None:
            hud_frame = self.image_proc.draw_hud(
                frame_mirrored,
                hand_detected=False,
                gesture_name="Disabled"
            )
            return hud_frame, status

        # 2. Convert to RGB for MediaPipe
        frame_rgb = cv2.cvtColor(frame_mirrored, cv2.COLOR_BGR2RGB)
        results = self.hands_detector.process(frame_rgb)

        index_pixel_pos = None
        thumb_pixel_pos = None

        if results.multi_hand_landmarks:
            self.hand_detected = True
            status["hand_detected"] = True
            hand_landmarks = results.multi_hand_landmarks[0]
            landmarks = hand_landmarks.landmark

            # Draw standard skeleton connections with custom subtle colors
            mp_drawing.draw_landmarks(
                frame_mirrored,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(40, 40, 40), thickness=1, circle_radius=1),
                mp_drawing.DrawingSpec(color=(0, 200, 255), thickness=2, circle_radius=2),
            )

            # Key landmarks:
            # 0: Wrist
            # 4: Thumb Tip
            # 8: Index Fingertip
            # 12: Middle Fingertip
            # 16: Ring Fingertip
            # 20: Pinky Fingertip
            wrist = landmarks[0]
            thumb_tip = landmarks[4]
            index_tip = landmarks[8]
            middle_tip = landmarks[12]
            ring_tip = landmarks[16]
            pinky_tip = landmarks[20]

            # Fingertip pixel positions for HUD
            index_pixel_pos = (int(index_tip.x * w), int(index_tip.y * h))
            thumb_pixel_pos = (int(thumb_tip.x * w), int(thumb_tip.y * h))

            # Reference hand scale (wrist to middle finger base MCP) for robust distance normalization
            hand_scale = math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y)
            if hand_scale < 0.05:
                hand_scale = 0.2  # safety fallback

            # Normalized pinch distances
            thumb_index_dist = self.calculate_distance(thumb_tip, index_tip) / hand_scale
            thumb_middle_dist = self.calculate_distance(thumb_tip, middle_tip) / hand_scale

            # Finger extension states
            index_extended = self.is_finger_extended(landmarks, 8, 6)
            middle_extended = self.is_finger_extended(landmarks, 12, 10)
            ring_extended = self.is_finger_extended(landmarks, 16, 14)
            pinky_extended = self.is_finger_extended(landmarks, 20, 18)

            current_time = time.time()

            # Map index fingertip to screen pixels
            target_screen_x, target_screen_y = self.image_proc.map_coordinates_to_screen(
                index_tip.x,
                index_tip.y,
                margin_x=self.config.margin_x,
                margin_y=self.config.margin_y
            )

            # Apply Cursor Smoothing (Exponential Moving Average + Deadzone)
            if not self.has_prev_pos:
                self.smoothed_x = float(target_screen_x)
                self.smoothed_y = float(target_screen_y)
                self.has_prev_pos = True
            else:
                dx = target_screen_x - self.smoothed_x
                dy = target_screen_y - self.smoothed_y
                dist_moved = math.hypot(dx, dy)

                if dist_moved > self.config.movement_deadzone:
                    alpha = self.config.smoothing_factor
                    self.smoothed_x = alpha * self.smoothed_x + (1.0 - alpha) * target_screen_x
                    self.smoothed_y = alpha * self.smoothed_y + (1.0 - alpha) * target_screen_y

            final_cursor_x = int(round(self.smoothed_x))
            final_cursor_y = int(round(self.smoothed_y))
            status["cursor_pos"] = (final_cursor_x, final_cursor_y)

            # ================= GESTURE CLASSIFIER =================

            # Gesture 1: Vertical Scrolling Gesture (Index & Middle extended together, Ring & Pinky curled)
            if index_extended and middle_extended and not ring_extended and not pinky_extended:
                self.current_gesture = "Scroll Mode"
                # Distance between index and middle fingertip is close
                index_mid_dist = self.calculate_distance(index_tip, middle_tip) / hand_scale
                if index_mid_dist < 0.25:
                    if self.scroll_anchor_y is None:
                        self.scroll_anchor_y = index_tip.y
                    else:
                        delta_y = self.scroll_anchor_y - index_tip.y
                        if abs(delta_y) > self.config.scroll_threshold:
                            if current_time - self.last_scroll_time > self.config.scroll_cooldown:
                                scroll_clicks = int(delta_y * 10 * self.config.scroll_distance_scale)
                                if scroll_clicks != 0:
                                    self.computer.scroll(scroll_clicks)
                                    self.last_scroll_time = current_time
                                    self.scroll_anchor_y = index_tip.y
                else:
                    self.scroll_anchor_y = None
            else:
                self.scroll_anchor_y = None

            # Gesture 2: Right Click (Thumb + Middle finger pinch)
            if thumb_middle_dist < (self.config.right_click_pinch_threshold * 1.8) and thumb_index_dist > 0.35:
                self.current_gesture = "Right Click"
                if current_time - self.last_right_click_time > self.config.click_cooldown:
                    self.computer.right_click()
                    self.last_right_click_time = current_time

            # Gesture 3 & 4: Left Click / Drag-and-Drop (Thumb + Index Pinch)
            is_thumb_index_pinched = thumb_index_dist < (self.config.pinch_threshold * 1.8)

            if is_thumb_index_pinched:
                self.is_pinching = True
                status["is_pinching"] = True

                if self.pinch_start_time is None:
                    self.pinch_start_time = current_time

                pinch_duration = current_time - self.pinch_start_time

                # Sustained pinch -> Drag & Drop
                if pinch_duration >= self.config.drag_hold_duration:
                    self.current_gesture = "Drag & Drop"
                    if not self.is_dragging:
                        self.computer.mouse_down()
                        self.is_dragging = True
                    # Move cursor during drag
                    self.computer.move_cursor(final_cursor_x, final_cursor_y)
                else:
                    self.current_gesture = "Pinching"
            else:
                # Pinch released
                if self.is_pinching:
                    if self.is_dragging:
                        # Drop
                        self.computer.mouse_up()
                        self.is_dragging = False
                        self.current_gesture = "Dropped"
                    else:
                        # Short pinch -> Left Click (with cooldown)
                        if current_time - self.last_click_time > self.config.click_cooldown:
                            self.computer.left_click()
                            self.last_click_time = current_time
                            self.current_gesture = "Left Click"

                self.is_pinching = False
                self.pinch_start_time = None

                # When not pinching or scrolling, standard cursor movement
                if self.current_gesture not in ["Right Click", "Scroll Mode"]:
                    self.current_gesture = "Pointing"
                    self.computer.move_cursor(final_cursor_x, final_cursor_y)

            status["is_dragging"] = self.is_dragging
            status["gesture"] = self.current_gesture

        else:
            # No hand detected in frame
            self.hand_detected = False
            self.current_gesture = "No Hand"
            self.has_prev_pos = False
            self.scroll_anchor_y = None
            
            # If hand suddenly disappears while dragging, safely drop
            if self.is_dragging:
                self.computer.mouse_up()
                self.is_dragging = False
                
            self.is_pinching = False
            self.pinch_start_time = None

        # 3. Render HUD Overlay
        hud_frame = self.image_proc.draw_hud(
            frame=frame_mirrored,
            hand_detected=self.hand_detected,
            gesture_name=self.current_gesture,
            margin_x=self.config.margin_x,
            margin_y=self.config.margin_y,
            index_pos=index_pixel_pos,
            thumb_pos=thumb_pixel_pos,
            is_pinching=self.is_pinching,
            is_dragging=self.is_dragging
        )

        return hud_frame, status
