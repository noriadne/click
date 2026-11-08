import { Suspense } from "react";
import { connection } from "next/server";
import Header from "@/components/header";
import AdminNav from "@/components/admin-nav";
import AdminShare from "@/components/admin-share";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  getSelectableRange,
  splitSeoulDateTime,
  toSeoulIso,
  todayInSeoul,
} from "@/lib/dates";
import type { EventWithDetails } from "@/lib/types";

export default function AdminSharePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <AdminNav />
        <Suspense
          fallback={
            <div className="p-8 text-center text-sm text-zinc-500">
              불러오는 중…
            </div>
          }
        >
          <ShareContent />
        </Suspense>
      </main>
    </div>
  );
}

/** 관리자가 들어오는 시점 기준으로 실시간 조회 (캐싱 없음) */
async function ShareContent() {
  await connection();
  const today = todayInSeoul();
  const range = getSelectableRange(today);

  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*, games(*), event_participants(*)")
    .gte("event_time", toSeoulIso(range.min, "00:00"))
    .lt("event_time", toSeoulIso(addDays(range.max, 1), "00:00"))
    .order("event_time", { ascending: true });

  const events = (data ?? []) as EventWithDetails[];

  const byDate = new Map<string, EventWithDetails[]>();
  for (const event of events) {
    const { date } = splitSeoulDateTime(event.event_time);
    byDate.set(date, [...(byDate.get(date) ?? []), event]);
  }

  return <AdminShare today={today} range={range} byDate={byDate} />;
}
