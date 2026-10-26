import React from 'react';
import { Sliders, X, RotateCcw, Shield, Check } from 'lucide-react';
import { GestureConfig } from '../types';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GestureConfig;
  onChangeConfig: (newConfig: GestureConfig) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    onChangeConfig({
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
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            <span className="text-sm font-semibold text-slate-100">Tracking & Sensitivity Calibration</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Sliders */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* 1. Cursor Smoothing EMA */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-200">Exponential Smoothing (EMA α)</span>
              <span className="font-mono text-sky-400">{config.smoothingFactor.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Higher value gives ultra-smooth cursor movement and filters out hand tremors; lower value provides zero latency.
            </p>
            <input
              type="range"
              min="0.10"
              max="0.95"
              step="0.05"
              value={config.smoothingFactor}
              onChange={(e) => onChangeConfig({ ...config, smoothingFactor: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* 2. Cursor Speed Multiplier */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-200">Cursor Speed Multiplier</span>
              <span className="font-mono text-sky-400">{config.cursorSpeed.toFixed(1)}x</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Amplifies hand travel distance relative to screen width.
            </p>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={config.cursorSpeed}
              onChange={(e) => onChangeConfig({ ...config, cursorSpeed: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* 3. Pinch Distance Threshold */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-200">Pinch Trigger Distance</span>
              <span className="font-mono text-sky-400">{config.pinchThreshold.toFixed(3)}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Normalized distance between thumb tip and index fingertip that initiates a left-click or drag.
            </p>
            <input
              type="range"
              min="0.02"
              max="0.12"
              step="0.005"
              value={config.pinchThreshold}
              onChange={(e) => onChangeConfig({ ...config, pinchThreshold: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* 4. Click Cooldown */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-200">Click Debounce Cooldown</span>
              <span className="font-mono text-sky-400">{(config.clickCooldown * 1000).toFixed(0)} ms</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Cooldown period after a click is fired to prevent accidental double clicks.
            </p>
            <input
              type="range"
              min="0.15"
              max="0.80"
              step="0.05"
              value={config.clickCooldown}
              onChange={(e) => onChangeConfig({ ...config, clickCooldown: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* 5. Drag Hold Duration */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-200">Drag Hold Duration</span>
              <span className="font-mono text-sky-400">{(config.dragHoldDuration * 1000).toFixed(0)} ms</span>
            </div>
            <p className="text-[11px] text-slate-400">
              How long you must hold a pinch before mouse button down triggers drag-and-drop mode.
            </p>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.05"
              value={config.dragHoldDuration}
              onChange={(e) => onChangeConfig({ ...config, dragHoldDuration: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* 6. Active Margins */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-200">Active Camera Zone Margin X & Y</span>
              <span className="font-mono text-sky-400">{(config.marginX * 100).toFixed(0)}% / {(config.marginY * 100).toFixed(0)}%</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ensures you can reach all 4 corners of your screen without taking your hand out of camera view.
            </p>
            <input
              type="range"
              min="0.05"
              max="0.30"
              step="0.05"
              value={config.marginX}
              onChange={(e) => onChangeConfig({ ...config, marginX: parseFloat(e.target.value), marginY: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-850 hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
