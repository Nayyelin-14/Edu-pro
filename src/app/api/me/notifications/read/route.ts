import { ok, run } from "@/lib/api";
import { markAllNotificationsRead } from "@/server/services/notification.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST() {
  return run(async () => {
    const user = await requireUser();
    return ok(await markAllNotificationsRead(user.id));
  });
}