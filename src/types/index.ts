export interface GestureConfig {
  cameraWidth: number;
  cameraHeight: number;
  marginX: number; // 0.0 - 0.4
  marginY: number; // 0.0 - 0.4
  smoothingFactor: number; // 0.1 - 0.95
  cursorSpeed: number; // 0.5 - 3.0
  pinchThreshold: number; // normalized distance
  dragHoldDuration: number; // seconds
  clickCooldown: number; // seconds
}

export interface HandPoint {
  x: number;
  y: number;
}

export type GestureAction = 
  | 'Idle'
  | 'Pointing'
  | 'Left Click'
  | 'Right Click'
  | 'Pinching'
  | 'Drag & Drop'
  | 'Scroll Up'
  | 'Scroll Down'
  | 'No Hand'
  | 'Disabled';

export interface CommandLogEntry {
  id: string;
  timestamp: string;
  source: 'voice' | 'gesture' | 'text' | 'system';
  intent: string;
  rawText?: string;
  status: 'success' | 'clarification' | 'halted' | 'error';
  details: string;
}

export interface WindowApp {
  id: 'notepad' | 'calc' | 'chrome' | 'gallery' | 'settings';
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface ScreenshotItem {
  id: string;
  timestamp: string;
  dataUrl: string;
  filename: string;
}
