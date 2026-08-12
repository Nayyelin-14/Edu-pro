import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { disableTwoStepSchema } from "@/lib/validation/auth";
import { disableTwoStep } from "@/server/services/auth.twoStep.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const input = disableTwoStepSchema.parse(await parseBody(req));
    const result = await disableTwoStep(user, input.password);
    return ok(result);
  });
}
