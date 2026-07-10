export type Segment = {
  id: string;
  label: string;
  color: string;
};

export const DEFAULT_COLORS = [
  "#F87171",
  "#FB923C",
  "#FBBF24",
  "#A3E635",
  "#34D399",
  "#22D3EE",
  "#818CF8",
  "#F472B6",
];

export const DEFAULT_SEGMENTS: Segment[] = [
  { id: "seg-1", label: "1원", color: DEFAULT_COLORS[0] },
  { id: "seg-2", label: "10원", color: DEFAULT_COLORS[1] },
  { id: "seg-3", label: "100원", color: DEFAULT_COLORS[2] },
  { id: "seg-4", label: "500원", color: DEFAULT_COLORS[3] },
  { id: "seg-5", label: "1,000원", color: DEFAULT_COLORS[4] },
  { id: "seg-6", label: "5,000원", color: DEFAULT_COLORS[5] },
  { id: "seg-7", label: "10,000원", color: DEFAULT_COLORS[6] },
  { id: "seg-8", label: "100,000원", color: DEFAULT_COLORS[7] },
];

export function createSegmentId(): string {
  return `seg-${Math.random().toString(36).slice(2, 10)}`;
}
