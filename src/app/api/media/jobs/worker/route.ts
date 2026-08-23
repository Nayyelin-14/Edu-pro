import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { unauthorized } from "@/lib/errors";
import {
  MEDIA_CLEANUP_INTERVAL_S,
  createMediaPublisher,
  verifyQStashSignature,
  type MediaJobPayload,
} from "@/server/services/media.queue";
import { sweepStaleAssets, verifyAssetReady, deleteAssetsAsync } from "@/server/services/upload.service";

export const dynamic = "force-dynamic";

/**
 * Public-but-signed worker for the media pipeline, invoked by QStash exactly
 * like the roadmap worker. Rejects anything without a valid Upstash-Signature.
 *
 * Job types:
 *   verify  -> confirm provider-side readiness of a PROCESSING video
 *   delete  -> asynchronous file deletion (replaced / deleted-lesson media)
 *   cleanup -> daily sweep of abandoned/failed/orphaned assets; reschedules
 *              itself so no separate cron system is needed.
 */
export async function POST(req: NextRequest) {
  return run(async () => {
    const signature = req.headers.get("upstash-signature") ?? "";
    const body = await req.text();
    if (!(await verifyQStashSignature(signature, body))) {
      throw unauthorized("Invalid QStash signature");
    }

    let payload: MediaJobPayload;
    try {
      payload = JSON.parse(body) as MediaJobPayload;
    } catch {
      throw unauthorized("Malformed payload");
    }
    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      throw unauthorized("Missing job type");
    }

    switch (payload.type) {
      case "verify": {
        if (typeof payload.assetId !== "string") throw unauthorized("Missing assetId");
        return ok(await verifyAssetReady(payload.assetId));
      }
      case "delete": {
        if (!Array.isArray(payload.targets)) throw unauthorized("Missing targets");
        await deleteAssetsAsync(
          payload.targets.filter(
            (t): t is { publicId: string; kind: "VIDEO" | "PDF" } =>
              !!t &&
              typeof t.publicId === "string" &&
              (t.kind === "VIDEO" || t.kind === "PDF"),
          ),
        );
        return ok({ deleted: payload.targets.length });
      }
      case "cleanup": {
        const result = await sweepStaleAssets();
        // Self-reschedule so the sweep runs daily without external cron.
        const publisher = createMediaPublisher();
        if (payload.type === "cleanup" && publisher.constructor.name !== "NoopMediaPublisher") {
          await publisher.publish({ type: "cleanup" }, { delaySeconds: MEDIA_CLEANUP_INTERVAL_S });
        }
        return ok(result);
      }
      default:
        throw unauthorized("Unknown job type");
    }
  });
}
