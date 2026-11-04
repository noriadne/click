"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "유저 관리" },
  { href: "/admin/games", label: "게임 관리" },
];

/** 관리자 화면 상단 탭 */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="관리자 메뉴" className="mb-5 flex items-center gap-1 border-b border-zinc-800">
      <Link
        href="/"
        aria-label="메인으로"
        className="mr-1 mb-1 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-indigo-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
