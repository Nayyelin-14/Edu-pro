import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-topbar";
import { requireStaff, requireUser } from "@/server/guards";

export const metadata = {
  title: "Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?next=/admin/dashboard");
  const staff = await requireStaff(user).catch(() => null);
  if (!staff) redirect("/");

  return (
    <div className="bg-background min-h-screen flex">
      <AdminSidebar user={staff} />
      <main className="flex-1 flex flex-col md:ml-[280px] min-w-0">
        <AdminTopBar user={staff} />
        <div className="flex-1 mt-[72px] p-6 md:p-8 max-w-[1280px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}