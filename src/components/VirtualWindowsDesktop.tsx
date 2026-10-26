import React, { useState, useRef, useEffect } from 'react';
import { 
  AppWindow, 
  Minus, 
  X, 
  Calculator, 
  FileText, 
  Globe, 
  Image as ImageIcon, 
  Settings, 
  Volume2, 
  VolumeX, 
  Camera, 
  Trash2, 
  Search,
  ExternalLink,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { WindowApp, ScreenshotItem } from '../types';
import { sounds } from '../services/soundEffects';

interface VirtualWindowsDesktopProps {
  cursorPos: { x: number; y: number }; // normalized 0-1
  isPinching: boolean;
  isDragging: boolean;
  activeGesture: string;
  volume: number; // 0-100
  onVolumeChange: (vol: number) => void;
  openWindows: WindowApp[];
  setOpenWindows: React.Dispatch<React.SetStateAction<WindowApp[]>>;
  screenshots: ScreenshotItem[];
  onTakeScreenshot: () => void;
  notepadText: string;
  setNotepadText: React.Dispatch<React.SetStateAction<string>>;
  chromeScroll: number;
}

export const VirtualWindowsDesktop: React.FC<VirtualWindowsDesktopProps> = ({
  cursorPos,
  isPinching,
  isDragging,
  activeGesture,
  volume,
  onVolumeChange,
  openWindows,
  setOpenWindows,
  screenshots,
  onTakeScreenshot,
  notepadText,
  setNotepadText,
  chromeScroll,
}) => {
  const desktopRef = useRef<HTMLDivElement>(null);
  const chromeContentRef = useRef<HTMLDivElement>(null);

  // Calculator state
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [calcClearNext, setCalcClearNext] = useState<boolean>(false);

  // Volume slider flyout in tray
  const [showVolumeFlyout, setShowVolumeFlyout] = useState<boolean>(false);
  const [showStartMenu, setShowStartMenu] = useState<boolean>(false);

  // Sync chrome scroll
  useEffect(() => {
    if (chromeContentRef.current) {
      chromeContentRef.current.scrollTop = chromeScroll;
    }
  }, [chromeScroll]);

  // Bring window to front
  const bringToFront = (appId: string) => {
    setOpenWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 10);
      return prev.map(w => (w.id === appId ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w));
    });
  };

  const closeWindow = (appId: string) => {
    setOpenWindows(prev => prev.map(w => (w.id === appId ? { ...w, isOpen: false } : w)));
  };

  const toggleMinimize = (appId: string) => {
    setOpenWindows(prev => prev.map(w => (w.id === appId ? { ...w, isMinimized: !w.isMinimized } : w)));
  };

  const openApp = (appId: WindowApp['id']) => {
    setOpenWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 10);
      return prev.map(w => (w.id === appId ? { ...w, isOpen: true, isMinimized: false, zIndex: maxZ + 1 } : w));
    });
    setShowStartMenu(false);
    sounds.playClick();
  };

  // Calculator operations
  const handleCalcNum = (num: string) => {
    sounds.playClick();
    if (calcClearNext || calcDisplay === '0') {
      setCalcDisplay(num);
      setCalcClearNext(false);
    } else {
      setCalcDisplay(calcDisplay + num);
    }
  };

  const handleCalcOp = (op: string) => {
    sounds.playClick();
    const curr = parseFloat(calcDisplay);
    if (calcPrev !== null && calcOp) {
      let result = curr;
      if (calcOp === '+') result = calcPrev + curr;
      if (calcOp === '-') result = calcPrev - curr;
      if (calcOp === '×') result = calcPrev * curr;
      if (calcOp === '÷') result = curr !== 0 ? calcPrev / curr : 0;
      setCalcDisplay(String(result));
      setCalcPrev(result);
    } else {
      setCalcPrev(curr);
    }
    setCalcOp(op);
    setCalcClearNext(true);
  };

  const handleCalcEquals = () => {
    sounds.playClick();
    const curr = parseFloat(calcDisplay);
    if (calcPrev !== null && calcOp) {
      let result = curr;
      if (calcOp === '+') result = calcPrev + curr;
      if (calcOp === '-') result = calcPrev - curr;
      if (calcOp === '×') result = calcPrev * curr;
      if (calcOp === '÷') result = curr !== 0 ? calcPrev / curr : 0;
      setCalcDisplay(String(result));
      setCalcPrev(null);
      setCalcOp(null);
      setCalcClearNext(true);
    }
  };

  const handleCalcClear = () => {
    sounds.playClick();
    setCalcDisplay('0');
    setCalcPrev(null);
    setCalcOp(null);
    setCalcClearNext(false);
  };

  // Convert normalized coordinates (0..1) to actual pixel positions within desktop
  const desktopWidth = desktopRef.current?.clientWidth || 800;
  const desktopHeight = desktopRef.current?.clientHeight || 500;
  const cursorPxX = Math.max(0, Math.min(desktopWidth, cursorPos.x * desktopWidth));
  const cursorPxY = Math.max(0, Math.min(desktopHeight, cursorPos.y * desktopHeight));

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const currentDate = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div 
      ref={desktopRef}
      className="relative w-full h-[580px] bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl select-none"
    >
      {/* Subtle Desktop Wallpaper Motif */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Desktop Shortcut Icons */}
      <div className="absolute top-4 left-4 flex flex-col gap-4 z-10">
        <button
          onClick={() => openApp('chrome')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors w-20 text-center cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-red-500 to-emerald-500 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Globe className="w-6 h-6 text-sky-400 group-hover:scale-105 transition-transform" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">Chrome</span>
        </button>

        <button
          onClick={() => openApp('notepad')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors w-20 text-center cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-sky-600/30 border border-sky-400/40 p-2 shadow-md flex items-center justify-center">
            <FileText className="w-6 h-6 text-sky-300 group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">Notepad</span>
        </button>

        <button
          onClick={() => openApp('calc')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors w-20 text-center cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-teal-600/30 border border-teal-400/40 p-2 shadow-md flex items-center justify-center">
            <Calculator className="w-6 h-6 text-teal-300 group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">Calculator</span>
        </button>

        <button
          onClick={() => openApp('gallery')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors w-20 text-center cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-400/40 p-2 shadow-md flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-indigo-300 group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">Screenshots</span>
        </button>

        <button
          onClick={onTakeScreenshot}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors w-20 text-center cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-600/30 border border-emerald-400/40 p-2 shadow-md flex items-center justify-center">
            <Camera className="w-6 h-6 text-emerald-300 group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[11px] font-medium text-slate-200 drop-shadow">Snap Now</span>
        </button>
      </div>

      {/* ================= OPEN WINDOWS ================= */}

      {/* 1. Calculator Window */}
      {openWindows.find(w => w.id === 'calc')?.isOpen && !openWindows.find(w => w.id === 'calc')?.isMinimized && (
        <div
          onClick={() => bringToFront('calc')}
          style={{
            zIndex: openWindows.find(w => w.id === 'calc')?.zIndex,
            left: '260px',
            top: '40px',
            width: '280px',
          }}
          className="absolute bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Titlebar */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700 cursor-move">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Calculator className="w-4 h-4 text-teal-400" />
              <span>Calculator</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleMinimize('calc')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => closeWindow('calc')} className="p-1 hover:bg-red-500 rounded text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Calculator Body */}
          <div className="p-4 flex flex-col gap-3">
            <div className="bg-slate-950 px-3 py-4 rounded-lg text-right font-mono text-2xl font-semibold text-slate-100 tracking-wider overflow-hidden truncate border border-slate-800">
              {calcDisplay}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button onClick={handleCalcClear} className="p-2.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-sm">C</button>
              <button onClick={() => handleCalcOp('÷')} className="p-2.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-sm">÷</button>
              <button onClick={() => handleCalcOp('×')} className="p-2.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-sm">×</button>
              <button onClick={() => handleCalcOp('-')} className="p-2.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-sm">-</button>

              <button onClick={() => handleCalcNum('7')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">7</button>
              <button onClick={() => handleCalcNum('8')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">8</button>
              <button onClick={() => handleCalcNum('9')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">9</button>
              <button onClick={() => handleCalcOp('+')} className="p-2.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-sm">+</button>

              <button onClick={() => handleCalcNum('4')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">4</button>
              <button onClick={() => handleCalcNum('5')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">5</button>
              <button onClick={() => handleCalcNum('6')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">6</button>
              <button onClick={handleCalcEquals} className="row-span-2 p-2.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm flex items-center justify-center">=</button>

              <button onClick={() => handleCalcNum('1')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">1</button>
              <button onClick={() => handleCalcNum('2')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">2</button>
              <button onClick={() => handleCalcNum('3')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">3</button>

              <button onClick={() => handleCalcNum('0')} className="col-span-2 p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">0</button>
              <button onClick={() => handleCalcNum('.')} className="p-2.5 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-sm">.</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Notepad Window */}
      {openWindows.find(w => w.id === 'notepad')?.isOpen && !openWindows.find(w => w.id === 'notepad')?.isMinimized && (
        <div
          onClick={() => bringToFront('notepad')}
          style={{
            zIndex: openWindows.find(w => w.id === 'notepad')?.zIndex,
            left: '320px',
            top: '70px',
            width: '420px',
            height: '320px',
          }}
          className="absolute bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700 cursor-move">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Notepad - TouchFreeNotes.txt</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleMinimize('notepad')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => closeWindow('notepad')} className="p-1 hover:bg-red-500 rounded text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 px-3 py-1 bg-slate-900 text-[11px] text-slate-400 border-b border-slate-800">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span className="ml-auto text-[10px] text-slate-500">Say "Copy selected text" or "Paste"</span>
          </div>

          <textarea
            value={notepadText}
            onChange={(e) => setNotepadText(e.target.value)}
            placeholder="Type here or use touch-free voice dictation..."
            className="flex-1 w-full p-3 bg-slate-950 text-slate-200 font-mono text-xs resize-none focus:outline-none border-0"
          />
        </div>
      )}

      {/* 3. Chrome Window */}
      {openWindows.find(w => w.id === 'chrome')?.isOpen && !openWindows.find(w => w.id === 'chrome')?.isMinimized && (
        <div
          onClick={() => bringToFront('chrome')}
          style={{
            zIndex: openWindows.find(w => w.id === 'chrome')?.zIndex,
            left: '120px',
            top: '30px',
            width: '560px',
            height: '380px',
          }}
          className="absolute bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Chrome titlebar tabs */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-850 rounded-t-lg text-xs font-medium text-slate-200 border-t border-x border-slate-700">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate max-w-[140px]">Touch-Free AI Hub</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleMinimize('chrome')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => closeWindow('chrome')} className="p-1 hover:bg-red-500 rounded text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* URL bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs">
            <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-md border border-slate-800 text-slate-300">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400 font-mono text-[11px]">https://touchfree.windows.local/docs/gestures</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Say "Scroll down"</span>
          </div>

          {/* Web page content */}
          <div 
            ref={chromeContentRef}
            className="flex-1 overflow-y-auto p-5 bg-slate-950 text-slate-300 space-y-4 text-xs leading-relaxed"
          >
            <div className="border-b border-slate-800 pb-3">
              <h1 className="text-base font-bold text-slate-100">Touch-Free Computer Controller Documentation</h1>
              <p className="text-xs text-slate-400 mt-1">Real-time interaction with OpenCV, MediaPipe, and PyAutoGUI.</p>
            </div>

            <div className="space-y-2">
              <h2 className="font-semibold text-sky-400 text-xs">1. Cursor Navigation with Exponential Smoothing</h2>
              <p className="text-slate-400">
                MediaPipe tracks the 3D position of landmark 8 (index fingertip). The coordinates are mapped through an active margin zone and smoothed using an Exponential Moving Average (EMA) with configurable alpha:
              </p>
              <code className="block bg-slate-900 p-2 rounded text-[11px] font-mono text-emerald-400">
                smoothed = alpha * prev + (1 - alpha) * current
              </code>
            </div>

            <div className="space-y-2">
              <h2 className="font-semibold text-sky-400 text-xs">2. Pinch Gestures & Click Debouncing</h2>
              <p className="text-slate-400">
                Pinch distance is calculated dynamically between the thumb tip (landmark 4) and index fingertip (landmark 8), normalized against palm scale. Clicks are debounced with a 350ms cooldown window to prevent unintended double-clicks.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="font-semibold text-sky-400 text-xs">3. Windows Core Audio (PyCaw) Integration</h2>
              <p className="text-slate-400">
                Audio levels are modulated directly via the Windows Endpoint Volume interface, ensuring reliable volume changes without GUI popups.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="font-semibold text-sky-400 text-xs">4. Emergency Stop Protocol</h2>
              <p className="text-slate-400">
                Hitting ESC, F12, or uttering "Stop all controls" immediately cuts off tracking loops and resets mouse states to prevent runaway behavior.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Screenshot Gallery Window */}
      {openWindows.find(w => w.id === 'gallery')?.isOpen && !openWindows.find(w => w.id === 'gallery')?.isMinimized && (
        <div
          onClick={() => bringToFront('gallery')}
          style={{
            zIndex: openWindows.find(w => w.id === 'gallery')?.zIndex,
            left: '180px',
            top: '80px',
            width: '480px',
            height: '340px',
          }}
          className="absolute bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700 cursor-move">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <ImageIcon className="w-4 h-4 text-indigo-400" />
              <span>Screenshots Gallery ({screenshots.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleMinimize('gallery')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => closeWindow('gallery')} className="p-1 hover:bg-red-500 rounded text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto bg-slate-950">
            {screenshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-10">
                <Camera className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
                <p className="text-xs">No screenshots captured yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">Say "Take a screenshot" or click "Snap Now"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {screenshots.map(s => (
                  <div key={s.id} className="bg-slate-900 rounded-lg p-2 border border-slate-800 space-y-1">
                    <img src={s.dataUrl} alt={s.filename} className="w-full h-24 object-cover rounded bg-slate-950" />
                    <div className="text-[10px] font-mono text-slate-400 truncate">{s.filename}</div>
                    <div className="text-[9px] text-slate-500">{s.timestamp}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= VIRTUAL CURSOR ================= */}
      <div
        style={{
          transform: `translate(${cursorPxX}px, ${cursorPxY}px)`,
          transition: 'transform 40ms linear',
        }}
        className="absolute top-0 left-0 pointer-events-none z-50 flex items-center justify-center -ml-2 -mt-2"
      >
        {/* Cursor Icon SVG */}
        <div className="relative">
          <svg className="w-7 h-7 drop-shadow-md text-sky-400 fill-sky-400" viewBox="0 0 24 24">
            <path d="M4 2v18l5.5-5.5L14 22l3-1.5-4.5-7.5H20L4 2z" stroke="#000" strokeWidth="1.5" />
          </svg>

          {/* Action indicator tag next to cursor */}
          {activeGesture !== 'Idle' && activeGesture !== 'Pointing' && (
            <div className="absolute left-6 top-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-sky-400/50 text-[10px] font-mono text-sky-300 whitespace-nowrap shadow-md">
              {activeGesture}
            </div>
          )}

          {/* Pinch click pulse animation */}
          {isPinching && (
            <div className="absolute -inset-2 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
          )}

          {/* Drag ring */}
          {isDragging && (
            <div className="absolute -inset-3 rounded-full border border-amber-400 bg-amber-400/20" />
          )}
        </div>
      </div>

      {/* ================= WINDOWS TASKBAR ================= */}
      <div className="absolute bottom-0 left-0 right-0 h-11 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-between px-3 z-40">
        {/* Start Button & Pinned Apps */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowStartMenu(!showStartMenu)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              showStartMenu ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="bg-sky-400 rounded-sm" />
              <div className="bg-sky-400 rounded-sm" />
              <div className="bg-sky-400 rounded-sm" />
              <div className="bg-sky-400 rounded-sm" />
            </div>
          </button>

          {/* Running / Pinned Apps in Taskbar */}
          <button
            onClick={() => openApp('chrome')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
              openWindows.find(w => w.id === 'chrome')?.isOpen ? 'bg-slate-800/80 text-sky-400' : 'hover:bg-slate-850 text-slate-400'
            }`}
          >
            <Globe className="w-5 h-5" />
            {openWindows.find(w => w.id === 'chrome')?.isOpen && (
              <div className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => openApp('notepad')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
              openWindows.find(w => w.id === 'notepad')?.isOpen ? 'bg-slate-800/80 text-sky-400' : 'hover:bg-slate-850 text-slate-400'
            }`}
          >
            <FileText className="w-5 h-5" />
            {openWindows.find(w => w.id === 'notepad')?.isOpen && (
              <div className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => openApp('calc')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
              openWindows.find(w => w.id === 'calc')?.isOpen ? 'bg-slate-800/80 text-sky-400' : 'hover:bg-slate-850 text-slate-400'
            }`}
          >
            <Calculator className="w-5 h-5" />
            {openWindows.find(w => w.id === 'calc')?.isOpen && (
              <div className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => openApp('gallery')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
              openWindows.find(w => w.id === 'gallery')?.isOpen ? 'bg-slate-800/80 text-sky-400' : 'hover:bg-slate-850 text-slate-400'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            {openWindows.find(w => w.id === 'gallery')?.isOpen && (
              <div className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
        </div>

        {/* System Tray (Audio, Clock, Battery) */}
        <div className="flex items-center gap-3 text-xs text-slate-300">
          {/* Volume button & Flyout */}
          <div className="relative">
            <button
              onClick={() => setShowVolumeFlyout(!showVolumeFlyout)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
              <span className="font-mono text-[11px] tabular-nums">{volume}%</span>
            </button>

            {/* Volume Popup Slider */}
            {showVolumeFlyout && (
              <div className="absolute bottom-12 right-0 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col gap-2 w-44 z-50">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                  <span>Speakers (Realtek Audio)</span>
                  <span className="font-mono text-sky-400">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    onVolumeChange(v);
                    sounds.playVolumeFeedback(v);
                  }}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Clock */}
          <div className="flex flex-col items-end text-right">
            <span className="font-mono text-[11px] font-semibold text-slate-200">{currentTime}</span>
            <span className="text-[9px] text-slate-500 font-mono">{currentDate}</span>
          </div>
        </div>
      </div>

      {/* ================= START MENU MODAL ================= */}
      {showStartMenu && (
        <div className="absolute bottom-13 left-3 w-72 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-4 z-50 flex flex-col gap-3">
          <div className="text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
            Windows Applications
          </div>
          <div className="space-y-1">
            <button onClick={() => openApp('chrome')} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-left text-xs text-slate-200 transition-colors">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Google Chrome</span>
            </button>
            <button onClick={() => openApp('calc')} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-left text-xs text-slate-200 transition-colors">
              <Calculator className="w-4 h-4 text-teal-400" />
              <span>Calculator</span>
            </button>
            <button onClick={() => openApp('notepad')} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-left text-xs text-slate-200 transition-colors">
              <FileText className="w-4 h-4 text-sky-300" />
              <span>Notepad</span>
            </button>
            <button onClick={() => openApp('gallery')} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-left text-xs text-slate-200 transition-colors">
              <ImageIcon className="w-4 h-4 text-indigo-400" />
              <span>Screenshots</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
