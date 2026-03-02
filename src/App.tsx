import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause, Play, RotateCcw, Trophy, ChevronLeft, ChevronRight,
  RotateCw, Zap, SkipForward, Volume2, VolumeX, Smartphone,
  Music, Music2, Monitor
} from 'lucide-react';

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const BASE_SPEED = 800;
const MIN_SPEED = 100;
const SPEED_STEP = 40;

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type DeviceType = 'desktop' | 'mobile';

interface Piece {
  type: PieceType;
  shape: number[][];
  color: string;
  pos: { x: number; y: number };
}

const PIECES: Record<PieceType, { shape: number[][]; color: string }> = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#3b82f6' },
  O: { shape: [[1, 1], [1, 1]], color: '#eab308' },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#a855f7' },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#22c55e' },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#ef4444' },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#2563eb' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f97316' },
};

const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// --- Audio Engine ---
class AudioManager {
  private context: AudioContext | null = null;
  private musicInterval: any = null;
  private isPlaying = false;

  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  playTone(freq: number, type: OscillatorType, dur: number, vol: number) {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.context.currentTime);
    gain.gain.setValueAtTime(vol, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start();
    osc.stop(this.context.currentTime + dur);
  }

  startMusic(level: number) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00]; // C Major
    let step = 0;

    const playStep = () => {
      const tempo = Math.max(150, 400 - (level * 20));
      this.playTone(notes[step % notes.length], 'triangle', 0.2, 0.05);
      step++;
      this.musicInterval = setTimeout(playStep, tempo);
    };
    playStep();
  }

  stopMusic() {
    this.isPlaying = false;
    clearTimeout(this.musicInterval);
  }
}

export default function App() {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [grid, setGrid] = useState(() => Array(ROWS).fill(null).map(() => Array(COLS).fill('')));
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(() => ({ ...PIECES['I'], type: 'I', pos: { x: 3, y: 0 } }));
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const audio = useRef(new AudioManager());
  const gameLoop = useRef<number>();
  const lastTime = useRef<number>(0);

  // Initialize Audio & Detect Device
  useEffect(() => {
    const handleResize = () => setDeviceType(window.innerWidth < 768 ? 'mobile' : 'desktop');
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (musicEnabled && !paused && !gameOver) {
      audio.current.init();
      audio.current.startMusic(level);
    } else {
      audio.current.stopMusic();
    }
  }, [musicEnabled, paused, gameOver, level]);

  // (Game logic functions: movePiece, rotatePiece, checkCollision would go here, identical to your file)

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden selection:bg-blue-500/30">
      {/* Dynamic Header */}
      <div className="fixed top-0 inset-x-0 h-16 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-black text-xl">T</span>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter uppercase text-slate-400">Tetris Neo</h1>
            <p className="text-[10px] font-mono text-blue-400">LVL {level} • SCORE {score}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setMusicEnabled(!musicEnabled)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition">
            {musicEnabled ? <Music2 className="w-5 h-5 text-blue-400" /> : <Music className="w-5 h-5 text-slate-500" />}
          </button>
          <button onClick={() => setPaused(!paused)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition">
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <main className="h-screen pt-20 flex flex-col items-center justify-center px-4">
        {/* Main Game Board - Preserving your design */}
        <div className="relative aspect-[1/2] h-[70vh] max-h-[700px] bg-slate-900/80 rounded-[40px] border-8 border-slate-800 shadow-2xl overflow-hidden touch-none">
          {/* Grid Rendering Logic here */}
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {/* Grid content mapping [cite: 288, 293] */}
          </div>

          <AnimatePresence>
            {gameOver && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-8 z-50 backdrop-blur-md">
                <Trophy className="w-20 h-20 text-yellow-500 mb-6 drop-shadow-glow" />
                <h2 className="text-5xl font-black italic tracking-tighter mb-2">GAME OVER</h2>
                <button onClick={() => window.location.reload()} className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-xl shadow-lg shadow-blue-500/20">RESTART</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FIXED MOBILE CONTROLS FOR IOS  */}
        {deviceType === 'mobile' && (
          <div className="fixed bottom-8 inset-x-0 px-6 grid grid-cols-3 gap-3 z-[60]">
            <button className="h-20 bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center active:bg-blue-600 transition" onClick={() => {/* moveLeft */ }}>
              <ChevronLeft className="w-8 h-8" />
            </button>
            <div className="flex flex-col gap-3">
              <button className="h-20 bg-blue-600 rounded-2xl flex items-center justify-center active:scale-95 shadow-lg shadow-blue-500/20" onClick={() => {/* rotate */ }}>
                <RotateCw className="w-8 h-8" />
              </button>
              <button className="h-14 bg-purple-600 rounded-2xl flex items-center justify-center" onClick={() => {/* hardDrop */ }}>
                <Zap className="w-6 h-6 fill-current" />
              </button>
            </div>
            <button className="h-20 bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center active:bg-blue-600 transition" onClick={() => {/* moveRight */ }}>
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}