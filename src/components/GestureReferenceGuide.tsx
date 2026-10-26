import React from 'react';
import { Hand, MousePointer, Move, ArrowUpDown, Grab, Volume2, ShieldAlert } from 'lucide-react';

export const GestureReferenceGuide: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* Hand Gesture Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Hand className="w-4 h-4 text-sky-400" />
          Hand Gesture Action Reference
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Point / Move */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Point & Move Cursor</span>
              <MousePointer className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Extend your index finger. The cursor glides with Exponential Moving Average (EMA) smoothing to eliminate hand jitter.
            </p>
            <div className="text-[10px] font-mono text-sky-300/80 bg-slate-950 p-1.5 rounded">
              Landmark 8 (Index Tip)
            </div>
          </div>

          {/* 2. Left Click */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Left Click (Pinch)</span>
              <span className="text-xs text-emerald-400 font-mono">Pinch & Release</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bring thumb tip and index fingertip together quickly (&lt;350ms) and release. Triggers an instantaneous single left click.
            </p>
            <div className="text-[10px] font-mono text-emerald-300/80 bg-slate-950 p-1.5 rounded">
              Pinch distance &lt; 0.055 hand scale
            </div>
          </div>

          {/* 3. Drag and Drop */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Drag & Drop</span>
              <Grab className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pinch thumb and index finger and hold for &gt;350ms. The mouse button stays held down until you open your fingers to release the object.
            </p>
            <div className="text-[10px] font-mono text-amber-300/80 bg-slate-950 p-1.5 rounded">
              Sustained pinch &gt; 350ms
            </div>
          </div>

          {/* 4. Right Click */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Right Click Menu</span>
              <span className="text-xs text-purple-400 font-mono">Thumb + Middle</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pinch your thumb tip and middle fingertip together. Instantly opens the Windows right-click context menu.
            </p>
            <div className="text-[10px] font-mono text-purple-300/80 bg-slate-950 p-1.5 rounded">
              Landmarks 4 & 12 Pinch
            </div>
          </div>

          {/* 5. Scroll */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Vertical Scrolling</span>
              <ArrowUpDown className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Extend index and middle fingers together (two-finger scroll). Move your hand upward to scroll up, or downward to scroll down.
            </p>
            <div className="text-[10px] font-mono text-sky-300/80 bg-slate-950 p-1.5 rounded">
              2 Fingers Up / Down Delta
            </div>
          </div>

          {/* 6. Emergency Stop */}
          <div className="p-3.5 bg-slate-900 border border-red-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-300">Emergency Stop</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-red-300 font-mono text-[10px]">ESC</kbd> or <kbd className="px-1 py-0.5 bg-slate-800 rounded text-red-300 font-mono text-[10px]">F12</kbd> or say <span className="italic text-red-200">"Stop all controls"</span> to instantly freeze all automation.
            </p>
            <div className="text-[10px] font-mono text-red-400 bg-slate-950 p-1.5 rounded">
              Instant Hardware Interruption
            </div>
          </div>
        </div>
      </div>

      {/* Voice Commands Cheat Sheet */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-emerald-400" />
          Natural-Language Voice Command Dictionary
        </h3>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Spoken Voice Command</th>
                <th className="py-2.5 px-4">Recognized Variations</th>
                <th className="py-2.5 px-4">System Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              <tr>
                <td className="py-2 px-4 text-sky-400">"Open Chrome"</td>
                <td className="py-2 px-4 text-slate-400">"Launch Google Chrome", "Open browser"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Opens Google Chrome browser window</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Open Calculator"</td>
                <td className="py-2 px-4 text-slate-400">"Launch calculator", "Open calc"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Opens Windows Calculator app</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Open Notepad"</td>
                <td className="py-2 px-4 text-slate-400">"Launch notepad", "Start text editor"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Opens Notepad for typing & notes</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Take a screenshot"</td>
                <td className="py-2 px-4 text-slate-400">"Capture screen", "Screenshot"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Saves screenshot to disk & opens gallery</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Set volume to 50 percent"</td>
                <td className="py-2 px-4 text-slate-400">"Volume 80%", "Volume half", "Sound to 30"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Sets exact Windows master audio level</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Increase volume"</td>
                <td className="py-2 px-4 text-slate-400">"Volume up", "Turn up sound", "Louder"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Increases volume by 10%</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Decrease volume"</td>
                <td className="py-2 px-4 text-slate-400">"Volume down", "Turn down sound", "Softer"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Decreases volume by 10%</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Scroll down" / "Scroll up"</td>
                <td className="py-2 px-4 text-slate-400">"Page down", "Page up"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Scrolls the active window vertically</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Press Enter"</td>
                <td className="py-2 px-4 text-slate-400">"Hit enter", "Press space", "Press escape"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Simulates key press without physical contact</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-sky-400">"Copy selected text" / "Paste"</td>
                <td className="py-2 px-4 text-slate-400">"Copy this", "Paste clipboard"</td>
                <td className="py-2 px-4 text-emerald-400 font-sans">Executes Ctrl+C and Ctrl+V clipboard operations</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-red-400">"Stop all controls"</td>
                <td className="py-2 px-4 text-slate-400">"Emergency stop", "Halt system", "Pause all"</td>
                <td className="py-2 px-4 text-red-300 font-sans">Immediately halts all mouse and keyboard actions</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
