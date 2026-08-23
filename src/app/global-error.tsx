"use client";

/**
 * Global error boundary (last-resort UI when the root layout itself throws).
 *
 * The auto-generated default page fails to prerender in this setup
 * ("Cannot read properties of null (reading 'useContext')"), which breaks
 * `next build`; an explicit minimal boundary is the standard fix and gives
 * users a styled fallback instead of the browser's default error screen.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p style={{ color: "#52525b", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "0.75rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
