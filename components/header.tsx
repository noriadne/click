"use client";

import Link from "next/link";
import { Dice5, LogOut, ShieldCheck } from "lucide-react";
import { useUser } from "@/components/user-provider";

export default function Header() {
  const { profile, isAdmin, signOut, ready } = useUser();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      {/* 높이(h-14 + 하단 보더 1px = 57px)는 schedule-view.tsx 의 HEADER_HEIGHT 와 맞춰야 한다 */}
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Dice5 className="h-6 w-6 text-indigo-500" />
          <span className="text-lg font-bold tracking-tight">보드게임 모임</span>
          {process.env.NODE_ENV === "development" && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              DEV
            </span>
          )}
        </Link>

        {ready && profile && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-sm text-zinc-400">{profile.nickname}</span>
            {isAdmin && (
              <Link
                href="/admin"
                aria-label="관리자 화면"
                className="rounded-lg p-1.5 text-amber-400 transition hover:bg-zinc-800"
              >
                <ShieldCheck className="h-4 w-4" />
              </Link>
            )}
            <button
              onClick={signOut}
              aria-label="로그아웃"
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
