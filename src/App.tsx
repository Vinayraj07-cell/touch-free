/**
 * Touch-Free Computer Controller
 * High-Fidelity Web Controller & Python Desktop Application Hub
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Hand, 
  Mic, 
  Terminal, 
  Sliders, 
  ShieldAlert, 
  Play, 
  Pause, 
  Download, 
  BookOpen, 
  Monitor, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  RotateCcw
} from 'lucide-react';

import { GestureConfig, GestureAction, CommandLogEntry, WindowApp, ScreenshotItem } from './types';
import { VirtualWindowsDesktop } from './components/VirtualWindowsDesktop';
import { WebcamHud } from './components/WebcamHud';
import { VoiceControllerPanel } from './components/VoiceControllerPanel';
import { PythonProjectExplorer } from './components/PythonProjectExplorer';
import { CalibrationModal } from './components/CalibrationModal';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { GestureReferenceGuide } from './components/GestureReferenceGuide';
import { parseNaturalLanguageCommand, ParsedCommand, IntentTypes } from './services/nlpEngine';
import { sounds } from './services/soundEffects';

export default function App() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<'studio' | 'python-code' | 'architecture' | 'reference'>('studio');

  // Master Control States
  const [isMasterActive, setIsMasterActive] = useState<boolean>(true);
  const [isGestureEnabled, setIsGestureEnabled] = useState<boolean>(true);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(false);

  // Calibration settings
  const [config, setConfig] = useState<GestureConfig>({
    cameraWidth: 640,
    cameraHeight: 480,
    marginX: 0.15,
    marginY: 0.20,
    smoothingFactor: 0.65,
    cursorSpeed: 1.3,
    pinchThreshold: 0.055,
    dragHoldDuration: 0.35,
    clickCooldown: 0.35,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Virtual Desktop States
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [currentGesture, setCurrentGesture] = useState<GestureAction>('Pointing');
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(65);
  const [chromeScroll, setChromeScroll] = useState<number>(0);
  const [notepadText, setNotepadText] = useState<string>(
    'Welcome to Touch-Free Computer Controller!\n\nYou can control this entire desktop hands-free using webcam gestures or voice commands.\n\nTry saying: "Open Calculator", "Take a screenshot", or "Set volume to 50%".'
  );

  // Open Windows in desktop
  const [openWindows, setOpenWindows] = useState<WindowApp[]>([
    {
      id: 'chrome',
      title: 'Google Chrome',
      isOpen: true,
      isMinimized: false,
      zIndex: 10,
      position: { x: 120, y: 30 },
      size: { width: 560, height: 380 },
    },
    {
      id: 'calc',
      title: 'Calculator',
      isOpen: false,
      isMinimized: false,
      zIndex: 11,
      position: { x: 260, y: 40 },
      size: { width: 280, height: 340 },
    },
    {
      id: 'notepad',
      title: 'Notepad',
      isOpen: false,
      isMinimized: false,
      zIndex: 12,
      position: { x: 320, y: 70 },
      size: { width: 420, height: 320 },
    },
    {
      id: 'gallery',
      title: 'Screenshots Gallery',
      isOpen: false,
      isMinimized: false,
      zIndex: 13,
      position: { x: 180, y: 80 },
      size: { width: 480, height: 340 },
    },
    {
      id: 'settings',
      title: 'Settings',
      isOpen: false,
      isMinimized: false,
      zIndex: 14,
      position: { x: 200, y: 100 },
      size: { width: 400, height: 300 },
    },
  ]);

  // Screenshots state
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);

  // Logs state
  const [logs, setLogs] = useState<CommandLogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString(),
      source: 'system',
      intent: 'SYSTEM_INIT',
      status: 'success',
      details: 'Touch-Free Computer Controller initialized. Ready for gestures & speech.',
    },
  ]);

  const [lastParsedCommand, setLastParsedCommand] = useState<ParsedCommand | null>(null);

  const addLog = useCallback((
    source: CommandLogEntry['source'],
    intent: string,
    details: string,
    status: CommandLogEntry['status'] = 'success',
    rawText?: string
  ) => {
    setLogs(prev => [
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        source,
        intent,
        details,
        status,
        rawText,
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Emergency Stop Handler
  const handleEmergencyStop = useCallback(() => {
    setIsEmergencyStopped(true);
    setIsMasterActive(false);
    setIsGestureEnabled(false);
    setIsVoiceEnabled(false);
    setIsPinching(false);
    setIsDragging(false);
    setCurrentGesture('Disabled');
    sounds.playEmergencyStop();
    addLog('system', 'EMERGENCY_STOP', 'Emergency stop engaged. All automation halted immediately.', 'halted');
  }, [addLog]);

  // Resume handler
  const handleResume = useCallback(() => {
    setIsEmergencyStopped(false);
    setIsMasterActive(true);
    setIsGestureEnabled(true);
    setIsVoiceEnabled(true);
    setCurrentGesture('Pointing');
    sounds.playClick();
    addLog('system', 'RESUME_CONTROLS', 'Emergency stop cleared. Automation resumed.', 'success');
  }, [addLog]);

  // Keyboard shortcut for ESC emergency stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F12') {
        handleEmergencyStop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEmergencyStop]);

  // Take screenshot action
  const handleTakeScreenshot = useCallback(() => {
    sounds.playScreenshot();
    const ts = new Date();
    const filename = `screenshot_${ts.getFullYear()}${(ts.getMonth()+1).toString().padStart(2,'0')}${ts.getDate().toString().padStart(2,'0')}_${ts.getHours().toString().padStart(2,'0')}${ts.getMinutes().toString().padStart(2,'0')}${ts.getSeconds().toString().padStart(2,'0')}.png`;

    // Create mockup screenshot canvas
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 360);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Touch-Free Computer Controller - Desktop Snapshot', 24, 40);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText(`Captured: ${ts.toLocaleString()}`, 24, 70);
      ctx.fillText(`Active Gesture: ${currentGesture}`, 24, 90);
      ctx.fillText(`Volume Level: ${volume}%`, 24, 110);

      // Desktop windows preview
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(24, 140, 592, 190);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(24, 140, 592, 190);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px sans-serif';
      ctx.fillText('Windows Desktop Surface [Snapshot OK]', 40, 180);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const newScreenshot: ScreenshotItem = {
      id: `ss-${Date.now()}`,
      timestamp: ts.toLocaleTimeString(),
      dataUrl,
      filename,
    };

    setScreenshots(prev => [newScreenshot, ...prev]);

    // Open Gallery
    setOpenWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 10);
      return prev.map(w => (w.id === 'gallery' ? { ...w, isOpen: true, isMinimized: false, zIndex: maxZ + 1 } : w));
    });

    addLog('system', 'TAKE_SCREENSHOT', `Captured screen saved to Pictures/TouchFreeScreenshots/${filename}`);
  }, [currentGesture, volume, addLog]);

  // Command Execution Handler (Voice or Typed)
  const handleExecuteCommand = useCallback((parsed: ParsedCommand) => {
    setLastParsedCommand(parsed);

    if (parsed.clarificationNeeded) {
      addLog('voice', parsed.intent, parsed.feedbackMessage, 'clarification', parsed.rawText);
      return;
    }

    const { intent, parameters } = parsed;

    // 1. Emergency Stop / Resume
    if (intent === IntentTypes.STOP_ALL) {
      handleEmergencyStop();
      return;
    }
    if (intent === IntentTypes.RESUME_ALL) {
      handleResume();
      return;
    }

    if (isEmergencyStopped) {
      addLog('voice', intent, 'Rejected: Emergency Stop is active. Press Resume first.', 'halted', parsed.rawText);
      return;
    }

    // 2. Gesture Controls Toggle
    if (intent === IntentTypes.STOP_GESTURE) {
      setIsGestureEnabled(false);
      addLog('voice', intent, 'Gesture tracking paused.', 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.START_GESTURE) {
      setIsGestureEnabled(true);
      addLog('voice', intent, 'Gesture tracking enabled.', 'success', parsed.rawText);
      return;
    }

    // 3. Voice Toggle
    if (intent === IntentTypes.STOP_VOICE) {
      setIsVoiceEnabled(false);
      addLog('voice', intent, 'Voice controller disabled.', 'success', parsed.rawText);
      return;
    }

    // 4. Open Application
    if (intent === IntentTypes.OPEN_APP) {
      const targetApp = parameters.app as WindowApp['id'];
      setOpenWindows(prev => {
        const maxZ = Math.max(...prev.map(w => w.zIndex), 10);
        return prev.map(w => (w.id === targetApp ? { ...w, isOpen: true, isMinimized: false, zIndex: maxZ + 1 } : w));
      });
      sounds.playClick();
      addLog('voice', intent, `Launched ${targetApp.toUpperCase()} successfully.`, 'success', parsed.rawText);
      return;
    }

    // 5. Volume controls
    if (intent === IntentTypes.SET_VOLUME) {
      const lvl = parameters.level;
      setVolume(lvl);
      sounds.playVolumeFeedback(lvl);
      addLog('voice', intent, `Master volume set to ${lvl}%.`, 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.INCREASE_VOLUME) {
      setVolume(prev => {
        const next = Math.min(100, prev + 10);
        sounds.playVolumeFeedback(next);
        return next;
      });
      addLog('voice', intent, 'Master volume increased by 10%.', 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.DECREASE_VOLUME) {
      setVolume(prev => {
        const next = Math.max(0, prev - 10);
        sounds.playVolumeFeedback(next);
        return next;
      });
      addLog('voice', intent, 'Master volume decreased by 10%.', 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.MUTE_VOLUME) {
      setVolume(0);
      sounds.playVolumeFeedback(0);
      addLog('voice', intent, 'Master audio muted.', 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.UNMUTE_VOLUME) {
      setVolume(50);
      sounds.playVolumeFeedback(50);
      addLog('voice', intent, 'Master audio unmuted to 50%.', 'success', parsed.rawText);
      return;
    }

    // 6. Screenshot
    if (intent === IntentTypes.TAKE_SCREENSHOT) {
      handleTakeScreenshot();
      return;
    }

    // 7. Scroll
    if (intent === IntentTypes.SCROLL_DOWN) {
      setChromeScroll(prev => prev + 200);
      sounds.playClick();
      addLog('voice', intent, 'Scrolled active window downward.', 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.SCROLL_UP) {
      setChromeScroll(prev => Math.max(0, prev - 200));
      sounds.playClick();
      addLog('voice', intent, 'Scrolled active window upward.', 'success', parsed.rawText);
      return;
    }

    // 8. Keyboard & Clipboard
    if (intent === IntentTypes.PRESS_KEY) {
      sounds.playClick();
      if (parameters.key === 'enter') {
        setNotepadText(prev => prev + '\n[User pressed Enter]');
      }
      addLog('voice', intent, `Key pressed: ${parameters.key}`, 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.COPY_TEXT) {
      sounds.playClick();
      addLog('voice', intent, 'Copied selected text to clipboard (Ctrl+C).', 'success', parsed.rawText);
      return;
    }
    if (intent === IntentTypes.PASTE_TEXT) {
      sounds.playClick();
      setNotepadText(prev => prev + ' [Pasted text content]');
      addLog('voice', intent, 'Pasted clipboard contents (Ctrl+V).', 'success', parsed.rawText);
      return;
    }

    addLog('voice', intent, parsed.feedbackMessage, 'success', parsed.rawText);
  }, [isEmergencyStopped, handleEmergencyStop, handleResume, handleTakeScreenshot, addLog]);

  // Gesture Actions triggered from WebcamHud
  const handleGestureAction = useCallback((action: GestureAction) => {
    setCurrentGesture(action);

    if (action === 'Left Click') {
      setIsPinching(true);
      setTimeout(() => setIsPinching(false), 200);
      addLog('gesture', 'LEFT_CLICK', 'Left Click pinch detected and executed.', 'success');
    } else if (action === 'Right Click') {
      addLog('gesture', 'RIGHT_CLICK', 'Right Click pinch detected (Thumb + Middle).', 'success');
    } else if (action === 'Drag & Drop') {
      setIsDragging(true);
    } else if (action === 'Idle') {
      setIsDragging(false);
    }
  }, [addLog]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* ================= 1. TOP BAR CONTRACT ================= */}
      {/* Zone 1: Wordmark, Zone 2: Navigation Links, Zone 3: Primary CTA */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <Hand className="w-5 h-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            Touch-Free Computer Controller
          </span>
        </div>

        {/* Zone 2: Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('studio')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 cursor-pointer ${
              activeTab === 'studio' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Live Controller & Desktop
          </button>
          <button
            onClick={() => setActiveTab('python-code')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 cursor-pointer ${
              activeTab === 'python-code' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Python Desktop Source (11 Modules)
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 cursor-pointer ${
              activeTab === 'architecture' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            How It Works & Architecture
          </button>
          <button
            onClick={() => setActiveTab('reference')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 cursor-pointer ${
              activeTab === 'reference' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Gestures & Commands Guide
          </button>
        </nav>

        {/* Zone 3: Emergency Stop / Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer border border-slate-800"
            title="Calibration Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {isEmergencyStopped ? (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Resume Automation</span>
            </button>
          ) : (
            <button
              onClick={handleEmergencyStop}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm animate-pulse"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>EMERGENCY STOP (ESC)</span>
            </button>
          )}
        </div>
      </header>

      {/* Emergency Stop Alert Banner if halted */}
      {isEmergencyStopped && (
        <div className="bg-red-950/80 border-b border-red-800/80 px-6 py-2.5 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-semibold">EMERGENCY STOP ACTIVE:</span>
            <span>All gesture tracking loops and voice commands are currently blocked.</span>
          </div>
          <button
            onClick={handleResume}
            className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-medium text-[11px] cursor-pointer"
          >
            Clear Stop & Resume
          </button>
        </div>
      )}

      {/* ================= 2. MAIN WORKSPACE VIEWPORT ================= */}
      <main className="flex-1 p-6 max-w-[1520px] w-full mx-auto flex flex-col gap-6">
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Virtual Windows Desktop Sandbox */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    Interactive Windows Desktop Simulator
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time execution sandbox with functional Calculator, Notepad, Chrome, and screenshots.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Volume: <span className="text-sky-400 tabular-nums">{volume}%</span>
                  </span>
                </div>
              </div>

              {/* Desktop Sandbox Canvas */}
              <VirtualWindowsDesktop
                cursorPos={cursorPos}
                isPinching={isPinching}
                isDragging={isDragging}
                activeGesture={currentGesture}
                volume={volume}
                onVolumeChange={setVolume}
                openWindows={openWindows}
                setOpenWindows={setOpenWindows}
                screenshots={screenshots}
                onTakeScreenshot={handleTakeScreenshot}
                notepadText={notepadText}
                setNotepadText={setNotepadText}
                chromeScroll={chromeScroll}
              />

              {/* Quick feature callout */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="text-slate-400 font-medium">Pinch Left Click</div>
                  <div className="text-slate-200 text-[11px]">Thumb + Index pinch clicks calculator buttons & opens apps.</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="text-slate-400 font-medium">Voice Intents</div>
                  <div className="text-slate-200 text-[11px]">Say "Open Calculator", "Take screenshot", or "Scroll down".</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="text-slate-400 font-medium">Hardware Safety</div>
                  <div className="text-slate-200 text-[11px]">Hit ESC or F12 anytime to abort all computer control.</div>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Webcam HUD, Voice Controller & Activity Stream */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Webcam Tracking HUD */}
              <WebcamHud
                isGestureEnabled={isGestureEnabled && !isEmergencyStopped}
                onToggleGesture={setIsGestureEnabled}
                config={config}
                onCursorUpdate={setCursorPos}
                onActionTrigger={handleGestureAction}
                currentAction={currentGesture}
              />

              {/* Voice & NLP Panel */}
              <VoiceControllerPanel
                isVoiceEnabled={isVoiceEnabled && !isEmergencyStopped}
                onToggleVoice={setIsVoiceEnabled}
                onExecuteCommand={handleExecuteCommand}
                lastParsedCommand={lastParsedCommand}
              />

              {/* Activity & Command Execution Log */}
              <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-200">REAL-TIME ACTIVITY LOG</span>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="p-3 max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs bg-slate-950">
                  {logs.length === 0 ? (
                    <div className="text-slate-600 text-center py-6 text-xs">No activity yet.</div>
                  ) : (
                    logs.map(log => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-900/60 transition-colors"
                      >
                        <span className="text-slate-500 text-[10px] tabular-nums shrink-0 mt-0.5">
                          {log.timestamp}
                        </span>

                        <span
                          className={`px-1 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${
                            log.status === 'success'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : log.status === 'clarification'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {log.intent}
                        </span>

                        <span className="text-slate-300 text-[11px] leading-tight break-all font-sans">
                          {log.details}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'python-code' && (
          <div className="h-[750px]">
            <PythonProjectExplorer />
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl">
            <ArchitectureGuide />
          </div>
        )}

        {activeTab === 'reference' && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl">
            <GestureReferenceGuide />
          </div>
        )}
      </main>

      {/* Calibration Modal */}
      <CalibrationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onChangeConfig={setConfig}
      />
    </div>
  );
}
