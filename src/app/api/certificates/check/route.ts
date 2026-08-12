import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { checkCertificate } from "@/server/services/certificate.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    const number = req.nextUrl.searchParams.get("number") ?? "";
    return ok(await checkCertificate(number));
  });
}
