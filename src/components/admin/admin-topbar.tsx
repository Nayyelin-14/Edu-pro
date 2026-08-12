"use client";

import { useAuth } from "@/hooks/use-auth";
import { LogOut, Menu, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AdminTopBarProps {
  user: { username: string; email: string; role: string; avatar?: string | null };
}

export function AdminTopBar({ user }: AdminTopBarProps) {
  const { logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 md:left-[280px] right-0 h-[72px] z-30 bg-background border-b border-border flex justify-between items-center px-6 md:px-8">
      <div className="md:hidden flex items-center gap-4 w-full">
        <button className="p-2 rounded-lg text-foreground hover:bg-accent" aria-label="Toggle menu">
          <Menu className="size-6" />
        </button>
        <span className="text-xl font-bold text-primary">EduPro</span>
      </div>

      <div className="hidden md:flex items-center flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
          <Input
            placeholder="Search courses, users..."
            className="pl-10 pr-4 py-2 bg-accent border-border rounded-lg text-sm"
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>
        <div className="h-8 w-px bg-border mx-2 hidden lg:block" />
        <div className="flex items-center gap-3 cursor-pointer">
          {user.avatar ? (
            <img alt={user.username} src={user.avatar} className="w-10 h-10 rounded-full border border-border object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-medium">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="hidden lg:block text-left">
            <p className="text-sm font-medium text-foreground">{user.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase()}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => logout()}>
          <LogOut className="size-5" />
        </Button>
      </div>
    </header>
  );
}