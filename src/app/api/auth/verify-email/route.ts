import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { verifyEmail } from "@/server/services/auth.verification.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const input = verifyEmailSchema.parse(await parseBody(req));
    const updated = await verifyEmail(user.id, input.code);
    return ok({ user: updated });
  });
}
