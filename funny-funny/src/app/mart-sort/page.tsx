import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import MartSortGame from "@/components/MartSortGame";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "마트 카트 정리왕 | Mart Sort Master",
  description:
    "같은 물건 3개를 한 진열대에 모아 정리하는 8비트 도트 정렬 퍼즐 게임",
};

export default function MartSortPage() {
  return (
    <main
      className={`${pixelFont.variable} flex flex-1 flex-col items-center gap-8 bg-[#F0F4F8] px-4 py-10`}
    >
      <header className="text-center">
        <h1
          className="text-lg text-gray-800 md:text-xl"
          style={{ fontFamily: "var(--font-pixel)" }}
        >
          마트 카트 정리왕
        </h1>
        <p className="mt-3 text-sm text-gray-500">
          같은 물건 3개를 한 진열대에 모으면 팡! 터지며 점수를 얻어요.
        </p>
      </header>
      <MartSortGame />
    </main>
  );
}
