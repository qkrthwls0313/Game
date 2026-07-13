"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RealItemType = "cola" | "milk" | "bread";
type ItemType = RealItemType | "trash";
type Slot = ItemType[];
type GameOverReason = "stuck" | "timeup" | null;

const SLOT_COUNT = 5;
const SLOT_CAPACITY = 3;
const ITEM_TYPES: RealItemType[] = ["cola", "milk", "bread"];

const ITEM_SIZE = 64;
const SLOT_WIDTH = 104;
const SLOT_GAP = 16;
const BOARD_PADDING = 24;
const SLOT_TOP_PADDING = 16;
const SLOT_BOTTOM_PADDING = 12;
const SLOT_HEIGHT =
  ITEM_SIZE * SLOT_CAPACITY + SLOT_TOP_PADDING + SLOT_BOTTOM_PADDING;

const TIMER_BAR_HEIGHT = 18;
const TIMER_BAR_GAP = 14;
const BOARD_TOP = BOARD_PADDING + TIMER_BAR_HEIGHT + TIMER_BAR_GAP;

const CANVAS_WIDTH =
  BOARD_PADDING * 2 + SLOT_WIDTH * SLOT_COUNT + SLOT_GAP * (SLOT_COUNT - 1);
const CANVAS_HEIGHT = BOARD_TOP + SLOT_HEIGHT + BOARD_PADDING;

const CLEAR_ANIM_MS = 300;
const COMBO_POPUP_MS = 900;
const COMBO_WINDOW_MS = 5000;
const GAME_DURATION = 60;
const TIME_BONUS_PER_CLEAR = 5;
const HAZARD_INTERVAL = 45;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateInitialSlots(): Slot[] {
  const counts: Record<RealItemType, number> = { cola: 3, milk: 3, bread: 3 };
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
  if (src[src.length - 1] === "trash") return false;
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

function spawnTrash(slots: Slot[]) {
  const emptyIdx = slots
    .map((s, i) => (s.length === 0 ? i : -1))
    .filter((i) => i >= 0);
  if (emptyIdx.length === 0) return;
  const pick = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
  slots[pick] = ["trash"];
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
  trash: "#556B2F",
  trashDark: "#3F4F22",
  trashStem: "#5C3A21",
  trashLeaf: "#7A8F4A",
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

function drawTrash(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const u = size / 16;
  ctx.fillStyle = COLORS.trashStem;
  ctx.fillRect(x + 7 * u, y + 3 * u, 2 * u, 3 * u);
  ctx.fillStyle = COLORS.trashLeaf;
  ctx.fillRect(x + 9 * u, y + 3 * u, 3 * u, 2 * u);
  ctx.fillStyle = COLORS.trash;
  ctx.fillRect(x + 3 * u, y + 6 * u, 10 * u, 5 * u);
  ctx.fillRect(x + 4 * u, y + 5 * u, 8 * u, 7 * u);
  ctx.fillStyle = COLORS.trashDark;
  ctx.fillRect(x + 6 * u, y + 8 * u, 2 * u, 2 * u);
  ctx.fillRect(x + 9 * u, y + 9 * u, 2 * u, 2 * u);
}

function drawItem(ctx: CanvasRenderingContext2D, type: ItemType, x: number, y: number, size: number) {
  if (type === "cola") drawCola(ctx, x, y, size);
  else if (type === "milk") drawMilk(ctx, x, y, size);
  else if (type === "bread") drawBread(ctx, x, y, size);
  else drawTrash(ctx, x, y, size);
}

function lerpColor(c1: number[], c2: number[], t: number): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function timeBarColor(fraction: number): string {
  const green = [34, 197, 94];
  const yellow = [250, 204, 21];
  const red = [239, 68, 68];
  if (fraction > 0.5) return lerpColor(yellow, green, (fraction - 0.5) / 0.5);
  return lerpColor(red, yellow, fraction / 0.5);
}

type Clearing = { index: number; type: ItemType; start: number } | null;
type ComboPopup = { combo: number; start: number } | null;

export default function MartSortGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotsRef = useRef<Slot[]>(generateInitialSlots());
  const selectedRef = useRef<number | null>(null);
  const clearingRef = useRef<Clearing>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endedRef = useRef(false);
  const timeLeftRef = useRef(GAME_DURATION);
  const hazardAccumRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const comboRef = useRef(0);
  const comboDeadlineRef = useRef<number | null>(null);
  const comboPopupRef = useRef<ComboPopup>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<GameOverReason>(null);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const endGame = useCallback((reason: "stuck" | "timeup") => {
    if (endedRef.current) return;
    endedRef.current = true;
    setGameOverReason(reason);
    setGameOver(true);
  }, []);

  const checkGameOverAfter = useCallback(() => {
    if (isStuck(slotsRef.current)) endGame("stuck");
  }, [endGame]);

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || endedRef.current || clearingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      if (y < BOARD_TOP || y > BOARD_TOP + SLOT_HEIGHT) return;
      if (x < BOARD_PADDING) return;
      const relX = x - BOARD_PADDING;
      const cell = SLOT_WIDTH + SLOT_GAP;
      const idx = Math.floor(relX / cell);
      if (idx < 0 || idx >= SLOT_COUNT) return;
      if (relX - idx * cell > SLOT_WIDTH) return;

      const slots = slotsRef.current;
      const selected = selectedRef.current;
      const topOf = (i: number) =>
        slots[i].length > 0 ? slots[i][slots[i].length - 1] : null;

      if (selected === null) {
        if (slots[idx].length > 0 && topOf(idx) !== "trash") {
          selectedRef.current = idx;
        }
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

            const now = performance.now();
            const comboCount =
              comboDeadlineRef.current !== null && now <= comboDeadlineRef.current
                ? comboRef.current + 1
                : 1;
            comboRef.current = comboCount;
            comboDeadlineRef.current = now + COMBO_WINDOW_MS;

            const gained = comboCount >= 2 ? 100 * comboCount : 100;
            setScore((s) => s + gained);
            if (comboCount >= 2) {
              comboPopupRef.current = { combo: comboCount, start: now };
            }

            timeLeftRef.current = Math.min(
              GAME_DURATION,
              timeLeftRef.current + TIME_BONUS_PER_CLEAR
            );

            checkGameOverAfter();
          }, CLEAR_ANIM_MS);
        } else {
          checkGameOverAfter();
        }
      } else {
        selectedRef.current =
          slots[idx].length > 0 && topOf(idx) !== "trash" ? idx : null;
      }
    },
    [checkGameOverAfter]
  );

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayTime(Math.ceil(Math.max(0, timeLeftRef.current)));
    }, 200);
    return () => clearInterval(id);
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
      let dt = 0;
      if (lastFrameTimeRef.current !== null) {
        dt = (t - lastFrameTimeRef.current) / 1000;
      }
      lastFrameTimeRef.current = t;

      if (!endedRef.current) {
        timeLeftRef.current -= dt;
        hazardAccumRef.current += dt;
        if (hazardAccumRef.current >= HAZARD_INTERVAL) {
          hazardAccumRef.current -= HAZARD_INTERVAL;
          spawnTrash(slotsRef.current);
        }
        if (timeLeftRef.current <= 0) {
          timeLeftRef.current = 0;
          endGame("timeup");
        }
      }

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const fraction = Math.max(0, timeLeftRef.current / GAME_DURATION);
      const barX = BOARD_PADDING;
      const barY = BOARD_PADDING;
      const barW = CANVAS_WIDTH - BOARD_PADDING * 2;
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(barX, barY, barW, TIMER_BAR_HEIGHT);
      ctx.fillStyle = timeBarColor(fraction);
      ctx.fillRect(barX, barY, barW * fraction, TIMER_BAR_HEIGHT);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#94A3B8";
      ctx.strokeRect(barX + 1, barY + 1, barW - 2, TIMER_BAR_HEIGHT - 2);

      const slots = slotsRef.current;
      const selected = selectedRef.current;
      const clearing = clearingRef.current;

      for (let i = 0; i < SLOT_COUNT; i++) {
        const slotX = BOARD_PADDING + i * (SLOT_WIDTH + SLOT_GAP);
        const slotY = BOARD_TOP;

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
            const progress = Math.min(1, (t - clearing.start) / CLEAR_ANIM_MS);
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

      const popup = comboPopupRef.current;
      if (popup) {
        const progress = (t - popup.start) / COMBO_POPUP_MS;
        if (progress >= 1) {
          comboPopupRef.current = null;
        } else {
          const scale =
            progress < 0.25
              ? 0.5 + 0.8 * (progress / 0.25)
              : 1.3 - 0.3 * Math.min(1, (progress - 0.25) / 0.25);
          const alpha = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
          const cx = CANVAS_WIDTH / 2;
          const cy = BOARD_TOP + SLOT_HEIGHT / 2;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.font = "bold 28px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#1F2937";
          ctx.strokeText(`${popup.combo} COMBO!`, 0, 0);
          ctx.fillStyle = "#FFD700";
          ctx.fillText(`${popup.combo} COMBO!`, 0, 0);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(rafId);
  }, [endGame]);

  const restart = () => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    slotsRef.current = generateInitialSlots();
    selectedRef.current = null;
    clearingRef.current = null;
    endedRef.current = false;
    timeLeftRef.current = GAME_DURATION;
    hazardAccumRef.current = 0;
    lastFrameTimeRef.current = null;
    comboRef.current = 0;
    comboDeadlineRef.current = null;
    comboPopupRef.current = null;
    setScore(0);
    setGameOver(false);
    setGameOverReason(null);
    setDisplayTime(GAME_DURATION);
  };

  const timeUrgent = displayTime <= 10;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 rounded-lg border border-gray-300 bg-white px-6 py-3 font-mono text-lg tracking-wider text-gray-700 shadow-sm">
        <span>SCORE</span>
        <span className="text-2xl font-bold text-[#00A2E8]">{score}</span>
        <span className="text-gray-300">|</span>
        <span>TIME</span>
        <span
          className={`text-2xl font-bold ${
            timeUrgent ? "text-red-500" : "text-gray-700"
          }`}
        >
          {displayTime}
        </span>
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
              {gameOverReason === "timeup" ? "TIME UP!" : "GAME OVER"}
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
        진열대를 클릭해 아이템을 선택하고, 같은 종류가 있는 진열대를 클릭해 옮기세요. 5초 안에 연속으로 정렬하면 콤보 보너스!
      </p>
    </div>
  );
}
