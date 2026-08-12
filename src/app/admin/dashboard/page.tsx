import { getDashboardStats } from "@/server/services/stats.service";
import { AdminDashboardClient } from "./admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return <AdminDashboardClient initialStats={stats} />;
}