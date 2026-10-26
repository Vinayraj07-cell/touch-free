import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { parseNaturalLanguageCommand, ParsedCommand } from '../services/nlpEngine';
import { sounds } from '../services/soundEffects';

interface VoiceControllerPanelProps {
  isVoiceEnabled: boolean;
  onToggleVoice: (enabled: boolean) => void;
  onExecuteCommand: (parsed: ParsedCommand) => void;
  lastParsedCommand: ParsedCommand | null;
}

export const VoiceControllerPanel: React.FC<VoiceControllerPanelProps> = ({
  isVoiceEnabled,
  onToggleVoice,
  onExecuteCommand,
  lastParsedCommand,
}) => {
  const [transcript, setTranscript] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [isListeningActive, setIsListeningActive] = useState<boolean>(false);
  const [speechApiSupported, setSpeechApiSupported] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);

  // Setup Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechApiSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          const finalPhrase = item[0].transcript.trim();
          setTranscript(finalPhrase);
          // Parse and dispatch
          const parsed = parseNaturalLanguageCommand(finalPhrase);
          onExecuteCommand(parsed);
        } else {
          currentTranscript += item[0].transcript;
          setTranscript(currentTranscript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
    };

    recognition.onend = () => {
      if (isVoiceEnabled && isListeningActive) {
        try {
          recognition.start();
        } catch (_) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (_) {}
    };
  }, []);

  // Sync listening state with toggle
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isVoiceEnabled) {
      try {
        recognitionRef.current.start();
        setIsListeningActive(true);
      } catch (_) {}
    } else {
      try {
        recognitionRef.current.stop();
        setIsListeningActive(false);
      } catch (_) {}
    }
  }, [isVoiceEnabled]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const parsed = parseNaturalLanguageCommand(textInput);
    onExecuteCommand(parsed);
    setTextInput('');
  };

  const handleQuickCommand = (phrase: string) => {
    sounds.playClick();
    const parsed = parseNaturalLanguageCommand(phrase);
    onExecuteCommand(parsed);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">VOICE CONTROLLER & RULE-BASED NLP</span>
        </div>

        <button
          onClick={() => onToggleVoice(!isVoiceEnabled)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            isVoiceEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
          }`}
        >
          {isVoiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span>{isVoiceEnabled ? 'Voice Listening' : 'Voice Disabled'}</span>
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Microphone status or live transcript card */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 min-h-[64px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${isVoiceEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isVoiceEnabled ? 'Microphone Active' : 'Microphone Muted'}
            </span>
            {lastParsedCommand && (
              <span className="font-mono text-xs text-sky-400">
                Intent: {lastParsedCommand.intent}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-200 font-mono italic mt-2 truncate">
            {transcript ? `"${transcript}"` : (isVoiceEnabled ? 'Speak a natural command, e.g., "Open Calculator" or "Set volume to 50%"...' : 'Enable Voice to listen via microphone, or type below.')}
          </div>
        </div>

        {/* Ambiguity clarification alert if needed */}
        {lastParsedCommand?.clarificationNeeded && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <div className="font-semibold">Clarification Required</div>
              <div className="text-[11px] text-amber-200/90 mt-0.5">{lastParsedCommand.clarificationQuestion}</div>
            </div>
          </div>
        )}

        {/* Text Command Input Alternative */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type command, e.g., 'Open Chrome', 'Scroll down'..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 px-3 py-2 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Execute</span>
          </button>
        </form>

        {/* Quick-test command shortcuts */}
        <div>
          <div className="text-[11px] font-medium text-slate-400 mb-1.5">Sample Voice Commands (Click to Test):</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Open Chrome',
              'Open Calculator',
              'Open Notepad',
              'Take a screenshot',
              'Set volume to 50 percent',
              'Increase volume',
              'Scroll down',
              'Scroll up',
              'Copy selected text',
              'Paste',
              'Stop gesture control',
              'Stop all controls'
            ].map(cmd => (
              <button
                key={cmd}
                onClick={() => handleQuickCommand(cmd)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-slate-300 hover:text-white rounded text-[11px] font-mono transition-colors cursor-pointer border border-slate-700/50"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
