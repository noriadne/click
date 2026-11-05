"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Scale, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import type { Game } from "@/lib/types";

/** 빈 칸이면 null, 아니면 숫자 (숫자가 아니면 NaN) */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : Number(text);
}

export default function AdminGames() {
  const router = useRouter();
  const { isAdmin, ready } = useUser();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // 관리자가 아니면 메인으로
  useEffect(() => {
    if (ready && !isAdmin) router.replace("/");
  }, [ready, isAdmin, router]);

  const loadGames = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from("games")
      .select("*")
      .order("title", { ascending: true });
    if (err) setError(`게임 목록을 불러오지 못했습니다. (${err.message})`);
    else setGames((data ?? []) as Game[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGames();
  }, [ready, isAdmin, loadGames]);

  if (!ready || !isAdmin) {
    return <div className="p-8 text-center text-sm text-zinc-500">확인 중…</div>;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const title = ((fd.get("title") as string) ?? "").trim();
    const minPlayers = optionalNumber(fd.get("min_players"));
    const maxPlayers = optionalNumber(fd.get("max_players"));
    const weight = optionalNumber(fd.get("geek_weight"));

    setError(null);
    setNotice(null);

    if (!title) {
      setError("게임 이름을 입력해주세요.");
      return;
    }
    if (games.some((g) => g.title.trim().toLowerCase() === title.toLowerCase())) {
      setError("이미 등록된 게임입니다.");
      return;
    }
    for (const [label, value] of [
      ["최소 인원", minPlayers],
      ["최대 인원", maxPlayers],
    ] as const) {
      if (value !== null && (!Number.isInteger(value) || value < 1 || value > 99)) {
        setError(`${label}은 1~99 사이의 정수로 입력해주세요.`);
        return;
      }
    }
    if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) {
      setError("최소 인원이 최대 인원보다 클 수 없습니다.");
      return;
    }
    if (weight !== null && (!Number.isFinite(weight) || weight < 1 || weight > 5)) {
      setError("웨이트는 1~5 사이로 입력해주세요. (비워두면 표시하지 않습니다)");
      return;
    }

    startTransition(async () => {
      const { error: err } = await createClient().from("games").insert({
        title,
        min_players: minPlayers,
        max_players: maxPlayers,
        geek_weight: weight === null ? null : Math.round(weight * 100) / 100,
      });

      if (err) {
        setError(
          err.code === "23505"
            ? "이미 등록된 게임입니다."
            : `게임 등록에 실패했습니다. (${err.message})`,
        );
        return;
      }

      formRef.current?.reset();
      setNotice(`'${title}' 게임을 등록했습니다.`);
      await loadGames();
    });
  };

  const fieldClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-900";
  const labelClass = "mb-1 block text-sm font-medium text-zinc-400";

  return (
    <div className="space-y-6">
      {/* 게임 등록 폼 */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-4 text-base font-semibold text-zinc-100">게임 등록</h2>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="game-title">
              게임 이름 <span className="text-red-400">*</span>
            </label>
            <input
              id="game-title"
              name="title"
              type="text"
              maxLength={50}
              required
              autoComplete="off"
              placeholder="예: 카탄"
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="game-min">
                최소 인원 (선택)
              </label>
              <input
                id="game-min"
                name="min_players"
                type="number"
                min={1}
                max={99}
                step={1}
                placeholder="예: 2"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="game-max">
                최대 인원 (선택)
              </label>
              <input
                id="game-max"
                name="max_players"
                type="number"
                min={1}
                max={99}
                step={1}
                placeholder="예: 4"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="game-weight">
              웨이트 (선택, 1~5)
            </label>
            <input
              id="game-weight"
              name="geek_weight"
              type="number"
              min={1}
              max={5}
              step={0.01}
              placeholder="비워두면 모임 카드에 표시하지 않습니다"
              className={fieldClass}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {isPending ? "등록 중…" : "게임 등록"}
          </button>
        </form>
      </section>

      {/* 등록된 게임 목록 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">
          등록된 게임 <span className="font-normal text-zinc-500">· {games.length}개</span>
        </h2>

        {loading ? (
          <p className="p-6 text-center text-sm text-zinc-500">불러오는 중…</p>
        ) : games.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-sm text-zinc-500">
            등록된 게임이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
            {games.map((game) => (
              <li key={game.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="mr-auto text-sm font-medium text-zinc-100">{game.title}</span>
                {(game.min_players != null || game.max_players != null) && (
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <Users className="h-3.5 w-3.5" />
                    {game.min_players ?? "?"}~{game.max_players ?? "?"}명
                  </span>
                )}
                {game.geek_weight != null && (
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <Scale className="h-3.5 w-3.5" />
                    {Number(game.geek_weight).toFixed(2)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
