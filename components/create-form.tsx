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
import { EVENT_CATEGORIES, isEventCategory } from "@/lib/categories";
import ParticipantPicker, {
  type PickerMember,
} from "@/components/participant-picker";
import type { Game } from "@/lib/types";

/** 룰마가 참석자를 직접 지정할 수 있는 카테고리 */
const ROSTER_CATEGORY = "캠페인";

type CreateFormProps = {
  defaultDate: string;
  today: string;
  games: Game[];
  /** 캠페인 참석자 후보 (승인된 유저) */
  members: PickerMember[];
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

function CreateFormInner({
  defaultDate,
  today,
  games,
  members,
}: CreateFormProps) {
  const router = useRouter();
  const { user, ready } = useUser();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // 카테고리/정원은 캠페인 참석자 지정 UI 의 노출과 인원 제한에 쓰여 상태로 관리한다.
  const [category, setCategory] = useState("");
  const [maxInput, setMaxInput] = useState("4");
  const [rosterIds, setRosterIds] = useState<string[]>([]);

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
  const isRosterCategory = category === ROSTER_CATEGORY;
  // 룰마(본인)는 자동으로 첫 참석자가 되므로 후보에서 빼고, 정원에서도 1자리를 뺀다.
  const rosterCandidates = members.filter((m) => m.id !== user.id);
  const rosterLimit = Math.max(0, (Number(maxInput) || 0) - 1);

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    // 캠페인이 아니면 지정 UI 가 사라지므로 선택도 비운다.
    if (next !== ROSTER_CATEGORY) setRosterIds([]);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const title = (fd.get("title") as string)?.trim();
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const maxParticipants = Number(fd.get("max_participants"));
    const category = fd.get("category");
    // 보드게임은 선택 항목: 선택하지 않으면 null
    const gameId = (fd.get("game_id") as string) || null;

    if (!title || !date || !time) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (!isEventCategory(category)) {
      setError("카테고리를 선택해주세요.");
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

    // 캠페인일 때만 지정한 참석자를 함께 등록한다.
    const roster = category === ROSTER_CATEGORY ? rosterIds : [];
    if (roster.length + 1 > maxParticipants) {
      setError(
        `지정한 참석자(${roster.length}명)와 룰마를 합치면 정원(${maxParticipants}명)을 넘습니다.`,
      );
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
          category,
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

      // 3. 캠페인: 룰마가 지정한 참석자 등록 (권한: 007 정책, 정원: 003 트리거)
      if (roster.length > 0) {
        const { error: rError } = await supabase
          .from("event_participants")
          .insert(roster.map((userId) => ({ event_id: event.id, user_id: userId })));

        if (rError) {
          // 일부만 등록된 모임이 남지 않도록 방금 만든 모임을 지운다. (참석 기록은 cascade 삭제)
          await supabase
            .from("events")
            .delete()
            .eq("id", event.id)
            .eq("creator_id", user.id);
          setError(
            rError.message.includes("EVENT_FULL")
              ? "지정한 참석자가 정원을 넘어 모임을 만들지 못했습니다."
              : `참석자 지정에 실패해 모임을 만들지 못했습니다. (${rError.message})`,
          );
          return;
        }
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

        {/* 카테고리 (필수) */}
        <div>
          <label className={labelClass} htmlFor="category">카테고리</label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="" disabled>카테고리 선택</option>
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
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
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        {/* 캠페인 참석자 지정 (캠페인일 때만 노출) */}
        {isRosterCategory && (
          <div>
            <p className={labelClass}>참석자 지정 (선택)</p>
            <p className="mb-2 text-xs text-zinc-500">
              룰마인 나는 자동으로 참석돼요. 함께할 멤버를 미리 지정할 수 있어요.
            </p>
            <ParticipantPicker
              members={rosterCandidates}
              selectedIds={rosterIds}
              onChange={setRosterIds}
              limit={rosterLimit}
              disabled={isPending}
            />
          </div>
        )}

        {/* 보드게임 선택 (선택 항목) */}
        <div>
          <label className={labelClass} htmlFor="game_id">보드게임 (선택)</label>
          {games.length === 0 ? (
            <p className="text-sm text-zinc-500">등록된 게임이 없습니다.</p>
          ) : (
            <select
              id="game_id"
              name="game_id"
              defaultValue=""
              className={fieldClass}
            >
              <option value="">선택 안 함</option>
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
