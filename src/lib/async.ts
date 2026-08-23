import { incrementMetric } from "./metrics";

/**
 * Runs a side-effect promise best-effort: failures are logged with a stable
 * label and swallowed, so a failed email/notification never breaks the primary
 * operation (which has already committed to the database). Returns whether the
 * task succeeded so callers can decide whether to surface a clear error.
 */
export async function bestEffort(
  label: string,
  task: Promise<unknown>,
): Promise<boolean> {
  try {
    await task;
    return true;
  } catch (error) {
    incrementMetric("best_effort.failed");
    console.error(`[${label}] failed (suppressed):`, error);
    return false;
  }
}