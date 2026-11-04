import Header from "@/components/header";
import AdminNav from "@/components/admin-nav";
import AdminGames from "@/components/admin-games";

export default function AdminGamesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <AdminNav />
        <AdminGames />
      </main>
    </div>
  );
}
