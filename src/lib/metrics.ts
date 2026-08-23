/**
 * In-process operational metrics (request/error counters, provider failures,
 * rate-limit rejections). Coarse-grained on purpose: enough to trend health
 * without a metric backend. Exposed via GET /api/metrics when enabled.
 */
const counters = new Map<string, number>();

export function incrementMetric(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function getMetrics(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of counters) out[key] = value;
  return out;
}

export function resetMetrics(): void {
  counters.clear();
}