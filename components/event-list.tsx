import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/event-card";
import type { EventWithDetails } from "@/lib/types";
import { formatKoreanDate } from "@/lib/dates";

export default async function EventList({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const supabase = await createClient();

  // event_time이 timestamp이므로 날짜 범위로 조회
  const dateStart = `${selectedDate}T00:00:00`;
  const dateEnd = `${selectedDate}T23:59:59`;

  const { data } = await supabase
    .from("events")
    .select("*, games(*), event_participants(*)")
    .gte("event_time", dateStart)
    .lte("event_time", dateEnd)
    .order("event_time", { ascending: true });

  const events = (data ?? []) as EventWithDetails[];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-500">
        {formatKoreanDate(selectedDate)} · {events.length}개 모임
      </h2>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-400">이 날짜에 등록된 모임이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
