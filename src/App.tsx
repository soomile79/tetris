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
const playSound = (type: 'move' | 'rotate' | 'drop' | 'clear' | 'gameover') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'move':
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start();
      osc.stop(now + 0.05);
      break;
    case 'rotate':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start();
      osc.stop(now + 0.1);
      break;
    case 'drop':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start();
      osc.stop(now + 0.2);
      break;
    case 'clear':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start();
      osc.stop(now + 0.3);
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
  const [holdPiece, setHoldPiece] = useState<Piece | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const gameLoop = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);

  const triggerSound = (type: any) => { if (!muted) playSound(type); };

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

  const mergePiece = useCallback(() => {
    if (!currentPiece) return;
    const newGrid = grid.map(row => [...row]);
    currentPiece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const bY = currentPiece.pos.y + y;
          const bX = currentPiece.pos.x + x;
          if (bY >= 0) newGrid[bY][bX] = currentPiece.color;
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
    setCanHold(true);
  }, [currentPiece, grid, level, muted]);

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
    if (dy > 0) mergePiece();
    return false;
  }, [currentPiece, gameOver, paused, checkCollision, mergePiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    const rotated = currentPiece.shape[0].map((_, i) => currentPiece.shape.map(row => row[i]).reverse());
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      triggerSound('rotate');
      setCurrentPiece({ ...currentPiece, shape: rotated });
    }
  }, [currentPiece, gameOver, paused, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) y++;
    triggerSound('drop');
    setCurrentPiece({ ...currentPiece, pos: { ...currentPiece.pos, y } });
    mergePiece();
  }, [currentPiece, gameOver, paused, checkCollision, mergePiece]);

  const resetGame = () => {
    setGrid(Array(ROWS).fill(null).map(() => Array(COLS).fill('')));
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setCurrentPiece(null);
  };

  useEffect(() => {
    const update = (time: number) => {
      const delta = time - lastTime.current;
      lastTime.current = time;
      if (!paused && !gameOver && currentPiece) {
        dropCounter.current += delta;
        const speed = Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);
        if (dropCounter.current > speed) {
          movePiece(0, 1);
          dropCounter.current = 0;
        }
      }
      gameLoop.current = requestAnimationFrame(update);
    };
    gameLoop.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(gameLoop.current);
  }, [paused, gameOver, currentPiece, level, movePiece]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      {/* HUD */}
      <div className="flex justify-between p-4 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 px-3 py-1 rounded font-bold">LEVEL {level}</div>
          <div className="text-blue-400 font-mono text-xl">{score.toLocaleString()}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMuted(!muted)} className="p-2 hover:bg-white/10 rounded">
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button onClick={() => setShowMobileControls(!showMobileControls)} className="sm:hidden p-2 hover:bg-white/10 rounded">
            <Smartphone />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 p-4 max-w-5xl mx-auto h-[calc(100vh-80px)]">
        {/* Next Piece */}
        <div className="hidden lg:block bg-slate-900 p-6 rounded-2xl border border-white/10">
          <h3 className="text-slate-500 text-xs font-bold mb-4 uppercase">Next</h3>
          <div className="grid grid-cols-4 gap-1">
            {nextPiece.shape.map((r, y) => r.map((c, x) => (
              <div key={`${y}-${x}`} className={`w-6 h-6 rounded-sm ${c ? '' : 'opacity-0'}`} style={{ backgroundColor: nextPiece.color }} />
            )))}
          </div>
        </div>

        {/* Board */}
        <div className="relative bg-slate-900 border-4 border-slate-800 rounded-xl overflow-hidden shadow-2xl aspect-[1/2] h-full max-h-[700px]">
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {grid.map((row, y) => row.map((cell, x) => {
              let color = cell || '#1e293b';
              let opacity = cell ? 1 : 0.2;

              if (currentPiece) {
                const py = y - currentPiece.pos.y;
                const px = x - currentPiece.pos.x;
                if (py >= 0 && py < currentPiece.shape.length && px >= 0 && px < currentPiece.shape[0].length && currentPiece.shape[py][px]) {
                  color = currentPiece.color;
                  opacity = 1;
                }
              }
              return <div key={`${y}-${x}`} className="border-[0.5px] border-white/5" style={{ backgroundColor: color, opacity }} />;
            }))}
          </div>

          <AnimatePresence>
            {gameOver && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-8 text-center z-50">
                <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
                <h2 className="text-4xl font-black mb-2">GAME OVER</h2>
                <p className="text-slate-400 mb-8">Score: {score}</p>
                <button onClick={resetGame} className="w-full py-4 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition">PLAY AGAIN</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Controls */}
        {showMobileControls && (
          <div className="sm:hidden grid grid-cols-3 gap-2 w-full max-w-[300px]">
            <button onClick={() => movePiece(-1, 0)} className="p-6 bg-slate-800 rounded-xl active:bg-slate-700"><ChevronLeft className="mx-auto" /></button>
            <button onClick={() => rotatePiece()} className="p-6 bg-slate-800 rounded-xl active:bg-slate-700"><RotateCw className="mx-auto" /></button>
            <button onClick={() => movePiece(1, 0)} className="p-6 bg-slate-800 rounded-xl active:bg-slate-700"><ChevronRight className="mx-auto" /></button>
            <button onClick={() => hardDrop()} className="col-span-3 p-4 bg-blue-600 rounded-xl active:bg-blue-500 flex justify-center gap-2 font-bold"><Zap /> DROP</button>
          </div>
        )}
      </div>
    </div>
  );
}