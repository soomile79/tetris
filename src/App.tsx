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
  Volume2,
  VolumeX,
  Music,
  Music2,
  ChevronDown
} from 'lucide-react';

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const BASE_SPEED = 1200;
const MIN_SPEED = 100;
const SPEED_STEP = 40;

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

interface Piece {
  type: PieceType;
  shape: number[][];
  color: string;
  pos: { x: number; y: number };
}

interface GameRecord {
  name: string;
  score: number;
  level: number;
  lines: number;
  timestamp: number;
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

// --- Audio Manager ---
class AudioManager {
  private context: AudioContext | null = null;
  private musicNodes: {
    oscillator1: OscillatorNode;
    oscillator2: OscillatorNode;
    oscillator3: OscillatorNode;
    gain1: GainNode;
    gain2: GainNode;
    gain3: GainNode;
    masterGain: GainNode;
  } | null = null;
  private isMusicPlaying = false;
  private musicSpeed = 1;
  private musicInterval: number | null = null;
  private enabled = true;

  constructor() {
    this.initAudio = this.initAudio.bind(this);
  }

  private initAudio() {
    if (this.context) return;
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  async enable() {
    this.enabled = true;
    this.initAudio();
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  disable() {
    this.enabled = false;
    this.stopMusic();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }

  playMove() {
    if (!this.enabled || !this.context) return;
    this.playTone(150, 0.05, 'sine', 0.1);
  }

  playRotate() {
    if (!this.enabled || !this.context) return;
    this.playTone(300, 0.08, 'triangle', 0.1);
  }

  playDrop() {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playClear(lines: number) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const baseFreq = 400;

    for (let i = 0; i < lines; i++) {
      setTimeout(() => {
        this.playTone(baseFreq + i * 100, 0.1, 'square', 0.15);
      }, i * 100);
    }
  }

  playGameOver() {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;

    for (let i = 0; i < 4; i++) {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300 - i * 50, now + i * 0.1);

      gain.gain.setValueAtValue(0.15, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);

      osc.connect(gain);
      gain.connect(this.context!.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.2);
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.1) {
    if (!this.context) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  startMusic(level: number) {
    if (!this.enabled || !this.context || this.isMusicPlaying) return;

    this.isMusicPlaying = true;
    this.musicSpeed = Math.max(0.5, 1 - (level - 1) * 0.1);
    this.playMusicLoop();
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicNodes) {
      try {
        this.musicNodes.oscillator1.stop();
        this.musicNodes.oscillator2.stop();
        this.musicNodes.oscillator3.stop();
      } catch (e) { }
      this.musicNodes = null;
    }
  }

  updateMusicSpeed(level: number) {
    this.musicSpeed = Math.max(0.5, 1 - (level - 1) * 0.1);
  }

  private playMusicLoop() {
    if (!this.context || !this.isMusicPlaying) return;

    const now = this.context.currentTime;

    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const osc3 = this.context.createOscillator();

    const gain1 = this.context.createGain();
    const gain2 = this.context.createGain();
    const gain3 = this.context.createGain();
    const masterGain = this.context.createGain();

    osc1.type = 'square';
    osc2.type = 'triangle';
    osc3.type = 'sawtooth';

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);

    masterGain.connect(this.context.destination);
    masterGain.gain.setValueAtTime(0.1, now);

    this.musicNodes = { oscillator1: osc1, oscillator2: osc2, oscillator3: osc3, gain1, gain2, gain3, masterGain };

    const notes = [261.63, 329.63, 392.00, 523.25];
    let noteIndex = 0;

    const playNote = () => {
      if (!this.isMusicPlaying || !this.musicNodes) return;

      const now = this.context!.currentTime;
      const freq = notes[noteIndex % notes.length];

      this.musicNodes.oscillator1.frequency.setValueAtTime(freq, now);
      this.musicNodes.oscillator2.frequency.setValueAtTime(freq * 2, now);
      this.musicNodes.oscillator3.frequency.setValueAtTime(freq * 4, now);

      this.musicNodes.gain1.gain.setValueAtTime(0.1, now);
      this.musicNodes.gain2.gain.setValueAtTime(0.05, now);
      this.musicNodes.gain3.gain.setValueAtTime(0.02, now);

      this.musicNodes.gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1 * this.musicSpeed);
      this.musicNodes.gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.1 * this.musicSpeed);
      this.musicNodes.gain3.gain.exponentialRampToValueAtTime(0.002, now + 0.1 * this.musicSpeed);

      noteIndex++;
    };

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    const baseInterval = 150 * this.musicSpeed;
    playNote();
    this.musicInterval = window.setInterval(playNote, baseInterval);
  }
}

export default function App() {
  // Detect if mobile based on screen width (also consider aspect ratio for tablets)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' &&
    (window.innerWidth < 1024 || window.innerHeight / window.innerWidth > 1.2)
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < 1024 || window.innerHeight / window.innerWidth > 1.2
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fix iOS Safari viewport and scrolling issues
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  const [grid, setGrid] = useState(createEmptyGrid());
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [pieceQueue, setPieceQueue] = useState<Piece[]>([]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [gameRecords, setGameRecords] = useState<GameRecord[]>([]);
  const [showRanking, setShowRanking] = useState(false);

  const gameLoop = useRef<number>();
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const audioManager = useRef<AudioManager>(new AudioManager());

  // Load game records from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tetris-records');
    if (saved) {
      try {
        setGameRecords(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load records:', e);
      }
    }
  }, []);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tetris-highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // Initialize queue with 3 pieces
  useEffect(() => {
    const queue = [];
    for (let i = 0; i < 3; i++) {
      queue.push(getRandomPiece());
    }
    setPieceQueue(queue);
    setCurrentPiece(queue[0]);
  }, []);

  // --- Collision Detection ---
  const checkCollision = useCallback((piece: Piece, pos: { x: number; y: number }) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[0].length; x++) {
        if (piece.shape[y][x]) {
          const boardX = pos.x + x;
          const boardY = pos.y + y;

          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
            return true;
          }

          if (boardY >= 0 && grid[boardY][boardX] !== '') {
            return true;
          }
        }
      }
    }
    return false;
  }, [grid]);

  // --- Spawn Next Piece ---
  const spawnNextPiece = useCallback(() => {
    const newQueue = [...pieceQueue];
    newQueue.shift();
    newQueue.push(getRandomPiece());
    setPieceQueue(newQueue);
    setCurrentPiece(newQueue[0]);
  }, [pieceQueue]);

  // --- Move Piece ---
  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || gameOver || paused) return;

    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };

    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      if (dx !== 0 && soundEnabled) audioManager.current.playMove();
    } else if (dy > 0) {
      mergePieceWithPiece(currentPiece);
      if (soundEnabled) audioManager.current.playDrop();
    }
  }, [currentPiece, gameOver, paused, checkCollision, soundEnabled]);

  // --- Rotate Piece ---
  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;

    const rotated = currentPiece.shape[0].map((_, i) =>
      currentPiece.shape.map(row => row[i]).reverse()
    );

    const rotatedPiece = { ...currentPiece, shape: rotated };

    if (!checkCollision(rotatedPiece, currentPiece.pos)) {
      setCurrentPiece(rotatedPiece);
      if (soundEnabled) audioManager.current.playRotate();
    }
  }, [currentPiece, gameOver, paused, checkCollision, soundEnabled]);

  // --- Hard Drop ---
  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;

    let y = currentPiece.pos.y;
    while (!checkCollision(currentPiece, { ...currentPiece.pos, y: y + 1 })) {
      y++;
    }

    const finalPiece = {
      ...currentPiece,
      pos: { ...currentPiece.pos, y }
    };

    setCurrentPiece(finalPiece);
    setTimeout(() => {
      mergePieceWithPiece(finalPiece);
      if (soundEnabled) audioManager.current.playDrop();
    }, 10);
  }, [currentPiece, gameOver, paused, checkCollision, soundEnabled]);

  // --- Soft Drop ---
  const softDrop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    movePiece(0, 1);
  }, [currentPiece, gameOver, paused, movePiece]);

  // --- Merge Piece ---
  const mergePieceWithPiece = useCallback((piece: Piece) => {
    if (!piece) return;

    const newGrid = grid.map(row => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const boardY = piece.pos.y + y;
          const boardX = piece.pos.x + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            newGrid[boardY][boardX] = piece.color;
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
      if (soundEnabled) audioManager.current.playClear(linesCleared);
    }

    setGrid(clearedGrid);
    setCurrentPiece(null);
  }, [grid, level, soundEnabled]);

  // --- Check Game Over ---
  useEffect(() => {
    if (currentPiece && checkCollision(currentPiece, currentPiece.pos)) {
      setGameOver(true);
      if (soundEnabled) audioManager.current.playGameOver();
      setShowNameInput(true);
    }
  }, [currentPiece, checkCollision, soundEnabled]);

  // --- Reset Game ---
  const resetGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setPlayerName('');
    setShowNameInput(false);

    const queue = [];
    for (let i = 0; i < 3; i++) {
      queue.push(getRandomPiece());
    }
    setPieceQueue(queue);
    setCurrentPiece(queue[0]);
  }, []);

  // --- Save Game Record ---
  const saveGameRecord = useCallback(() => {
    if (!playerName.trim()) return;

    const newRecord: GameRecord = {
      name: playerName.trim(),
      score,
      level,
      lines,
      timestamp: Date.now()
    };

    const updatedRecords = [newRecord, ...gameRecords].sort((a, b) => b.score - a.score).slice(0, 10);
    setGameRecords(updatedRecords);
    localStorage.setItem('tetris-records', JSON.stringify(updatedRecords));

    setShowNameInput(false);
    setPlayerName('');
  }, [playerName, score, level, lines, gameRecords]);

  // --- Auto-spawn next piece when current piece is null ---
  useEffect(() => {
    if (!currentPiece && !gameOver && pieceQueue.length > 0) {
      spawnNextPiece();
    }
  }, [currentPiece, gameOver, pieceQueue, spawnNextPiece]);

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

  // --- High Score ---
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('tetris-highscore', score.toString());
    }
  }, [score, highScore]);

  // --- Desktop Keyboard Controls ---
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'p', 'P', 'r', 'R'].includes(e.key)) {
        e.preventDefault();
      }

      if (gameOver || paused) return;

      if (keysPressed.current.has(e.key)) return;
      keysPressed.current.add(e.key);

      switch (e.key) {
        case 'ArrowLeft':
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          softDrop();
          break;
        case 'ArrowUp':
          rotatePiece();
          break;
        case ' ':
          hardDrop();
          break;
        case 'p':
        case 'P':
          setPaused(prev => !prev);
          break;
        case 'r':
        case 'R':
          resetGame();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keysPressed.current.clear();
    };
  }, [isMobile, gameOver, paused, movePiece, rotatePiece, hardDrop, softDrop, resetGame]);

  // --- Mobile Touch Controls ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    e.preventDefault();
    if (!touchStartRef.current || !currentPiece || gameOver || paused) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 20) return;

    if (absDx > absDy) {
      if (dx > 0) movePiece(1, 0);
      else movePiece(-1, 0);
    } else {
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

  // --- Render Piece Preview ---
  const renderPiece = (piece: Piece | null, blockSize = 20) => {
    if (!piece) return null;

    const cols = piece.shape[0].length;

    return (
      <div className="flex gap-1" style={{ flexWrap: 'wrap', width: cols * (blockSize + 4) }}>
        {piece.shape.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              style={{
                width: blockSize,
                height: blockSize,
                backgroundColor: cell ? piece.color : 'transparent',
                borderRadius: 2,
                opacity: cell ? 1 : 0,
              }}
            />
          ))
        )}
      </div>
    );
  };

  // ========== DESKTOP LAYOUT ==========
  if (!isMobile) {
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col overflow-hidden">
        {/* Desktop header */}
        <div className="bg-black/50 backdrop-blur-lg border-b border-white/10 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-black text-xl">T</div>
            <span className="font-bold text-xl">TETRIS</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMusicEnabled(!musicEnabled)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              {musicEnabled ? <Music2 className="w-6 h-6" /> : <Music className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setShowRanking(!showRanking)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              <Trophy className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center px-6 py-6 gap-8 overflow-hidden">
          {/* Left Panel - Stats */}
          <div className="flex flex-col gap-4 flex-shrink-0 w-64 overflow-y-auto max-h-full">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white/40 mb-2">SCORE</h3>
                <div className="font-mono font-bold text-6xl text-blue-400">{score}</div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-white/40 mb-2">HIGH SCORE</h3>
                <div className="font-mono font-bold text-5xl text-emerald-400">{highScore}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-white/40 mb-2">LEVEL</h3>
                  <div className="font-mono font-bold text-4xl text-orange-400">{level}</div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white/40 mb-2">LINES</h3>
                  <div className="font-mono font-bold text-4xl text-purple-400">{lines}</div>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl font-bold text-lg transition"
              >
                NEW GAME
              </button>

              <button
                onClick={() => setPaused(!paused)}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 rounded-xl font-bold text-lg transition"
              >
                {paused ? 'RESUME' : 'PAUSE'}
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-bold text-white/40 mb-2">MOVEMENT</h4>
                  <div className="space-y-1 text-white/60">
                    <div>← → : Move left/right</div>
                    <div>↓ : Soft drop</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white/40 mb-2">ACTIONS</h4>
                  <div className="space-y-1 text-white/60">
                    <div>↑ : Rotate</div>
                    <div>Space : Hard drop</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white/40 mb-2">GAME</h4>
                  <div className="space-y-1 text-white/60">
                    <div>P : Pause</div>
                    <div>R : Reset</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Game Board - PERFECT SQUARE BLOCKS */}
          <div className="flex-1 flex items-center justify-center min-w-0 h-full">
            <div
              className="bg-black/60 rounded-3xl border-4 border-white/20 shadow-2xl overflow-hidden"
              style={{
                touchAction: 'none',
                width: '100%',
                height: '100%',
                maxWidth: '50vh',
                maxHeight: '100vh',
                aspectRatio: '10 / 20',
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={(e) => e.preventDefault()}
            >
              <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
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
                        className="border-[1px] border-white/10"
                        style={{
                          backgroundColor: bgColor,
                          opacity,
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
                    <Pause className="w-32 h-32 text-white mb-6" />
                    <h2 className="text-6xl font-black mb-6">PAUSED</h2>
                    <button
                      onClick={() => setPaused(false)}
                      className="px-16 py-5 bg-white text-black rounded-full font-bold text-2xl hover:scale-105 transition"
                    >
                      RESUME
                    </button>
                  </motion.div>
                )}

                {gameOver && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
                  >
                    <Trophy className="w-40 h-40 text-yellow-500 mb-8" />
                    <h2 className="text-7xl font-black mb-6">GAME OVER</h2>
                    <p className="text-white/60 mb-10 text-3xl">Level {level} • {score} Points</p>
                    <button
                      onClick={resetGame}
                      className="px-16 py-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-bold text-2xl"
                    >
                      PLAY AGAIN
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Panel - Next */}
          <div className="flex flex-col gap-4 flex-shrink-0 w-64 overflow-y-auto max-h-full">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6">
              <h3 className="text-xs font-bold text-white/40 mb-4">NEXT PIECE</h3>
              <div className="bg-black/40 rounded-xl p-8 flex items-center justify-center min-h-[200px]">
                {pieceQueue.length > 1 && renderPiece(pieceQueue[1], 24)}
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setPaused(!paused)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition"
                >
                  {paused ? 'RESUME' : 'PAUSE'}
                </button>

                <button
                  onClick={resetGame}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-sm transition"
                >
                  RESET
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ranking Modal */}
        <AnimatePresence>
          {showRanking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
              onClick={() => setShowRanking(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                  <h2 className="text-3xl font-black">TOP 10</h2>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {gameRecords.length === 0 ? (
                    <div className="text-center text-white/60 py-12">No records yet</div>
                  ) : (
                    gameRecords.map((record, idx) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-base">#{idx + 1} {record.name}</div>
                          <div className="text-sm text-white/60">Level {record.level} • {record.lines} lines</div>
                        </div>
                        <div className="font-mono font-bold text-xl text-blue-400">{record.score}</div>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setShowRanking(false)}
                  className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition"
                >
                  CLOSE
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name Input Modal */}
        <AnimatePresence>
          {showNameInput && gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-sm w-full"
              >
                <h2 className="text-3xl font-black mb-4">SAVE YOUR SCORE</h2>
                <p className="text-white/60 mb-6">Enter your name to save this record</p>

                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveGameRecord()}
                  placeholder="Your name..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 mb-6 focus:outline-none focus:border-blue-500 text-lg"
                  autoFocus
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowNameInput(false);
                      setPlayerName('');
                    }}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition"
                  >
                    SKIP
                  </button>
                  <button
                    onClick={saveGameRecord}
                    disabled={!playerName.trim()}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold transition"
                  >
                    SAVE
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ========== MOBILE LAYOUT ==========
  return (
    <div className="w-screen h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Mobile Header */}
      <div className="bg-black/90 border-b border-white/10 px-3 py-2 flex-shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-black text-sm">T</div>
            <span className="font-bold text-sm">TETRIS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRanking(!showRanking)}
              className="p-2 bg-white/20 rounded-lg active:bg-white/30 transition"
            >
              <Trophy className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMusicEnabled(!musicEnabled)}
              className="p-2 bg-white/20 rounded-lg active:bg-white/30 transition"
            >
              {musicEnabled ? <Music2 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-white/20 rounded-lg active:bg-white/30 transition"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Score Bar */}
      <div className="bg-black/70 border-b border-white/10 px-3 py-1.5 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-black/40 px-1.5 py-1 rounded-lg text-center">
            <div className="text-[7px] text-white/40 font-bold">SCORE</div>
            <div className="font-mono font-bold text-xs text-blue-400 truncate">{score}</div>
          </div>
          <div className="bg-black/40 px-1.5 py-1 rounded-lg text-center">
            <div className="text-[7px] text-white/40 font-bold">LEVEL</div>
            <div className="font-mono font-bold text-xs text-orange-400">{level}</div>
          </div>
          <div className="bg-black/40 px-1.5 py-1 rounded-lg text-center">
            <div className="text-[7px] text-white/40 font-bold">BEST</div>
            <div className="font-mono font-bold text-xs text-emerald-400">{highScore}</div>
          </div>
        </div>
      </div>

      {/* Game Board Container - Limited Height */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-2 min-h-0" style={{ maxHeight: 'calc(100% - 280px)' }}>
        {/* Game Board - Perfect Square Blocks */}
        <div
          className="bg-black/60 rounded-2xl border-2 border-white/20 shadow-xl overflow-hidden"
          style={{
            touchAction: 'none',
            width: '100%',
            height: '100%',
            aspectRatio: '10 / 20',
            maxWidth: 'min(100%, calc(100vh * 0.5))',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={(e) => e.preventDefault()}
        >
          <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
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
                    className="border-[0.5px] border-white/10"
                    style={{
                      backgroundColor: bgColor,
                      opacity,
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
                <Pause className="w-10 h-10 text-white mb-2" />
                <h2 className="text-xl font-black mb-2">PAUSED</h2>
                <button
                  onClick={() => setPaused(false)}
                  className="px-5 py-2 bg-white text-black rounded-full font-bold text-xs"
                >
                  RESUME
                </button>
              </motion.div>
            )}

            {gameOver && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center"
              >
                <Trophy className="w-12 h-12 text-yellow-500 mb-2" />
                <h2 className="text-2xl font-black mb-1">GAME OVER</h2>
                <p className="text-white/60 mb-3 text-xs">Level {level} • {score} Points</p>
                <button
                  onClick={resetGame}
                  className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-bold text-xs"
                >
                  PLAY AGAIN
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Touch Controls - Always Visible with Fixed Height */}
      <div className="px-2 pb-2 flex-shrink-0 space-y-1 h-auto" style={{ minHeight: '260px', maxHeight: 'calc(100vh - 400px)' }}>
        <div className="grid grid-cols-4 gap-1">
          <button
            onPointerDown={() => movePiece(-1, 0)}
            className="bg-blue-600 rounded-lg active:bg-blue-500 transition-colors flex items-center justify-center shadow-lg border border-white/20 py-3"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onPointerDown={() => movePiece(1, 0)}
            className="bg-blue-600 rounded-lg active:bg-blue-500 transition-colors flex items-center justify-center shadow-lg border border-white/20 py-3"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onPointerDown={rotatePiece}
            className="bg-purple-600 rounded-lg active:bg-purple-500 transition-colors flex items-center justify-center shadow-lg border border-white/20 py-3"
          >
            <RotateCw className="w-5 h-5" />
          </button>

          <button
            onPointerDown={hardDrop}
            className="bg-orange-600 rounded-lg active:bg-orange-500 transition-colors flex items-center justify-center shadow-lg border border-white/20 py-3"
          >
            <Zap className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button
            onPointerDown={softDrop}
            className="bg-green-600 rounded-lg active:bg-green-500 transition-colors font-bold text-xs py-3 shadow-lg border border-white/20 flex items-center justify-center"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <button
            onPointerDown={() => setPaused(!paused)}
            className="bg-yellow-600 rounded-lg active:bg-yellow-500 transition-colors font-bold text-xs py-3 shadow-lg border border-white/20"
          >
            {paused ? 'RESUME' : 'PAUSE'}
          </button>

          <button
            onPointerDown={resetGame}
            className="bg-red-600 rounded-lg active:bg-red-500 transition-colors font-bold text-xs py-3 shadow-lg border border-white/20"
          >
            NEW
          </button>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="bg-white/20 rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${(lines % 10) * 10}%` }}
            />
          </div>
          <div className="flex justify-between text-[7px] text-white/40 mt-0.5">
            <span>{lines} LINES</span>
            <span>{10 - (lines % 10)} TO NEXT</span>
          </div>
        </div>
      </div>

      {/* Ranking Modal */}
      <AnimatePresence>
        {showRanking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
            onClick={() => setShowRanking(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-900 border border-white/20 rounded-xl p-4 max-w-sm w-full max-h-96"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-black">TOP 10</h2>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {gameRecords.length === 0 ? (
                  <div className="text-center text-white/60 py-6 text-xs">No records yet</div>
                ) : (
                  gameRecords.map((record, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-2 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs">#{idx + 1} {record.name}</div>
                        <div className="text-[9px] text-white/60">Lv {record.level} • {record.lines}L</div>
                      </div>
                      <div className="font-mono font-bold text-xs text-blue-400">{record.score}</div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowRanking(false)}
                className="w-full mt-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs transition"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name Input Modal */}
      <AnimatePresence>
        {showNameInput && gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-900 border border-white/20 rounded-xl p-4 max-w-sm w-full"
            >
              <h2 className="text-lg font-black mb-2">SAVE YOUR SCORE</h2>
              <p className="text-white/60 mb-3 text-xs">Enter your name to save this record</p>

              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && saveGameRecord()}
                placeholder="Your name..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 mb-3 focus:outline-none focus:border-blue-500 text-sm"
                autoFocus
              />

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowNameInput(false);
                    setPlayerName('');
                  }}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs transition"
                >
                  SKIP
                </button>
                <button
                  onClick={saveGameRecord}
                  disabled={!playerName.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold text-xs transition"
                >
                  SAVE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
