import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeVariant = "primary" | "success" | "warning" | "info" | "neutral";

const VARIANT_MAP: Record<StatusBadgeVariant, BadgeProps["variant"]> = {
  primary: "default",
  success: "success",
  warning: "warning",
  info: "info",
  neutral: "secondary",
};

interface StatusBadgeProps {
  status: string;
  label: string;
  variant?: StatusBadgeVariant;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  variant = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant={VARIANT_MAP[variant]}
      className={cn("capitalize", className)}
      data-status={status}
    >
      {label}
    </Badge>
  );
}

export function statusToVariant(
  status: string,
): Exclude<StatusBadgeVariant, "primary"> {
  switch (status) {
    case "COMPLETED":
    case "RESOLVED":
      return "success";
    case "IN_PROGRESS":
    case "PENDING":
      return "warning";
    case "SUGGESTED":
      return "info";
    case "DISMISSED":
    case "NOT_STARTED":
    default:
      return "neutral";
  }
}