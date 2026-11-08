"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { useUser } from "@/components/user-provider";
import { formatKoreanDate, formatSeoulTime, listDates } from "@/lib/dates";
import type { EventWithDetails } from "@/lib/types";

/** 날짜, 제목, 시간, 게임명, 참석 인원으로 공유용 텍스트를 만든다. */
function buildShareText(
  today: string,
  range: { min: string; max: string },
  byDate: Map<string, EventWithDetails[]>,
): string {
  const lines: string[] = [`📅 ${formatKoreanDate(today)} ~ ${formatKoreanDate(range.max)} 모임 안내`, ""];

  for (const date of listDates(range.min, range.max)) {
    const events = byDate.get(date) ?? [];
    lines.push(`▶ ${formatKoreanDate(date)}${date === today ? " (오늘)" : ""}`);

    if (events.length === 0) {
      lines.push("모임 없음");
    } else {
      for (const event of events) {
        const time = formatSeoulTime(event.event_time);
        const game = event.games?.title ?? "게임 미정";
        const count = event.event_participants.length;
        lines.push(`🎲 ${event.title}`);
        lines.push(`${time} · ${game} · ${count}/${event.max_participants}명`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export default function AdminShare({
  today,
  range,
  byDate,
}: {
  today: string;
  range: { min: string; max: string };
  byDate: Map<string, EventWithDetails[]>;
}) {
  const router = useRouter();
  const { isAdmin, ready } = useUser();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/");
  }, [ready, isAdmin, router]);

  const text = useMemo(
    () => buildShareText(today, range, byDate),
    [today, range, byDate],
  );

  if (!ready || !isAdmin) {
    return <div className="p-8 text-center text-sm text-zinc-500">확인 중…</div>;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">공유용 일정 안내</h1>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              복사됨
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              복사하기
            </>
          )}
        </button>
      </div>

      <p className="mb-3 text-xs text-zinc-500">
        지금 시점 기준으로 생성된 미리보기입니다. 오픈톡방에 복사해서
        붙여넣으세요.
      </p>

      <pre className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-200">
        {text}
      </pre>
    </div>
  );
}
