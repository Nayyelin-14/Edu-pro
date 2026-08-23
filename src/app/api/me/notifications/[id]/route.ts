import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseBody, run } from "@/lib/api";
import { markNotificationRead } from "@/server/services/notification.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

const schema = z.object({ read: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { read } = schema.parse(await parseBody(req));
    // markNotificationRead only updates rows whose recipient is `user.id`,
    // so a user can never touch another user's notification.
    return ok(await markNotificationRead(user.id, id, read));
  });
}