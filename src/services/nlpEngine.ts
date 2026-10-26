/**
 * Client-side Rule-Based NLP Processor
 * Matches python_app/nlp_processor.py behavior exactly
 */

export interface ParsedCommand {
  rawText: string;
  intent: string;
  parameters: Record<string, any>;
  confidence: number;
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
  feedbackMessage: string;
}

export const IntentTypes = {
  OPEN_APP: 'OPEN_APP',
  SET_VOLUME: 'SET_VOLUME',
  INCREASE_VOLUME: 'INCREASE_VOLUME',
  DECREASE_VOLUME: 'DECREASE_VOLUME',
  MUTE_VOLUME: 'MUTE_VOLUME',
  UNMUTE_VOLUME: 'UNMUTE_VOLUME',
  TAKE_SCREENSHOT: 'TAKE_SCREENSHOT',
  SCROLL_UP: 'SCROLL_UP',
  SCROLL_DOWN: 'SCROLL_DOWN',
  PRESS_KEY: 'PRESS_KEY',
  COPY_TEXT: 'COPY_TEXT',
  PASTE_TEXT: 'PASTE_TEXT',
  STOP_GESTURE: 'STOP_GESTURE',
  START_GESTURE: 'START_GESTURE',
  STOP_VOICE: 'STOP_VOICE',
  STOP_ALL: 'STOP_ALL',
  RESUME_ALL: 'RESUME_ALL',
  UNKNOWN: 'UNKNOWN',
  AMBIGUOUS: 'AMBIGUOUS',
} as const;

const APP_ALIASES: Record<string, string> = {
  chrome: 'chrome',
  'google chrome': 'chrome',
  browser: 'chrome',
  calculator: 'calc',
  calc: 'calc',
  notepad: 'notepad',
  'text editor': 'notepad',
  editor: 'notepad',
  gallery: 'gallery',
  screenshots: 'gallery',
  'screenshot gallery': 'gallery',
  settings: 'settings',
  preferences: 'settings',
};

const WORD_TO_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, half: 50, max: 100, maximum: 100, full: 100,
  min: 0, minimum: 0,
};

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s%]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPercentage(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(%|percent)?/);
  if (match) {
    const val = parseInt(match[1], 10);
    return Math.max(0, Math.min(100, val));
  }
  for (const [word, val] of Object.entries(WORD_TO_NUM)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      return val;
    }
  }
  return null;
}

export function parseNaturalLanguageCommand(rawInput: string): ParsedCommand {
  if (!rawInput || !rawInput.trim()) {
    return {
      rawText: '',
      intent: IntentTypes.UNKNOWN,
      parameters: {},
      confidence: 0,
      clarificationNeeded: false,
      feedbackMessage: 'No command received.',
    };
  }

  const text = cleanText(rawInput);

  // 1. Emergency stop / Stop all controls
  if (['stop all controls', 'stop all', 'pause all', 'emergency stop', 'halt system', 'freeze'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.STOP_ALL,
      parameters: {},
      confidence: 1.0,
      clarificationNeeded: false,
      feedbackMessage: 'Emergency Stop: All controls halted immediately.',
    };
  }

  if (['resume all controls', 'resume all', 'start all', 'unpause all', 'resume control'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.RESUME_ALL,
      parameters: {},
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Resuming all controls.',
    };
  }

  // 2. Gesture Toggle
  if (['stop gesture control', 'disable gesture', 'stop gestures', 'turn off gesture', 'disable hand tracking'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.STOP_GESTURE,
      parameters: {},
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Disabling gesture control.',
    };
  }
  if (['start gesture control', 'enable gesture', 'turn on gesture', 'enable hand tracking', 'start gestures'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.START_GESTURE,
      parameters: {},
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Enabling gesture control.',
    };
  }

  // 3. Voice Toggle
  if (['disable voice control', 'stop voice control', 'turn off voice', 'mute microphone', 'stop listening'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.STOP_VOICE,
      parameters: {},
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Disabling voice controller.',
    };
  }

  // 4. Screenshot
  if (['take a screenshot', 'take screenshot', 'capture screen', 'screenshot', 'save screen'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.TAKE_SCREENSHOT,
      parameters: {},
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Taking desktop screenshot...',
    };
  }

  // 5. Volume controls
  if (text.includes('volume') || text.includes('sound') || text.includes('audio')) {
    if (['set', 'to', 'at', '%', 'percent', 'put'].some(w => text.includes(w))) {
      const pct = extractPercentage(text);
      if (pct !== null) {
        return {
          rawText: rawInput,
          intent: IntentTypes.SET_VOLUME,
          parameters: { level: pct },
          confidence: 0.95,
          clarificationNeeded: false,
          feedbackMessage: `Setting master volume to ${pct}%`,
        };
      }
    }

    if (['increase', 'turn up', 'raise', 'louder', 'boost', 'up'].some(w => text.includes(w))) {
      return {
        rawText: rawInput,
        intent: IntentTypes.INCREASE_VOLUME,
        parameters: { delta: 10 },
        confidence: 0.9,
        clarificationNeeded: false,
        feedbackMessage: 'Increasing master volume by 10%.',
      };
    }

    if (['decrease', 'turn down', 'lower', 'quieter', 'softer', 'down'].some(w => text.includes(w))) {
      return {
        rawText: rawInput,
        intent: IntentTypes.DECREASE_VOLUME,
        parameters: { delta: -10 },
        confidence: 0.9,
        clarificationNeeded: false,
        feedbackMessage: 'Decreasing master volume by 10%.',
      };
    }

    if (text.includes('mute') && !text.includes('unmute')) {
      return {
        rawText: rawInput,
        intent: IntentTypes.MUTE_VOLUME,
        parameters: {},
        confidence: 0.9,
        clarificationNeeded: false,
        feedbackMessage: 'Muting audio.',
      };
    }

    if (text.includes('unmute')) {
      return {
        rawText: rawInput,
        intent: IntentTypes.UNMUTE_VOLUME,
        parameters: {},
        confidence: 0.9,
        clarificationNeeded: false,
        feedbackMessage: 'Unmuting audio.',
      };
    }
  }

  // 6. Scrolling
  if (text.includes('scroll down') || text.includes('page down')) {
    return {
      rawText: rawInput,
      intent: IntentTypes.SCROLL_DOWN,
      parameters: { amount: 300 },
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Scrolling downwards.',
    };
  }
  if (text.includes('scroll up') || text.includes('page up')) {
    return {
      rawText: rawInput,
      intent: IntentTypes.SCROLL_UP,
      parameters: { amount: -300 },
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Scrolling upwards.',
    };
  }

  // 7. Keyboard Actions
  if (text.includes('press enter') || text.includes('hit enter') || text === 'enter') {
    return {
      rawText: rawInput,
      intent: IntentTypes.PRESS_KEY,
      parameters: { key: 'enter' },
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Pressing Enter.',
    };
  }
  if (text.includes('press space') || text.includes('hit space') || text === 'space') {
    return {
      rawText: rawInput,
      intent: IntentTypes.PRESS_KEY,
      parameters: { key: 'space' },
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Pressing Space.',
    };
  }
  if (text.includes('press escape') || text.includes('hit escape') || text === 'escape') {
    return {
      rawText: rawInput,
      intent: IntentTypes.PRESS_KEY,
      parameters: { key: 'escape' },
      confidence: 0.95,
      clarificationNeeded: false,
      feedbackMessage: 'Pressing Escape.',
    };
  }

  // 8. Clipboard Actions
  if (['copy selected text', 'copy this', 'copy selection', 'copy'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.COPY_TEXT,
      parameters: {},
      confidence: 0.9,
      clarificationNeeded: false,
      feedbackMessage: 'Copying selection to clipboard (Ctrl+C).',
    };
  }
  if (['paste', 'paste text', 'paste here', 'paste clipboard'].some(p => text.includes(p))) {
    return {
      rawText: rawInput,
      intent: IntentTypes.PASTE_TEXT,
      parameters: {},
      confidence: 0.9,
      clarificationNeeded: false,
      feedbackMessage: 'Pasting from clipboard (Ctrl+V).',
    };
  }

  // 9. Open Application
  if (['open', 'launch', 'start', 'run'].some(w => text.includes(w))) {
    let matchedApp: string | null = null;
    for (const [alias, target] of Object.entries(APP_ALIASES)) {
      if (text.includes(alias)) {
        matchedApp = target;
        break;
      }
    }

    if (matchedApp) {
      return {
        rawText: rawInput,
        intent: IntentTypes.OPEN_APP,
        parameters: { app: matchedApp },
        confidence: 0.95,
        clarificationNeeded: false,
        feedbackMessage: `Opening ${matchedApp.toUpperCase()}...`,
      };
    } else {
      const candidate = text.replace(/open|launch|start|run/g, '').trim();
      return {
        rawText: rawInput,
        intent: IntentTypes.AMBIGUOUS,
        parameters: { candidate },
        confidence: 0.4,
        clarificationNeeded: true,
        clarificationQuestion: `Which application did you mean by "${candidate}"? Supported: Chrome, Calculator, Notepad, Screenshots, Settings.`,
        feedbackMessage: `Ambiguous application "${candidate}". Please clarify.`,
      };
    }
  }

  // Direct app spoken alone
  for (const [alias, target] of Object.entries(APP_ALIASES)) {
    if (text === alias) {
      return {
        rawText: rawInput,
        intent: IntentTypes.OPEN_APP,
        parameters: { app: target },
        confidence: 0.85,
        clarificationNeeded: false,
        feedbackMessage: `Opening ${target.toUpperCase()}...`,
      };
    }
  }

  // Fallback
  return {
    rawText: rawInput,
    intent: IntentTypes.UNKNOWN,
    parameters: {},
    confidence: 0.0,
    clarificationNeeded: true,
    clarificationQuestion: `Command "${rawInput}" not recognized. Try "open calculator", "set volume to 60%", "scroll down", or "take screenshot".`,
    feedbackMessage: `Unrecognized command: "${rawInput}"`,
  };
}
