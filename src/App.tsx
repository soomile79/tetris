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
  Volume2,
  VolumeX,
  RefreshCw
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const gameLoop = useRef<number>();
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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

    let linesCleared = 0;
    const clearedGrid = newGrid.filter(row => {
      const full = row.every(cell => cell !== '');
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
        const newLevel = Math.floor(total / 10) + 1;
        if (newLevel > level) setLevel(newLevel);
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

    if (dy > 0) mergePiece();
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

    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) {
      y++;
    }

    const droppedPiece = {
      ...currentPiece,
      pos: { ...currentPiece.pos, y }
    };

    setCurrentPiece(droppedPiece);
    setTimeout(() => mergePiece(), 10);
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
    setShowMenu(false);
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
    if (!currentPiece && !gameOver) spawnPiece();
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

  // --- Touch Controls ---
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartRef.current || !currentPiece || gameOver || paused) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 15) return;

    if (absDx > absDy) {
      // Horizontal swipe
      if (dx > 0) movePiece(1, 0);
      else movePiece(-1, 0);
    } else {
      // Vertical swipe
      if (dy > 0) hardDrop();
      else rotatePiece();
    }

    touchStartRef.current = null;
  };

  // --- Ghost Piece ---
  const getGhostY = () => {
    if (!currentPiece) return null;
    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) {
      y++;
    }
    return y;
  };

  const ghostY = getGhostY();

  // --- Render ---
  const renderPiece = (piece: Piece | null, size = 'w-4 h-4') => {
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
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-b border-white/10 z-10 px-4 py-2">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black">T</div>
            <span className="font-bold text-sm">TETRIS</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2">
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button onClick={() => setShowMenu(!showMenu)} className="p-2">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Score Bar */}
      <div className="fixed top-14 left-0 right-0 bg-black/40 backdrop-blur-sm border-b border-white/5 z-10 px-4 py-2">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div>
            <div className="text-xs text-white/40">SCORE</div>
            <div className="font-mono font-bold text-xl text-blue-400">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">LEVEL</div>
            <div className="font-mono font-bold text-xl text-orange-400">{level}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/40">BEST</div>
            <div className="font-mono font-bold text-xl text-emerald-400">{highScore}</div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="pt-28 px-4 pb-4 max-w-md mx-auto">
        {/* Game Board */}
        <div className="relative aspect-[1/2] w-full mb-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-3xl border-4 border-white/10 shadow-2xl overflow-hidden touch-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={(e) => e.preventDefault()}
          >
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {grid.map((row, y) =>
                row.map((cell, x) => {
                  let bgColor = cell || '#0f172a';
                  let opacity = cell ? 1 : 0.3;

                  if (currentPiece) {
                    const pieceY = y - currentPiece.pos.y;
                    const pieceX = x - currentPiece.pos.x;
                    if (
                      pieceY >= 0 && pieceY < currentPiece.shape.length &&
                      pieceX >= 0 && pieceX < currentPiece.shape[0].length &&
                      currentPiece.shape[pieceY][pieceX]
                    ) {
                      bgColor = currentPiece.color;
                      opacity = 1;
                    }
                  }

                  if (ghostY !== null && currentPiece && !cell) {
                    const ghostY_rel = y - ghostY;
                    const ghostX = x - currentPiece.pos.x;
                    if (
                      ghostY_rel >= 0 && ghostY_rel < currentPiece.shape.length &&
                      ghostX >= 0 && ghostX < currentPiece.shape[0].length &&
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

            <AnimatePresence>
              {paused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center"
                >
                  <Pause className="w-16 h-16 text-white mb-4" />
                  <h2 className="text-3xl font-black mb-2">PAUSED</h2>
                  <button
                    onClick={() => setPaused(false)}
                    className="px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition"
                  >
                    RESUME
                  </button>
                </motion.div>
              )}

              {gameOver && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                >
                  <Trophy className="w-20 h-20 text-yellow-500 mb-4" />
                  <h2 className="text-4xl font-black mb-2">GAME OVER</h2>
                  <p className="text-white/60 mb-6">Level {level} • {score} Points</p>
                  <button
                    onClick={resetGame}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-bold text-lg"
                  >
                    PLAY AGAIN
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Next Piece Preview */}
          <div className="absolute -right-20 top-0 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-3 w-16">
            <div className="text-xs text-white/40 text-center mb-2">NEXT</div>
            <div className="flex justify-center">
              {renderPiece(nextPiece, 'w-3 h-3')}
            </div>
          </div>

          {/* Hold Piece Preview */}
          <div className="absolute -left-20 top-0 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-3 w-16">
            <div className="text-xs text-white/40 text-center mb-2">HOLD</div>
            <div className="flex justify-center">
              {renderPiece(holdPiece, 'w-3 h-3')}
            </div>
          </div>
        </div>

        {/* Touch Controls */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <button
            onClick={() => movePiece(-1, 0)}
            className="aspect-square bg-white/10 backdrop-blur-md rounded-2xl active:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Move left"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button
            onClick={() => movePiece(1, 0)}
            className="aspect-square bg-white/10 backdrop-blur-md rounded-2xl active:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Move right"
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          <button
            onClick={rotatePiece}
            className="aspect-square bg-white/10 backdrop-blur-md rounded-2xl active:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Rotate"
          >
            <RotateCw className="w-8 h-8" />
          </button>

          <button
            onClick={hardDrop}
            className="aspect-square bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl active:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="Hard drop"
          >
            <Zap className="w-8 h-8" />
          </button>
        </div>

        {/* Bottom Action Bar */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            onClick={holdCurrentPiece}
            disabled={!canHold || gameOver || paused}
            className="py-4 bg-white/10 backdrop-blur-md rounded-2xl active:bg-white/20 transition-colors font-bold disabled:opacity-50"
          >
            HOLD
          </button>

          <button
            onClick={() => setPaused(!paused)}
            className="py-4 bg-white/10 backdrop-blur-md rounded-2xl active:bg-white/20 transition-colors font-bold flex items-center justify-center gap-2"
          >
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>

        {/* Lines Progress */}
        <div className="mt-4 bg-white/5 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${(lines % 10) * 10}%` }}
          />
        </div>
        <div className="text-center text-xs text-white/40 mt-2">
          {lines} LINES • {10 - (lines % 10)} TO NEXT LEVEL
        </div>
      </div>

      {/* Menu Modal */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowMenu(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-black mb-6 text-center">MENU</h2>

              <button
                onClick={resetGame}
                className="w-full py-4 bg-blue-500 rounded-xl font-bold mb-3 active:scale-95 transition"
              >
                NEW GAME
              </button>

              <button
                onClick={() => {
                  setPaused(!paused);
                  setShowMenu(false);
                }}
                className="w-full py-4 bg-white/10 rounded-xl font-bold mb-3 active:scale-95 transition"
              >
                {paused ? 'RESUME' : 'PAUSE'}
              </button>

              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-4 bg-white/5 rounded-xl font-bold active:scale-95 transition"
              >
                CLOSE
              </button>

              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-bold text-white/40 mb-3">HOW TO PLAY</h3>
                <ul className="text-sm text-white/60 space-y-2">
                  <li>• Swipe left/right to move</li>
                  <li>• Swipe up to rotate</li>
                  <li>• Swipe down for hard drop</li>
                  <li>• Tap HOLD to store piece</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}