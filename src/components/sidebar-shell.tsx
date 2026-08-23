"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

export function SidebarShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col transition-[margin] duration-200",
        collapsed ? "md:ml-20" : "md:ml-sidebar-width",
        className,
      )}
    >
      {children}
    </div>
  );
}