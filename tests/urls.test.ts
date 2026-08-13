/**
 * Tests for sanitizeReturnTo — the guard against open-redirect attacks on the
 * login `next` parameter.
 */
import { test } from "node:test";
import assert from "node:assert";
import { sanitizeReturnTo } from "@/lib/urls";

test("empty/null/undefined falls back to /", () => {
  assert.equal(sanitizeReturnTo(null), "/");
  assert.equal(sanitizeReturnTo(undefined), "/");
  assert.equal(sanitizeReturnTo(""), "/");
  assert.equal(sanitizeReturnTo("   "), "/");
});

test("keeps a simple same-origin path", () => {
  assert.equal(sanitizeReturnTo("/account/profile"), "/account/profile");
  assert.equal(sanitizeReturnTo("/courses/foo"), "/courses/foo");
  assert.equal(sanitizeReturnTo("/"), "/");
});

test("rejects absolute and protocol-relative URLs (open redirect)", () => {
  assert.equal(sanitizeReturnTo("https://evil.com"), "/");
  assert.equal(sanitizeReturnTo("http://evil.com/phish"), "/");
  assert.equal(sanitizeReturnTo("//evil.com"), "/");
  assert.equal(sanitizeReturnTo("\\\\evil.com"), "/");
  // A colon anywhere (e.g. a scheme or data:) must be rejected.
  assert.equal(sanitizeReturnTo("/foo:bar"), "/");
});
