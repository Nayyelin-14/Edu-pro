/**
 * StorageProvider abstraction (spec §4).
 *
 * Keeps application code independent from Cloudinary specifics. PostgreSQL
 * stores metadata/references only; binaries live behind this interface.
 *
 * Media references stored on Lesson rows use the internal scheme
 * `cloudinary:<publicId>` for provider-backed assets (resolved to short-lived
 * signed URLs at request time), or plain https URLs for legacy/direct links.
 */

/** Kinds of lesson media tracked as Asset rows. */
export type AssetKind = "VIDEO" | "PDF";

/**
 * Parameters handed to the browser for a DIRECT upload to the provider.
 * Contains no secrets: the API secret signs `paramsToSign` server-side and
 * only the resulting signature leaves the server.
 */
export interface SignedUpload {
  /** Fully-qualified endpoint the browser PUTs/POSTs chunks to. */
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** Exact parameter object that was signed — the browser must send these verbatim. */
  paramsToSign: Record<string, string>;
  /** Recommended chunk size for resumable uploads (bytes). */
  chunkSize: number;
}

export interface ProviderObjectMetadata {
  publicId: string;
  resourceType: string;
  format: string | null;
  bytes: number | null;
  durationSeconds: number | null;
}

export interface StorageProvider {
  readonly name: string;

  /**
   * Produces credentials for a browser-direct, chunked/resumable upload of a
   * single object at the given controlled public id.
   */
  createSignedUpload(input: { publicId: string; kind: AssetKind }): Promise<SignedUpload>;

  /**
   * Fetches authoritative metadata for an uploaded object. Returns null when
   * the object does not exist (never trust client claims of completion).
   */
  getObjectMetadata(publicId: string, kind: AssetKind): Promise<ProviderObjectMetadata | null>;

  /**
   * Short-lived signed delivery URL for PRIVATE media. URLs expire after
   * ttlSeconds and must fail closed cross-tenant (provider enforces the
   * signature, we enforce who may request one).
   */
  getSignedDeliveryUrl(
    publicId: string,
    kind: AssetKind,
    ttlSeconds: number,
  ): Promise<{ url: string; expiresAt: Date }>;

  /** Best-effort permanent deletion. Must not throw for already-missing objects. */
  deleteObject(publicId: string, kind: AssetKind): Promise<void>;
}

export class StorageNotConfiguredError extends Error {
  constructor(message = "Storage provider is not configured") {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}
