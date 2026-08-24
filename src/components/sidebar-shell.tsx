"use client";

import { cn } from "@/lib/utils";

export function SidebarShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col flex-1 min-w-0",
        className,
      )}
    >
      {children}
    </div>
  );
}