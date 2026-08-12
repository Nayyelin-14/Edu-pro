import { ok, run } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok({ user: publicUser(user) });
  });
}
