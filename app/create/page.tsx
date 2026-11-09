import { Suspense } from "react";
import { connection } from "next/server";
import Header from "@/components/header";
import CreateForm from "@/components/create-form";
import { createClient } from "@/lib/supabase/server";
import { todayInSeoul } from "@/lib/dates";
import type { PickerMember } from "@/components/participant-picker";
import type { Game } from "@/lib/types";

export default function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="p-8 text-center text-sm text-zinc-400">로딩 중…</div>
          }
        >
          <CreateContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function CreateContent({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  await connection();
  const today = todayInSeoul();
  const defaultDate = typeof date === "string" ? date : today;

  // games 목록, 캠페인 참석자 후보(승인된 유저) 목록을 서버에서 조회
  const supabase = await createClient();
  const [{ data: gameRows }, { data: memberRows }] = await Promise.all([
    supabase.from("games").select("*").order("title", { ascending: true }),
    supabase
      .from("users")
      .select("id, nickname")
      .eq("status", "approved")
      .order("nickname", { ascending: true }),
  ]);
  const games = (gameRows ?? []) as Game[];
  const members = (memberRows ?? []) as PickerMember[];

  return (
    <CreateForm
      defaultDate={defaultDate}
      today={today}
      games={games}
      members={members}
    />
  );
}
