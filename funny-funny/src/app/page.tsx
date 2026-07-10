"use client";

import { useState } from "react";
import RouletteWheel from "@/components/RouletteWheel";
import SegmentEditor from "@/components/SegmentEditor";
import { DEFAULT_SEGMENTS, type Segment } from "@/lib/roulette";

export default function Home() {
  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);

  return (
    <main className="flex flex-1 flex-col items-center gap-10 bg-gray-50 px-6 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">애니메이션 룰렛</h1>
        <p className="mt-2 text-gray-500">
          버튼을 눌러 룰렛을 돌리고, 아래에서 항목과 개수를 자유롭게 수정하세요.
        </p>
      </header>

      <div className="flex w-full max-w-4xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
        <RouletteWheel segments={segments} />
        <SegmentEditor segments={segments} onChange={setSegments} />
      </div>
    </main>
  );
}
