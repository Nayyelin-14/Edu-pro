import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a duration in seconds as e.g. "2h 15m" or "8m" or "45s". */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** Formats seconds as a mono clock, e.g. "25:00" or "1:04:32". */
export function formatClockTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Format a price. price is stored in THB; 0 = free. */
export function formatPrice(price: number): string {
  if (!price) return "Free";
  return `฿${price.toLocaleString("en-US")}`;
}

const COURSE_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-orange-400 to-rose-600",
  "from-violet-500 to-purple-600",
  "from-fuchsia-500 to-pink-600",
];

/** Deterministic gradient for a course, derived from its category/seed. */
export function courseGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COURSE_GRADIENTS[h % COURSE_GRADIENTS.length] ?? COURSE_GRADIENTS[0]!;
}
