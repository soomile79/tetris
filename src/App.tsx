import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause, Play, RotateCcw, Trophy, ChevronDown, ChevronLeft, ChevronRight,
  RotateCw, Zap, SkipForward, Volume2, VolumeX, Smartphone, Music, Music2
} from 'lucide-react';

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const BASE_SPEED = 800;
const MIN_SPEED = 100;
const SPEED_STEP = 40;

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

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

// --- Audio Manager ---
let audioCtx: AudioContext | null = null;
const playTone = (freq: number, type: OscillatorType, dur: number, vol: number) => {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
};

export default function App() {
  const [grid, setGrid] = useState(() => Array(ROWS).fill(null).map(() => Array(COLS).fill('')));
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(() => {
    const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    return { ...PIECES[type], type, pos: { x: 3, y: 0 } };
  });
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);

  const gameLoop = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const musicCounter = useRef<number>(0);

  const checkCollision = useCallback((piece: Piece, newPos = piece.pos, newShape = piece.shape) => {
    for (let y = 0; y < newShape.length; y++) {
      for (let x = 0; x < newShape[y].length; x++) {
        if (newShape[y][x]) {
          const bX = newPos.x + x;
          const bY = newPos.y + y;
          if (bX < 0 || bX >= COLS || bY >= ROWS || (bY >= 0 && grid[bY][bX])) return true;
        }
      }
    }
    return false;
  }, [grid]);

  const spawnPiece = useCallback(() => {
    // 1. Take the piece currently in the "Next" window
    const newCurrent = { ...nextPiece, pos: { x: 3, y: 0 } };

    // 2. Generate the NEW "Next" piece
    const nextType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    const newNext = { ...PIECES[nextType], type: nextType, pos: { x: 3, y: 0 } };

    if (checkCollision(newCurrent)) {
      setGameOver(true);
      return;
    }

    setCurrentPiece(newCurrent);
    setNextPiece(newNext);
  }, [nextPiece, checkCollision]);

  const mergePiece = useCallback((p: Piece) => {
    const newGrid = grid.map(row => [...row]);
    p.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && p.pos.y + y >= 0) newGrid[p.pos.y + y][p.pos.x + x] = p.color;
      });
    });

    let cleared = 0;
    const filteredGrid = newGrid.filter(row => {
      const full = row.every(c => c !== '');
      if (full) cleared++;
      return !full;
    });

    while (filteredGrid.length < ROWS) filteredGrid.unshift(Array(COLS).fill(''));

    if (cleared > 0) {
      if (!muted) playTone(600, 'sine', 0.4, 0.1);
      setScore(s => s + (cleared * 100 * level));
      setLines(l => {
        const total = l + cleared;
        setLevel(Math.floor(total / 10) + 1);
        return total;
      });
    }

    setGrid(filteredGrid);
    setCurrentPiece(null);
  }, [grid, level, muted]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || paused || gameOver) return;
    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      if (dx !== 0 && !muted) playTone(150, 'square', 0.05, 0.03);
    } else if (dy > 0) {
      mergePiece(currentPiece);
    }
  }, [currentPiece, paused, gameOver, checkCollision, mergePiece, muted]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || paused || gameOver) return;
    const rotated = currentPiece.shape[0].map((_, i) => currentPiece.shape.map(row => row[i]).reverse());
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
      if (!muted) playTone(300, 'triangle', 0.1, 0.05);
    }
  }, [currentPiece, paused, gameOver, checkCollision, muted]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || paused || gameOver) return;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) y++;
    if (!muted) playTone(100, 'sawtooth', 0.1, 0.1);
    mergePiece({ ...currentPiece, pos: { ...currentPiece.pos, y } });
  }, [currentPiece, paused, gameOver, checkCollision, mergePiece, muted]);

  useEffect(() => {
    const update = (time: number) => {
      const delta = time - lastTime.current;
      lastTime.current = time;

      if (!paused && !gameOver) {
        // Music logic
        if (musicOn && !muted) {
          musicCounter.current += delta;
          const tempo = Math.max(150, 400 - (level * 20));
          if (musicCounter.current > tempo) {
            playTone(200 + (Math.random() * 100), 'triangle', 0.1, 0.02);
            musicCounter.current = 0;
          }
        }

        if (currentPiece) {
          dropCounter.current += delta;
          const speed = Math.max(MIN_SPEED, BASE_SPEED - (level * SPEED_STEP));
          if (dropCounter.current > speed) {
            movePiece(0, 1);
            dropCounter.current = 0;
          }
        } else {
          spawnPiece();
        }
      }
      gameLoop.current = requestAnimationFrame(update);
    };
    gameLoop.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(gameLoop.current);
  }, [paused, gameOver, currentPiece, level, movePiece, spawnPiece, musicOn, muted]);

  // Key Listeners
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') movePiece(-1, 0);
      if (e.key === 'ArrowRight') movePiece(1, 0);
      if (e.key === 'ArrowDown') movePiece(0, 1);
      if (e.key === 'ArrowUp') rotatePiece();
      if (e.key === ' ') { e.preventDefault(); hardDrop(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [movePiece, rotatePiece, hardDrop]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 lg:p-8 font-sans flex flex-col items-center justify-center overflow-hidden touch-none">

      {/* Header Stat Bar */}
      <div className="w-full max-w-[500px] mb-6 flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-blue-500 font-black tracking-tighter text-2xl">TETRIS PRO</span>
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">Next-Gen Arcade</span>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setMusicOn(!musicOn)} className="p-2 bg-white/5 rounded-lg border border-white/10">
            {musicOn ? <Music2 className="w-4 h-4 text-blue-400" /> : <Music className="w-4 h-4 text-slate-500" />}
          </button>
          <div className="text-right">
            <p className="text-slate-500 text-[10px] font-bold uppercase">Score</p>
            <p className="text-2xl font-mono font-black">{score.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Main Board Container */}
        <div className="relative p-2 bg-slate-900 rounded-[2.5rem] border-[6px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="bg-slate-950 rounded-[2rem] overflow-hidden relative" style={{ width: 'min(80vw, 320px)', height: 'min(160vw, 640px)' }}>
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {grid.map((row, y) => row.map((cell, x) => {
                let color = cell || 'transparent';
                let opacity = cell ? 1 : 0;

                if (currentPiece) {
                  const py = y - currentPiece.pos.y;
                  const px = x - currentPiece.pos.x;
                  if (py >= 0 && py < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[py][px]) {
                    color = currentPiece.color;
                    opacity = 1;
                  }
                }
                return (
                  <div key={`${y}-${x}`} className="border-[0.5px] border-white/[0.03] relative">
                    {opacity > 0 && (
                      <div className="absolute inset-[1px] rounded-sm shadow-inner" style={{ backgroundColor: color }}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>

            {/* Game Over Overlay */}
            <AnimatePresence>
              {gameOver && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-50">
                  <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
                  <h2 className="text-4xl font-black mb-2 italic">GAME OVER</h2>
                  <p className="text-slate-400 mb-8 font-mono">Final Score: {score}</p>
                  <button onClick={() => window.location.reload()} className="w-full py-4 bg-blue-600 rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition">REPLAY</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 w-full lg:w-48">
          {/* Next Piece Window */}
          <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 backdrop-blur-xl">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 text-center">Next Piece</p>
            <div className="flex justify-center items-center h-20">
              <div className="grid grid-cols-4 gap-1">
                {nextPiece.shape.map((row, y) => row.map((cell, x) => (
                  <div key={`${y}-${x}`} className={`w-4 h-4 rounded-sm ${cell ? '' : 'opacity-0'}`} style={{ backgroundColor: nextPiece.color, boxShadow: cell ? `0 0 10px ${nextPiece.color}66` : 'none' }} />
                )))}
              </div>
            </div>
          </div>

          {/* Level Stats */}
          <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 backdrop-blur-xl flex justify-between lg:flex-col items-center lg:items-start gap-2">
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Level</p>
              <p className="text-2xl font-black text-blue-500">{level}</p>
            </div>
            <div className="lg:mt-4 text-right lg:text-left">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Lines</p>
              <p className="text-xl font-bold text-white">{lines}</p>
            </div>
          </div>

          {/* Pause Button */}
          <button onClick={() => setPaused(!paused)} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-bold transition flex items-center justify-center gap-2">
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      </div>

      {/* MOBILE CONTROLS - FIXED FOR IOS */}
      <div className="lg:hidden fixed bottom-8 left-0 right-0 px-6 flex flex-col gap-4 z-[60]">
        <div className="grid grid-cols-3 gap-4">
          <button className="h-16 bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center active:bg-blue-600" onClick={() => movePiece(-1, 0)}><ChevronLeft /></button>
          <button className="h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg active:scale-95" onClick={() => rotatePiece()}><RotateCw /></button>
          <button className="h-16 bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center active:bg-blue-600" onClick={() => movePiece(1, 0)}><ChevronRight /></button>
        </div>
        <button className="w-full py-4 bg-purple-600 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl active:scale-95" onClick={() => hardDrop()}>
          <Zap className="fill-current w-5 h-5" /> HARD DROP
        </button>
      </div>
    </div>
  );
}