import { ok, run } from "@/lib/api";
import { getUserEnrollments } from "@/server/services/enrollment.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const ctx = await requireTenantContext();
    return ok({ enrollments: await getUserEnrollments(ctx) });
  });
}
