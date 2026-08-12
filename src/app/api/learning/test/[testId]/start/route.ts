import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { startTest } from "@/server/services/test.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { testId } = await params;
    return ok(await startTest(user.id, testId));
  });
}
