"use client";

import {
  Award,
  Bell,
  BookOpen,
  Flag,
  LayoutDashboard,
  ShieldPlus,
  TicketCheck,
  UserRound,
  Users,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarGroup, SidebarItem } from "@/components/app-sidebar";

interface AdminSidebarProps {
  user: { id: string; role: string; username: string; email: string; avatar?: string | null };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const isSuperAdmin = user.role === "SUPERADMIN";

  const adminItems: SidebarItem[] = [
    { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/staff/notifications", label: "Notifications", icon: Bell, exact: true },
    { href: "/staff/profile", label: "Profile", icon: UserRound, exact: true },
    ...(isSuperAdmin
      ? [
          { href: "/staff/users", label: "Users", icon: Users },
        ]
      : []),
    {
      href: "/staff/courses",
      label: isSuperAdmin ? "Courses" : "My Courses",
      icon: BookOpen,
      // Highlight only on the management list — not on /new or /[id] (those have
      // their own tabs below).
      match: (p: string) =>
        p === "/staff/courses" ||
        (!p.startsWith("/staff/courses/new") &&
          p.startsWith("/staff/courses") &&
          !/\/staff\/courses\/[^/]+$/.test(p)),
    },
    { href: "/staff/enrollments", label: "Enrollments", icon: TicketCheck },
    { href: "/staff/reports", label: "Reports", icon: Flag },
    ...(isSuperAdmin
      ? [{ href: "/staff/certificates", label: "Certificates", icon: Award }]
      : []),
    ...(isSuperAdmin
      ? [{ href: "/staff/register", label: "Register Staff", icon: ShieldPlus }]
      : []),
  ];

  const groups: SidebarGroup[] = [
    { id: "staff", label: "Management", items: adminItems },
  ];

  return (
    <AppSidebar
      groups={groups}
      user={{
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      }}
    />
  );
}
