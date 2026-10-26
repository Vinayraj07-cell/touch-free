"""
Touch-Free Computer Controller - Voice Controller Module
Listens for spoken natural language commands in a non-blocking background thread,
converts speech to text via SpeechRecognition, parses intent with RuleBasedNLPProcessor,
and executes safe actions on ComputerController.
"""

import time
import logging
import threading
from typing import Callable, Optional, Dict, Any

# Setup logger
logger = logging.getLogger("VoiceController")

try:
    import speech_recognition as sr
    HAS_SPEECH_RECOGNITION = True
except ImportError:
    HAS_SPEECH_RECOGNITION = False
    logger.warning("speech_recognition not installed.")

from config import DEFAULT_VOICE_CONFIG, VoiceConfig
from nlp_processor import RuleBasedNLPProcessor, ParsedCommand, IntentType
from computer_actions import ComputerController


class VoiceController:
    """Non-blocking background voice command listener and dispatcher."""

    def __init__(
        self,
        computer: ComputerController,
        nlp: RuleBasedNLPProcessor,
        config: Optional[VoiceConfig] = None,
        on_command_callback: Optional[Callable[[ParsedCommand, bool, str], None]] = None,
        on_status_callback: Optional[Callable[[str], None]] = None
    ):
        self.computer = computer
        self.nlp = nlp
        self.config = config or DEFAULT_VOICE_CONFIG
        self.on_command_callback = on_command_callback
        self.on_status_callback = on_status_callback
        
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.recognizer: Optional[Any] = None
        self.microphone: Optional[Any] = None
        
        # External hook for gesture control toggle via voice
        self.gesture_toggle_callback: Optional[Callable[[bool], None]] = None
        self.master_stop_callback: Optional[Callable[[], None]] = None
        self.master_resume_callback: Optional[Callable[[], None]] = None

    def start(self) -> bool:
        """Start listening thread."""
        if not HAS_SPEECH_RECOGNITION:
            logger.error("Cannot start VoiceController: SpeechRecognition is not installed.")
            self._update_status("Error: speech_recognition library missing.")
            return False

        if self.is_running:
            return True

        try:
            self.recognizer = sr.Recognizer()
            self.recognizer.energy_threshold = self.config.energy_threshold
            self.recognizer.dynamic_energy_threshold = self.config.dynamic_energy_threshold
            self.recognizer.pause_threshold = self.config.pause_threshold
            
            # Test default microphone access
            self.microphone = sr.Microphone()
            self.is_running = True
            
            self.thread = threading.Thread(target=self._listen_loop, daemon=True)
            self.thread.start()
            
            logger.info("VoiceController listening thread started.")
            self._update_status("Voice Active: Listening for commands...")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize microphone: {e}")
            self._update_status(f"Mic Error: {e}")
            self.is_running = False
            return False

    def stop(self) -> None:
        """Stop listening thread."""
        self.is_running = False
        self._update_status("Voice Inactive")
        logger.info("VoiceController stopped.")

    def _update_status(self, text: str) -> None:
        """Helper to safely notify status listener."""
        if self.on_status_callback:
            try:
                self.on_status_callback(text)
            except Exception as e:
                logger.debug(f"Status callback error: {e}")

    def execute_parsed_command(self, parsed: ParsedCommand) -> Tuple[bool, str]:
        """Dispatch ParsedCommand to the appropriate ComputerController action."""
        intent = parsed.intent
        params = parsed.parameters
        
        if parsed.clarification_needed:
            return False, parsed.clarification_question or "Clarification needed."

        try:
            # 1. Master Stop / Emergency Stop
            if intent == IntentType.STOP_ALL:
                self.computer.emergency_stop()
                if self.master_stop_callback:
                    self.master_stop_callback()
                return True, "Emergency Stop activated."

            if intent == IntentType.RESUME_ALL:
                self.computer.reset_emergency_stop()
                if self.master_resume_callback:
                    self.master_resume_callback()
                return True, "All controls resumed."

            # 2. Gesture Controller Toggle
            if intent == IntentType.STOP_GESTURE:
                if self.gesture_toggle_callback:
                    self.gesture_toggle_callback(False)
                return True, "Gesture control stopped."

            if intent == IntentType.START_GESTURE:
                if self.gesture_toggle_callback:
                    self.gesture_toggle_callback(True)
                return True, "Gesture control enabled."

            # 3. Voice Controller Self-Toggle
            if intent == IntentType.STOP_VOICE:
                self.stop()
                return True, "Voice control disabled."

            # 4. Open Application
            if intent == IntentType.OPEN_APP:
                app_name = params.get("app", "")
                return self.computer.launch_application(app_name)

            # 5. Volume Controls
            if intent == IntentType.SET_VOLUME:
                level = params.get("level", 50)
                return self.computer.set_volume(level)

            if intent == IntentType.INCREASE_VOLUME:
                delta = params.get("delta", 10)
                return self.computer.adjust_volume(delta)

            if intent == IntentType.DECREASE_VOLUME:
                delta = params.get("delta", -10)
                return self.computer.adjust_volume(delta)

            if intent == IntentType.MUTE_VOLUME:
                return self.computer.set_volume(0)

            if intent == IntentType.UNMUTE_VOLUME:
                return self.computer.set_volume(50)

            # 6. Screenshot
            if intent == IntentType.TAKE_SCREENSHOT:
                return self.computer.take_screenshot()

            # 7. Scrolling
            if intent == IntentType.SCROLL_UP:
                amount = params.get("amount", 300)
                success = self.computer.scroll(amount)
                return success, f"Scrolled up ({amount})"

            if intent == IntentType.SCROLL_DOWN:
                amount = params.get("amount", -300)
                success = self.computer.scroll(amount)
                return success, f"Scrolled down ({abs(amount)})"

            # 8. Keyboard Key Press
            if intent == IntentType.PRESS_KEY:
                key = params.get("key", "enter")
                return self.computer.press_key(key)

            # 9. Clipboard
            if intent == IntentType.COPY_TEXT:
                return self.computer.copy_selection()

            if intent == IntentType.PASTE_TEXT:
                return self.computer.paste_selection()

            return False, f"Unhandled intent: {intent}"

        except Exception as e:
            err = f"Action execution error: {e}"
            logger.error(err)
            return False, err

    def handle_text_command(self, text_input: str) -> Tuple[ParsedCommand, bool, str]:
        """Directly parse and execute a typed text command as an alternative to voice."""
        parsed = self.nlp.process(text_input)
        success, message = self.execute_parsed_command(parsed)
        
        if self.on_command_callback:
            self.on_command_callback(parsed, success, message)
            
        return parsed, success, message

    def _listen_loop(self) -> None:
        """Continuous background listening loop running in separate worker thread."""
        logger.info("Adjusting for ambient noise...")
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(
                    source,
                    duration=self.config.ambient_noise_adjustment_sec
                )
        except Exception as e:
            logger.warning(f"Could not adjust for ambient noise: {e}")

        logger.info("Voice listener ready and running.")
        self._update_status("Listening...")

        while self.is_running:
            try:
                with self.microphone as source:
                    # Non-blocking audio capture
                    self._update_status("Listening...")
                    audio = self.recognizer.listen(
                        source,
                        timeout=3.0,
                        phrase_time_limit=self.config.phrase_time_limit
                    )
                
                # Speech detected, recognize via Google Speech API
                self._update_status("Processing speech...")
                try:
                    transcript = self.recognizer.recognize_google(
                        audio,
                        language=self.config.language
                    )
                    logger.info(f"Recognized Speech: '{transcript}'")
                    
                    # Parse with rule-based NLP
                    parsed = self.nlp.process(transcript)
                    
                    # Execute
                    success, exec_msg = self.execute_parsed_command(parsed)
                    
                    # Notify callback
                    if self.on_command_callback:
                        self.on_command_callback(parsed, success, exec_msg)
                        
                except sr.UnknownValueError:
                    # Speech unintelligible
                    logger.debug("Speech unintelligible.")
                except sr.RequestError as re:
                    err = f"Speech API error: {re}"
                    logger.error(err)
                    self._update_status("Speech Service Network Error")
                    time.sleep(1.0)
                    
            except sr.WaitTimeoutError:
                # Silence timeout, continue listening
                pass
            except Exception as e:
                if self.is_running:
                    logger.warning(f"Voice loop exception: {e}")
                    time.sleep(0.5)

        self._update_status("Voice Stopped")
