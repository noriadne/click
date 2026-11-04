"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Dice5, Scale, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import type { EventWithDetails } from "@/lib/types";
import { cn } from "@/lib/utils";

/** ISO timestamp → "오전/오후 HH:MM" */
function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${displayHour}:${minutes}`;
}

export default function EventCard({ event }: { event: EventWithDetails }) {
  const { user } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const participantCount = event.event_participants.length;
  const isJoined = user
    ? event.event_participants.some((p) => p.user_id === user.id)
    : false;
  const isFull = participantCount >= event.max_participants;

  const handleToggle = () => {
    if (!user) return;
    setError(null);

    startTransition(async () => {
      const supabase = createClient();

      if (isJoined) {
        const { error: err } = await supabase
          .from("event_participants")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", user.id);

        if (err) { setError("참석 취소에 실패했습니다."); return; }
      } else {
        if (isFull) { setError("정원이 가득 찼습니다."); return; }

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

        if (err) { setError("참석에 실패했습니다."); return; }
      }

      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug text-zinc-100">
          {event.title}
        </h3>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          <Users className="h-3 w-3" />
          {participantCount}/{event.max_participants}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-zinc-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatTime(event.event_time)}
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
                웨이트 {event.games.geek_weight.toFixed(2)}
              </span>
            )}
          </>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <button
        onClick={handleToggle}
        disabled={isPending || !user || (!isJoined && isFull)}
        className={cn(
          "w-full rounded-xl py-2 text-sm font-medium transition",
          isJoined
            ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            : "bg-indigo-500 text-white hover:bg-indigo-600",
          (isPending || !user || (!isJoined && isFull)) &&
            "cursor-not-allowed opacity-50",
        )}
      >
        {isPending
          ? "처리 중…"
          : !user
            ? "닉네임을 먼저 설정하세요"
            : isJoined
              ? "참석 취소"
              : isFull
                ? "정원 가득"
                : "참석하기"}
      </button>
    </div>
  );
}
