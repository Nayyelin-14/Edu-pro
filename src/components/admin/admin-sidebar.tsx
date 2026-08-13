"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  TicketCheck,
  Flag,
  Award,
  ShieldPlus,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/enrollments", label: "Enrollments", icon: TicketCheck },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/certificates", label: "Certificates", icon: Award },
  { href: "/admin/register", label: "Create instructor", icon: ShieldPlus, superAdminOnly: true },
];

const bottomItems: NavItem[] = [
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/help", label: "Help", icon: HelpCircle },
];

interface AdminSidebarProps {
  user: { role: string };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = user.role === "SUPERADMIN";

  const filteredNavItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[280px] z-40 flex-col py-6 bg-background border-r border-border">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">EduPro</h1>
            <p className="text-xs text-muted-foreground">Admin Suite</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-1 px-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary border-l-4 border-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-4 border-t border-border pt-4 flex flex-col gap-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary border-l-4 border-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}