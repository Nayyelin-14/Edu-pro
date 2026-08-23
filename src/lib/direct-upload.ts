"use client";

/**
 * Browser-direct, chunked/resumable uploads to Cloudinary (spec §5/§7).
 *
 * Uses Cloudinary's NATIVE chunked protocol — no custom protocol:
 *   - every chunk is a signed POST to the upload endpoint
 *   - `X-Unique-Upload-Id` ties chunks into one upload session
 *   - `Content-Range` positions each chunk
 *   - an interrupted upload resumes from its persisted byte offset
 *
 * The Next.js server never sees file bytes: it issues credentials
 * (/api/staff/uploads/sign) and verifies completion (/complete).
 */

import { apiFetch } from "@/lib/api-client";

export interface UploadSession {
  assetId: string;
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  paramsToSign: Record<string, string>;
  resourceType: "video" | "image";
  chunkSize: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  speedBps: number;
  etaSeconds: number | null;
}

export type UploadOutcome =
  | { state: "ready"; assetId: string }
  | { state: "processing"; assetId: string }
  | { state: "failed"; reason: string; canRetryChunk: boolean }
  | { state: "cancelled" };

interface PersistedSession {
  session: UploadSession;
  fileMeta: { name: string; size: number; lastModified: number };
  offset: number;
}

const STORAGE_PREFIX = "edupro:upload:";

function storageKey(lessonId: string, kind: string) {
  return `${STORAGE_PREFIX}${lessonId}:${kind}`;
}

function saveSession(key: string, value: PersistedSession) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. — resume just won't be available */
  }
}

function loadSession(key: string): PersistedSession | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    return parsed?.session && parsed.fileMeta ? parsed : null;
  } catch {
    return null;
  }
}

function clearSession(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Requests signing + creates the Asset row. */
export async function requestUploadSession(
  lessonId: string,
  kind: "VIDEO" | "PDF",
  file: File,
): Promise<UploadSession> {
  return apiFetch<UploadSession>("/api/staff/uploads/sign", {
    method: "POST",
    body: JSON.stringify({ lessonId, kind, filename: file.name }),
  });
}

/**
 * Finds a resumable session for this exact file (name+size+mtime must match)
 * and checks the server still accepts it.
 */
export async function findResumable(
  lessonId: string,
  kind: "VIDEO" | "PDF",
  file: File,
): Promise<{ session: UploadSession; offset: number } | null> {
  const key = storageKey(lessonId, kind);
  const saved = loadSession(key);
  if (!saved) return null;
  const { fileMeta } = saved;
  if (
    fileMeta.name !== file.name ||
    fileMeta.size !== file.size ||
    fileMeta.lastModified !== file.lastModified ||
    saved.offset <= 0 ||
    saved.offset >= file.size
  ) {
    clearSession(key);
    return null;
  }
  // Probe: ask the backend whether this asset is still UPLOADING.
  try {
    const status = await apiFetch<{ status: string }>(
      `/api/staff/uploads/${saved.session.assetId}/status`,
    );
    if (status.status !== "UPLOADING") {
      clearSession(key);
      return null;
    }
  } catch {
    clearSession(key);
    return null;
  }
  return { session: saved.session, offset: saved.offset };
}

export class ResumableUploader {
  private xhr: XMLHttpRequest | null = null;
  private cancelled = false;
  private running = false;

  constructor(
    private readonly file: File,
    private readonly lessonId: string,
    private readonly kind: "VIDEO" | "PDF",
    private readonly opts: {
      onProgress?: (p: UploadProgress) => void;
      onProcessing?: (assetId: string) => void;
      onReady?: (assetId: string) => void;
      onError?: (outcome: Extract<UploadOutcome, { state: "failed" }>) => void;
      onCancelled?: () => void;
    },
  ) {}

  /** Starts (or resumes at `startOffset`). One run per instance. */
  async run(session: UploadSession, startOffset = 0): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;
    const key = storageKey(this.lessonId, this.kind);
    const total = this.file.size;
    let offset = Math.max(0, Math.min(startOffset, total));
    saveSession(key, { session, fileMeta: { name: this.file.name, size: total, lastModified: this.file.lastModified }, offset });

    // Speed is an exponential moving average sampled between chunks.
    let emaSpeed: number | null = null;
    let lastLoaded = offset;
    let lastTick = Date.now();

    const report = () => {
      const now = Date.now();
      const dt = (now - lastTick) / 1000;
      if (dt > 0.5) {
        const inst = (offset - lastLoaded) / dt;
        emaSpeed = emaSpeed === null ? inst : 0.7 * emaSpeed + 0.3 * inst;
        lastLoaded = offset;
        lastTick = now;
      }
      const remaining = total - offset;
      this.opts.onProgress?.({
        loaded: offset,
        total,
        percent: total > 0 ? Math.min(100, (offset / total) * 100) : 100,
        speedBps: emaSpeed ?? 0,
        etaSeconds: emaSpeed && emaSpeed > 0 ? Math.round(remaining / emaSpeed) : null,
      });
    };

    try {
      while (offset < total && !this.cancelled) {
        const end = Math.min(offset + session.chunkSize, total);
        const uploaded = await this.sendChunk(session, offset, end, total);
        // Trust but verify the provider's accounting; a mismatch means the
        // chunk landed twice or partially — recompute from the response.
        offset = Math.max(end, uploaded ?? end);
        saveSession(key, { session, fileMeta: { name: this.file.name, size: total, lastModified: this.file.lastModified }, offset });
      }
      if (this.cancelled) {
        clearSession(key);
        this.opts.onCancelled?.();
        return;
      }

      clearSession(key);
      report();

      // Finalize: server verifies existence/format/size and links the lesson.
      const result = await apiFetch<{ assetId: string; status: string }>(
        `/api/staff/uploads/${session.assetId}/complete`,
        { method: "POST" },
      );
      if (result.status === "READY") {
        this.opts.onReady?.(session.assetId);
        return;
      }
      if (result.status === "PROCESSING") {
        this.opts.onProcessing?.(session.assetId);
        const final = await this.pollUntilDone(session.assetId);
        if (final === "READY") this.opts.onReady?.(session.assetId);
        else if (!this.cancelled) {
          this.opts.onError?.({
            state: "failed",
            reason: "Video processing failed",
            canRetryChunk: false,
          });
        }
        return;
      }
      this.opts.onError?.({
        state: "failed",
        reason: "Upload verification failed",
        canRetryChunk: false,
      });
    } catch (err) {
      if (this.cancelled) {
        this.opts.onCancelled?.();
        return;
      }
      const message = err instanceof Error ? err.message : "Upload failed";
      this.opts.onError?.({
        state: "failed",
        reason: message,
        // Chunk failures (network) are resumable; auth/config errors are not.
        canRetryChunk: !/not configured|not allowed|cannot be attached|sign/i.test(message),
      });
    } finally {
      this.running = false;
    }
  }

  cancel() {
    this.cancelled = true;
    this.xhr?.abort();
  }

  private async sendChunk(
    session: UploadSession,
    start: number,
    end: number,
    total: number,
  ): Promise<number | undefined> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.cancelled) throw new Error("cancelled");
      try {
        return await new Promise<number | undefined>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          this.xhr = xhr;
          xhr.open("POST", session.uploadUrl, true);
          xhr.setRequestHeader("X-Unique-Upload-Id", session.assetId);
          if (total > session.chunkSize || start > 0) {
            xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${total}`);
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText) as { uploaded?: number };
                resolve(json.uploaded);
              } catch {
                resolve(undefined);
              }
            } else if (xhr.status === 401 || xhr.status === 403) {
              reject(new Error("Upload authorization expired. Please start a new upload."));
            } else if (xhr.status === 413) {
              reject(new Error("File is too large."));
            } else if (xhr.status === 400 && /already/i.test(xhr.responseText)) {
              // Chunk already present (e.g. after retry) — skip forward.
              resolve(end);
            } else {
              reject(new Error(`Storage rejected chunk (HTTP ${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new Error("cancelled"));
          const form = new FormData();
          form.append("file", this.file.slice(start, end), "chunk");
          for (const [k, v] of Object.entries(session.paramsToSign)) form.append(k, v);
          form.append("api_key", session.apiKey);
          form.append("signature", session.signature);
          xhr.send(form);
        });
      } catch (err) {
        if (this.cancelled || (err instanceof Error && err.message === "cancelled")) throw err;
        if (attempt === maxAttempts) throw err instanceof Error ? err : new Error("Upload failed");
        // Exponential backoff before retrying this chunk.
        await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** (attempt - 1))));
      }
    }
    throw new Error("Upload failed");
  }

  private async pollUntilDone(assetId: string, timeoutMs = 5 * 60_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.cancelled) return "CANCELLED";
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const s = await apiFetch<{ status: string }>(`/api/staff/uploads/${assetId}/status`);
        if (s.status === "READY") return "READY";
        if (s.status === "FAILED") return "FAILED";
      } catch {
        /* transient — keep polling */
      }
    }
    return "TIMEOUT";
  }
}
