import Header from "@/components/header";
import AdminNav from "@/components/admin-nav";
import AdminUsers from "@/components/admin-users";

export default function AdminPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <AdminNav />
        <AdminUsers />
      </main>
    </div>
  );
}
