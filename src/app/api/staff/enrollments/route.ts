import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listEnrollments } from "@/server/services/enrollment.service";
import { isPlatformAdmin } from "@/server/authorization";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";
import { z } from "zod";

const querySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["all", "active", "completed", "dropped"]).default("all").optional(),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    if (isPlatformAdmin(user)) {
      // PLATFORM MODE: SUPERADMIN manages enrollments across all tenants.
      const query = querySchema.parse({
        search: req.nextUrl.searchParams.get("search") || undefined,
        page: 1,
        pageSize: 20,
        status: req.nextUrl.searchParams.get("status") || "all",
      });
      return ok(await listEnrollments(query, {}));
    }
    // TENANT MODE: instructors see students of their own courses.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    const sp = req.nextUrl.searchParams;
    const query = querySchema.parse({
      search: sp.get("search") || undefined,
      page: sp.get("page") || 1,
      pageSize: sp.get("pageSize") || 20,
      status: sp.get("status") || "all",
    });
    return ok(
      await listEnrollments(query, {
        tenantId: tctx.tenant.id,
        instructorId: user.id,
      }),
    );
  });
}