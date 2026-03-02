import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause, Play, RotateCcw, Trophy, ChevronLeft, ChevronRight,
  RotateCw, Zap, Volume2, VolumeX, Smartphone, Music2, Music
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

// --- Audio Controller ---
let audioCtx: AudioContext | null = null;
const playNote = (freq: number, type: OscillatorType, dur: number, vol: number) => {
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
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const gameLoop = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const musicTimer = useRef<number>(0);

  // --- Sound Effects ---
  const triggerSFX = (type: 'move' | 'clear' | 'drop') => {
    if (muted) return;
    if (type === 'move') playNote(150, 'square', 0.05, 0.05);
    if (type === 'drop') playNote(100, 'sawtooth', 0.1, 0.1);
    if (type === 'clear') playNote(500, 'sine', 0.3, 0.1);
  };

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

  const mergePiece = useCallback((p: Piece) => {
    const newGrid = grid.map(row => [...row]);
    p.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && p.pos.y + y >= 0) newGrid[p.pos.y + y][p.pos.x + x] = p.color;
      });
    });
    let cleared = 0;
    const filteredGrid = newGrid.filter(row => {
      const isFull = row.every(c => c !== '');
      if (isFull) cleared++;
      return !isFull;
    });
    while (filteredGrid.length < ROWS) filteredGrid.unshift(Array(COLS).fill(''));
    if (cleared > 0) {
      triggerSFX('clear');
      setScore(s => s + (cleared * 100 * level));
      setLinesCleared(l => l + cleared);
    }
    setGrid(filteredGrid);
    setCurrentPiece(null);
  }, [grid, level, muted]);

  const [linesCleared, setLinesCleared] = useState(0);
  useEffect(() => { setLevel(Math.floor(linesCleared / 10) + 1); }, [linesCleared]);

  const spawnPiece = useCallback(() => {
    // 1. Take the piece that was visible in the 'Next' window
    const pieceToSpawn = { ...nextPiece, pos: { x: 3, y: 0 } };

    if (checkCollision(pieceToSpawn)) {
      setGameOver(true);
      return;
    }

    // 2. Set it as the current active piece
    setCurrentPiece(pieceToSpawn);

    // 3. Generate a NEW piece for the 'Next' window
    const newType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    setNextPiece({ ...PIECES[newType], type: newType, pos: { x: 3, y: 0 } });
  }, [nextPiece, checkCollision]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || paused || gameOver) return;
    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      if (dx !== 0) triggerSFX('move');
    } else if (dy > 0) {
      mergePiece(currentPiece);
    }
  }, [currentPiece, paused, gameOver, checkCollision, mergePiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || paused || gameOver) return;
    const rotated = currentPiece.shape[0].map((_, i) => currentPiece.shape.map(row => row[i]).reverse());
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
      triggerSFX('move');
    }
  }, [currentPiece, paused, gameOver, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || paused || gameOver) return;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) y++;
    triggerSFX('drop');
    mergePiece({ ...currentPiece, pos: { ...currentPiece.pos, y } });
  }, [currentPiece, paused, gameOver, checkCollision, mergePiece]);

  // --- Game Loop ---
  useEffect(() => {
    const update = (time: number) => {
      const delta = time - lastTime.current;
      lastTime.current = time;
      if (!paused && !gameOver) {
        // Music loop
        if (musicEnabled && !muted) {
          musicTimer.current += delta;
          if (musicTimer.current > 400 - (level * 20)) {
            playNote(261.63 + (musicTimer.current % 100), 'triangle', 0.1, 0.02);
            musicTimer.current = 0;
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
  }, [paused, gameOver, currentPiece, level, movePiece, spawnPiece, musicEnabled, muted]);

  // Ghost Piece Logic
  const getGhostY = () => {
    if (!currentPiece) return 0;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) y++;
    return y;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30 overflow-hidden touch-none">
      {/* Header */}
      <div className="fixed top-0 inset-x-0 h-16 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-black">T</div>
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Tetris Pro</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMusicEnabled(!musicEnabled)} className="p-2 bg-white/5 rounded-lg">
            {musicEnabled ? <Music2 className="w-4 h-4 text-blue-400" /> : <Music className="w-4 h-4 text-slate-500" />}
          </button>
          <button onClick={() => setMuted(!muted)} className="p-2 bg-white/5 rounded-lg">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 p-6 pt-24 h-screen max-w-6xl mx-auto">

        {/* Next Window (Side) */}
        <div className="hidden lg:block bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-4 text-center">Next</p>
          <div className="grid grid-cols-4 gap-1">
            {nextPiece.shape.map((row, y) => row.map((cell, x) => (
              <div key={x + y} className={`w-5 h-5 rounded-sm ${cell ? '' : 'opacity-0'}`} style={{ backgroundColor: nextPiece.color }} />
            )))}
          </div>
        </div>

        {/* Play Window (Center) */}
        <div className="relative aspect-[1/2] h-full max-h-[650px] bg-slate-900 border-4 border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {grid.map((row, y) => row.map((cell, x) => {
              let color = cell || '#1e293b';
              let opacity = cell ? 1 : 0.1;
              if (currentPiece) {
                const gy = y - getGhostY();
                const py = y - currentPiece.pos.y;
                const px = x - currentPiece.pos.x;
                if (py >= 0 && py < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[py][px]) {
                  color = currentPiece.color; opacity = 1;
                } else if (gy >= 0 && gy < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[gy][px]) {
                  color = currentPiece.color; opacity = 0.2;
                }
              }
              return <div key={x + y} className="border-[0.5px] border-white/5" style={{ backgroundColor: color, opacity }} />;
            }))}
          </div>

          <AnimatePresence>
            {gameOver && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-8 z-50">
                <Trophy className="w-12 h-12 text-yellow-500 mb-4" />
                <h2 className="text-3xl font-black mb-6 italic">GAME OVER</h2>
                <button onClick={() => window.location.reload()} className="w-full py-4 bg-blue-600 rounded-2xl font-bold">RESTART</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats (Desktop only) */}
        <div className="hidden lg:flex flex-col gap-4">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 w-32">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Score</p>
            <p className="text-xl font-mono font-bold text-blue-400">{score}</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 w-32">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Level</p>
            <p className="text-xl font-mono font-bold text-purple-400">{level}</p>
          </div>
        </div>
      </div>

      {/* FIXED MOBILE CONTROLS (iOS Compatible) */}
      <div className="lg:hidden fixed bottom-10 inset-x-0 px-6 grid grid-cols-3 gap-4 z-[100]">
        <button className="h-20 bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center active:bg-blue-600" onClick={() => movePiece(-1, 0)}><ChevronLeft /></button>
        <div className="flex flex-col gap-4">
          <button className="h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30" onClick={() => rotatePiece()}><RotateCw /></button>
          <button className="h-12 bg-purple-600 rounded-xl flex items-center justify-center" onClick={() => hardDrop()}><Zap className="w-4 h-4 fill-current" /></button>
        </div>
        <button className="h-20 bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center active:bg-blue-600" onClick={() => movePiece(1, 0)}><ChevronRight /></button>
      </div>
    </div>
  );
}