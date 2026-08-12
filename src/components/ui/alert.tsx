import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        error: "border-destructive/50 bg-destructive/10 text-destructive",
        success: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700",
        warning: "border-amber-500/50 bg-amber-500/10 text-amber-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
