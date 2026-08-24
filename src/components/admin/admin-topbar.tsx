"use client";

import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/components/sidebar-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/user/notification-bell";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminTopBarProps {
  user: { username: string; email: string; role: string; avatar?: string | null };
}

export function AdminTopBar({ user }: AdminTopBarProps) {
  const { logout } = useAuth();
  const { collapsed } = useSidebar();

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 h-14 z-30 bg-background/80 backdrop-blur-md border-b border-border flex justify-between items-center px-6 transition-[left] duration-200",
        collapsed ? "md:left-20" : "md:left-sidebar-width",
      )}
    >
      <div className="md:hidden flex items-center gap-4 w-full">
        <button className="p-2 rounded-xl text-foreground hover:bg-muted" aria-label="Toggle menu">
          <Menu className="size-5" />
        </button>
        <span className="text-lg font-bold text-primary">EduPro</span>
      </div>

      <div className="hidden md:flex items-center flex-1" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell detailBase="/staff/notifications" />
        <div className="h-6 w-px bg-border mx-2 hidden lg:block" />
        <Link href="/staff/profile" className="flex items-center gap-3 cursor-pointer rounded-xl p-1 transition-colors hover:bg-muted">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={user.username} src={user.avatar} className="w-8 h-8 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-foreground">{user.username}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{user.role.toLowerCase()}</p>
          </div>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => logout()}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}