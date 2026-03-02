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
  Maximize2,
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
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#3b82f6' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f97316' },
};

const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// --- Helpers ---
const createEmptyGrid = () => Array(ROWS).fill(null).map(() => Array(COLS).fill(''));

const getRandomPiece = (): Piece => {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  const piece = PIECES[type];
  return {
    type,
    shape: piece.shape.map(row => [...row]),
    color: piece.color,
    pos: { x: Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2), y: 0 },
  };
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
  const [showMobileControls, setShowMobileControls] = useState(window.innerWidth < 1024);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const gameLoop = useRef<number>();
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const boardRef = useRef<HTMLDivElement>(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setShowMobileControls(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Game Logic ---
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
            (boardY >= 0 && grid[boardY] && grid[boardY][boardX])
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, [grid]);

  const rotateShape = (shape: number[][]) => {
    return shape[0].map((_, i) => shape.map(row => row[i]).reverse());
  };

  const mergePiece = useCallback(() => {
    if (!currentPiece) return;

    const newGrid = grid.map(row => [...row]);
    currentPiece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const boardY = currentPiece.pos.y + y;
          const boardX = currentPiece.pos.x + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            newGrid[boardY][boardX] = currentPiece.color;
          }
        }
      });
    });

    // Clear lines
    let linesCleared = 0;
    const clearedGrid = newGrid.filter(row => {
      const full = row.every(cell => cell !== '');
      if (full) linesCleared++;
      return !full;
    });

    while (clearedGrid.length < ROWS) {
      clearedGrid.unshift(Array(COLS).fill(''));
    }

    // Update score
    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800];
      setScore(prev => prev + (points[linesCleared] * level));
      setLines(prev => {
        const total = prev + linesCleared;
        const newLevel = Math.floor(total / 10) + 1;
        if (newLevel > level) {
          setLevel(newLevel);
        }
        return total;
      });
    }

    setGrid(clearedGrid);
    setCurrentPiece(null);
    setCanHold(true);
  }, [currentPiece, grid, level]);

  const spawnPiece = useCallback(() => {
    const piece = { ...nextPiece };
    if (checkCollision(piece)) {
      setGameOver(true);
      return;
    }
    setCurrentPiece(piece);
    setNextPiece(getRandomPiece());
  }, [nextPiece, checkCollision]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || gameOver || paused) return false;

    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      return true;
    }

    if (dy > 0) {
      mergePiece();
    }
    return false;
  }, [currentPiece, gameOver, paused, checkCollision, mergePiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;

    const rotated = rotateShape(currentPiece.shape);
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
    }
  }, [currentPiece, gameOver, paused, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;

    // Calculate final position
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) {
      y++;
    }

    // Create a copy of the piece at the final position
    const droppedPiece = {
      ...currentPiece,
      pos: { ...currentPiece.pos, y }
    };

    // Merge immediately
    setCurrentPiece(droppedPiece);

    // Small delay to show the piece at bottom before merging
    setTimeout(() => {
      mergePiece();
    }, 10);
  }, [currentPiece, gameOver, paused, checkCollision, mergePiece]);

  const holdCurrentPiece = useCallback(() => {
    if (!currentPiece || !canHold || gameOver || paused) return;

    if (!holdPiece) {
      setHoldPiece(currentPiece);
      setCurrentPiece(null);
      spawnPiece();
    } else {
      const temp = currentPiece;
      setCurrentPiece({
        ...holdPiece,
        pos: { x: Math.floor(COLS / 2) - 1, y: 0 }
      });
      setHoldPiece(temp);
    }
    setCanHold(false);
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
    const first = getRandomPiece();
    const second = getRandomPiece();
    setCurrentPiece(first);
    setNextPiece(second);
  }, []);

  // --- Game Loop ---
  const gameUpdate = useCallback((time: number) => {
    if (paused || gameOver || !currentPiece) {
      gameLoop.current = requestAnimationFrame(gameUpdate);
      return;
    }

    const delta = time - lastTime.current;
    lastTime.current = time;
    dropCounter.current += delta;

    const speed = Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);

    if (dropCounter.current > speed) {
      movePiece(0, 1);
      dropCounter.current = 0;
    }

    gameLoop.current = requestAnimationFrame(gameUpdate);
  }, [paused, gameOver, currentPiece, level, movePiece]);

  useEffect(() => {
    gameLoop.current = requestAnimationFrame(gameUpdate);
    return () => {
      if (gameLoop.current) cancelAnimationFrame(gameLoop.current);
    };
  }, [gameUpdate]);

  useEffect(() => {
    if (!currentPiece && !gameOver) {
      spawnPiece();
    }
  }, [currentPiece, gameOver, spawnPiece]);

  // --- High Score ---
  useEffect(() => {
    const saved = localStorage.getItem('tetris-highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('tetris-highscore', score.toString());
    }
  }, [score, highScore]);

  // --- Keyboard Controls ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for game controls
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'c', 'C', 'p', 'P', 'r', 'R'].includes(e.key)) {
        e.preventDefault();
      }

      if (gameOver || paused) return;

      switch (e.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': movePiece(0, 1); break;
        case 'ArrowUp': rotatePiece(); break;
        case ' ': hardDrop(); break;
        case 'c': case 'C': holdCurrentPiece(); break;
        case 'p': case 'P': setPaused(p => !p); break;
        case 'r': case 'R': resetGame(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [movePiece, rotatePiece, hardDrop, holdCurrentPiece, resetGame, gameOver, paused]);

  // --- Touch Controls ---
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStart || !currentPiece || gameOver || paused) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 20) return;

    if (absDx > absDy) {
      // Horizontal swipe
      if (dx > 0) movePiece(1, 0);
      else movePiece(-1, 0);
    } else {
      // Vertical swipe
      if (dy > 0) hardDrop();
      else rotatePiece();
    }

    setTouchStart(null);
  };

  // --- Ghost Piece Position ---
  const getGhostY = () => {
    if (!currentPiece) return null;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) {
      y++;
    }
    return y;
  };

  const ghostY = getGhostY();

  // --- Render Piece Preview ---
  const renderPiece = (piece: Piece | null, size = 'w-5 h-5') => {
    if (!piece) return null;

    return (
      <div className="grid grid-cols-4 gap-0.5">
        {piece.shape.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              className={`${size} rounded-sm ${cell ? '' : 'opacity-0'}`}
              style={{ backgroundColor: cell ? piece.color : 'transparent' }}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-b border-white/10 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black text-lg">T</div>
            <span className="font-bold text-sm tracking-wider hidden sm:inline">TETRIS PRO</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-white/10 rounded-xl hover:bg-white/20"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="text-right">
              <div className="text-xs text-white/40">HIGH SCORE</div>
              <div className="font-mono font-bold text-emerald-400">{highScore}</div>
            </div>
            {isMobile && (
              <button
                onClick={() => setShowMobileControls(v => !v)}
                className="p-2 bg-white/10 rounded-xl hover:bg-white/20"
              >
                <Smartphone className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="pt-20 pb-8 px-2 sm:px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">

          {/* Left Panel - Hold & Stats */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white/40 mb-2 sm:mb-3">HOLD</h3>
                <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex items-center justify-center min-h-[100px] sm:min-h-[120px]">
                  {renderPiece(holdPiece, isMobile ? 'w-4 h-4' : 'w-6 h-6')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-black/40 rounded-xl p-2 sm:p-3">
                  <div className="text-xs text-white/40">SCORE</div>
                  <div className="font-mono font-bold text-base sm:text-lg text-blue-400 truncate">{score}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-2 sm:p-3">
                  <div className="text-xs text-white/40">LINES</div>
                  <div className="font-mono font-bold text-base sm:text-lg text-purple-400">{lines}</div>
                </div>
              </div>

              <div className="bg-black/40 rounded-xl p-2 sm:p-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">LEVEL</span>
                  <span className="font-mono font-bold text-lg sm:text-xl text-orange-400">{level}</span>
                </div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${(lines % 10) * 10}%` }}
                  />
                </div>
              </div>

              {/* Desktop Controls Info */}
              {!isMobile && (
                <div className="hidden lg:block bg-black/40 rounded-xl p-3 text-xs">
                  <div className="font-bold text-white/40 mb-2">CONTROLS</div>
                  <div className="grid grid-cols-2 gap-2 text-white/60">
                    <div>← → : Move</div>
                    <div>↑ : Rotate</div>
                    <div>↓ : Soft Drop</div>
                    <div>Space : Hard Drop</div>
                    <div>C : Hold</div>
                    <div>P : Pause</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center - Game Board */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <div className="relative aspect-[1/2] max-w-[400px] mx-auto w-full">
              {/* Main Board */}
              <div
                ref={boardRef}
                className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-3xl border-4 border-white/10 shadow-2xl overflow-hidden touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="grid h-full"
                  style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
                >
                  {grid.map((row, y) =>
                    row.map((cell, x) => {
                      let bgColor = cell || '#0f172a';
                      let opacity = cell ? 1 : 0.3;

                      // Current piece
                      if (currentPiece) {
                        const pieceY = y - currentPiece.pos.y;
                        const pieceX = x - currentPiece.pos.x;
                        if (
                          pieceY >= 0 &&
                          pieceY < currentPiece.shape.length &&
                          pieceX >= 0 &&
                          pieceX < currentPiece.shape[0].length &&
                          currentPiece.shape[pieceY][pieceX]
                        ) {
                          bgColor = currentPiece.color;
                          opacity = 1;
                        }
                      }

                      // Ghost piece
                      if (ghostY !== null && currentPiece && !cell) {
                        const ghostY_rel = y - ghostY;
                        const ghostX = x - currentPiece.pos.x;
                        if (
                          ghostY_rel >= 0 &&
                          ghostY_rel < currentPiece.shape.length &&
                          ghostX >= 0 &&
                          ghostX < currentPiece.shape[0].length &&
                          currentPiece.shape[ghostY_rel][ghostX]
                        ) {
                          bgColor = currentPiece.color;
                          opacity = 0.15;
                        }
                      }

                      return (
                        <div
                          key={`${y}-${x}`}
                          className="border-[0.5px] border-white/5"
                          style={{
                            backgroundColor: bgColor,
                            opacity,
                            boxShadow: cell ? `inset 0 0 10px ${bgColor}80` : 'none'
                          }}
                        />
                      );
                    })
                  )}
                </div>

                {/* Overlays */}
                <AnimatePresence>
                  {paused && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
                    >
                      <Pause className="w-12 h-12 sm:w-16 sm:h-16 text-white mb-4" />
                      <h2 className="text-2xl sm:text-3xl font-black mb-2">PAUSED</h2>
                      <button
                        onClick={() => setPaused(false)}
                        className="px-6 sm:px-8 py-2 sm:py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition text-sm sm:text-base"
                      >
                        RESUME
                      </button>
                    </motion.div>
                  )}

                  {gameOver && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center"
                    >
                      <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-500 mb-4" />
                      <h2 className="text-3xl sm:text-4xl font-black mb-2">GAME OVER</h2>
                      <p className="text-white/60 mb-4 sm:mb-6 text-sm sm:text-base">
                        Level {level} • {score} Points
                      </p>
                      <button
                        onClick={resetGame}
                        className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-bold text-base sm:text-lg hover:opacity-90 transition"
                      >
                        PLAY AGAIN
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Mobile Controls */}
            <AnimatePresence>
              {showMobileControls && isMobile && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="mt-4 grid grid-cols-4 gap-2"
                >
                  <button
                    onClick={() => movePiece(-1, 0)}
                    className="p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-xl active:scale-95 active:bg-white/20 transition border border-white/10"
                    aria-label="Move left"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
                  </button>
                  <button
                    onClick={() => movePiece(1, 0)}
                    className="p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-xl active:scale-95 active:bg-white/20 transition border border-white/10"
                    aria-label="Move right"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
                  </button>
                  <button
                    onClick={rotatePiece}
                    className="p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-xl active:scale-95 active:bg-white/20 transition border border-white/10"
                    aria-label="Rotate"
                  >
                    <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
                  </button>
                  <button
                    onClick={hardDrop}
                    className="p-3 sm:p-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl active:scale-95 transition"
                    aria-label="Hard drop"
                  >
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
                  </button>
                  <button
                    onClick={holdCurrentPiece}
                    className="p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-xl active:scale-95 active:bg-white/20 transition border border-white/10 col-span-2"
                    aria-label="Hold piece"
                  >
                    <span className="font-bold text-xs sm:text-sm">HOLD</span>
                  </button>
                  <button
                    onClick={() => setPaused(p => !p)}
                    className="p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-xl active:scale-95 active:bg-white/20 transition border border-white/10"
                    aria-label="Pause"
                  >
                    {paused ? <Play className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" /> : <Pause className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />}
                  </button>
                  <button
                    onClick={resetGame}
                    className="p-3 sm:p-4 bg-red-500/20 backdrop-blur-md rounded-xl active:scale-95 active:bg-red-500/30 transition border border-red-500/30"
                    aria-label="Reset game"
                  >
                    <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Swipe Hint for Mobile */}
            {isMobile && !showMobileControls && (
              <div className="mt-4 bg-blue-500/10 rounded-xl p-3 text-xs text-blue-400">
                <div className="flex items-center gap-2 mb-1">
                  <Maximize2 className="w-4 h-4" />
                  <span className="font-bold">SWIPE CONTROLS</span>
                </div>
                <p className="text-white/60">
                  Swipe left/right to move • Up to rotate • Down to hard drop
                </p>
              </div>
            )}
          </div>

          {/* Right Panel - Next & Actions */}
          <div className="lg:col-span-3 order-3">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white/40 mb-2 sm:mb-3">NEXT</h3>
                <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex items-center justify-center min-h-[100px] sm:min-h-[120px]">
                  {renderPiece(nextPiece, isMobile ? 'w-4 h-4' : 'w-6 h-6')}
                </div>
              </div>

              {!isMobile && (
                <div className="space-y-2">
                  <button
                    onClick={holdCurrentPiece}
                    disabled={!canHold || gameOver || paused}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:hover:bg-white/10 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    <SkipForward className="w-4 h-4" />
                    HOLD
                  </button>
                  <button
                    onClick={() => setPaused(p => !p)}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {paused ? 'RESUME' : 'PAUSE'}
                  </button>
                  <button
                    onClick={resetGame}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    RESET
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}