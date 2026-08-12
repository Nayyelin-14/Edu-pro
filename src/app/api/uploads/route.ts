import { NextRequest } from "next/server";
import { badRequest } from "@/lib/errors";
import { ok, run } from "@/lib/api";
import { uploadBuffer } from "@/lib/cloudinary";
import { requireStaff, requireUser } from "@/server/guards";

const ALLOWED_FOLDERS = new Set(["avatars", "courses", "lessons"]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const formData = await req.formData();
    const folder = String(formData.get("folder") ?? "misc");
    if (!ALLOWED_FOLDERS.has(folder)) throw badRequest("Invalid upload folder");
    if (folder !== "avatars") await requireStaff(user);

    const file = formData.get("file");
    if (!(file instanceof File)) throw badRequest("file is required");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > 100 * 1024 * 1024) {
      throw badRequest("File exceeds the 100 MB limit");
    }
    const resourceType = file.type.startsWith("video")
      ? ("video" as const)
      : ("auto" as const);
    const { url } = await uploadBuffer(buffer, { folder, resourceType });
    return ok({ url });
  });
}
