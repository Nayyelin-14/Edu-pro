import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { setUserBanned } from "@/server/services/admin.user.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    const { id } = await params;
    return ok(await setUserBanned(id, true));
  });
}
