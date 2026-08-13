/**
 * Returns a safe, same-origin-relative return target for "where to go after
 * login". Strips anything that could be used for an open-redirect attack
 * (absolute URLs, protocol-relative URLs, backslash variants, etc.) and falls
 * back to "/" for anything that isn't a plain relative path.
 */
export function sanitizeReturnTo(next: string | null | undefined): string {
  if (!next) return "/";
  const trimmed = next.trim();
  if (!trimmed) return "/";
  // Reject anything that isn't a simple same-origin path.
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":")
  ) {
    return trimmed;
  }
  return "/";
}
