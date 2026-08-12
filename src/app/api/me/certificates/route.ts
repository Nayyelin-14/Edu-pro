import { ok, run } from "@/lib/api";
import { getMyCertificates } from "@/server/services/certificate.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok({ certificates: await getMyCertificates(user.id) });
  });
}
