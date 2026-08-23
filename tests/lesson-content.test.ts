/**
 * Lesson content model validation (spec §20).
 *
 * Exactly TWO types; READING carries exactly ONE source. All valid and
 * invalid combinations are exercised against the same schemas the API uses,
 * plus the service-layer guard that re-checks every rule.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLessonSchema,
  updateLessonSchema,
} from "@/lib/validation/course";
import { assertContentConsistent } from "@/server/services/admin.course.service";
import { ApiError } from "@/lib/errors";

const base = {
  moduleId: "mod_1",
  title: "Intro",
  position: 0,
};

// --- createLessonSchema: VALID ---

test("valid VIDEO lesson with videoUrl", () => {
  const r = createLessonSchema.parse({
    ...base,
    type: "VIDEO",
    videoUrl: "https://res.cloudinary.com/demo/video/upload/v1/x.mp4",
    videoDuration: 320,
  });
  assert.equal(r.type, "VIDEO");
});

test("valid READING lesson with article", () => {
  const r = createLessonSchema.parse({
    ...base,
    type: "READING",
    article: "<p>Hello</p>",
  });
  assert.equal(r.type, "READING");
});

test("valid READING lesson with pdfUrl", () => {
  const r = createLessonSchema.parse({
    ...base,
    type: "READING",
    pdfUrl: "https://res.cloudinary.com/demo/image/upload/v1/doc.pdf",
  });
  assert.ok(r.pdfUrl);
});

// --- createLessonSchema: INVALID ---

test("VIDEO without videoUrl is rejected", () => {
  assert.throws(() => createLessonSchema.parse({ ...base, type: "VIDEO" }));
});

test("VIDEO with article is rejected", () => {
  assert.throws(() =>
    createLessonSchema.parse({
      ...base,
      type: "VIDEO",
      videoUrl: "https://x.local/v.mp4",
      article: "<p>nope</p>",
    }),
  );
});

test("VIDEO with pdfUrl is rejected", () => {
  assert.throws(() =>
    createLessonSchema.parse({
      ...base,
      type: "VIDEO",
      videoUrl: "https://x.local/v.mp4",
      pdfUrl: "https://x.local/d.pdf",
    }),
  );
});

test("non-https videoUrl is rejected", () => {
  assert.throws(() =>
    createLessonSchema.parse({
      ...base,
      type: "VIDEO",
      videoUrl: "http://insecure.local/v.mp4",
    }),
  );
  assert.throws(() =>
    createLessonSchema.parse({
      ...base,
      type: "VIDEO",
      videoUrl: "javascript:alert(1)",
    }),
  );
});

test("READING without article/pdf is rejected", () => {
  assert.throws(() => createLessonSchema.parse({ ...base, type: "READING" }));
});

test("READING with BOTH article and pdfUrl is rejected", () => {
  assert.throws(() =>
    createLessonSchema.parse({
      ...base,
      type: "READING",
      article: "<p>x</p>",
      pdfUrl: "https://x.local/d.pdf",
    }),
  );
});

test("missing type is rejected", () => {
  assert.throws(() => createLessonSchema.parse(base));
});

// --- updateLessonSchema ---

test("update accepts full atomic VIDEO payload", () => {
  const r = updateLessonSchema.parse({
    title: "Renamed",
    type: "VIDEO",
    videoUrl: "https://x.local/v.mp4",
    isFree: true,
  });
  assert.equal(r.type, "VIDEO");
});

test("update rejects partial conflicting payload", () => {
  // Switching to VIDEO without providing a video URL must fail.
  assert.throws(() => updateLessonSchema.parse({ type: "VIDEO", title: "x" }));
  // Both sources on READING must fail.
  assert.throws(() =>
    updateLessonSchema.parse({
      type: "READING",
      article: "<p>a</p>",
      pdfUrl: "https://x.local/d.pdf",
    }),
  );
});

// --- service layer guard (defense in depth) ---

test("service guard re-enforces every rule", () => {
  assert.throws(
    () =>
      assertContentConsistent({
        type: "VIDEO",
        videoUrl: null as unknown as string,
        article: null,
        pdfUrl: null,
      }),
    (e: unknown) => e instanceof ApiError && e.statusCode === 400,
  );
  assert.throws(() =>
    assertContentConsistent({ type: "READING", article: null, pdfUrl: null }),
  );
  assert.throws(() =>
    assertContentConsistent({
      type: "READING",
      article: "<p>a</p>",
      pdfUrl: "https://x.local/d.pdf",
    }),
  );
  // Whitespace-only article counts as missing.
  assert.throws(() =>
    assertContentConsistent({ type: "READING", article: "   ", pdfUrl: null }),
  );
});
