import { Suspense } from "react";
import { connection } from "next/server";
import Header from "@/components/header";
import ScheduleView from "@/components/schedule-view";
import EventList from "@/components/event-list";
import { todayInSeoul } from "@/lib/dates";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
        <Suspense fallback={<MainSkeleton />}>
          <MainContent />
        </Suspense>
      </main>
    </div>
  );
}

async function MainContent() {
  await connection();
  const today = todayInSeoul();

  return (
    <ScheduleView today={today}>
      <Suspense fallback={<EventListSkeleton />}>
        <EventList today={today} />
      </Suspense>
    </ScheduleView>
  );
}

function MainSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-48 animate-pulse rounded-2xl bg-zinc-800" />
      <div className="h-12 animate-pulse rounded-xl bg-zinc-800" />
      <EventListSkeleton />
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-2xl border border-zinc-800" />
    </div>
  );
}
