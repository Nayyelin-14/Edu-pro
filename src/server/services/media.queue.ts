/**
 * QStash wiring for the media pipeline — mirrors the roadmap pattern:
 * signed worker endpoint, no-op publisher in dev, self-rescheduling cleanup.
 *
 * Job types (payload delivered to /api/media/jobs/worker):
 *   { type: "verify",  assetId }                  -> confirm provider has the
 *                                                    asset; PROCESSING -> READY
 *   { type: "delete",  targets: [{publicId, kind}] } -> async file deletion
 *   { type: "cleanup" }                            -> sweep stale/abandoned/
 *                                                    orphaned uploads, then
 *                                                    reschedule itself daily
 */
import { Client } from "@upstash/qstash";
import { serviceUnavailable } from "@/lib/errors";

export const MEDIA_WORKER_PATH = "/api/media/jobs/worker";
export const MEDIA_CLEANUP_INTERVAL_S = 24 * 60 * 60;

export type MediaJobPayload =
  | { type: "verify"; assetId: string }
  | { type: "delete"; targets: { publicId: string; kind: "VIDEO" | "PDF" }[] }
  | { type: "cleanup" };

export interface MediaJobPublisher {
  publish(payload: MediaJobPayload, opts?: { delaySeconds?: number }): Promise<void>;
}

export class NoopMediaPublisher implements MediaJobPublisher {
  async publish(): Promise<void> {}
}

export class QStashMediaPublisher implements MediaJobPublisher {
  constructor(
    private readonly client: Client,
    private readonly url: string,
    private readonly retries: number,
  ) {}

  async publish(payload: MediaJobPayload, opts?: { delaySeconds?: number }): Promise<void> {
    await this.client.publishJSON({
      url: this.url,
      body: payload,
      retries: this.retries,
      ...(opts?.delaySeconds ? { delay: opts.delaySeconds } : {}),
    });
  }
}

export function createMediaPublisher(): MediaJobPublisher {
  if (process.env.QSTASH_ENABLED !== "true") return new NoopMediaPublisher();
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      throw serviceUnavailable("QStash is not configured");
    }
    return new NoopMediaPublisher();
  }
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return new QStashMediaPublisher(new Client({ token }), `${baseUrl}${MEDIA_WORKER_PATH}`, 2);
}

// Signature verification is shared with the roadmap worker.
export { verifyQStashSignature } from "./roadmap.queue";
