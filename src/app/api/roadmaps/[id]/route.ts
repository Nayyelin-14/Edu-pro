import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    const roadmap = await roadmapReadRepo.getMyRoadmap(user.id, id);
    if (!roadmap) {
      // 404 instead of 403 to avoid leaking existence
      throw notFound();
    }
    return ok({ roadmap });
  });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    const roadmap = await roadmapReadRepo.saveMyRoadmap(user.id, id);
    if (!roadmap) {
      throw notFound();
    }
    return ok({ roadmap });
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    const deleted = await roadmapReadRepo.deleteMyRoadmap(user.id, id);
    if (!deleted) {
      throw notFound();
    }
    return ok({ success: true });
  });
}