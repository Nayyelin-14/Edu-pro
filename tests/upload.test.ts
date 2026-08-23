/**
 * Unit tests for magic-byte upload validation (never trust the declared MIME).
 */
import { test } from "node:test";
import assert from "node:assert";
import { ApiError } from "@/lib/errors";
import { validateUpload } from "@/lib/upload";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082",
  "hex",
);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.from("rest-of-jpeg"),
]);
const GIF = Buffer.concat([
  Buffer.from("GIF89a"),
  Buffer.from("rest-of-gif"),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
  Buffer.from("rest-of-webp"),
]);
const MP4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]),
  Buffer.from("ftypisom"),
  Buffer.from("rest-of-mp4"),
]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

async function expectRejected(buffer: Buffer, folder: string, re: RegExp) {
  await assert.rejects(
    () => validateUpload(buffer, folder),
    (err: unknown) => {
      assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
      assert.match(err.message, re);
      return true;
    },
  );
}

test("accepts PNG/JPEG/GIF/WebP images", async () => {
  for (const [buf, mime] of [
    [PNG, "image/png"],
    [JPEG, "image/jpeg"],
    [GIF, "image/gif"],
    [WEBP, "image/webp"],
  ] as const) {
    const res = await validateUpload(buf, "courses");
    assert.strictEqual(res.resourceType, "image");
    assert.strictEqual(res.detectedMime, mime);
  }
});

test("accepts MP4 video in course folders but not in avatars", async () => {
  const res = await validateUpload(MP4, "lessons");
  assert.strictEqual(res.resourceType, "video");
  assert.strictEqual(res.detectedMime, "video/mp4");
  await expectRejected(MP4, "avatars", /not allowed/);
});

test("rejects executables even when the declared type claims an image", async () => {
  await expectRejected(EXE, "avatars", /not allowed/);
});

test("rejects SVG payloads (script-capable XML)", async () => {
  await expectRejected(SVG, "courses", /not allowed/);
});