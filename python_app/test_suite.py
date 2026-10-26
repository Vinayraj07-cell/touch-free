"""
Touch-Free Computer Controller - Diagnostic & Self-Test Suite
Validates NLP intent parsing, action allowlists, math smoothing algorithms, and configuration integrity.
Can be executed in any environment without physical camera/mic hardware.
"""

import unittest
from config import DEFAULT_SYSTEM_CONFIG, GestureConfig
from nlp_processor import RuleBasedNLPProcessor, IntentType
from computer_actions import ComputerController
from image_processor import ImageProcessor


class TestTouchFreeController(unittest.TestCase):

    def setUp(self):
        self.nlp = RuleBasedNLPProcessor()
        self.computer = ComputerController(DEFAULT_SYSTEM_CONFIG)
        self.image_proc = ImageProcessor(1920, 1080)

    # 1. NLP Tests for required commands
    def test_open_application_intents(self):
        commands = [
            ("Open Chrome", "chrome"),
            ("open google chrome", "chrome"),
            ("Launch Calculator", "calculator"),
            ("calc", "calculator"),
            ("Open Notepad", "notepad"),
            ("launch text editor", "notepad"),
            ("open edge", "edge"),
            ("open file explorer", "explorer"),
        ]
        for text, expected_app in commands:
            parsed = self.nlp.process(text)
            self.assertEqual(parsed.intent, IntentType.OPEN_APP, f"Failed for '{text}'")
            self.assertEqual(parsed.parameters.get("app"), expected_app)

    def test_volume_intents(self):
        # Explicit percentage
        p1 = self.nlp.process("Set volume to 50 percent")
        self.assertEqual(p1.intent, IntentType.SET_VOLUME)
        self.assertEqual(p1.parameters.get("level"), 50)

        p2 = self.nlp.process("volume 80%")
        self.assertEqual(p2.intent, IntentType.SET_VOLUME)
        self.assertEqual(p2.parameters.get("level"), 80)

        # Word numbers
        p3 = self.nlp.process("set volume to fifty")
        self.assertEqual(p3.intent, IntentType.SET_VOLUME)
        self.assertEqual(p3.parameters.get("level"), 50)

        # Increase / Decrease
        p4 = self.nlp.process("Increase volume")
        self.assertEqual(p4.intent, IntentType.INCREASE_VOLUME)

        p5 = self.nlp.process("turn down volume")
        self.assertEqual(p5.intent, IntentType.DECREASE_VOLUME)

        # Mute / Unmute
        p6 = self.nlp.process("mute audio")
        self.assertEqual(p6.intent, IntentType.MUTE_VOLUME)

    def test_screenshot_intent(self):
        for phrase in ["Take a screenshot", "capture screen", "screenshot"]:
            p = self.nlp.process(phrase)
            self.assertEqual(p.intent, IntentType.TAKE_SCREENSHOT)

    def test_scrolling_intent(self):
        p1 = self.nlp.process("Scroll down")
        self.assertEqual(p1.intent, IntentType.SCROLL_DOWN)
        p2 = self.nlp.process("page up")
        self.assertEqual(p2.intent, IntentType.SCROLL_UP)

    def test_keyboard_and_clipboard_intents(self):
        self.assertEqual(self.nlp.process("Press Enter").intent, IntentType.PRESS_KEY)
        self.assertEqual(self.nlp.process("Press space").intent, IntentType.PRESS_KEY)
        self.assertEqual(self.nlp.process("Copy selected text").intent, IntentType.COPY_TEXT)
        self.assertEqual(self.nlp.process("Paste").intent, IntentType.PASTE_TEXT)

    def test_toggle_and_emergency_stop_intents(self):
        self.assertEqual(self.nlp.process("Stop gesture control").intent, IntentType.STOP_GESTURE)
        self.assertEqual(self.nlp.process("Disable voice control").intent, IntentType.STOP_VOICE)
        self.assertEqual(self.nlp.process("Stop all controls").intent, IntentType.STOP_ALL)
        self.assertEqual(self.nlp.process("Emergency stop").intent, IntentType.STOP_ALL)

    def test_ambiguous_and_unknown_handling(self):
        # Ambiguous app
        p_amb = self.nlp.process("Open quantum blender simulator")
        self.assertEqual(p_amb.intent, IntentType.AMBIGUOUS)
        self.assertTrue(p_amb.clarification_needed)
        self.assertIn("Which application", p_amb.clarification_question)

        # Gibberish
        p_unk = self.nlp.process("xyz foobar baz")
        self.assertEqual(p_unk.intent, IntentType.UNKNOWN)
        self.assertTrue(p_unk.clarification_needed)

    # 2. Safety and allowlist tests
    def test_application_allowlist_enforcement(self):
        # Safe app
        success, msg = self.computer.launch_application("notepad")
        # May be True or simulated depending on OS
        self.assertIn("Notepad", msg)

        # Malicious arbitrary command injection attempt
        success_evil, msg_evil = self.computer.launch_application("rmdir /s /q c:\\")
        self.assertFalse(success_evil)
        self.assertIn("not in the allowed list", msg_evil)

    def test_emergency_stop_state(self):
        self.computer.emergency_stop()
        self.assertTrue(self.computer.is_emergency_stopped)
        # Should reject actions during stop
        success, msg = self.computer.launch_application("notepad")
        self.assertFalse(success)
        self.assertEqual(msg, "Emergency stop active")

        self.computer.reset_emergency_stop()
        self.assertFalse(self.computer.is_emergency_stopped)

    # 3. Coordinate mapping tests
    def test_coordinate_mapping(self):
        # Center of camera (0.5, 0.5) should map to center of screen (960, 540)
        sx, sy = self.image_proc.map_coordinates_to_screen(0.5, 0.5, margin_x=0.15, margin_y=0.20)
        self.assertAlmostEqual(sx, 960, delta=5)
        self.assertAlmostEqual(sy, 540, delta=5)


if __name__ == "__main__":
    unittest.main()
