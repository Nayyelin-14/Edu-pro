/**
 * Storage layer unit tests: provider contract via a fake, tenant-aware
 * generated object naming, and upload policy limits (spec §4/§6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  setStorageProvider,
  resetStorageProvider,
  getStorageProvider,
  assertFormatAllowed,
  assertSizeAllowed,
  VIDEO_MAX_BYTES,
  type StorageProvider,
} from "@/server/storage";
import { ApiError } from "@/lib/errors";

test("format/size policy rejects off-allowlist content", () => {
  assert.throws(() => assertFormatAllowed("VIDEO", "exe"), ApiError);
  assert.throws(() => assertFormatAllowed("VIDEO", null), ApiError);
  assert.throws(() => assertFormatAllowed("PDF", "docx"), ApiError);
  // Allowed sets:
  assert.doesNotThrow(() => assertFormatAllowed("VIDEO", "mp4"));
  assert.doesNotThrow(() => assertFormatAllowed("VIDEO", "webm"));
  assert.doesNotThrow(() => assertFormatAllowed("PDF", "pdf"));
});

test("size limits enforced against provider-reported bytes", () => {
  assert.throws(
    () => assertSizeAllowed("PDF", VIDEO_MAX_BYTES),
    (e: unknown) => e instanceof ApiError && e.statusCode === 413,
  );
  assert.doesNotThrow(() => assertSizeAllowed("VIDEO", 1024));
});

test("signed uploads contain no secrets and pin controlled public ids", async () => {
  const seen: { params?: Record<string, string>; publicId?: string } = {};
  const fake: StorageProvider = {
    name: "fake",
    async createSignedUpload({ publicId }) {
      seen.publicId = publicId;
      return {
        uploadUrl: "https://storage.local/upload",
        apiKey: "key-public",
        timestamp: 1,
        signature: "sig",
        paramsToSign: { public_id: publicId, timestamp: "1", type: "authenticated" },
        chunkSize: 8 * 1024 ** 2,
      };
    },
    async getObjectMetadata() {
      return null;
    },
    async getSignedDeliveryUrl(publicId, _kind, ttl) {
      return {
        url: `https://storage.local/${publicId}?sig=x&exp=${ttl}`,
        expiresAt: new Date(Date.now() + ttl * 1000),
      };
    },
    async deleteObject() {},
  };
  setStorageProvider(fake);
  try {
    const provider = getStorageProvider();
    const signed = await provider.createSignedUpload({
      publicId: "elearning/tenants/t1/courses/c1/lessons/l1/video-a",
      kind: "VIDEO",
    });
    const json = JSON.stringify(signed);
    assert.ok(!json.includes("secret"), "no secret material in signed params");
    assert.equal(signed.paramsToSign.type, "authenticated");
    assert.equal(seen.publicId?.startsWith("elearning/tenants/t1/courses/c1/lessons/l1/"), true);
  } finally {
    resetStorageProvider();
  }
});

test("getObjectMetadata returning null means object missing", async () => {
  const fake: StorageProvider = {
    name: "fake",
    async createSignedUpload() {
      throw new Error("unused");
    },
    async getObjectMetadata() {
      return null;
    },
    async getSignedDeliveryUrl() {
      throw new Error("unused");
    },
    async deleteObject() {},
  };
  setStorageProvider(fake);
  try {
    assert.equal(
      await getStorageProvider().getObjectMetadata("missing", "VIDEO"),
      null,
    );
  } finally {
    resetStorageProvider();
  }
});
