import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { initEnableTwoStepSchema } from "@/lib/validation/auth";
import { initEnableTwoStep } from "@/server/services/auth.twoStep.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const input = initEnableTwoStepSchema.parse(await parseBody(req));
    const result = await initEnableTwoStep(user, input.method);
    return ok(result);
  });
}
