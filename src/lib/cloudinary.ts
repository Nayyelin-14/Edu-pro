import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./errors";

export interface UploadResult {
  url: string;
  publicId: string;
}

function configure(): typeof cloudinary {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
  return cloudinary;
}

function resolveFolder(folder: string): string {
  const prefix = process.env.CLOUDINARY_FOLDER_PREFIX;
  return [prefix, folder].filter(Boolean).join("/");
}

export async function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw" | "auto";
  },
): Promise<UploadResult> {
  const c = configure();
  return new Promise((resolve, reject) => {
    const stream = c.uploader.upload_stream(
      {
        folder: resolveFolder(options.folder),
        public_id: options.publicId,
        resource_type: options.resourceType ?? "auto",
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error("Upload failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteByPublicId(publicId: string): Promise<void> {
  const c = configure();
  await c.uploader.destroy(publicId);
}
