/**
 * Unit tests for TOTP-secret encryption at rest (AES-256-GCM).
 */
import { afterEach, test } from "node:test";
import assert from "node:assert";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "@/lib/crypto";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SECRET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function setKey(value: string | undefined) {
  if (value === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = value;
}

afterEach(() => setKey(undefined));

test("encryptSecret produces a prefixed, non-plaintext ciphertext", () => {
  setKey(KEY);
  const out = encryptSecret(SECRET);
  assert.ok(isEncryptedSecret(out));
  assert.ok(!out.includes(SECRET), "plaintext must never appear in ciphertext");
  assert.notStrictEqual(out, SECRET);
});

test("decryptSecret round-trips to the original secret", () => {
  setKey(KEY);
  const cipher = encryptSecret(SECRET);
  assert.strictEqual(decryptSecret(cipher), SECRET);
});

test("encryptSecret fails closed when ENCRYPTION_KEY is missing", () => {
  assert.throws(() => encryptSecret(SECRET), /ENCRYPTION_KEY/);
});

test("decryptSecret fails closed when ENCRYPTION_KEY is missing", () => {
  setKey(KEY);
  const cipher = encryptSecret(SECRET);
  setKey(undefined);
  assert.throws(() => decryptSecret(cipher), /ENCRYPTION_KEY/);
});

test("ciphertext is unique per call (random IV)", () => {
  setKey(KEY);
  assert.notStrictEqual(encryptSecret(SECRET), encryptSecret(SECRET));
});

test("legacy plaintext secrets decrypt unchanged (backwards compatibility)", () => {
  setKey(KEY);
  assert.strictEqual(decryptSecret(SECRET), SECRET);
  assert.strictEqual(isEncryptedSecret(SECRET), false);
});

test("tampered ciphertext fails to decrypt", () => {
  setKey(KEY);
  const cipher = encryptSecret(SECRET);
  const tampered = cipher.slice(0, -2) + (cipher.endsWith("AA") ? "BB" : "AA");
  assert.throws(() => decryptSecret(tampered));
});