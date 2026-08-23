"use client";

import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Flag,
  HelpCircle,
  LayoutDashboard,
  Settings,
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
    ...(isSuperAdmin
      ? [
          { href: `/${user.id}/profile`, label: "Profile", icon: UserRound },
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
    {
      href: "/staff/certificate-requests",
      label: "Certificate Requests",
      icon: Award,
      exact: true,
    },
    { href: "/staff/reports", label: "Reports", icon: Flag },
    { href: "/staff/analytics", label: "Analytics", icon: BarChart3 },
    ...(isSuperAdmin
      ? [{ href: "/staff/certificates", label: "Certificates", icon: Award }]
      : []),
    ...(isSuperAdmin
      ? [{ href: "/staff/register", label: "Register Staff", icon: ShieldPlus }]
      : []),
  ];

  const bottomItems: SidebarItem[] = [
    { href: "/staff/settings", label: "Settings", icon: Settings },
    { href: "/staff/help", label: "Help", icon: HelpCircle },
  ];

  const groups: SidebarGroup[] = [
    { id: "staff", label: "Management", items: adminItems },
  ];

  return (
    <AppSidebar
      groups={groups}
      bottomItems={bottomItems}
      user={{
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      }}
    />
  );
}
