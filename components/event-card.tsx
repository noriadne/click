"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Clock,
  Crown,
  Dice5,
  Pencil,
  Scale,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import type { EventWithDetails } from "@/lib/types";
import { formatSeoulTime, splitSeoulDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** 접힌 상태에서 기본으로 보여줄 참석자 수 */
const VISIBLE_PARTICIPANTS = 4;

export default function EventCard({
  event,
  today,
}: {
  event: EventWithDetails;
  today: string;
}) {
  const { user } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 룰마 우선, 이후 참석 순서대로 정렬
  const participants = [...event.event_participants].sort((a, b) => {
    if (a.user_id === event.creator_id) return -1;
    if (b.user_id === event.creator_id) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
  const visibleParticipants = expanded
    ? participants
    : participants.slice(0, VISIBLE_PARTICIPANTS);
  const hiddenCount = participants.length - VISIBLE_PARTICIPANTS;

  const participantCount = event.event_participants.length;
  const isJoined = user
    ? event.event_participants.some((p) => p.user_id === user.id)
    : false;
  const isFull = participantCount >= event.max_participants;
  const isCreator = !!user && user.id === event.creator_id;
  // 모임 날짜가 오늘보다 과거면 종료된 모임 (같은 날의 지난 시간은 허용)
  const isPastDate = splitSeoulDateTime(event.event_time).date < today;

  // 룰마가 참석을 취소하면 가장 먼저 참석한 다른 사람에게 룰마가 넘어간다. (DB 트리거)
  const nextHost = participants.find((p) => p.user_id !== event.creator_id);
  const isSoleHost = isCreator && isJoined && participantCount === 1;

  const handleToggle = () => {
    if (!user || isPastDate) return;
    if (isSoleHost) return;
    if (isCreator && isJoined && nextHost) {
      const name = nextHost.users?.nickname ?? "다음 참석자";
      if (!window.confirm(`참석을 취소하면 룰마가 ${name}님에게 넘어갑니다. 계속할까요?`)) {
        return;
      }
    }
    setError(null);

    startTransition(async () => {
      const supabase = createClient();

      if (isJoined) {
        // 화면 데이터는 오래됐을 수 있으므로, 룰마라면 삭제 직전에 실제 참석자 수를 다시 확인한다.
        // (그 사이 다른 참석자가 모두 취소해 혼자 남았다면 취소를 막는다.)
        if (isCreator) {
          const { count, error: countErr } = await supabase
            .from("event_participants")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id);

          if (countErr) { setError("참석자 정보를 확인하지 못했습니다."); return; }
          if ((count ?? 0) <= 1) {
            setError(
              "마지막 참석자인 룰마는 참석을 취소할 수 없습니다. 모임을 취소하려면 삭제해 주세요.",
            );
            router.refresh();
            return;
          }
        }

        const { error: err } = await supabase
          .from("event_participants")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", user.id);

        if (err) { setError("참석 취소에 실패했습니다."); return; }
      } else {
        if (isFull) {
          setError("정원이 가득 찼습니다.");
          router.refresh();
          return;
        }

        const { data: existing } = await supabase
          .from("event_participants")
          .select("id")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) { router.refresh(); return; }

        const { error: err } = await supabase
          .from("event_participants")
          .insert({ event_id: event.id, user_id: user.id });

        if (err) {
          // DB(003_integrity.sql)가 돌려주는 오류를 사용자 메시지로 변환
          if (err.message.includes("EVENT_FULL")) {
            setError("정원이 가득 찼습니다.");
          } else if (err.code === "23505") {
            setError("이미 참석한 모임입니다.");
          } else if (err.code === "23503") {
            setError("삭제되었거나 존재하지 않는 모임입니다.");
          } else {
            setError("참석에 실패했습니다.");
          }
          router.refresh(); // 오래된 화면을 최신 상태로 맞춘다
          return;
        }
      }

      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!user || !isCreator || isPastDate) return;
    if (!window.confirm("이 모임을 삭제할까요? 참석자 정보도 함께 삭제됩니다.")) {
      return;
    }
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id)
        .eq("creator_id", user.id)
        .select("id");

      if (err) {
        setError(`삭제에 실패했습니다. (${err.message})`);
        return;
      }
      if (!data || data.length === 0) {
        setError("삭제할 수 없습니다. 권한을 확인해주세요.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-zinc-100">
            {event.title}
          </h3>
          {isCreator && (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-400">
              <Crown className="h-3 w-3" />내가 룰마
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          <Users className="h-3 w-3" />
          {participantCount}/{event.max_participants}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-zinc-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatSeoulTime(event.event_time)}
        </span>
        {event.games && (
          <>
            <span className="flex items-center gap-1">
              <Dice5 className="h-3.5 w-3.5" />
              {event.games.title}
            </span>
            {event.games.geek_weight != null && (
              <span className="flex items-center gap-1">
                <Scale className="h-3.5 w-3.5" />
                웨이트 {Number(event.games.geek_weight).toFixed(2)}
              </span>
            )}
          </>
        )}
      </div>

      {/* 참석자 목록 */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {visibleParticipants.map((p) => {
          const isHost = p.user_id === event.creator_id;
          const isMe = !!user && p.user_id === user.id;
          return (
            <span
              key={p.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                isMe
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-zinc-800 text-zinc-300",
              )}
            >
              {isHost && <Crown className="h-3 w-3 text-amber-400" />}
              {p.users?.nickname ?? "알 수 없음"}
            </span>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800"
          >
            {expanded ? "접기" : `외 ${hiddenCount}명`}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {isSoleHost && !isPastDate && (
        <p className="mb-2 text-xs text-zinc-500">
          마지막 참석자인 룰마는 참석을 취소할 수 없습니다. 모임을 취소하려면
          삭제해 주세요.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          disabled={
            isPending || isPastDate || !user || isSoleHost || (!isJoined && isFull)
          }
          className={cn(
            "flex-1 rounded-xl py-2 text-sm font-medium transition",
            isJoined
              ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              : "bg-indigo-500 text-white hover:bg-indigo-600",
            (isPending ||
              isPastDate ||
              !user ||
              isSoleHost ||
              (!isJoined && isFull)) &&
              "cursor-not-allowed opacity-50",
          )}
        >
          {isPending
            ? "처리 중…"
            : isPastDate
              ? "종료된 모임"
              : !user
                ? "닉네임을 먼저 설정하세요"
                : isJoined
                  ? "참석 취소"
                  : isFull
                    ? "정원 가득"
                    : "참석하기"}
        </button>

        {isCreator && !isPastDate && (
          <>
            <Link
              href={`/edit/${event.id}`}
              aria-label="모임 수정"
              className="flex items-center justify-center rounded-xl border border-zinc-700 px-3 text-zinc-400 transition hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              onClick={handleDelete}
              disabled={isPending}
              aria-label="모임 삭제"
              className="flex items-center justify-center rounded-xl border border-red-900 px-3 text-red-400 transition hover:bg-red-950 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
