/**
 * Publisher for roadmap generation jobs.
 *
 * The service owns job creation and hands publishing off to an implementation:
 * - QStash publishes the worker invocation (production).
 * - A no-op is used for the dev inline path and for unit tests.
 *
 * Duplicate publishes are safe: the worker's DB claim (QUEUED -> PROCESSING,
 * atomic) makes a second delivery a no-op.
 */
import { Client } from "@upstash/qstash";

export interface RoadmapJobPublisher {
  /** Publish the initial worker invocation for a freshly accepted job. */
  publishInitial(jobId: string): Promise<string | undefined>;
  /** Publish a retry after a retryable failure (backed off by QStash). */
  publishRetry(jobId: string): Promise<string | undefined>;
}

export class QStashRoadmapPublisher implements RoadmapJobPublisher {
  constructor(
    private readonly client: Client,
    private readonly workerUrl: string,
    private readonly opts: { retries?: number } = {},
  ) {}

  private async publish(jobId: string, delay?: number): Promise<string | undefined> {
    const message = await this.client.publishJSON({
      url: this.workerUrl,
      body: { jobId },
      retries: this.opts.retries ?? 2,
      ...(delay ? { delay } : {}),
    });
    return message.messageId;
  }

  async publishInitial(jobId: string): Promise<string | undefined> {
    return this.publish(jobId);
  }

  async publishRetry(jobId: string): Promise<string | undefined> {
    // Back the retry off so we don't hammer the provider immediately.
    return this.publish(jobId, 30);
  }
}

/** No-op publisher for the dev inline path and unit tests. */
export class NoopRoadmapPublisher implements RoadmapJobPublisher {
  async publishInitial(): Promise<string | undefined> {
    return undefined;
  }

  async publishRetry(): Promise<string | undefined> {
    return undefined;
  }
}
