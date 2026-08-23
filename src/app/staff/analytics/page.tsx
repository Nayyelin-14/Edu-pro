import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminAnalytics } from "@/components/admin/admin-analytics";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "SUPERADMIN")) {
    redirect("/staff/courses");
  }

  return <AdminAnalytics />;
}