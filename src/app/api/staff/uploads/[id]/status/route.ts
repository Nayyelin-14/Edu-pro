import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

/** Asset lifecycle status for the instructor's upload UI. Tenant-scoped. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const ctx = await requireTenantContext();
    const { id } = await params;
    const asset = await prisma.asset.findFirst({
      where: { id, tenantId: ctx.tenant.id },
      select: { status: true, kind: true, bytes: true, format: true, filename: true },
    });
    if (!asset) throw notFound("Upload not found");
    return ok(asset);
  });
}
