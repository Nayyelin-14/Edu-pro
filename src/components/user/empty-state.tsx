import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  iconClassName,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-5 flex size-16 items-center justify-center rounded-2xl bg-surface-container text-outline",
            iconClassName,
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-title-lg font-semibold text-on-surface">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-body-md text-on-surface-variant">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}