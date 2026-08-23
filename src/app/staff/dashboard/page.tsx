import { redirect } from "next/navigation";
import { getDashboardStats } from "@/server/services/stats.service";
import { getSessionUser } from "@/lib/auth";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminDashboardClient } from "./admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/staff/dashboard");
  // PLATFORM MODE: platform-wide statistics are a SUPERADMIN-only surface.
  // Everyone else (including tenant admins) gets the tenant-scoped analytics.
  if (user.role !== "SUPERADMIN") return <AdminAnalytics />;

  const stats = await getDashboardStats();

  return <AdminDashboardClient initialStats={stats} />;
}