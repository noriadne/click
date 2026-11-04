"use client";

import { useState, useTransition } from "react";
import { Dice5, LogOut, Pencil } from "lucide-react";
import { useUser } from "@/components/user-provider";

export default function Header() {
  const { user, ready, registerNickname, logout } = useUser();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nickname = formData.get("nickname") as string;
    if (!nickname.trim()) return;

    startTransition(async () => {
      const result = await registerNickname(nickname);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Dice5 className="h-6 w-6 text-indigo-500" />
          <span className="text-lg font-bold tracking-tight">보드게임 모임</span>
        </div>

        {ready && (
          <div className="flex items-center gap-2">
            {user && !editing ? (
              <>
                <span className="text-sm text-zinc-500">{user.nickname}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={logout}
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                <input
                  name="nickname"
                  type="text"
                  placeholder="닉네임"
                  maxLength={20}
                  autoComplete="off"
                  defaultValue={user?.nickname ?? ""}
                  className="w-28 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-indigo-900"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
                >
                  {isPending ? "…" : user ? "변경" : "시작"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="bg-red-50 px-4 py-1.5 text-center text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
    </header>
  );
}
