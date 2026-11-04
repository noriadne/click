import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/event-card";
import type { EventWithDetails } from "@/lib/types";
import {
  addDays,
  formatKoreanDate,
  getSelectableRange,
  listDates,
  splitSeoulDateTime,
  toSeoulIso,
} from "@/lib/dates";

/** 오늘 ~ 다음 주 일요일까지의 모임을 날짜별 섹션으로 나열한다. */
export default async function EventList({ today }: { today: string }) {
  const supabase = await createClient();
  const range = getSelectableRange(today);

  // event_time 은 timestamptz → 서울 기준 범위로 한 번에 조회
  const { data } = await supabase
    .from("events")
    .select("*, games(*), event_participants(*, users(nickname))")
    .gte("event_time", toSeoulIso(range.min, "00:00"))
    .lt("event_time", toSeoulIso(addDays(range.max, 1), "00:00"))
    .order("event_time", { ascending: true });

  const events = (data ?? []) as EventWithDetails[];

  // 날짜별로 묶기
  const byDate = new Map<string, EventWithDetails[]>();
  for (const event of events) {
    const { date } = splitSeoulDateTime(event.event_time);
    byDate.set(date, [...(byDate.get(date) ?? []), event]);
  }

  return (
    <div>
      {listDates(range.min, range.max).map((date) => {
        const dayEvents = byDate.get(date) ?? [];
        return (
          // id / data-day 는 달력의 스크롤 이동과 스크롤 연동에서 사용한다.
          <section key={date} id={`day-${date}`} data-day={date} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                {formatKoreanDate(date)}
                {date === today && (
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                    오늘
                  </span>
                )}
                {dayEvents.length > 0 && (
                  <span className="font-normal text-zinc-500">
                    · {dayEvents.length}개 모임
                  </span>
                )}
              </h2>
              {/*
                이 날짜로 바로 모임 만들기.
                next/link 대신 일반 <a> 를 쓴다: 클라이언트 라우터가 이전에 그린
                /create 화면(다른 날짜)을 재사용해 날짜가 고정되는 문제가 있어,
                매번 서버가 새로 그린 페이지를 받도록 전체 페이지 이동을 한다.
              */}
              <a
                href={`/create?date=${date}`}
                aria-label={`${formatKoreanDate(date)} 모임 만들기`}
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-300 transition hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                모임 만들기
              </a>
            </div>

            {dayEvents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-sm text-zinc-500">
                모임 없음
              </p>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((event) => (
                  <EventCard key={event.id} event={event} today={today} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* 마지막 날짜 섹션도 화면 상단까지 스크롤될 수 있도록 하는 여백 */}
      <div aria-hidden className="h-[40vh]" />
    </div>
  );
}
