/**
 * Cloudinary implementation of StorageProvider.
 *
 * - Direct browser uploads: signed upload params (API secret NEVER leaves the
 *   server). Assets are uploaded as `type: "authenticated"` so raw URLs are
 *   useless without a signature — private by default (spec §10).
 * - Resumable uploads: Cloudinary's native chunked protocol
 *   (`X-Unique-Upload-Id` + `Content-Range` headers) driven entirely by the
 *   browser; the server never sees file bytes.
 * - Delivery: short-lived signed URLs via utils.private_download_url.
 */
import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "@/lib/errors";
import type {
  AssetKind,
  ProviderObjectMetadata,
  SignedUpload,
  StorageProvider,
} from "./types";

/** 8 MiB chunks — good throughput/latency balance for flaky networks. */
const CHUNK_SIZE = 8 * 1024 ** 2;

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return { cloudName, apiKey, apiSecret };
}

function resourceTypeFor(kind: AssetKind): "video" | "image" {
  // PDFs live under the "image" resource type on Cloudinary (detected format
  // will be "pdf"); videos under "video".
  return kind === "VIDEO" ? "video" : "image";
}

export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = "cloudinary";

  async createSignedUpload(input: { publicId: string; kind: AssetKind }): Promise<SignedUpload> {
    const { cloudName, apiKey, apiSecret } = config();
    const timestamp = Math.floor(Date.now() / 1000);
    // Sign EXACTLY what the browser will send — nothing more, nothing less,
    // otherwise Cloudinary rejects the signature. `type=authenticated` keeps
    // delivery URLs unusable without signing.
    const paramsToSign = {
      public_id: input.publicId,
      timestamp: String(timestamp),
      type: "authenticated",
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
    const resourceType = resourceTypeFor(input.kind);
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      apiKey,
      timestamp,
      signature,
      paramsToSign,
      chunkSize: CHUNK_SIZE,
    };
  }

  async getObjectMetadata(
    publicId: string,
    kind: AssetKind,
  ): Promise<ProviderObjectMetadata | null> {
    config(); // fail fast when unconfigured; also applies SDK-wide config
    try {
      const res = await cloudinary.api.resource(publicId, {
        resource_type: resourceTypeFor(kind),
        type: "authenticated",
      });
      return {
        publicId: res.public_id,
        resourceType: String(res.resource_type ?? ""),
        format: typeof res.format === "string" ? res.format.toLowerCase() : null,
        bytes: typeof res.bytes === "number" ? res.bytes : null,
        durationSeconds:
          kind === "VIDEO" && typeof res.duration === "number" ? res.duration : null,
      };
    } catch (err) {
      if (extractHttpCode(err) === 404) {
        return null;
      }
      throw err;
    }
  }

  async getSignedDeliveryUrl(
    publicId: string,
    kind: AssetKind,
    ttlSeconds: number,
  ) {
    config(); // ensure SDK-wide config (api_key/secret) is applied
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const url = cloudinary.utils.private_download_url(
      publicId,
      kind === "PDF" ? "pdf" : "mp4",
      {
        resource_type: resourceTypeFor(kind),
        type: "authenticated",
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      },
    );
    return { url, expiresAt };
  }

  async deleteObject(publicId: string, kind: AssetKind): Promise<void> {
    config(); // ensure SDK-wide config (api_key/secret) is applied
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceTypeFor(kind),
        type: "authenticated",
        invalidate: true,
      });
      // "not found" is success (already gone).
      if (res?.result && res.result !== "ok" && res.result !== "not found") {
        throw new Error(`Cloudinary destroy returned: ${res.result}`);
      }
    } catch (err) {
      if (extractHttpCode(err) === 404) return;
      throw err;
    }
  }
}

/** Cloudinary SDK errors nest the status under `error.http_code`. */
function extractHttpCode(err: unknown): number | undefined {
  const e = err as { error?: { http_code?: number }; http_code?: number } | null;
  return e?.error?.http_code ?? e?.http_code;
}
