"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import {
  getSelectableRange,
  isSelectableDate,
  TIME_OPTIONS,
  toSeoulIso,
} from "@/lib/dates";
import type { Game } from "@/lib/types";

type CreateFormProps = {
  defaultDate: string;
  today: string;
  games: Game[];
};

/**
 * Cache Components 는 이전 페이지를 숨겨서 보존(Activity)하기 때문에, 이전에 열었던
 * 생성 폼의 입력값(날짜 등)이 남아 있을 수 있다. 링크/push 로 새로 진입할 때마다
 * bfcacheId 가 바뀌므로 key 로 써서 폼을 초기화한다. (뒤로가기는 입력 상태 그대로 복원)
 */
export default function CreateForm(props: CreateFormProps) {
  const { bfcacheId } = useRouter();
  // 보존된(숨겨진) 폼이 서버에서 받은 이전 props 를 들고 있을 수 있으므로,
  // 날짜는 현재 주소(?date=)에서 직접 읽고, 날짜가 바뀌면 폼을 새로 만든다.
  const dateParam = useSearchParams().get("date");
  const defaultDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : props.defaultDate;

  return (
    <CreateFormInner
      key={`${bfcacheId}:${defaultDate}`}
      {...props}
      defaultDate={defaultDate}
    />
  );
}

function CreateFormInner({ defaultDate, today, games }: CreateFormProps) {
  const router = useRouter();
  const { user, ready } = useUser();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 유저 없으면 메인으로 리다이렉트
  useEffect(() => {
    if (ready && !user) router.push("/");
  }, [ready, user, router]);

  if (!ready) {
    return <div className="p-8 text-center text-sm text-zinc-400">로딩 중…</div>;
  }
  if (!user) {
    return (
      <div className="p-8 text-center text-sm text-zinc-400">
        닉네임을 먼저 설정해주세요. 메인 페이지로 이동합니다…
      </div>
    );
  }

  const range = getSelectableRange(today);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const title = (fd.get("title") as string)?.trim();
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const maxParticipants = Number(fd.get("max_participants"));
    const gameId = fd.get("game_id") as string;

    if (!title || !date || !time || !gameId) {
      setError("모든 필드를 입력해주세요.");
      return;
    }
    if (!isSelectableDate(date, range)) {
      setError(`날짜는 ${range.min} ~ ${range.max} 사이로만 선택할 수 있습니다.`);
      return;
    }
    if (!Number.isFinite(maxParticipants) || maxParticipants < 2) {
      setError("정원은 2명 이상이어야 합니다.");
      return;
    }

    // 날짜 + 시간 → 서울 시간대(+09:00) timestamptz
    const eventTime = toSeoulIso(date, time);

    setError(null);
    startTransition(async () => {
      const supabase = createClient();

      // 1. events insert
      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({
          title,
          event_time: eventTime,
          max_participants: maxParticipants,
          creator_id: user.id,
          game_id: gameId,
        })
        .select()
        .single();

      if (eventError || !event) {
        setError(`모임 생성에 실패했습니다. (${eventError?.message ?? "unknown"})`);
        return;
      }

      // 2. 룰마(생성자)를 첫 참석자로 등록
      const { error: pError } = await supabase
        .from("event_participants")
        .insert({ event_id: event.id, user_id: user.id });

      if (pError) {
        setError("참석자 등록에 실패했습니다.");
        return;
      }

      router.push(`/?date=${date}`);
    });
  };

  const fieldClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-900";
  const labelClass =
    "mb-1 block text-sm font-medium text-zinc-400";

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => router.push("/")}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">모임 만들기</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 날짜 */}
        <div>
          <label className={labelClass} htmlFor="date">날짜</label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={defaultDate}
            min={range.min}
            max={range.max}
            required
            className={fieldClass}
          />
        </div>

        {/* 시간 (30분 단위) */}
        <div>
          <label className={labelClass} htmlFor="time">시간</label>
          <select
            id="time"
            name="time"
            defaultValue="19:00"
            required
            className={fieldClass}
          >
            {TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 모임 제목 */}
        <div>
          <label className={labelClass} htmlFor="title">모임 제목</label>
          <input
            id="title"
            type="text"
            name="title"
            placeholder="예: 금요일 저녁 보드게임"
            maxLength={50}
            required
            className={fieldClass}
          />
        </div>

        {/* 최대 정원 */}
        <div>
          <label className={labelClass} htmlFor="max_participants">최대 정원</label>
          <input
            id="max_participants"
            type="number"
            name="max_participants"
            min={2}
            max={20}
            defaultValue={4}
            required
            className={fieldClass}
          />
        </div>

        {/* 보드게임 선택 */}
        <div>
          <label className={labelClass} htmlFor="game_id">보드게임</label>
          {games.length === 0 ? (
            <p className="text-sm text-zinc-500">등록된 게임이 없습니다.</p>
          ) : (
            <select
              id="game_id"
              name="game_id"
              defaultValue=""
              required
              className={fieldClass}
            >
              <option value="" disabled>게임 선택</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                  {game.geek_weight != null
                    ? ` (웨이트 ${game.geek_weight.toFixed(2)})`
                    : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {isPending ? "생성 중…" : "모임 만들기"}
          </button>
        </div>
      </form>
    </div>
  );
}
