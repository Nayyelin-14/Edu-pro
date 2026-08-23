/**
 * Unit tests for the server-side rich-text sanitizer (stored-XSS defense).
 */
import { test } from "node:test";
import assert from "node:assert";
import { sanitizeRichHtml } from "@/lib/html";

test("strips script tags and inline event handlers", () => {
  const out = sanitizeRichHtml(
    '<p onclick="alert(1)">Hi</p><script>alert("xss")</script><img src="x" onerror="alert(2)">',
  );
  assert.ok(!out.includes("<script"));
  assert.ok(!out.includes("onclick"));
  assert.ok(!out.includes("onerror"));
  assert.ok(out.includes("Hi"));
});

test("strips javascript: and data: URLs", () => {
  const out = sanitizeRichHtml(
    '<a href="javascript:alert(1)">click</a><img src="data:image/svg+xml;base64,PHN2Zz4=">',
  );
  assert.ok(!out.includes("javascript:"));
  assert.ok(!out.includes("data:"));
  assert.ok(out.includes(">click</a>") || out.includes("click"));
});

test("strips iframes, objects, embeds, style and svg", () => {
  const out = sanitizeRichHtml(
    '<iframe src="https://evil.example"></iframe><object data="x"></object><style>*{}</style><svg onload="alert(1)"></svg><p>keep</p>',
  );
  assert.ok(!out.includes("iframe"));
  assert.ok(!out.includes("<object"));
  assert.ok(!out.includes("<style"));
  assert.ok(!out.includes("<svg"));
  assert.ok(out.includes("keep"));
});

test("preserves safe rich content", () => {
  const out = sanitizeRichHtml(
    '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em> <a href="https://example.com" rel="x">link</a></p><ul><li>One</li></ul><code>const x = 1</code>',
  );
  assert.ok(out.includes("<h2>Title</h2>"));
  assert.ok(out.includes("<strong>Bold</strong>"));
  assert.ok(out.includes("https://example.com"));
  assert.ok(out.includes("<ul>"));
  assert.ok(out.includes("const x = 1"));
});

test("forces rel and target on links", () => {
  const out = sanitizeRichHtml('<a href="https://example.com">x</a>');
  assert.ok(out.includes('rel="noopener noreferrer nofollow"'));
  assert.ok(out.includes('target="_blank"'));
});