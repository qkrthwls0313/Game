"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ItemType = "cola" | "milk" | "bread";
type Slot = ItemType[];

const SLOT_COUNT = 5;
const SLOT_CAPACITY = 3;
const ITEM_TYPES: ItemType[] = ["cola", "milk", "bread"];

const ITEM_SIZE = 64;
const SLOT_WIDTH = 104;
const SLOT_GAP = 16;
const BOARD_PADDING = 24;
const SLOT_TOP_PADDING = 16;
const SLOT_BOTTOM_PADDING = 12;
const SLOT_HEIGHT =
  ITEM_SIZE * SLOT_CAPACITY + SLOT_TOP_PADDING + SLOT_BOTTOM_PADDING;

const CANVAS_WIDTH =
  BOARD_PADDING * 2 + SLOT_WIDTH * SLOT_COUNT + SLOT_GAP * (SLOT_COUNT - 1);
const CANVAS_HEIGHT = BOARD_PADDING * 2 + SLOT_HEIGHT;

const CLEAR_ANIM_MS = 300;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateInitialSlots(): Slot[] {
  const counts: Record<ItemType, number> = { cola: 3, milk: 3, bread: 3 };
  const pool = shuffle(
    ITEM_TYPES.flatMap((type) => Array(counts[type]).fill(type) as ItemType[])
  );
  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, () => []);
  pool.forEach((item, i) => {
    slots[i % SLOT_COUNT].push(item);
  });
  return slots;
}

function canMove(slots: Slot[], from: number, to: number): boolean {
  if (from === to) return false;
  const src = slots[from];
  if (src.length === 0) return false;
  const dst = slots[to];
  if (dst.length >= SLOT_CAPACITY) return false;
  if (dst.length === 0) return true;
  return dst[dst.length - 1] === src[src.length - 1];
}

function hasAnyMove(slots: Slot[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].length === 0) continue;
    for (let j = 0; j < slots.length; j++) {
      if (canMove(slots, i, j)) return true;
    }
  }
  return false;
}

function isStuck(slots: Slot[]): boolean {
  const hasItems = slots.some((s) => s.length > 0);
  if (!hasItems) return false;
  return !hasAnyMove(slots);
}

const COLORS = {
  colaRed: "#E50914",
  colaDarkRed: "#B0060F",
  colaLiquid: "#3B2412",
  white: "#FFFFFF",
  milkBlue: "#00A2E8",
  breadCrust: "#8B5A2B",
  breadMain: "#C68B59",
  breadInside: "#F5DEB3",
};

function drawCola(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const u = size / 16;
  ctx.fillStyle = COLORS.colaLiquid;
  ctx.fillRect(x + 6 * u, y, 4 * u, 3 * u);
  ctx.fillStyle = COLORS.colaRed;
  ctx.fillRect(x + 5 * u, y + 3 * u, 6 * u, 1 * u);
  ctx.fillRect(x + 4 * u, y + 4 * u, 8 * u, 3 * u);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(x + 4 * u, y + 7 * u, 8 * u, 2 * u);
  ctx.fillStyle = COLORS.colaRed;
  ctx.fillRect(x + 4 * u, y + 9 * u, 8 * u, 5 * u);
  ctx.fillStyle = COLORS.colaDarkRed;
  ctx.fillRect(x + 4 * u, y + 14 * u, 8 * u, 2 * u);
}

function drawMilk(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const u = size / 16;
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(x + 7 * u, y, 2 * u, 1 * u);
  ctx.fillRect(x + 6 * u, y + 1 * u, 4 * u, 1 * u);
  ctx.fillRect(x + 5 * u, y + 2 * u, 6 * u, 1 * u);
  ctx.fillRect(x + 3 * u, y + 3 * u, 10 * u, 12 * u);
  ctx.fillStyle = COLORS.milkBlue;
  ctx.fillRect(x + 3 * u, y + 8 * u, 10 * u, 2 * u);
}

function drawBread(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const u = size / 16;
  ctx.fillStyle = COLORS.breadCrust;
  ctx.fillRect(x + 4 * u, y + 2 * u, 8 * u, 1 * u);
  ctx.fillRect(x + 3 * u, y + 3 * u, 10 * u, 1 * u);
  ctx.fillRect(x + 2 * u, y + 4 * u, 12 * u, 11 * u);
  ctx.fillStyle = COLORS.breadMain;
  ctx.fillRect(x + 5 * u, y + 3 * u, 6 * u, 1 * u);
  ctx.fillRect(x + 3 * u, y + 4 * u, 10 * u, 10 * u);
  ctx.fillStyle = COLORS.breadInside;
  ctx.fillRect(x + 5 * u, y + 5 * u, 6 * u, 8 * u);
}

function drawItem(ctx: CanvasRenderingContext2D, type: ItemType, x: number, y: number, size: number) {
  if (type === "cola") drawCola(ctx, x, y, size);
  else if (type === "milk") drawMilk(ctx, x, y, size);
  else drawBread(ctx, x, y, size);
}

type Clearing = { index: number; type: ItemType; start: number } | null;

export default function MartSortGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotsRef = useRef<Slot[]>(generateInitialSlots());
  const selectedRef = useRef<number | null>(null);
  const clearingRef = useRef<Clearing>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const checkGameOverAfter = useCallback(() => {
    if (isStuck(slotsRef.current)) {
      setGameOver(true);
    }
  }, []);

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || gameOver || clearingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      if (y < BOARD_PADDING || y > BOARD_PADDING + SLOT_HEIGHT) return;
      if (x < BOARD_PADDING) return;
      const relX = x - BOARD_PADDING;
      const cell = SLOT_WIDTH + SLOT_GAP;
      const idx = Math.floor(relX / cell);
      if (idx < 0 || idx >= SLOT_COUNT) return;
      if (relX - idx * cell > SLOT_WIDTH) return;

      const slots = slotsRef.current;
      const selected = selectedRef.current;

      if (selected === null) {
        if (slots[idx].length > 0) selectedRef.current = idx;
        return;
      }
      if (selected === idx) {
        selectedRef.current = null;
        return;
      }
      if (canMove(slots, selected, idx)) {
        const item = slots[selected].pop() as ItemType;
        slots[idx].push(item);
        selectedRef.current = null;

        const dst = slots[idx];
        if (
          dst.length === SLOT_CAPACITY &&
          dst.every((t) => t === dst[0])
        ) {
          clearingRef.current = { index: idx, type: dst[0], start: performance.now() };
          clearTimeoutRef.current = setTimeout(() => {
            slotsRef.current[idx] = [];
            clearingRef.current = null;
            setScore((s) => s + 100);
            checkGameOverAfter();
          }, CLEAR_ANIM_MS);
        } else {
          checkGameOverAfter();
        }
      } else {
        selectedRef.current = slots[idx].length > 0 ? idx : null;
      }
    },
    [gameOver, checkGameOverAfter]
  );

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    let rafId: number;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const slots = slotsRef.current;
      const selected = selectedRef.current;
      const clearing = clearingRef.current;

      for (let i = 0; i < SLOT_COUNT; i++) {
        const slotX = BOARD_PADDING + i * (SLOT_WIDTH + SLOT_GAP);
        const slotY = BOARD_PADDING;

        ctx.fillStyle = "#FAFBFC";
        ctx.fillRect(slotX, slotY, SLOT_WIDTH, SLOT_HEIGHT);
        ctx.lineWidth = i === selected ? 4 : 3;
        ctx.strokeStyle = i === selected ? "#00A2E8" : "#B9C2CC";
        ctx.strokeRect(
          slotX + ctx.lineWidth / 2,
          slotY + ctx.lineWidth / 2,
          SLOT_WIDTH - ctx.lineWidth,
          SLOT_HEIGHT - ctx.lineWidth
        );

        const items = slots[i];
        for (let level = 0; level < items.length; level++) {
          const type = items[level];
          const isTop = level === items.length - 1;
          const itemX = slotX + (SLOT_WIDTH - ITEM_SIZE) / 2;
          let itemY =
            slotY + SLOT_HEIGHT - SLOT_BOTTOM_PADDING - (level + 1) * ITEM_SIZE;

          let scale = 1;
          let alpha = 1;

          if (isTop && i === selected) {
            itemY += Math.sin(t / 180) * 5;
          }

          if (clearing && clearing.index === i) {
            const progress = Math.min(
              1,
              (t - clearing.start) / CLEAR_ANIM_MS
            );
            scale = 1 - progress;
            alpha = 1 - progress;
          }

          ctx.save();
          ctx.globalAlpha = alpha;
          if (scale !== 1) {
            const cx = itemX + ITEM_SIZE / 2;
            const cy = itemY + ITEM_SIZE / 2;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
          }
          drawItem(ctx, type, itemX, itemY, ITEM_SIZE);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(rafId);
  }, []);

  const restart = () => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    slotsRef.current = generateInitialSlots();
    selectedRef.current = null;
    clearingRef.current = null;
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 rounded-lg border border-gray-300 bg-white px-6 py-3 font-mono text-lg tracking-wider text-gray-700 shadow-sm">
        <span>SCORE</span>
        <span className="text-2xl font-bold text-[#00A2E8]">{score}</span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          className="cursor-pointer touch-none rounded-lg"
          onClick={(e) => handlePointer(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) handlePointer(t.clientX, t.clientY);
          }}
        />

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/60">
            <p className="font-mono text-2xl font-bold text-white tracking-widest">
              GAME OVER
            </p>
            <p className="font-mono text-white">SCORE {score}</p>
            <button
              onClick={restart}
              className="rounded-md border-2 border-white bg-[#00A2E8] px-4 py-2 font-mono text-white transition hover:bg-[#0089c7]"
            >
              다시하기
            </button>
          </div>
        )}
      </div>

      <p className="font-mono text-xs text-gray-400">
        진열대를 클릭해 아이템을 선택하고, 같은 종류가 있는 진열대를 클릭해 옮기세요.
      </p>
    </div>
  );
}
