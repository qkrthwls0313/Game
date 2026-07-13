"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GAME_CONFIG = {
  // 1. 기본 타이머 및 시간 설정
  INITIAL_TIME_LIMIT: 60, // 게임 시작 시 주어지는 제한 시간 (초)
  TIME_GAIN_ON_MATCH: 5, // 아이템 정렬(매칭) 성공 시 추가되는 시간 (초)
  MAX_TIME_LIMIT: 60, // 타이머가 가질 수 있는 최대 시간 (초)

  // 2. 콤보 시스템 설정
  COMBO_WINDOW_MS: 5000, // 콤보를 유지하기 위해 허용되는 시간 (밀리초, 5000ms = 5초)
  BASE_SCORE_PER_MATCH: 100, // 매칭 기본 점수

  // 3. 피버 모드 설정
  FEVER_TRIGGER_COMBO: 5, // 피버 모드를 발동시키기 위한 최소 콤보 횟수
  FEVER_DURATION_MS: 8000, // 피버 모드 지속 시간 (밀리초, 8000ms = 8초)

  // 4. 방해 요소 (쓰레기) 설정
  HAZARD_SPAWN_INTERVAL_MS: 45000, // 쓰레기가 생성되는 주기 (밀리초, 45000ms = 45초)

  // 5. 아이템 기본 제한
  MAX_BROOM_COUNT: 1, // 판당 사용할 수 있는 빗자루 아이템 개수
  MAX_SHUFFLE_COUNT: 2, // 판당 사용할 수 있는 셔플 아이템 개수
};

type RealItemType = "cola" | "milk" | "bread";
type ItemType = RealItemType | "trash";
type Slot = ItemType[];
type GameOverReason = "stuck" | "timeup" | null;
type ToolMode = "none" | "broom";

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
const HAZARD_INTERVAL_SEC = GAME_CONFIG.HAZARD_SPAWN_INTERVAL_MS / 1000;

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

type ClearResult = { count: number; type: ItemType } | null;

function getClearResult(dst: Slot, feverActive: boolean): ClearResult {
  if (dst.length === 0) return null;
  const top = dst[dst.length - 1];
  if (top === "trash") return null;
  if (feverActive) {
    if (dst.length >= 2 && dst[dst.length - 2] === top) {
      return { count: 2, type: top };
    }
    return null;
  }
  if (dst.length === SLOT_CAPACITY && dst.every((t) => t === dst[0])) {
    return { count: SLOT_CAPACITY, type: dst[0] };
  }
  return null;
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

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  maxLife: number;
  color: string;
  w: number;
  h: number;
};

const PARTICLE_COLORS = ["#FFFFFF", "#FFF6C2", "#FFD700"];

function spawnParticles(list: Particle[], x: number, y: number) {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 160;
    list.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 10,
      life: 700,
      maxLife: 700,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      w: 6 + Math.random() * 4,
      h: 4 + Math.random() * 3,
    });
  }
}

type AudioCtxWindow = Window & { webkitAudioContext?: typeof AudioContext };

function ensureAudioContext(
  ref: React.MutableRefObject<AudioContext | null>
): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ref.current) {
    const AudioCtxClass =
      window.AudioContext || (window as AudioCtxWindow).webkitAudioContext;
    if (!AudioCtxClass) return null;
    ref.current = new AudioCtxClass();
  }
  if (ref.current.state === "suspended") {
    ref.current.resume().catch(() => {});
  }
  return ref.current;
}

function playPluck(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(600, t0);
  osc.frequency.exponentialRampToValueAtTime(300, t0 + 0.08);
  gain.gain.setValueAtTime(0.15, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.12);
}

function playClear(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  [0, 0.09].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800, t0 + offset);
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.09);
  });
}

function playGameOver(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  const notes = [440, 392, 349, 293];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    const detune = (Math.random() - 0.5) * 30;
    osc.frequency.setValueAtTime(freq, t0 + i * 0.18);
    osc.detune.setValueAtTime(detune, t0 + i * 0.18);
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.15, t0 + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + i * 0.18);
    osc.stop(t0 + i * 0.18 + 0.18);
  });
}

type Clearing = { index: number; count: number; start: number } | null;
type ComboPopup = { combo: number; start: number } | null;

export default function MartSortGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotsRef = useRef<Slot[]>(generateInitialSlots());
  const selectedRef = useRef<number | null>(null);
  const clearingRef = useRef<Clearing>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const toolModeRef = useRef<ToolMode>("none");

  const endedRef = useRef(false);
  const timeLeftRef = useRef(GAME_CONFIG.INITIAL_TIME_LIMIT);
  const hazardAccumRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const comboRef = useRef(0);
  const comboDeadlineRef = useRef<number | null>(null);
  const comboPopupRef = useRef<ComboPopup>(null);
  const feverUntilRef = useRef<number | null>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<GameOverReason>(null);
  const [displayTime, setDisplayTime] = useState(GAME_CONFIG.INITIAL_TIME_LIMIT);
  const [feverActive, setFeverActive] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("none");
  const [broomCount, setBroomCount] = useState(GAME_CONFIG.MAX_BROOM_COUNT);
  const [shuffleCount, setShuffleCount] = useState(GAME_CONFIG.MAX_SHUFFLE_COUNT);

  const endGame = useCallback((reason: "stuck" | "timeup") => {
    if (endedRef.current) return;
    endedRef.current = true;
    setGameOverReason(reason);
    setGameOver(true);
    const ctx = ensureAudioContext(audioCtxRef);
    if (ctx) playGameOver(ctx);
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

      if (toolModeRef.current === "broom") {
        if (slots[idx].length > 0) {
          slots[idx].pop();
          toolModeRef.current = "none";
          setToolMode("none");
          setBroomCount((c) => Math.max(0, c - 1));
          const ctx = ensureAudioContext(audioCtxRef);
          if (ctx) playPluck(ctx);
          checkGameOverAfter();
        }
        return;
      }

      const selected = selectedRef.current;
      const topOf = (i: number) =>
        slots[i].length > 0 ? slots[i][slots[i].length - 1] : null;

      if (selected === null) {
        if (slots[idx].length > 0 && topOf(idx) !== "trash") {
          selectedRef.current = idx;
          const ctx = ensureAudioContext(audioCtxRef);
          if (ctx) playPluck(ctx);
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
        const moveCtx = ensureAudioContext(audioCtxRef);
        if (moveCtx) playPluck(moveCtx);

        const nowMove = performance.now();
        const feverActiveNow =
          feverUntilRef.current !== null && nowMove < feverUntilRef.current;
        const clearResult = getClearResult(slots[idx], feverActiveNow);

        if (clearResult) {
          const slotX = BOARD_PADDING + idx * (SLOT_WIDTH + SLOT_GAP);
          const originX = slotX + SLOT_WIDTH / 2;
          const topLevel = slots[idx].length - 1;
          const originY =
            BOARD_TOP +
            SLOT_HEIGHT -
            SLOT_BOTTOM_PADDING -
            (topLevel + 1) * ITEM_SIZE +
            ITEM_SIZE / 2;

          clearingRef.current = {
            index: idx,
            count: clearResult.count,
            start: nowMove,
          };
          clearTimeoutRef.current = setTimeout(() => {
            const arr = slotsRef.current[idx];
            arr.splice(arr.length - clearResult.count, clearResult.count);
            clearingRef.current = null;
            spawnParticles(particlesRef.current, originX, originY);
            const clearCtx = ensureAudioContext(audioCtxRef);
            if (clearCtx) playClear(clearCtx);

            const now2 = performance.now();
            const comboCount =
              comboDeadlineRef.current !== null && now2 <= comboDeadlineRef.current
                ? comboRef.current + 1
                : 1;
            comboRef.current = comboCount;
            comboDeadlineRef.current = now2 + GAME_CONFIG.COMBO_WINDOW_MS;

            const gained =
              comboCount >= 2
                ? GAME_CONFIG.BASE_SCORE_PER_MATCH * comboCount
                : GAME_CONFIG.BASE_SCORE_PER_MATCH;
            setScore((s) => s + gained);
            if (comboCount >= 2) {
              comboPopupRef.current = { combo: comboCount, start: now2 };
            }
            if (
              comboCount >= GAME_CONFIG.FEVER_TRIGGER_COMBO &&
              (feverUntilRef.current === null || now2 >= feverUntilRef.current)
            ) {
              feverUntilRef.current = now2 + GAME_CONFIG.FEVER_DURATION_MS;
            }

            timeLeftRef.current = Math.min(
              GAME_CONFIG.MAX_TIME_LIMIT,
              timeLeftRef.current + GAME_CONFIG.TIME_GAIN_ON_MATCH
            );

            checkGameOverAfter();
          }, CLEAR_ANIM_MS);
        } else {
          checkGameOverAfter();
        }
      } else {
        const nextSelected =
          slots[idx].length > 0 && topOf(idx) !== "trash" ? idx : null;
        selectedRef.current = nextSelected;
        if (nextSelected !== null) {
          const ctx = ensureAudioContext(audioCtxRef);
          if (ctx) playPluck(ctx);
        }
      }
    },
    [checkGameOverAfter]
  );

  const handleBroomClick = () => {
    if (endedRef.current || broomCount <= 0 || clearingRef.current) return;
    const next: ToolMode = toolModeRef.current === "broom" ? "none" : "broom";
    toolModeRef.current = next;
    setToolMode(next);
  };

  const handleShuffleClick = () => {
    if (endedRef.current || shuffleCount <= 0 || clearingRef.current) return;
    toolModeRef.current = "none";
    setToolMode("none");

    const slots = slotsRef.current;
    const flat = slots.flatMap((s) => s);
    const shuffled = shuffle(flat);
    let cursor = 0;
    slotsRef.current = slots.map((s) => {
      const len = s.length;
      const chunk = shuffled.slice(cursor, cursor + len);
      cursor += len;
      return chunk;
    });
    selectedRef.current = null;
    setShuffleCount((c) => Math.max(0, c - 1));

    const ctx = ensureAudioContext(audioCtxRef);
    if (ctx) playPluck(ctx);
    checkGameOverAfter();
  };

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayTime(Math.ceil(Math.max(0, timeLeftRef.current)));
      setFeverActive(
        feverUntilRef.current !== null && performance.now() < feverUntilRef.current
      );
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
        if (hazardAccumRef.current >= HAZARD_INTERVAL_SEC) {
          hazardAccumRef.current -= HAZARD_INTERVAL_SEC;
          spawnTrash(slotsRef.current);
        }
        if (timeLeftRef.current <= 0) {
          timeLeftRef.current = 0;
          endGame("timeup");
        }
        if (feverUntilRef.current !== null && t >= feverUntilRef.current) {
          feverUntilRef.current = null;
        }
      }

      const feverNow = feverUntilRef.current !== null && t < feverUntilRef.current;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const fraction = Math.max(0, timeLeftRef.current / GAME_CONFIG.MAX_TIME_LIMIT);
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

          if (
            clearing &&
            clearing.index === i &&
            level >= items.length - clearing.count
          ) {
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

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt * 1000;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += 600 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (feverNow) {
        const hue = (t / 5) % 360;
        ctx.save();
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, CANVAS_WIDTH - 6, CANVAS_HEIGHT - 6);
        ctx.restore();
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
    particlesRef.current = [];
    toolModeRef.current = "none";
    endedRef.current = false;
    timeLeftRef.current = GAME_CONFIG.INITIAL_TIME_LIMIT;
    hazardAccumRef.current = 0;
    lastFrameTimeRef.current = null;
    comboRef.current = 0;
    comboDeadlineRef.current = null;
    comboPopupRef.current = null;
    feverUntilRef.current = null;
    setScore(0);
    setGameOver(false);
    setGameOverReason(null);
    setDisplayTime(GAME_CONFIG.INITIAL_TIME_LIMIT);
    setFeverActive(false);
    setToolMode("none");
    setBroomCount(GAME_CONFIG.MAX_BROOM_COUNT);
    setShuffleCount(GAME_CONFIG.MAX_SHUFFLE_COUNT);
  };

  const timeUrgent = displayTime <= 10;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`flex items-center gap-6 rounded-lg border px-6 py-3 font-mono text-lg tracking-wider shadow-sm transition-colors ${
          feverActive
            ? "border-fuchsia-400 bg-gradient-to-r from-fuchsia-100 via-yellow-100 to-cyan-100 text-gray-800"
            : "border-gray-300 bg-white text-gray-700"
        }`}
      >
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
        {feverActive && (
          <>
            <span className="text-gray-300">|</span>
            <span className="animate-pulse font-bold text-fuchsia-600">
              FEVER!
            </span>
          </>
        )}
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

      <div className="flex items-center gap-3">
        <button
          onClick={handleBroomClick}
          disabled={gameOver || broomCount <= 0}
          className={`rounded-md border-2 px-4 py-2 font-mono text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
            toolMode === "broom"
              ? "border-amber-500 bg-amber-400 text-white"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          🧹 빗자루 ({broomCount})
        </button>
        <button
          onClick={handleShuffleClick}
          disabled={gameOver || shuffleCount <= 0}
          className="rounded-md border-2 border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🔀 셔플 ({shuffleCount})
        </button>
      </div>

      <p className="font-mono text-xs text-gray-400">
        {toolMode === "broom"
          ? "빗자루 모드: 지울 진열대를 클릭하세요."
          : "진열대를 클릭해 아이템을 선택하고, 같은 종류가 있는 진열대를 클릭해 옮기세요. 5초 안에 연속 정렬하면 콤보 보너스!"}
      </p>
    </div>
  );
}
