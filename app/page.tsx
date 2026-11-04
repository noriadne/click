import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import Header from "@/components/header";
import Calendar from "@/components/calendar";
import EventList from "@/components/event-list";
import { todayInSeoul } from "@/lib/dates";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
        <Suspense fallback={<MainSkeleton />}>
          <MainContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function MainContent({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  await connection();
  const today = todayInSeoul();
  const selectedDate = typeof date === "string" ? date : today;

  return (
    <>
      <Calendar selectedDate={selectedDate} today={today} />

      <Link
        href={`/create?date=${selectedDate}`}
        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-medium text-white transition hover:bg-indigo-600"
      >
        <Plus className="h-4 w-4" />
        모임 만들기
      </Link>

      <Suspense fallback={<EventListSkeleton />}>
        <EventList selectedDate={selectedDate} />
      </Suspense>
    </>
  );
}

function MainSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-20 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-12 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-32 animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800" />
      </div>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800" />
    </div>
  );
}
