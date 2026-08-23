/**
 * Guard for the i18n dictionaries: en and th must expose identical key
 * structures (same shape, including nested objects and function signatures),
 * otherwise a page can crash with "t.foo is not a function" in Thai mode.
 */
import { test } from "node:test";
import assert from "node:assert";
import { en, th } from "@/i18n/dictionaries";

function shape(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "function") return `fn:${value.length}`;
  if (Array.isArray(value)) return `arr:${value.length}`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `obj:{${keys
      .map((k) => `${k}:${shape((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return typeof value;
}

test("en and th dictionaries have identical shapes", () => {
  assert.strictEqual(shape(th), shape(en));
});

test("key string values are non-empty in both locales", () => {
  function walk(value: unknown, path: string) {
    if (typeof value === "string") {
      assert.ok(value.length > 0, `empty string at ${path}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, `${path}.${k}`);
      }
    }
  }
  walk(en, "en");
  walk(th, "th");
});

test("every catalog price filter maps to a label in both locales", () => {
  const expected = ["free", "under500", "range", "over1500"];
  for (const key of expected) {
    assert.ok(key in en.catalog.price);
    assert.ok(key in th.catalog.price);
  }
});