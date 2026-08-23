import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-topbar";
import { SessionRefresh } from "@/components/auth/session-refresh";
import { SidebarProvider } from "@/components/sidebar-context";
import { SidebarShell } from "@/components/sidebar-shell";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/server/guards";

export const metadata = {
  title: "Staff",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    // The access JWT is short-lived and the refresh cookie never reaches page
    // renders (it's scoped to /api/auth), so an expired-but-refreshable session
    // reads as "null" here. Don't bounce to /login — that loops forever with the
    // login page's auto-redirect. Recover the session client-side instead.
    // Fully signed-out visitors never reach this branch (the proxy sends them
    // to /login first).
    return <SessionRefresh />;
  }
  if (!isStaff(user)) redirect("/");

  return (
    <div className="bg-background min-h-screen flex">
      <SidebarProvider>
        <AdminSidebar user={user} />
        <SidebarShell className="flex-1 min-w-0">
          <AdminTopBar user={user} />
          <div className="flex-1 mt-14 p-6 md:p-8 max-w-[1280px] mx-auto w-full">
            {children}
          </div>
        </SidebarShell>
      </SidebarProvider>
    </div>
  );
}