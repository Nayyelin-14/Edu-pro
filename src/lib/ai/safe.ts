/** Best-effort, safe JSON parse. Throws a descriptive error on failure. */
export function parseJsonSafe(text: string): unknown {
  // Strip optional markdown code fences some providers sometimes emit.
  const cleaned = text.replace(/^\s*(?:```[a-zA-Z0-9-]*\s*)?/, "").replace(/\s*(?:```)?\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const preview = cleaned.slice(0, 200);
    throw new Error(`Invalid JSON from AI: ${err instanceof Error ? err.message : "parse error"} — input: ${preview}`);
  }
}
