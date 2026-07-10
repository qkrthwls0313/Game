"use client";

import { DEFAULT_COLORS, DEFAULT_SEGMENTS, createSegmentId, type Segment } from "@/lib/roulette";

type SegmentEditorProps = {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
};

const MIN_SEGMENTS = 2;
const MAX_SEGMENTS = 16;

export default function SegmentEditor({ segments, onChange }: SegmentEditorProps) {
  function updateLabel(id: string, label: string) {
    onChange(segments.map((s) => (s.id === id ? { ...s, label } : s)));
  }

  function updateColor(id: string, color: string) {
    onChange(segments.map((s) => (s.id === id ? { ...s, color } : s)));
  }

  function removeSegment(id: string) {
    if (segments.length <= MIN_SEGMENTS) return;
    onChange(segments.filter((s) => s.id !== id));
  }

  function addSegment() {
    if (segments.length >= MAX_SEGMENTS) return;
    const nextColor = DEFAULT_COLORS[segments.length % DEFAULT_COLORS.length];
    onChange([
      ...segments,
      { id: createSegmentId(), label: `항목 ${segments.length + 1}`, color: nextColor },
    ]);
  }

  function resetToDefault() {
    onChange(DEFAULT_SEGMENTS.map((s) => ({ ...s, id: createSegmentId() })));
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">항목 편집</h2>
        <button
          type="button"
          onClick={resetToDefault}
          data-testid="reset-button"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          기본값으로 초기화
        </button>
      </div>

      <ul className="flex flex-col gap-2" data-testid="segment-list">
        {segments.map((segment, index) => (
          <li key={segment.id} className="flex items-center gap-2">
            <input
              type="color"
              value={segment.color}
              onChange={(e) => updateColor(segment.id, e.target.value)}
              aria-label={`항목 ${index + 1} 색상`}
              className="h-9 w-9 shrink-0 cursor-pointer rounded border border-gray-300"
            />
            <input
              type="text"
              value={segment.label}
              onChange={(e) => updateLabel(segment.id, e.target.value)}
              aria-label={`항목 ${index + 1} 이름`}
              data-testid={`segment-label-${index}`}
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeSegment(segment.id)}
              disabled={segments.length <= MIN_SEGMENTS}
              aria-label={`항목 ${index + 1} 삭제`}
              className="shrink-0 rounded px-2 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addSegment}
        disabled={segments.length >= MAX_SEGMENTS}
        data-testid="add-segment-button"
        className="mt-4 w-full rounded-lg border border-dashed border-indigo-400 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
      >
        + 항목 추가 ({segments.length}/{MAX_SEGMENTS})
      </button>
      {segments.length <= MIN_SEGMENTS && (
        <p className="mt-2 text-xs text-gray-400">최소 {MIN_SEGMENTS}개의 항목이 필요합니다.</p>
      )}
    </div>
  );
}
