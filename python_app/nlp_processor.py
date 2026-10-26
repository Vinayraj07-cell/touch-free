"""
Touch-Free Computer Controller - Rule-Based NLP Processor
Parses natural language speech and text into structured intents and parameters.
Handles command variations, typos, synonyms, and requests clarification if ambiguous.
"""

import re
from dataclasses import dataclass
from typing import Optional, Dict, Any, List


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
    """Lightweight deterministic intent parser for hands-free computer control."""

    def __init__(self):
        # Known application keywords mapped to internal alias
        self.app_aliases = {
            "chrome": "chrome",
            "google chrome": "chrome",
            "browser": "chrome",
            "calculator": "calculator",
            "calc": "calculator",
            "notepad": "notepad",
            "text editor": "notepad",
            "editor": "notepad",
            "explorer": "explorer",
            "file explorer": "explorer",
            "files": "explorer",
            "edge": "edge",
            "microsoft edge": "edge",
            "paint": "paint",
            "settings": "settings",
            "task manager": "task manager",
            "terminal": "terminal",
            "command prompt": "cmd",
            "cmd": "cmd",
        }

        # Number words mapping
        self.word_to_num = {
            "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
            "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
            "hundred": 100, "half": 50, "max": 100, "maximum": 100, "full": 100,
            "min": 0, "minimum": 0
        }

    def clean_text(self, text: str) -> str:
        """Strip punctuation and normalize spacing."""
        cleaned = re.sub(r"[^\w\s%]", " ", text.lower())
        return " ".join(cleaned.split())

    def extract_percentage(self, text: str) -> Optional[int]:
        """Extract a volume percentage (0-100) from text like '50 percent' or 'volume to 75%'."""
        # 1. Look for digits e.g., '50%', '50 percent', 'to 50'
        match = re.search(r"(\d{1,3})\s*(%|percent)?", text)
        if match:
            val = int(match.group(1))
            return max(0, min(100, val))

        # 2. Look for word numbers e.g. "fifty percent"
        for word, val in self.word_to_num.items():
            if re.search(rf"\b{word}\b", text):
                return val

        return None

    def process(self, raw_input: str) -> ParsedCommand:
        """Parse raw speech or text and return structured ParsedCommand."""
        if not raw_input or not raw_input.strip():
            return ParsedCommand(
                raw_text="",
                intent=IntentType.UNKNOWN,
                parameters={},
                confidence=0.0,
                feedback_message="No command received."
            )

        text = self.clean_text(raw_input)

        # 1. Emergency stop / Stop all controls
        if any(p in text for p in ["stop all controls", "stop all", "pause all", "emergency stop", "halt system", "freeze"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.STOP_ALL,
                parameters={},
                confidence=1.0,
                feedback_message="Emergency Stop: All controls halted immediately."
            )

        if any(p in text for p in ["resume all controls", "resume all", "start all", "unpause all", "resume control"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.RESUME_ALL,
                parameters={},
                confidence=0.95,
                feedback_message="Resuming all controls."
            )

        # 2. Gesture Toggle
        if any(p in text for p in ["stop gesture control", "disable gesture", "stop gestures", "turn off gesture", "disable hand tracking"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.STOP_GESTURE,
                parameters={},
                confidence=0.95,
                feedback_message="Disabling gesture control."
            )
        if any(p in text for p in ["start gesture control", "enable gesture", "turn on gesture", "enable hand tracking", "start gestures"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.START_GESTURE,
                parameters={},
                confidence=0.95,
                feedback_message="Enabling gesture control."
            )

        # 3. Voice Toggle
        if any(p in text for p in ["disable voice control", "stop voice control", "turn off voice", "mute microphone", "stop listening"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.STOP_VOICE,
                parameters={},
                confidence=0.95,
                feedback_message="Disabling voice controller."
            )

        # 4. Screenshot
        if any(p in text for p in ["take a screenshot", "take screenshot", "capture screen", "screenshot", "save screen"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.TAKE_SCREENSHOT,
                parameters={},
                confidence=0.95,
                feedback_message="Taking screenshot..."
            )

        # 5. Volume controls
        if "volume" in text or "sound" in text or "audio" in text:
            # Set explicit percentage
            if any(w in text for w in ["set", "to", "at", "%", "percent", "put"]):
                pct = self.extract_percentage(text)
                if pct is not None:
                    return ParsedCommand(
                        raw_text=raw_input,
                        intent=IntentType.SET_VOLUME,
                        parameters={"level": pct},
                        confidence=0.95,
                        feedback_message=f"Setting volume to {pct}%"
                    )

            if any(w in text for w in ["increase", "turn up", "raise", "louder", "boost", "up"]):
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.INCREASE_VOLUME,
                    parameters={"delta": 10},
                    confidence=0.9,
                    feedback_message="Increasing volume."
                )

            if any(w in text for w in ["decrease", "turn down", "lower", "quieter", "softer", "down"]):
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.DECREASE_VOLUME,
                    parameters={"delta": -10},
                    confidence=0.9,
                    feedback_message="Decreasing volume."
                )

            if "mute" in text and "unmute" not in text:
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.MUTE_VOLUME,
                    parameters={},
                    confidence=0.9,
                    feedback_message="Muting audio."
                )

            if "unmute" in text:
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.UNMUTE_VOLUME,
                    parameters={},
                    confidence=0.9,
                    feedback_message="Unmuting audio."
                )

        # 6. Scrolling
        if "scroll down" in text or "page down" in text:
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.SCROLL_DOWN,
                parameters={"amount": -300},
                confidence=0.95,
                feedback_message="Scrolling down."
            )
        if "scroll up" in text or "page up" in text:
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.SCROLL_UP,
                parameters={"amount": 300},
                confidence=0.95,
                feedback_message="Scrolling up."
            )

        # 7. Keyboard Actions (Enter, Space, Escape)
        if "press enter" in text or "hit enter" in text or text == "enter":
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.PRESS_KEY,
                parameters={"key": "enter"},
                confidence=0.95,
                feedback_message="Pressing Enter."
            )
        if "press space" in text or "hit space" in text or "spacebar" in text:
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.PRESS_KEY,
                parameters={"key": "space"},
                confidence=0.95,
                feedback_message="Pressing Space."
            )
        if "press escape" in text or "hit escape" in text or "press esc" in text:
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.PRESS_KEY,
                parameters={"key": "escape"},
                confidence=0.95,
                feedback_message="Pressing Escape."
            )

        # 8. Clipboard Actions (Copy & Paste)
        if any(p in text for p in ["copy selected text", "copy this", "copy selection", "copy"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.COPY_TEXT,
                parameters={},
                confidence=0.9,
                feedback_message="Copying text to clipboard."
            )
        if any(p in text for p in ["paste", "paste text", "paste here", "paste clipboard"]):
            return ParsedCommand(
                raw_text=raw_input,
                intent=IntentType.PASTE_TEXT,
                parameters={},
                confidence=0.9,
                feedback_message="Pasting clipboard contents."
            )

        # 9. Application Launching (Open Chrome, Open Notepad, etc.)
        if any(w in text for w in ["open", "launch", "start", "run"]):
            matched_app = None
            for alias, target in self.app_aliases.items():
                if alias in text:
                    matched_app = target
                    break
            
            if matched_app:
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.OPEN_APP,
                    parameters={"app": matched_app},
                    confidence=0.95,
                    feedback_message=f"Opening {matched_app.title()}..."
                )
            else:
                # User asked to open something not recognized or ambiguous
                words_after = text.replace("open", "").replace("launch", "").replace("start", "").strip()
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.AMBIGUOUS,
                    parameters={"candidate": words_after},
                    confidence=0.4,
                    clarification_needed=True,
                    clarification_question=f"Which application did you mean by '{words_after}'? Supported: Chrome, Calculator, Notepad, Edge, Explorer.",
                    feedback_message=f"Ambiguous application '{words_after}'. Please specify."
                )

        # Check direct app names spoken alone without "open", e.g. "Calculator", "Chrome", "Notepad"
        for alias, target in self.app_aliases.items():
            if text == alias:
                return ParsedCommand(
                    raw_text=raw_input,
                    intent=IntentType.OPEN_APP,
                    parameters={"app": target},
                    confidence=0.85,
                    feedback_message=f"Opening {target.title()}..."
                )

        # 10. Fallback: Check if ambiguous or unsupported
        return ParsedCommand(
            raw_text=raw_input,
            intent=IntentType.UNKNOWN,
            parameters={},
            confidence=0.0,
            clarification_needed=True,
            clarification_question=f"Command '{raw_input}' was not recognized. Say 'open chrome', 'increase volume', 'scroll down', or 'take screenshot'.",
            feedback_message=f"Unrecognized command: '{raw_input}'"
        )
