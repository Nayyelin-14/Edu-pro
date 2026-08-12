import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await parseBody(req);
    const input = registerSchema.parse(body);
    const user = await registerUser(input);
    return ok({ user }, { status: 201 });
  });
}
