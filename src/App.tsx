/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pause, Play, RotateCcw, Trophy, Gamepad2, 
  ChevronDown, ChevronLeft, ChevronRight, ArrowUp, Space, Monitor
} from 'lucide-react';

// --- Constants & Themes ---
const COLS = 10;
const ROWS = 20;
const INITIAL_SPEED = 800;

type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

const PIECES: Record<PieceType, { shape: number[][]; color: string }> = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00f0f0' },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#0000f0' },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#f0a000' },
  O: { shape: [[1,1],[1,1]], color: '#f0f000' },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#00f000' },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#a000f0' },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#f00000' },
};

const THEMES = {
  modern: {
    bg: "bg-[#050505]", gridBg: "bg-white/5", border: "border-white/10",
    text: "text-emerald-400", blockBorder: "none", ghostAlpha: 0.2
  },
  classic: {
    bg: "bg-[#8bac0f]", gridBg: "bg-[#9bbc0f]", border: "border-[#306230]",
    text: "text-[#0f380f]", blockBorder: "1px solid #8bac0f", ghostAlpha: 0.1
  }
};

export default function App() {
  const [theme, setTheme] = useState<'modern' | 'classic'>('modern');
  const [grid, setGrid] = useState<any[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const [activePiece, setActivePiece] = useState<any>(null);
  const [bag, setBag] = useState<PieceType[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const curTheme = THEMES[theme];

  // Professional 7-Bag Randomizer
  const getNextFromBag = useCallback(() => {
    let currentBag = [...bag];
    if (currentBag.length === 0) {
      currentBag = (['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as PieceType[])
        .sort(() => Math.random() - 0.5);
    }
    const type = currentBag.pop()!;
    setBag(currentBag);
    return {
      type,
      shape: PIECES[type].shape,
      color: PIECES[type].color,
      pos: { x: 3, y: 0 }
    };
  }, [bag]);

  const checkCollision = (piece: any, pos = piece.pos, shape = piece.shape) => {
    return shape.some((row: any[], y: number) => row.some((cell, x) => {
      if (!cell) return false;
      const nx = pos.x + x, ny = pos.y + y;
      return nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && grid[ny][nx]);
    }));
  };

  const spawnPiece = useCallback(() => {
    const next = getNextFromBag();
    if (checkCollision(next)) setGameOver(true);
    else setActivePiece(next);
  }, [getNextFromBag, grid]);

  const lockPiece = useCallback(() => {
    const newGrid = grid.map(row => [...row]);
    activePiece.shape.forEach((row: any[], y: number) => row.forEach((cell, x) => {
      if (cell) newGrid[activePiece.pos.y + y][activePiece.pos.x + x] = activePiece.color;
    }));
    const filtered = newGrid.filter(row => !row.every(c => c !== 0));
    const cleared = ROWS - filtered.length;
    while (filtered.length < ROWS) filtered.unshift(Array(COLS).fill(0));
    setScore(s => s + (cleared * 100));
    setGrid(filtered);
    setActivePiece(null);
  }, [activePiece, grid]);

  const move = (dx: number, dy: number) => {
    if (!activePiece || paused || gameOver) return;
    const newPos = { x: activePiece.pos.x + dx, y: activePiece.pos.y + dy };
    if (!checkCollision(activePiece, newPos)) setActivePiece({ ...activePiece, pos: newPos });
    else if (dy > 0) lockPiece();
  };

  const rotate = () => {
    if (!activePiece) return;
    const shape = activePiece.shape[0].map((_: any, i: number) => activePiece.shape.map((row: any[]) => row[i]).reverse());
    if (!checkCollision(activePiece, activePiece.pos, shape)) setActivePiece({ ...activePiece, shape });
  };

  useEffect(() => {
    if (!activePiece && !gameOver) spawnPiece();
    const id = setInterval(() => move(0, 1), INITIAL_SPEED);
    return () => clearInterval(id);
  }, [activePiece, gameOver, spawnPiece]);

  // Ghost Calculation
  const getGhostY = () => {
    if (!activePiece) return 0;
    let gy = activePiece.pos.y;
    while (!checkCollision(activePiece, { ...activePiece.pos, y: gy + 1 })) gy++;
    return gy;
  };

  return (
    <div className={`min-h-screen ${curTheme.bg} transition-colors flex flex-col items-center justify-center p-4 touch-none`}>
      <button onClick={() => setTheme(t => t === 'modern' ? 'classic' : 'modern')} className="fixed top-6 right-6 p-3 bg-white/10 rounded-full border border-white/20">
        <Monitor className={curTheme.text} />
      </button>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className={`${curTheme.gridBg} border ${curTheme.border} rounded-2xl p-4 w-32`}>
          <p className={`text-[10px] uppercase font-bold opacity-50 ${curTheme.text}`}>Score</p>
          <p className={`text-xl font-mono ${curTheme.text}`}>{score}</p>
        </div>

        <div className={`relative border-4 ${curTheme.border} rounded-3xl p-1 bg-white/5`}>
          <div className="grid grid-cols-10 gap-px w-[280px] h-[560px]">
            {grid.map((row, y) => row.map((cell, x) => {
              let color = cell || 'transparent';
              let opacity = cell ? 1 : 0.05;
              if (activePiece) {
                const py = y - activePiece.pos.y, px = x - activePiece.pos.x;
                const gy = y - getGhostY();
                if (py >= 0 && py < activePiece.shape.length && px >= 0 && px < activePiece.shape[0].length && activePiece.shape[py][px]) {
                  color = theme === 'classic' ? '#306230' : activePiece.color;
                  opacity = 1;
                } else if (gy >= 0 && gy < activePiece.shape.length && px >= 0 && px < activePiece.shape[0].length && activePiece.shape[gy][px]) {
                  color = theme === 'classic' ? '#306230' : activePiece.color;
                  opacity = curTheme.ghostAlpha;
                }
              }
              return <div key={`${y}-${x}`} style={{ backgroundColor: color, opacity, border: cell ? curTheme.blockBorder : 'none' }} className="w-full h-full rounded-sm" />;
            }))}
          </div>
          {gameOver && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-2xl">
            <Trophy className="text-yellow-500 w-12 h-12 mb-2" />
            <button onClick={() => window.location.reload()} className="bg-emerald-500 px-6 py-2 rounded-full font-bold">RETRY</button>
          </div>}
        </div>

        {/* Mobile Controls */}
        <div className="grid grid-cols-3 gap-4 lg:hidden">
          <button onClick={() => move(-1, 0)} className="p-6 bg-white/10 rounded-2xl"><ChevronLeft /></button>
          <button onClick={rotate} className="p-6 bg-white/10 rounded-2xl"><ArrowUp /></button>
          <button onClick={() => move(1, 0)} className="p-6 bg-white/10 rounded-2xl"><ChevronRight /></button>
          <div />
          <button onClick={() => move(0, 1)} className="p-6 bg-white/10 rounded-2xl"><ChevronDown /></button>
        </div>
      </div>
    </div>
  );
}