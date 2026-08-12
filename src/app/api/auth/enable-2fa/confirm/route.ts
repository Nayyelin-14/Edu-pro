import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { confirmEnableTwoStepSchema } from "@/lib/validation/auth";
import { confirmEnableTwoStep } from "@/server/services/auth.twoStep.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const input = confirmEnableTwoStepSchema.parse(await parseBody(req));
    const result = await confirmEnableTwoStep(user, input);
    return ok(result);
  });
}
