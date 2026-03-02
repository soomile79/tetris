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
  Monitor,
  Smartphone,
  Music,
  Music2
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

  // Sound Effects
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

      gain.gain.setValueAtTime(0.15, now + i * 0.1);
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

  // Dynamic Chiptune Music
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
    if (this.isMusicPlaying) {
      this.stopMusic();
      this.startMusic(level);
    }
  }

  private playMusicLoop() {
    if (!this.context || !this.isMusicPlaying) return;

    const now = this.context.currentTime;

    // Create oscillators for a simple chiptune melody
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

    // Simple chiptune melody pattern (C major arpeggio)
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
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

    // Start oscillators
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    // Schedule notes
    const baseInterval = 150 * this.musicSpeed;
    playNote();
    this.musicInterval = window.setInterval(playNote, baseInterval);
  }
}

export default function App() {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
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
  const [musicEnabled, setMusicEnabled] = useState(true);

  const gameLoop = useRef<number>();
  const lastTime = useRef<number>(0);
  const dropCounter = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const audioManager = useRef<AudioManager>(new AudioManager());

  // Detect device type
  useEffect(() => {
    const checkDevice = () => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches ||
        ('ontouchstart' in window);
      setDeviceType(isMobile ? 'mobile' : 'desktop');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Initialize audio
  useEffect(() => {
    if (soundEnabled || musicEnabled) {
      audioManager.current.enable();
    } else {
      audioManager.current.disable();
    }
  }, [soundEnabled, musicEnabled]);

  // Handle music based on game state
  useEffect(() => {
    if (musicEnabled && !paused && !gameOver && currentPiece) {
      audioManager.current.startMusic(level);
    } else {
      audioManager.current.stopMusic();
    }
  }, [musicEnabled, paused, gameOver, currentPiece, level]);

  // Update music speed when level changes
  useEffect(() => {
    if (musicEnabled) {
      audioManager.current.updateMusicSpeed(level);
    }
  }, [level, musicEnabled]);

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
      if (soundEnabled) audioManager.current.playClear(linesCleared);
    }

    setGrid(clearedGrid);
    setCurrentPiece(null);
    setCanHold(true);
  }, [currentPiece, grid, level, soundEnabled]);

  const spawnPiece = useCallback(() => {
    const piece = { ...nextPiece };
    if (checkCollision(piece)) {
      setGameOver(true);
      if (soundEnabled) audioManager.current.playGameOver();
      return;
    }
    setCurrentPiece(piece);
    setNextPiece(getRandomPiece());
  }, [nextPiece, checkCollision, soundEnabled]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || gameOver || paused) return false;

    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(currentPiece, newPos)) {
      setCurrentPiece({ ...currentPiece, pos: newPos });
      if (dx !== 0 && soundEnabled) audioManager.current.playMove();
      return true;
    }

    if (dy > 0) {
      mergePiece();
      if (soundEnabled) audioManager.current.playDrop();
    }
    return false;
  }, [currentPiece, gameOver, paused, checkCollision, mergePiece, soundEnabled]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    const rotated = rotateShape(currentPiece.shape);
    if (!checkCollision(currentPiece, currentPiece.pos, rotated)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
      if (soundEnabled) audioManager.current.playRotate();
    }
  }, [currentPiece, gameOver, paused, checkCollision, soundEnabled]);

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
    setCanHold(true);
  }, [grid, level, soundEnabled]);

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
    if (soundEnabled) audioManager.current.playRotate();
  }, [currentPiece, holdPiece, canHold, gameOver, paused, spawnPiece, soundEnabled]);

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

  // --- Desktop Keyboard Controls ---
  useEffect(() => {
    if (deviceType !== 'desktop') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'c', 'C', 'p', 'P', 'r', 'R'].includes(e.key)) {
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
          movePiece(0, 1);
          break;
        case 'ArrowUp':
          rotatePiece();
          break;
        case ' ':
          hardDrop();
          break;
        case 'c':
        case 'C':
          holdCurrentPiece();
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
  }, [deviceType, gameOver, paused, movePiece, rotatePiece, hardDrop, holdCurrentPiece, resetGame]);

  // --- Mobile Touch Controls ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (deviceType !== 'mobile') return;
    e.preventDefault();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (deviceType !== 'mobile') return;
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

  // Desktop Layout
  if (deviceType === 'desktop') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-b border-white/10 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black text-lg">T</div>
              <span className="font-bold text-sm tracking-wider">TETRIS PRO</span>
              <div className="ml-4 flex items-center gap-1 text-xs bg-white/10 px-2 py-1 rounded-full">
                <Monitor className="w-3 h-3" />
                <span>DESKTOP MODE</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMusicEnabled(!musicEnabled)}
                className="p-2 bg-white/10 rounded-xl hover:bg-white/20"
                title={musicEnabled ? "Disable music" : "Enable music"}
              >
                {musicEnabled ? <Music2 className="w-5 h-5" /> : <Music className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 bg-white/10 rounded-xl hover:bg-white/20"
                title={soundEnabled ? "Disable sounds" : "Enable sounds"}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <div className="text-right">
                <div className="text-xs text-white/40">HIGH SCORE</div>
                <div className="font-mono font-bold text-emerald-400">{highScore}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Area - Desktop */}
        <div className="pt-20 pb-8 px-4 max-w-6xl mx-auto">
          <div className="grid grid-cols-12 gap-6 items-start">

            {/* Left Panel - Hold */}
            <div className="col-span-2">
              <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
                <h3 className="text-xs font-bold text-white/40 mb-3">HOLD</h3>
                <div className="bg-black/40 rounded-xl p-4 flex items-center justify-center min-h-[120px]">
                  {renderPiece(holdPiece, 'w-6 h-6')}
                </div>

                <div className="mt-4 space-y-2">
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
            </div>

            {/* Center - Game Board */}
            <div className="col-span-8">
              <div className="relative aspect-[1/2] max-w-[400px] mx-auto">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-3xl border-4 border-white/10 shadow-2xl overflow-hidden">
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
              </div>

              {/* Desktop Controls Info */}
              <div className="mt-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
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
                      <div>C : Hold piece</div>
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

            {/* Right Panel - Next & Actions */}
            <div className="col-span-2">
              <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
                <h3 className="text-xs font-bold text-white/40 mb-3">NEXT</h3>
                <div className="bg-black/40 rounded-xl p-4 flex items-center justify-center min-h-[120px]">
                  {renderPiece(nextPiece, 'w-6 h-6')}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="bg-black/40 rounded-xl p-3">
                    <div className="text-xs text-white/40">LEVEL</div>
                    <div className="font-mono font-bold text-xl text-orange-400">{level}</div>
                  </div>

                  <button
                    onClick={holdCurrentPiece}
                    disabled={!canHold || gameOver || paused}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    <SkipForward className="w-4 h-4" />
                    HOLD
                  </button>

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
        </div>
      </div>
    );
  }

  // Mobile Layout - With visible buttons
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-b border-white/10 z-10 px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black">T</div>
            <span className="font-bold text-sm">TETRIS</span>
            <div className="ml-2 flex items-center gap-1 text-xs bg-white/10 px-2 py-1 rounded-full">
              <Smartphone className="w-3 h-3" />
              <span>MOBILE</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMusicEnabled(!musicEnabled)}
              className="p-2 bg-white/20 rounded-xl active:bg-white/30"
            >
              {musicEnabled ? <Music2 className="w-5 h-5" /> : <Music className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-white/20 rounded-xl active:bg-white/30"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Score Bar */}
      <div className="fixed top-14 left-0 right-0 bg-black/60 backdrop-blur-sm border-b border-white/10 z-10 px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="bg-black/40 px-3 py-1 rounded-xl">
            <div className="text-[10px] text-white/40">SCORE</div>
            <div className="font-mono font-bold text-base text-blue-400">{score}</div>
          </div>
          <div className="bg-black/40 px-3 py-1 rounded-xl">
            <div className="text-[10px] text-white/40">LEVEL</div>
            <div className="font-mono font-bold text-base text-orange-400">{level}</div>
          </div>
          <div className="bg-black/40 px-3 py-1 rounded-xl">
            <div className="text-[10px] text-white/40">BEST</div>
            <div className="font-mono font-bold text-base text-emerald-400">{highScore}</div>
          </div>
        </div>
      </div>

      {/* Mobile Game Area */}
      <div className="pt-28 px-3 pb-4">
        {/* Game Board with Previews */}
        <div className="relative aspect-[1/2] w-full mb-4">
          {/* Hold Preview - Made more visible */}
          <div className="absolute -left-16 top-0 bg-black/60 backdrop-blur-md rounded-xl border-2 border-white/20 p-2 w-14 z-20">
            <div className="text-[10px] text-white/60 text-center mb-1 font-bold">HOLD</div>
            <div className="flex justify-center bg-black/40 rounded-lg p-1">
              {renderPiece(holdPiece, 'w-3 h-3')}
            </div>
          </div>

          {/* Next Preview - Made more visible */}
          <div className="absolute -right-16 top-0 bg-black/60 backdrop-blur-md rounded-xl border-2 border-white/20 p-2 w-14 z-20">
            <div className="text-[10px] text-white/60 text-center mb-1 font-bold">NEXT</div>
            <div className="flex justify-center bg-black/40 rounded-lg p-1">
              {renderPiece(nextPiece, 'w-3 h-3')}
            </div>
          </div>

          {/* Main Board */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-3xl border-4 border-white/20 shadow-2xl overflow-hidden touch-none"
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
                      className="border-[0.5px] border-white/10"
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
                    className="px-8 py-3 bg-white text-black rounded-full font-bold"
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
        </div>

        {/* Mobile Touch Controls - Made bigger and more visible */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <button
            onClick={() => movePiece(-1, 0)}
            className="aspect-square bg-blue-600/80 backdrop-blur-md rounded-2xl active:bg-blue-500 transition-colors flex items-center justify-center shadow-lg border-2 border-white/20"
            style={{ minHeight: '70px' }}
          >
            <ChevronLeft className="w-10 h-10" />
          </button>

          <button
            onClick={() => movePiece(1, 0)}
            className="aspect-square bg-blue-600/80 backdrop-blur-md rounded-2xl active:bg-blue-500 transition-colors flex items-center justify-center shadow-lg border-2 border-white/20"
            style={{ minHeight: '70px' }}
          >
            <ChevronRight className="w-10 h-10" />
          </button>

          <button
            onClick={rotatePiece}
            className="aspect-square bg-purple-600/80 backdrop-blur-md rounded-2xl active:bg-purple-500 transition-colors flex items-center justify-center shadow-lg border-2 border-white/20"
            style={{ minHeight: '70px' }}
          >
            <RotateCw className="w-10 h-10" />
          </button>

          <button
            onClick={hardDrop}
            className="aspect-square bg-orange-600/80 backdrop-blur-md rounded-2xl active:bg-orange-500 transition-colors flex items-center justify-center shadow-lg border-2 border-white/20"
            style={{ minHeight: '70px' }}
          >
            <Zap className="w-10 h-10" />
          </button>
        </div>

        {/* Mobile Action Bar - Made bigger */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            onClick={holdCurrentPiece}
            disabled={!canHold || gameOver || paused}
            className="py-5 bg-green-600/80 backdrop-blur-md rounded-2xl active:bg-green-500 transition-colors font-bold text-lg disabled:opacity-50 shadow-lg border-2 border-white/20"
          >
            HOLD
          </button>

          <button
            onClick={() => setPaused(!paused)}
            className="py-5 bg-yellow-600/80 backdrop-blur-md rounded-2xl active:bg-yellow-500 transition-colors font-bold text-lg shadow-lg border-2 border-white/20"
          >
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>

        {/* Reset Button */}
        <button
          onClick={resetGame}
          className="w-full mt-3 py-4 bg-red-600/80 backdrop-blur-md rounded-2xl active:bg-red-500 transition-colors font-bold text-lg shadow-lg border-2 border-white/20"
        >
          NEW GAME
        </button>

        {/* Mobile Progress */}
        <div className="mt-4">
          <div className="bg-white/20 rounded-full h-3 overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${(lines % 10) * 10}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/60 mt-2 px-1">
            <span className="font-bold">{lines} LINES</span>
            <span className="font-bold">{10 - (lines % 10)} TO NEXT LEVEL</span>
          </div>
        </div>

        {/* Swipe Hint */}
        <div className="mt-4 bg-blue-600/30 backdrop-blur-md rounded-2xl p-4 text-sm text-blue-300 text-center border-2 border-blue-500/30">
          <p className="font-bold mb-2 text-base">👆 SWIPE CONTROLS</p>
          <p className="text-white/80">←→ Move • ↑ Rotate • ↓ Hard Drop</p>
        </div>
      </div>
    </div>
  );
}