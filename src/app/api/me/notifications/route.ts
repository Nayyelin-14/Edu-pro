import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listNotifications } from "@/server/services/notification.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 50);
    return ok(await listNotifications(user.id, limit));
  });
}