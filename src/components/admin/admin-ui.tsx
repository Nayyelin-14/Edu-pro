import type { ReactNode, ElementType } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/* ── Page header ────────────────────────────────────────────────── */

export function AdminPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ElementType;
  color?: string;
  trend?: number;
  progress?: number;
}

export function AdminStatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "from-indigo-500 to-violet-600",
  trend,
  progress,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-4 flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
            color,
          )}
        >
          <Icon className="size-5 text-white" />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              "font-mono text-xs font-medium",
              trend >= 0 ? "text-emerald-500" : "text-rose-500",
            )}
          >
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      <p className="font-mono text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-3" />}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

/* ── Avatar initials ────────────────────────────────────────────── */

export function Avi({
  name,
  size = "md",
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  const s = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  }[size];
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-primary font-semibold text-white",
        s,
      )}
    >
      {initials || "U"}
    </div>
  );
}

/* ── Progress bar ───────────────────────────────────────────────── */

export function ProgressBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
      />
    </div>
  );
}

/* ── Status & role badges ───────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  APPROVED: { label: "Approved", variant: "success" },
  PENDING_REVIEW: { label: "Pending Review", variant: "warning" },
  DRAFT: { label: "Draft", variant: "secondary" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  PENDING: { label: "Pending", variant: "warning" },
  RESOLVED: { label: "Resolved", variant: "success" },
  DISMISSED: { label: "Dismissed", variant: "secondary" },
  OPEN: { label: "Open", variant: "warning" },
  REVIEWING: { label: "Reviewing", variant: "info" },
  ACTIVE: { label: "Active", variant: "success" },
  BANNED: { label: "Banned", variant: "destructive" },
  UNPUBLISHED: { label: "Unpublished", variant: "secondary" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    SUPERADMIN: "Superadmin",
    INSTRUCTOR: "Instructor",
    STUDENT: "Student",
  };
  const map: Record<string, string> = {
    SUPERADMIN: "bg-amber-500/10 text-amber-500",
    INSTRUCTOR: "bg-primary/10 text-primary",
    STUDENT: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        map[role] ?? map.STUDENT,
      )}
    >
      {labels[role] ?? role}
    </span>
  );
}

/* ── Filter pills ───────────────────────────────────────────────── */

export function FilterPills({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Table shell ────────────────────────────────────────────────── */

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function TableTh({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-5 py-3 text-left text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TableTd({
  children,
  className,
  ...props
}: {
  children?: ReactNode;
  className?: string;
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-5 py-3.5 text-sm text-foreground", className)} {...props}>
      {children}
    </td>
  );
}

/* ── Form helpers ───────────────────────────────────────────────── */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export const adminInputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/35";

export const adminSelectClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/35 appearance-none";

export const adminTextareaClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/35 resize-none";
