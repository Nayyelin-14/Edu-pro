import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createModuleSchema } from "@/lib/validation/course";
import { createModule } from "@/server/services/admin.course.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const input = createModuleSchema.parse(await parseBody(req));
    return ok(await createModule(input), { status: 201 });
  });
}
