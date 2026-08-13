import { test, describe } from "node:test";
import assert from "node:assert";
import { parseJsonSafe } from "@/lib/ai/safe";

describe("parseJsonSafe", () => {
  test("parses valid JSON", () => {
    const result = parseJsonSafe('{"key": "value"}');
    assert.deepStrictEqual(result, { key: "value" });
  });

  test("parses JSON with arrays", () => {
    const result = parseJsonSafe('["a", "b", "c"]');
    assert.deepStrictEqual(result, ["a", "b", "c"]);
  });

  test("strips markdown code fences", () => {
    const result = parseJsonSafe('```json\n{"key": "value"}\n```');
    assert.deepStrictEqual(result, { key: "value" });
  });

  test("strips code fences without language", () => {
    const result = parseJsonSafe('```\n{"key": "value"}\n```');
    assert.deepStrictEqual(result, { key: "value" });
  });

  test("strips code fences with trailing spaces", () => {
    const result = parseJsonSafe('  ```json\n{"key": "value"}\n```  ');
    assert.deepStrictEqual(result, { key: "value" });
  });

  test("throws on invalid JSON", () => {
    assert.throws(() => parseJsonSafe('not json'), /Invalid JSON from AI/);
  });

  test("throws on incomplete JSON", () => {
    assert.throws(() => parseJsonSafe('{"key": "value"'), /Invalid JSON from AI/);
  });

  test("includes preview in error message", () => {
    try {
      parseJsonSafe('{"invalid": json}');
    } catch (err) {
      assert(err instanceof Error);
      assert(err.message.includes("Invalid JSON from AI"));
      assert(err.message.includes("input:"));
    }
  });
});