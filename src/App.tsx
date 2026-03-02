import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause,
  Play,
  RotateCcw,
  Trophy,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Zap,
  SkipForward,
  Smartphone,
  Volume2,
  VolumeX
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

// --- Audio Engine ---
let audioCtx: AudioContext | null = null;
let musicOsc: OscillatorNode | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

const playSound = (type: 'move' | 'rotate' | 'drop' | 'clear') => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;

  switch (type) {
    case 'move':
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(); osc.stop(now + 0.05);
      break;
    case 'rotate':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(); osc.stop(now + 0.1);
      break;
    case 'drop':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(); osc.stop(now + 0.1);
      break;
    case 'clear':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(); osc.stop(now + 0.3);
      break;
  }
};

export default function App() {
  const [grid, setGrid] = useState(() => Array(ROWS).fill(null).map(() => Array(COLS).fill('')));
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(() => {
    const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    return { ...PIECES[type], type, pos: { x: 3, y: 0 } };
  });
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const gameLoop = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const musicStep = useRef(0);
  const nextNoteTime = useRef(0);

  const triggerSound = (type: any) => { if (!muted) playSound(type); };

  // --- Background Music Logic ---
  const playMusicStep = useCallback((ctx: AudioContext, time: number) => {
    const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 349.23, 329.63, 293.66]; // C4 Scale loop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(melody[musicStep.current % melody.length], time);

    gain.gain.setValueAtTime(0.02, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.2);

    musicStep.current++;
  }, []);

  const checkCollision = useCallback((piece: Piece, newPos = piece.pos, newShape = piece.shape) => {
    for (let y = 0; y < newShape.length; y++) {
      for (let x = 0; x < newShape[y].length; x++) {
        if (newShape[y][x]) {
          const boardX = newPos.x + x;
          const boardY = newPos.y + y;
          if (boardX < 0 || boardX >= COLS || boardY >= ROWS || (boardY >= 0 && grid[boardY][boardX])) return true;
        }
      }
    }
    return false;
  }, [grid]);

  const performMerge = useCallback((pieceToMerge: Piece) => {
    const newGrid = grid.map(row => [...row]);
    pieceToMerge.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const bY = pieceToMerge.pos.y + y;
          const bX = pieceToMerge.pos.x + x;
          if (bY >= 0) newGrid[bY][bX] = pieceToMerge.color;
        }
      });
    });

    let linesCleared = 0;
    const clearedGrid = newGrid.filter(row => {
      const full = row.every(c => c);
      if (full) linesCleared++;
      return !full;
    });

    while (clearedGrid.length < ROWS) clearedGrid.unshift(Array(COLS).fill(''));

    if (linesCleared > 0) {
      triggerSound('clear');
      const points = [0, 100, 300, 500, 800];
      setScore(s => s + (points[linesCleared] * level));
      setLines(l => {
        const total = l + linesCleared;
        setLevel(Math.floor(total / 10) + 1);
        return total;
      });
    }

    setGrid(clearedGrid);
    setCurrentPiece(null);
  }, [grid, level, triggerSound]);

  const spawnPiece = useCallback(() => {
    const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    const p = { ...nextPiece, pos: { x: Math.floor(COLS / 2) - 2, y: 0 } };
    if (checkCollision(p)) {
      setGameOver(true);
      return;
    }
    setCurrentPiece(p);
    setNextPiece({ ...PIECES[type], type, pos: { x: 3, y: 0 } });
  }, [nextPiece, checkCollision]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || gameOver || paused) return false;
    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      if (dx !== 0) triggerSound('move');
      return true;
    }
    if (dy > 0) performMerge(currentPiece);
    return false;
  }, [currentPiece, gameOver, paused, checkCollision, performMerge, triggerSound]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    const rotated = currentPiece.shape[0].map((_, i) => currentPiece.shape.map(row => row[i]).reverse());
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      triggerSound('rotate');
      setCurrentPiece({ ...currentPiece, shape: rotated });
    }
  }, [currentPiece, gameOver, paused, checkCollision, triggerSound]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) y++;
    triggerSound('drop');
    performMerge({ ...currentPiece, pos: { ...currentPiece.pos, y } });
  }, [currentPiece, gameOver, paused, checkCollision, performMerge, triggerSound]);

  useEffect(() => {
    const update = (time: number) => {
      const delta = time - lastTime.current;
      lastTime.current = time;

      if (!paused && !gameOver) {
        // Music Scheduler
        if (!muted) {
          const ctx = initAudio();
          if (time / 1000 >= nextNoteTime.current) {
            const tempo = Math.max(0.15, 0.4 - (level * 0.02)); // Speed up music with level
            playMusicStep(ctx, ctx.currentTime);
            nextNoteTime.current = (time / 1000) + tempo;
          }
        }

        if (currentPiece) {
          dropCounter.current += delta;
          const speed = Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);
          if (dropCounter.current > speed) {
            movePiece(0, 1);
            dropCounter.current = 0;
          }
        }
      }
      gameLoop.current = requestAnimationFrame(update);
    };
    gameLoop.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(gameLoop.current);
  }, [paused, gameOver, currentPiece, level, movePiece, muted, playMusicStep]);

  useEffect(() => { if (!currentPiece && !gameOver) spawnPiece(); }, [currentPiece, gameOver, spawnPiece]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver || paused) return;
      switch (e.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': movePiece(0, 1); break;
        case 'ArrowUp': rotatePiece(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
        case 'p': setPaused(v => !v); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [movePiece, rotatePiece, hardDrop, paused, gameOver]);

  const getGhostY = () => {
    if (!currentPiece) return 0;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) y++;
    return y;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <div className="flex justify-between p-4 bg-slate-900/50 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Level</span>
            <span className="text-xl font-black text-blue-500">{level}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Score</span>
            <span className="text-xl font-mono font-bold text-white">{score.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMuted(!muted)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition">
            {muted ? <VolumeX className="w-5 h-5 text-slate-400" /> : <Volume2 className="w-5 h-5 text-blue-400" />}
          </button>
          <button onClick={() => setShowMobileControls(!showMobileControls)} className="sm:hidden p-3 bg-white/5 rounded-xl">
            <Smartphone className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-12 p-6 max-w-6xl mx-auto h-[calc(100vh-100px)]">
        {/* Next Piece Side Panel */}
        <div className="hidden lg:flex flex-col gap-4">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
            <h3 className="text-slate-500 text-[10px] font-black mb-6 uppercase tracking-widest text-center">Next Up</h3>
            <div className="grid grid-cols-4 gap-1.5 p-2">
              {nextPiece.shape.map((r, y) => r.map((c, x) => (
                <div key={`${y}-${x}`} className={`w-6 h-6 rounded-md shadow-lg ${c ? '' : 'opacity-0'}`} style={{ backgroundColor: nextPiece.color, boxShadow: c ? `0 0 15px ${nextPiece.color}44` : 'none' }} />
              )))}
            </div>
          </div>
        </div>

        {/* The Main Board */}
        <div className="relative bg-slate-900/80 border-[6px] border-slate-800 rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] aspect-[1/2] h-full max-h-[750px]">
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {grid.map((row, y) => row.map((cell, x) => {
              let color = cell || '#0f172a';
              let opacity = cell ? 1 : 0.3;

              if (currentPiece) {
                const ghostY = getGhostY();
                const py = y - currentPiece.pos.y;
                const px = x - currentPiece.pos.x;
                const gy = y - ghostY;

                if (py >= 0 && py < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[py][px]) {
                  color = currentPiece.color;
                  opacity = 1;
                } else if (gy >= 0 && gy < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[gy][px]) {
                  color = currentPiece.color;
                  opacity = 0.15;
                }
              }
              return <div key={`${y}-${x}`} className="border-[0.5px] border-white/5" style={{ backgroundColor: color, opacity }} />;
            }))}
          </div>

          <AnimatePresence>
            {gameOver && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-10 text-center z-50 backdrop-blur-md">
                <Trophy className="w-20 h-20 text-yellow-500 mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]" />
                <h2 className="text-5xl font-black mb-2 tracking-tighter italic">GAME OVER</h2>
                <div className="text-slate-400 mb-10 font-mono">FINAL SCORE: {score.toLocaleString()}</div>
                <button onClick={() => window.location.reload()} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-lg transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)]">PLAY AGAIN</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile UI Controls */}
        {showMobileControls && (
          <div className="sm:hidden grid grid-cols-3 gap-3 w-full max-w-[340px] mt-4">
            <button onClick={() => movePiece(-1, 0)} className="p-8 bg-slate-800/50 rounded-2xl active:scale-95 transition"><ChevronLeft className="mx-auto w-8 h-8" /></button>
            <button onClick={() => rotatePiece()} className="p-8 bg-slate-800/50 rounded-2xl active:scale-95 transition"><RotateCw className="mx-auto w-8 h-8 text-blue-400" /></button>
            <button onClick={() => movePiece(1, 0)} className="p-8 bg-slate-800/50 rounded-2xl active:scale-95 transition"><ChevronRight className="mx-auto w-8 h-8" /></button>
            <button onClick={() => hardDrop()} className="col-span-3 p-6 bg-blue-600 rounded-2xl active:scale-95 font-black flex justify-center gap-3 items-center text-xl shadow-lg"><Zap className="fill-current" /> HARD DROP</button>
          </div>
        )}
      </div>
    </div>
  );
}