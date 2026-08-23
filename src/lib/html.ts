/**
 * Server-side HTML sanitization for instructor-authored rich content.
 *
 * This is the single choke point every rich-text field must pass through
 * before it is persisted (course descriptions, lesson articles, module
 * descriptions). It keeps safe formatting and structure and strips
 * everything that can execute or leak: script, style, event handlers,
 * javascript: URLs, embedded objects, SVG and iframes.
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "mark",
  "blockquote",
  "code",
  "pre",
  "span",
  "div",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  th: ["colspan", "rowspan", "align"],
  td: ["colspan", "rowspan", "align"],
  code: ["class"],
  pre: ["class"],
};

const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"];

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: { img: ["http", "https"] },
    allowVulnerableTags: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
}
