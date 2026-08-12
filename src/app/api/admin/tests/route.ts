import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createTestSchema } from "@/lib/validation/course";
import { createTest } from "@/server/services/admin.content.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const input = createTestSchema.parse(await parseBody(req));
    return ok(await createTest(input), { status: 201 });
  });
}
