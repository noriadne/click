"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import {
  getSelectableRange,
  isSelectableDate,
  splitSeoulDateTime,
  TIME_OPTIONS,
  toSeoulIso,
} from "@/lib/dates";
import { CAMPAIGN_CATEGORY, categoryLabel } from "@/lib/categories";
import ParticipantPicker, {
  type PickerMember,
} from "@/components/participant-picker";
import type { EventWithDetails, Game } from "@/lib/types";

type EditFormProps = {
  event: EventWithDetails;
  games: Game[];
  /** 캠페인 참석자 지정 후보 (승인된 유저) */
  members: PickerMember[];
  today: string;
};

/** 생성 폼과 같은 이유로, 진입할 때마다 폼 상태를 초기화한다. (create-form.tsx 참고) */
export default function EditForm(props: EditFormProps) {
  const { bfcacheId } = useRouter();
  return <EditFormInner key={bfcacheId} {...props} />;
}

function EditFormInner({ event, games, members, today }: EditFormProps) {
  const router = useRouter();
  const { user, ready } = useUser();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCreator = !!user && user.id === event.creator_id;
  const isCampaign = event.category === CAMPAIGN_CATEGORY;

  // 캠페인 참석자 지정: 룰마 본인을 제외한 현재 참석자로 초기화
  const initialRosterIds = event.event_participants
    .map((p) => p.user_id)
    .filter((id) => id !== event.creator_id);
  const [rosterIds, setRosterIds] = useState<string[]>(initialRosterIds);
  const [maxInput, setMaxInput] = useState(String(event.max_participants));

  // 로그인 안 했거나 룰마가 아니면 메인으로
  useEffect(() => {
    if (ready && !isCreator) router.replace("/");
  }, [ready, isCreator, router]);

  if (!ready) {
    return <div className="p-8 text-center text-sm text-zinc-400">로딩 중…</div>;
  }
  if (!isCreator) {
    return (
      <div className="p-8 text-center text-sm text-zinc-400">
        룰마만 수정할 수 있습니다. 메인 페이지로 이동합니다…
      </div>
    );
  }

  const { date: currentDate, time: currentTime } = splitSeoulDateTime(
    event.event_time,
  );
  const participantCount = event.event_participants.length;

  // 오늘 ~ 다음 주 일요일까지만 변경 가능
  const range = getSelectableRange(today);
  // 지정 후보에서 룰마 본인은 제외 (항상 포함되며 제외 대상이 아니다)
  const rosterCandidates = members.filter((m) => m.id !== event.creator_id);
  const rosterLimit = Math.max(0, (Number(maxInput) || 0) - 1);

  // 과거 날짜 모임은 수정 불가 (URL 직접 접근 방어)
  if (currentDate < today) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="text-sm text-zinc-400">
          이미 지난 날짜의 모임은 수정할 수 없습니다.
        </p>
        <button
          onClick={() => router.replace("/")}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
        >
          메인으로
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const maxParticipants = Number(fd.get("max_participants"));
    // 보드게임은 선택 항목: 선택하지 않으면 null
    const gameId = (fd.get("game_id") as string) || null;

    if (!date || !time) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (!isSelectableDate(date, range)) {
      setError(`날짜는 ${range.min} ~ ${range.max} 사이로만 변경할 수 있습니다.`);
      return;
    }
    if (!Number.isFinite(maxParticipants) || maxParticipants < 2) {
      setError("정원은 2명 이상이어야 합니다.");
      return;
    }
    if (maxParticipants < participantCount) {
      setError(`현재 참석자(${participantCount}명)보다 적게 설정할 수 없습니다.`);
      return;
    }
    // 캠페인: 지정한 참석자(+룰마)가 바꾸려는 정원을 넘지 않는지 미리 확인
    if (isCampaign && rosterIds.length + 1 > maxParticipants) {
      setError(
        `지정한 참석자(${rosterIds.length}명)와 룰마를 합치면 정원(${maxParticipants}명)을 넘습니다.`,
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("events")
        .update({
          event_time: toSeoulIso(date, time),
          max_participants: maxParticipants,
          game_id: gameId,
        })
        .eq("id", event.id)
        .eq("creator_id", user.id)
        .select("id");

      if (err) {
        setError(
          err.message.includes("MAX_BELOW_COUNT")
            ? "현재 참석자 수보다 정원을 줄일 수 없습니다. 화면을 새로고침해 확인해 주세요."
            : `수정에 실패했습니다. (${err.message})`,
        );
        return;
      }
      if (!data || data.length === 0) {
        setError("수정할 수 없습니다. 권한을 확인해주세요.");
        return;
      }

      // 캠페인: 참석자 지정 변경분(추가/제외)을 반영한다. (권한: 007 정책)
      if (isCampaign) {
        const toAdd = rosterIds.filter((id) => !initialRosterIds.includes(id));
        const toRemove = initialRosterIds.filter(
          (id) => !rosterIds.includes(id),
        );

        if (toRemove.length > 0) {
          const { error: removeErr } = await supabase
            .from("event_participants")
            .delete()
            .eq("event_id", event.id)
            .in("user_id", toRemove);
          if (removeErr) {
            setError(`참석자 제외에 실패했습니다. (${removeErr.message})`);
            return;
          }
        }
        if (toAdd.length > 0) {
          const { error: addErr } = await supabase
            .from("event_participants")
            .insert(toAdd.map((userId) => ({ event_id: event.id, user_id: userId })));
          if (addErr) {
            setError(
              addErr.message.includes("EVENT_FULL")
                ? "정원이 가득 차 참석자를 추가하지 못했습니다."
                : `참석자 추가에 실패했습니다. (${addErr.message})`,
            );
            return;
          }
        }
      }

      router.push(`/?date=${date}`);
      router.refresh();
    });
  };

  const fieldClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-900";
  const labelClass = "mb-1 block text-sm font-medium text-zinc-400";

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => router.push(`/?date=${currentDate}`)}
          aria-label="뒤로가기"
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">모임 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 제목 (수정 불가) */}
        <div>
          <label className={labelClass} htmlFor="title">
            모임 제목 (수정 불가)
          </label>
          <input
            id="title"
            type="text"
            value={event.title}
            readOnly
            disabled
            className={`${fieldClass} cursor-not-allowed opacity-60`}
          />
        </div>

        {/* 날짜 */}
        <div>
          <label className={labelClass} htmlFor="date">날짜</label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={currentDate}
            min={range.min}
            max={range.max}
            required
            className={fieldClass}
          />
        </div>

        {/* 시간 */}
        <div>
          <label className={labelClass} htmlFor="time">시간</label>
          <select
            id="time"
            name="time"
            defaultValue={currentTime}
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

        {/* 카테고리 (수정 불가: 캠페인 권한 등이 카테고리에 연결되어 있다) */}
        <div>
          <label className={labelClass} htmlFor="category">
            카테고리 (수정 불가)
          </label>
          <input
            id="category"
            type="text"
            value={categoryLabel(event.category)}
            readOnly
            disabled
            className={`${fieldClass} cursor-not-allowed opacity-60`}
          />
        </div>

        {/* 최대 정원 */}
        <div>
          <label className={labelClass} htmlFor="max_participants">
            최대 정원 (현재 참석 {participantCount}명)
          </label>
          <input
            id="max_participants"
            type="number"
            name="max_participants"
            min={Math.max(2, participantCount)}
            max={20}
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        {/* 캠페인 참석자 지정 (캠페인 모임만 노출) */}
        {isCampaign && (
          <div>
            <p className={labelClass}>참석자 지정</p>
            <p className="mb-2 text-xs text-zinc-500">
              룰마인 나는 항상 참석돼요. 함께할 멤버를 추가하거나 제외할 수 있어요.
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

        {/* 보드게임 (선택 항목) */}
        <div>
          <label className={labelClass} htmlFor="game_id">보드게임 (선택)</label>
          <select
            id="game_id"
            name="game_id"
            defaultValue={event.game_id ?? ""}
            className={fieldClass}
          >
            <option value="">선택 안 함</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
                {game.geek_weight != null
                  ? ` (웨이트 ${Number(game.geek_weight).toFixed(2)})`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => router.push(`/?date=${currentDate}`)}
            className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
