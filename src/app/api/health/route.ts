import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return run(async () => {
    return ok({ status: "ok" });
  });
}