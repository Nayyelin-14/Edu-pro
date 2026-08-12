import { ok, run } from "@/lib/api";
import { getUserEnrollments } from "@/server/services/enrollment.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok({ enrollments: await getUserEnrollments(user.id) });
  });
}
