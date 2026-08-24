import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseBody, run } from "@/lib/api";
import {
  deleteNotification,
  getNotification,
  markNotificationRead,
} from "@/server/services/notification.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

const schema = z.object({ read: z.boolean() });

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    // Ownership is enforced in the service — a user can never read another
    // user's notification.
    return ok(await getNotification(user.id, id));
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
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

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await deleteNotification(user.id, id));
  });
}
