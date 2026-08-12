import { ok, run } from "@/lib/api";
import { getUserScores } from "@/server/services/user.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok(await getUserScores(user.id));
  });
}
