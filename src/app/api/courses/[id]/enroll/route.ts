import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { enroll } from "@/server/services/enrollment.service";
import { requireUser, requireVerified } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireVerified(await requireUser());
    const { id } = await params;
    return ok(await enroll(user.id, id));
  });
}
