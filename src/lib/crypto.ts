import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison of two strings (safe against timing attacks). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function randomCode(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

const ENCRYPTED_PREFIX = "enc:v1:";
const ENCRYPTION_ALGO = "aes-256-gcm";

/** Returns the 32-byte AES key, or null when ENCRYPTION_KEY is unset. */
function encryptionKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  return Buffer.from(key, "hex");
}

/** True when a stored value was produced by encryptSecret (not legacy plaintext). */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypts a TOTP secret at rest with AES-256-GCM. Fail closed: without a
 * configured ENCRYPTION_KEY new secrets cannot be stored (a 500 is raised
 * rather than silently persisting plaintext).
 */
export function encryptSecret(plaintext: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("ENCRYPTION_KEY is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypts a TOTP secret previously encrypted with encryptSecret. Values that
 * predate encryption (no prefix) are returned unchanged for backwards
 * compatibility. Throws if the ciphertext is corrupted or the key changed.
 */
export function decryptSecret(ciphertext: string): string {
  if (!isEncryptedSecret(ciphertext)) return ciphertext;
  const key = encryptionKey();
  if (!key) throw new Error("ENCRYPTION_KEY is not configured");
  const [iv64, tag64, data64] = ciphertext
    .slice(ENCRYPTED_PREFIX.length)
    .split(":");
  if (!iv64 || !tag64 || !data64) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(iv64, "base64"));
  decipher.setAuthTag(Buffer.from(tag64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
