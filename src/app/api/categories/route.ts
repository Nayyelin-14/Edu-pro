import { ok, run } from "@/lib/api";
import { listCategories } from "@/server/services/course.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => ok(await listCategories()));
}
