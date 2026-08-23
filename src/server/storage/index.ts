/**
 * Storage provider resolution. Swap implementations here without touching
 * application code. Tests inject a fake provider directly.
 */
import { CloudinaryStorageProvider } from "./cloudinary.provider";
import type { StorageProvider } from "./types";

export * from "./types";
export {
  PDF_ALLOWED_FORMATS,
  PDF_MAX_BYTES,
  VIDEO_ALLOWED_FORMATS,
  VIDEO_MAX_BYTES,
  assertFormatAllowed,
  assertSizeAllowed,
  formatBytes,
} from "./limits";

let override: StorageProvider | null = null;

/** Test hook: forces a specific provider until resetStorageProvider(). */
export function setStorageProvider(provider: StorageProvider): void {
  override = provider;
}

export function resetStorageProvider(): void {
  override = null;
}

export function getStorageProvider(): StorageProvider {
  if (override) return override;
  return new CloudinaryStorageProvider();
}
