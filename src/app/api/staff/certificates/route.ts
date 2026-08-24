import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, run } from "@/lib/api";
import { listAllCertificates } from "@/server/services/certificate.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    const query = querySchema.parse({
      search: req.nextUrl.searchParams.get("search") || undefined,
      page: req.nextUrl.searchParams.get("page") || 1,
      pageSize: req.nextUrl.searchParams.get("pageSize") || 20,
    });
    return ok(await listAllCertificates(query));
  });
}
