"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BookOpen,
  LayoutDashboard,
  ShieldPlus,
  TicketCheck,
  Users,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const items = [
  {
    href: "/staff/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    superAdminOnly: true,
  },
  { href: "/staff/users", label: "Users", icon: Users, superAdminOnly: true },
  { href: "/staff/courses", label: "Courses", icon: BookOpen },
  { href: "/staff/enrollments", label: "Enrollments", icon: TicketCheck },
  { href: "/staff/reports", label: "Reports", icon: Flag },
  {
    href: "/staff/certificates",
    label: "Certificates",
    icon: Award,
    superAdminOnly: true,
  },
  {
    href: "/staff/register",
    label: "Create instructor",
    icon: ShieldPlus,
    superAdminOnly: true,
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";

  const visible = items
    .filter((item) => !item.superAdminOnly || isSuperAdmin)
    .map((item) =>
      item.href === "/staff/courses" && !isSuperAdmin
        ? { ...item, label: "My Courses" }
        : item,
    );

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {visible.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/staff/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}