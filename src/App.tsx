import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause,
  Play,
  RotateCcw,
  Trophy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Zap,
  SkipForward,
  Smartphone,
  Maximize2
} from 'lucide-react';

// --- Constants ---
const COLS = 10;[cite: 3]
const ROWS = 20;[cite: 3]
const BASE_SPEED = 800;[cite: 3]
const MIN_SPEED = 100;[cite: 3]
const SPEED_STEP = 40;[cite: 4]

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
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#3b82f6' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f97316' },
};

const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];[cite: 8]

const createEmptyGrid = () => Array(ROWS).fill(null).map(() => Array(COLS).fill(''));[cite: 9]

const getRandomPiece = (): Piece => {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];[cite: 10]
  const piece = PIECES[type];
  return {
    type,
    shape: piece.shape.map(row => [...row]),
    color: piece.color,
    pos: { x: Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2), y: 0 },
  };[cite: 11]
};

export default function App() {
  const [grid, setGrid] = useState(createEmptyGrid());
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(getRandomPiece());
  const [holdPiece, setHoldPiece] = useState<Piece | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const gameLoop = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);

  const checkCollision = useCallback((piece: Piece, newPos = piece.pos, newShape = piece.shape) => {
    for (let y = 0; y < newShape.length; y++) {
      for (let x = 0; x < newShape[y].length; x++) {
        if (newShape[y][x]) {
          const boardX = newPos.x + x;
          const boardY = newPos.y + y;
          if (
            boardX < 0 ||
            boardX >= COLS ||
            boardY >= ROWS ||
            (boardY >= 0 && grid[boardY][boardX])
          ) {
            return true;[cite: 18]
          }
        }
      }
    }
    return false;[cite: 19]
  }, [grid]);

  const rotateShape = (shape: number[][]) => {
    return shape[0].map((_, i) => shape.map(row => row[i]).reverse());[cite: 20]
  };

  const mergePiece = useCallback(() => {
    setCurrentPiece(prevPiece => {
      if (!prevPiece) return null;

      const newGrid = grid.map(row => [...row]);
      prevPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell) {
            const boardY = prevPiece.pos.y + y;
            const boardX = prevPiece.pos.x + x;
            if (boardY >= 0) newGrid[boardY][boardX] = prevPiece.color;[cite: 22]
          }
        });
      });

      let linesCleared = 0;
      const clearedGrid = newGrid.filter(row => {
        const full = row.every(cell => cell);
        if (full) linesCleared++;
        return !full;
      });

      while (clearedGrid.length < ROWS) {
        clearedGrid.unshift(Array(COLS).fill(''));[cite: 23]
      }

      if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800];
        setScore(prev => prev + (points[linesCleared] * level));[cite: 23]
        setLines(prev => {
          const total = prev + linesCleared;
          setLevel(Math.floor(total / 10) + 1);[cite: 24]
          return total;
        });
      }

      setGrid(clearedGrid);
      setCanHold(true);
      return null;
    });
  }, [grid, level]);

  const spawnPiece = useCallback(() => {
    const piece = { ...nextPiece };
    if (checkCollision(piece)) {
      setGameOver(true);[cite: 25]
      return;
    }
    setCurrentPiece(piece);
    setNextPiece(getRandomPiece());[cite: 25]
  }, [nextPiece, checkCollision]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || gameOver || paused) return false;

    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      return true;
    }

    if (dy > 0) mergePiece();[cite: 26]
    return false;
  }, [currentPiece, gameOver, paused, checkCollision, mergePiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;

    const rotated = rotateShape(currentPiece.shape);
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });[cite: 27]
    }
  }, [currentPiece, gameOver, paused, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;

    let finalY = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: finalY + 1 })) {
      finalY++;[cite: 28]
    }

    // Update piece to bottom and lock immediately
    const droppedPiece = { ...currentPiece, pos: { ...currentPiece.pos, y: finalY } };

    const newGrid = grid.map(row => [...row]);
    droppedPiece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const boardY = droppedPiece.pos.y + y;
          const boardX = droppedPiece.pos.x + x;
          if (boardY >= 0) newGrid[boardY][boardX] = droppedPiece.color;
        }
      });
    });

    let linesCleared = 0;
    const clearedGrid = newGrid.filter(row => {
      const full = row.every(cell => cell);
      if (full) linesCleared++;
      return !full;
    });

    while (clearedGrid.length < ROWS) {
      clearedGrid.unshift(Array(COLS).fill(''));
    }

    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800];
      setScore(prev => prev + (points[linesCleared] * level));
      setLines(prev => {
        const total = prev + linesCleared;
        setLevel(Math.floor(total / 10) + 1);
        return total;
      });
    }

    setGrid(clearedGrid);
    setCurrentPiece(null);
    setCanHold(true);
  }, [currentPiece, gameOver, paused, checkCollision, grid, level]);

  const holdCurrentPiece = useCallback(() => {
    if (!currentPiece || !canHold || gameOver || paused) return;

    if (!holdPiece) {
      setHoldPiece(currentPiece);[cite: 29]
      setCurrentPiece(null);
      spawnPiece();[cite: 29]
    } else {
      const temp = currentPiece;
      setCurrentPiece({
        ...holdPiece,
        pos: { x: Math.floor(COLS / 2) - 1, y: 0 }
      });
      setHoldPiece(temp);[cite: 30]
    }
    setCanHold(false);[cite: 30]
  }, [currentPiece, holdPiece, canHold, gameOver, paused, spawnPiece]);

  const resetGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setHoldPiece(null);
    setCanHold(true);
    setCurrentPiece(getRandomPiece());
    setNextPiece(getRandomPiece());[cite: 31]
  }, []);

  const gameUpdate = useCallback((time: number) => {
    if (paused || gameOver || !currentPiece) {
      gameLoop.current = requestAnimationFrame(gameUpdate);[cite: 32]
      return;
    }

    const delta = time - lastTime.current;
    lastTime.current = time;
    dropCounter.current += delta;

    const speed = Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);[cite: 32]

    if (dropCounter.current > speed) {
      movePiece(0, 1);
      dropCounter.current = 0;[cite: 33]
    }

    gameLoop.current = requestAnimationFrame(gameUpdate);[cite: 33]
  }, [paused, gameOver, currentPiece, level, movePiece]);

  useEffect(() => {
    gameLoop.current = requestAnimationFrame(gameUpdate);
    return () => cancelAnimationFrame(gameLoop.current);[cite: 34]
  }, [gameUpdate]);

  useEffect(() => {
    if (!currentPiece && !gameOver) spawnPiece();[cite: 35]
  }, [currentPiece, gameOver, spawnPiece]);

  useEffect(() => {
    const saved = localStorage.getItem('tetris-highscore');
    if (saved) setHighScore(parseInt(saved));[cite: 36]
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('tetris-highscore', score.toString());[cite: 37]
    }
  }, [score, highScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver || paused) {
        if ((e.key === 'r' || e.key === 'R') && gameOver) resetGame();
        if ((e.key === 'p' || e.key === 'P')) setPaused(p => !p);
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;[cite: 38]
        case 'ArrowRight': movePiece(1, 0); break;[cite: 38]
        case 'ArrowDown': movePiece(0, 1); break;[cite: 39]
        case 'ArrowUp': rotatePiece(); break;[cite: 39]
        case ' ': e.preventDefault(); hardDrop(); break;[cite: 39]
        case 'c': case 'C': holdCurrentPiece(); break;[cite: 39]
        case 'p': case 'P': setPaused(p => !p); break;[cite: 39]
        case 'r': case 'R': resetGame(); break;[cite: 39]
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);[cite: 40, 41]
  }, [movePiece, rotatePiece, hardDrop, holdCurrentPiece, resetGame, gameOver, paused]);

  const getGhostY = () => {
    if (!currentPiece) return null;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) {
      y++;[cite: 51]
    }
    return y;[cite: 52]
  };

  const ghostY = getGhostY();

  const renderPiecePreview = (piece: Piece | null, size = 'w-5 h-5') => {
    if (!piece) return null;
    return (
      <div className="grid grid-cols-4 gap-0.5">
        {piece.shape.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              className={`${size} rounded-sm ${cell ? '' : 'opacity-0'}`}
              style={{ backgroundColor: cell ? piece.color : 'transparent' }}
            /> [cite: 54, 55]
        ))
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white font-sans">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-b border-white/10 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black text-lg">T</div>
            <span className="font-bold text-sm tracking-wider hidden sm:inline">TETRIS PRO</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-white/40">HIGH SCORE</div>
              <div className="font-mono font-bold text-emerald-400">{highScore}</div>
            </div>
            <button onClick={() => setShowMobileControls(v => !v)} className="sm:hidden p-2 bg-white/10 rounded-xl hover:bg-white/20">
              <Smartphone className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="pt-24 pb-8 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Stats */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
              <h3 className="text-xs font-bold text-white/40 mb-3 uppercase tracking-widest">Hold</h3>
              <div className="bg-black/40 rounded-xl p-4 flex items-center justify-center min-h-[120px]">
                {renderPiecePreview(holdPiece, 'w-6 h-6')}
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 grid grid-cols-2 gap-3">
              <div className="bg-black/40 rounded-xl p-3">
                <div className="text-xs text-white/40">SCORE</div>
                <div className="font-mono font-bold text-lg text-blue-400">{score}</div>
              </div>
              <div className="bg-black/40 rounded-xl p-3">
                <div className="text-xs text-white/40">LINES</div>
                <div className="font-mono font-bold text-lg text-purple-400">{lines}</div>
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <div className="relative aspect-[1/2] max-w-[380px] mx-auto">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-2xl border-4 border-white/10 shadow-2xl overflow-hidden grid"
                style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                {grid.map((row, y) =>
                  row.map((cell, x) => {
                    let bgColor = cell || '#0f172a';
                    let opacity = cell ? 1 : 0.1;

                    if (currentPiece) {
                      const pY = y - currentPiece.pos.y;
                      const pX = x - currentPiece.pos.x;
                      if (pY >= 0 && pY < currentPiece.shape.length && pX >= 0 && pX < currentPiece.shape[0].length && currentPiece.shape[pY][pX]) {
                        bgColor = currentPiece.color;
                        opacity = 1;[cite: 74]
                      }
                    }

                if (ghostY !== null && currentPiece && !cell) {
                      const gY = y - ghostY;
                const gX = x - currentPiece.pos.x;
                      if (gY >= 0 && gY < currentPiece.shape.length && gX >= 0 && gX < currentPiece.shape[0].length && currentPiece.shape[gY][gX]) {
                  bgColor = currentPiece.color;
                opacity = 0.2; [cite: 78]
                      }
                    }

                return (
                <div key={`${y}-${x}`} className="border-[0.5px] border-white/5"
                  style={{ backgroundColor: bgColor, opacity, boxShadow: cell ? `inset 0 0 8px ${bgColor}aa` : 'none' }} />
                );
                  })
                )}

                <AnimatePresence>
                  {paused && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                      <Pause className="w-16 h-16 mb-4" />
                      <h2 className="text-2xl font-black">PAUSED</h2>
                      <button onClick={() => setPaused(false)} className="mt-4 px-6 py-2 bg-white text-black rounded-full font-bold">RESUME</button>
                    </motion.div>
                  )}
                  {gameOver && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
                      <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
                      <h2 className="text-3xl font-black mb-2">GAME OVER</h2>
                      <p className="text-white/60 mb-6">Score: {score} | Level: {level}</p>
                      <button onClick={resetGame} className="w-full py-3 bg-blue-500 rounded-xl font-bold">PLAY AGAIN</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-3 order-3 space-y-4">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
              <h3 className="text-xs font-bold text-white/40 mb-3 uppercase tracking-widest">Next</h3>
              <div className="bg-black/40 rounded-xl p-4 flex items-center justify-center min-h-[120px]">
                {renderPiecePreview(nextPiece, 'w-6 h-6')}
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={holdCurrentPiece} className="w-full py-3 bg-white/10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/20 transition">
                <SkipForward className="w-4 h-4" /> HOLD
              </button>
              <button onClick={() => setPaused(p => !p)} className="w-full py-3 bg-white/10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/20 transition">
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {paused ? 'RESUME' : 'PAUSE'}
              </button>
              <button onClick={resetGame} className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition">
                <RotateCcw className="w-4 h-4" /> RESET
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}