import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listUsers } from "@/server/services/admin.user.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";
import { usersQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    const query = usersQuerySchema.parse({
      search: req.nextUrl.searchParams.get("search") || undefined,
      role: req.nextUrl.searchParams.get("role") || undefined,
      page: req.nextUrl.searchParams.get("page") || 1,
      pageSize: req.nextUrl.searchParams.get("pageSize") || 20,
    });
    return ok(await listUsers(query));
  });
}
