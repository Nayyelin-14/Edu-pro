import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validation/auth";
import { updateProfile } from "@/server/services/user.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok({ user: publicUser(user) });
  });
}

export async function PATCH(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const body = await parseBody<{ username?: string; avatar?: string | null }>(req);
    const input = profileUpdateSchema.parse(body);
    const updated = await updateProfile(user.id, input);
    return ok({ user: publicUser(updated) });
  });
}
