/**
 * Unit tests for trusted-proxy client IP resolution.
 */
import { test } from "node:test";
import assert from "node:assert";
import { resolveClientIp } from "@/lib/api";

test("returns unknown when no proxy is trusted (spoofable headers ignored)", () => {
  const headers = new Headers({
    "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    "x-real-ip": "9.9.9.9",
  });
  assert.strictEqual(resolveClientIp(headers, false), "unknown");
});

test("trusts x-vercel-forwarded-for first when a proxy is trusted", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.7",
    "x-forwarded-for": "1.2.3.4, 203.0.113.7",
    "x-real-ip": "9.9.9.9",
  });
  assert.strictEqual(resolveClientIp(headers, true), "203.0.113.7");
});

test("uses the rightmost x-forwarded-for entry (not the attacker-controlled leftmost)", () => {
  const headers = new Headers({
    "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.9",
  });
  assert.strictEqual(resolveClientIp(headers, true), "203.0.113.9");
});

test("falls back to x-real-ip when no x-forwarded-for is present", () => {
  const headers = new Headers({ "x-real-ip": "203.0.113.10" });
  assert.strictEqual(resolveClientIp(headers, true), "203.0.113.10");
});

test("returns unknown with a trusted proxy but no headers at all", () => {
  assert.strictEqual(resolveClientIp(new Headers(), true), "unknown");
});

test("handles empty or whitespace-only entries", () => {
  const headers = new Headers({ "x-forwarded-for": "  , , " });
  assert.strictEqual(resolveClientIp(headers, true), "unknown");
});