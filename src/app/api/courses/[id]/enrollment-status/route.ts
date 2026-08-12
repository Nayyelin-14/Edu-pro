import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { getEnrollmentStatus } from "@/server/services/enrollment.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await getEnrollmentStatus(user.id, id));
  });
}
