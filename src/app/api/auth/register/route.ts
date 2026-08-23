import { NextRequest } from "next/server";
import { getIp, ok, parseBody, run } from "@/lib/api";
import { enforceRateLimit } from "@/lib/ratelimit";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await enforceRateLimit(`register:${getIp(req)}`);
    const body = await parseBody(req);
    const input = registerSchema.parse(body);
    const user = await registerUser(input);
    return ok({ user }, { status: 201 });
  });
}
