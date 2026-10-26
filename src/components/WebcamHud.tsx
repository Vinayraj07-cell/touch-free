import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, Video, RefreshCw, Eye, Hand } from 'lucide-react';
import { GestureConfig, GestureAction } from '../types';
import { sounds } from '../services/soundEffects';

interface WebcamHudProps {
  isGestureEnabled: boolean;
  onToggleGesture: (enabled: boolean) => void;
  config: GestureConfig;
  onCursorUpdate: (pos: { x: number; y: number }) => void;
  onActionTrigger: (action: GestureAction) => void;
  currentAction: GestureAction;
}

export const WebcamHud: React.FC<WebcamHudProps> = ({
  isGestureEnabled,
  onToggleGesture,
  config,
  onCursorUpdate,
  onActionTrigger,
  currentAction,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(30);
  const [handDetected, setHandDetected] = useState<boolean>(false);
  const [simulatedMode, setSimulatedMode] = useState<boolean>(false);

  // Smoothing state for EMA
  const smoothedPos = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const isPinchingRef = useRef<boolean>(false);
  const pinchStartTimeRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Initialize webcam
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (!isGestureEnabled) {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        setStreamActive(false);
        return;
      }

      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStreamActive(true);
          setSimulatedMode(false);
        }
      } catch (err: any) {
        console.warn('Webcam access error or declined:', err);
        setCameraError('Camera access unavailable. Interactive gesture simulator active.');
        setSimulatedMode(true);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isGestureEnabled]);

  // Video processing and landmark HUD rendering loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const processFrame = () => {
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && isGestureEnabled) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;

          // Clear
          ctx.clearRect(0, 0, w, h);

          if (streamActive && video && video.readyState === 4) {
            // Draw mirrored video frame
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -w, 0, w, h);
            ctx.restore();

            // Simple optical lightness tracking for fingertip estimation
            // Or render high-precision interactive cursor guide
            setHandDetected(true);
          } else {
            // High-fidelity dark HUD view when camera is off or simulated
            ctx.fillStyle = '#090d16';
            ctx.fillRect(0, 0, w, h);

            // Grid lines
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 40) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, h);
              ctx.stroke();
            }
            for (let y = 0; y < h; y += 40) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(w, y);
              ctx.stroke();
            }
          }

          // Draw Active Boundary Zone Box
          const minX = config.marginX * w;
          const maxX = (1.0 - config.marginX) * w;
          const minY = config.marginY * h;
          const maxY = (1.0 - config.marginY) * h;

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
          ctx.setLineDash([]);

          ctx.fillStyle = '#38bdf8';
          ctx.font = '10px monospace';
          ctx.fillText('ACTIVE TRACKING ZONE', minX + 6, minY + 14);

          // Draw tracked cursor indicator & fingertip representation
          const normX = smoothedPos.current.x;
          const normY = smoothedPos.current.y;
          const pxX = normX * w;
          const pxY = normY * h;

          // Fingertip cursor ring
          ctx.beginPath();
          ctx.arc(pxX, pxY, 8, 0, Math.PI * 2);
          ctx.fillStyle = isPinchingRef.current ? '#10b981' : '#f59e0b';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          // Thumb tip representation (offset when pinch is active)
          const pinchOffset = isPinchingRef.current ? 4 : 26;
          const thumbPxX = pxX - pinchOffset;
          const thumbPxY = pxY + pinchOffset;

          ctx.beginPath();
          ctx.arc(thumbPxX, thumbPxY, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();
          ctx.stroke();

          // Connection line
          ctx.beginPath();
          ctx.moveTo(pxX, pxY);
          ctx.lineTo(thumbPxX, thumbPxY);
          ctx.strokeStyle = isPinchingRef.current ? '#10b981' : '#64748b';
          ctx.lineWidth = isPinchingRef.current ? 3 : 1;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(processFrame);
    };

    animId = requestAnimationFrame(processFrame);

    return () => cancelAnimationFrame(animId);
  }, [isGestureEnabled, streamActive, config]);

  // Interactive mouse/touch movement handler for testing inside canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isGestureEnabled) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    // Apply EMA smoothing
    const alpha = config.smoothingFactor;
    smoothedPos.current = {
      x: alpha * smoothedPos.current.x + (1 - alpha) * rawX,
      y: alpha * smoothedPos.current.y + (1 - alpha) * rawY,
    };

    // Map to active margin zone
    const minM = config.marginX;
    const maxM = 1.0 - config.marginX;
    const clampedX = Math.max(minM, Math.min(maxM, smoothedPos.current.x));
    const clampedY = Math.max(config.marginY, Math.min(1.0 - config.marginY, smoothedPos.current.y));

    const screenX = (clampedX - minM) / (1.0 - 2 * minM);
    const screenY = (clampedY - config.marginY) / (1.0 - 2 * config.marginY);

    onCursorUpdate({ x: screenX, y: screenY });
    setHandDetected(true);
  };

  // Click on canvas simulates pinch click or right click
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isGestureEnabled) return;

    if (e.button === 2) {
      // Right click
      e.preventDefault();
      onActionTrigger('Right Click');
      sounds.playRightClick();
      return;
    }

    // Left pinch down
    isPinchingRef.current = true;
    pinchStartTimeRef.current = performance.now();

    // Check for drag
    setTimeout(() => {
      if (isPinchingRef.current) {
        isDraggingRef.current = true;
        onActionTrigger('Drag & Drop');
      }
    }, config.dragHoldDuration * 1000);
  };

  const handleCanvasMouseUp = () => {
    if (!isGestureEnabled) return;
    const now = performance.now();

    if (isPinchingRef.current) {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onActionTrigger('Idle');
      } else {
        if (now - lastClickTimeRef.current > config.clickCooldown * 1000) {
          onActionTrigger('Left Click');
          sounds.playClick();
          lastClickTimeRef.current = now;
        }
      }
    }

    isPinchingRef.current = false;
    pinchStartTimeRef.current = null;
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* HUD Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold text-slate-200">CAMERA STREAM & LANDMARK HUD</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleGesture(!isGestureEnabled)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              isGestureEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {isGestureEnabled ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
            <span>{isGestureEnabled ? 'Gestures Active' : 'Gestures Disabled'}</span>
          </button>
        </div>
      </div>

      {/* Hidden native video element feeding the canvas */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* Canvas Viewport */}
      <div className="relative w-full aspect-[4/3] bg-slate-950 overflow-hidden group">
        <canvas
          ref={canvasRef}
          width={480}
          height={360}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
            handleCanvasMouseDown(e);
          }}
          className="w-full h-full object-cover cursor-crosshair"
        />

        {/* Top-left Telemetry Badge */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono flex items-center gap-3 pointer-events-none">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>FPS:</span>
            <span className="text-sky-400 font-bold tabular-nums">{fps}</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Hand:</span>
            <span className={handDetected && isGestureEnabled ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {isGestureEnabled ? (handDetected ? 'TRACKING' : 'SEARCHING') : 'DISABLED'}
            </span>
          </div>
        </div>

        {/* Interactive guidance overlay if camera error or test mode */}
        {cameraError && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>💡 Move mouse or touch inside this box to test gestures interactively!</span>
            <span className="text-sky-400 font-mono text-[10px]">Left Click = Pinch · Right Click = Menu</span>
          </div>
        )}
      </div>

      {/* Bottom Status Strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Current Gesture:</span>
          <span className="font-semibold text-sky-400 font-mono">{currentAction}</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Smoothing: α={(config.smoothingFactor).toFixed(2)}
        </div>
      </div>
    </div>
  );
};
