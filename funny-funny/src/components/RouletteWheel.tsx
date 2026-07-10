"use client";

import { useMemo, useRef, useState } from "react";
import type { Segment } from "@/lib/roulette";

type RouletteWheelProps = {
  segments: Segment[];
  onSpinEnd?: (segment: Segment) => void;
};

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 4;
const SPIN_DURATION_MS = 4200;
const EXTRA_SPINS = 6;

function polarToCartesian(angleDeg: number, radius: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  };
}

function describeSlice(startAngle: number, endAngle: number) {
  const start = polarToCartesian(startAngle, RADIUS);
  const end = polarToCartesian(endAngle, RADIUS);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function RouletteWheel({ segments, onSpinEnd }: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Segment | null>(null);
  const rotationRef = useRef(0);

  const sliceAngle = 360 / segments.length;

  const slices = useMemo(
    () =>
      segments.map((segment, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const midAngle = startAngle + sliceAngle / 2;
        const labelPos = polarToCartesian(midAngle, RADIUS * 0.62);
        return {
          segment,
          path: describeSlice(startAngle, endAngle),
          midAngle,
          labelPos,
        };
      }),
    [segments, sliceAngle],
  );

  function handleSpin() {
    if (spinning || segments.length === 0) return;

    const winnerIndex = Math.floor(Math.random() * segments.length);
    const winningSegment = segments[winnerIndex];
    const midAngle = winnerIndex * sliceAngle + sliceAngle / 2;

    const targetMod = (360 - midAngle + 360) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;

    const newRotation = rotationRef.current + delta + EXTRA_SPINS * 360;
    rotationRef.current = newRotation;

    setSpinning(true);
    setWinner(null);
    setRotation(newRotation);

    window.setTimeout(() => {
      setSpinning(false);
      setWinner(winningSegment);
      onSpinEnd?.(winningSegment);
    }, SPIN_DURATION_MS);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/4"
          data-testid="roulette-pointer"
        >
          <div className="h-0 w-0 border-x-[14px] border-t-[24px] border-x-transparent border-t-red-600 drop-shadow-md" />
        </div>

        <svg
          data-testid="roulette-svg"
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="rounded-full border-4 border-white shadow-xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
              : "none",
          }}
        >
          {slices.map(({ segment, path, midAngle, labelPos }) => (
            <g key={segment.id}>
              <path d={path} fill={segment.color} stroke="#ffffff" strokeWidth={2} />
              <text
                x={labelPos.x}
                y={labelPos.y}
                fontSize={segments.length > 10 ? 10 : 13}
                fontWeight={600}
                fill="#1f2937"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
              >
                {segment.label}
              </text>
            </g>
          ))}
          <circle cx={CENTER} cy={CENTER} r={10} fill="#ffffff" stroke="#d1d5db" strokeWidth={2} />
        </svg>
      </div>

      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning || segments.length < 2}
        data-testid="spin-button"
        className="rounded-full bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {spinning ? "돌아가는 중..." : "돌리기"}
      </button>

      <div
        data-testid="winner-display"
        className="min-h-[2rem] text-xl font-bold text-gray-800"
        aria-live="polite"
      >
        {winner ? `당첨: ${winner.label}` : " "}
      </div>
    </div>
  );
}
