import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Header from "@/components/header";
import EditForm from "@/components/edit-form";
import { createClient } from "@/lib/supabase/server";
import { todayInSeoul } from "@/lib/dates";
import type { EventWithDetails, Game } from "@/lib/types";

export default function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
          <EditContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const today = todayInSeoul();

  const supabase = await createClient();
  const [{ data: event }, { data: games }] = await Promise.all([
    supabase
      .from("events")
      .select("*, games(*), event_participants(*, users(nickname))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("games").select("*").order("title", { ascending: true }),
  ]);

  if (!event) notFound();

  return (
    <EditForm
      event={event as EventWithDetails}
      games={(games ?? []) as Game[]}
      today={today}
    />
  );
}
