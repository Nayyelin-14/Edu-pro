import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { serviceUnavailable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return run(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      throw serviceUnavailable("Database is not reachable");
    }
    return ok({ status: "ok", database: "ok" });
  });
}