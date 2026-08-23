import { NextRequest } from "next/server";
import { badRequest } from "@/lib/errors";
import { ok, run } from "@/lib/api";
import { uploadBuffer } from "@/lib/cloudinary";
import { validateUpload } from "@/lib/upload";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { requireTenantCapability } from "@/server/authorization";
import { enforceRateLimit } from "@/lib/ratelimit";

const ALLOWED_FOLDERS = new Set(["avatars", "courses", "lessons"]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    await enforceRateLimit(`uploads:${user.id}`);
    const formData = await req.formData();
    const folder = String(formData.get("folder") ?? "misc");
    if (!ALLOWED_FOLDERS.has(folder)) throw badRequest("Invalid upload folder");
    let storageFolder = folder;
    if (folder !== "avatars") {
      await requireStaff(user);
      // TENANT MODE: content-folder uploads need author capability, and the
      // storage namespace is tenant-scoped from the TRUSTED context — never
      // from client input. (Avatars are user-global.)
      const ctx = await requireTenantContext();
      requireTenantCapability(ctx, "author");
      storageFolder = [ctx.tenant.id, folder].join("/");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) throw badRequest("file is required");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > 100 * 1024 * 1024) {
      throw badRequest("File exceeds the 100 MB limit");
    }
    const { resourceType } = await validateUpload(buffer, folder);
    const { url } = await uploadBuffer(buffer, {
      folder: storageFolder,
      resourceType,
    });
    return ok({ url });
  });
}
