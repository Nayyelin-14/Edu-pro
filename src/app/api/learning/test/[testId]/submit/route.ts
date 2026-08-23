import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { submitTestSchema } from "@/lib/validation/learning";
import { submitTest } from "@/server/services/test.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { testId } = await params;
    const input = submitTestSchema.parse(await parseBody(req));
    return ok(await submitTest(ctx, testId, input.answers, input.startedAt));
  });
}
