import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "primary" | "success" | "warning" | "info";
  className?: string;
}

const ACCENTS = {
  primary: "bg-primary-container/10 text-primary",
  success: "bg-success-container/60 text-on-success-container",
  warning: "bg-warning-container/60 text-on-warning-container",
  info: "bg-info-container/60 text-on-info-container",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "primary",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-outline-variant/70 bg-card p-4 shadow-sm transition-colors hover:border-outline-variant",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            ACCENTS[accent],
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-label-sm text-on-surface-variant">{label}</p>
        <div className="text-title-lg font-bold text-on-surface">{value}</div>
        {hint && <p className="mt-0.5 text-label-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}