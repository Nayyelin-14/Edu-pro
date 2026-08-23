"use client";

import {
  Award,
  BookOpen,
  Bookmark,
  Flag,
  GraduationCap,
  Map,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarGroup, SidebarItem } from "@/components/app-sidebar";

export function UserNav() {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const userId = user?.id;
  const isSuperAdmin = user?.role === "SUPERADMIN";

  const accountItems: SidebarItem[] = userId
    ? isSuperAdmin
      ? [{ href: `/${userId}/dashboard`, label: t.nav.dashboard, icon: GraduationCap }]
      : [
          { href: `/${userId}/dashboard`, label: t.nav.dashboard, icon: GraduationCap },
          { href: `/${userId}/my-courses`, label: t.nav.myCourses, icon: BookOpen },
          { href: `/${userId}/saved`, label: t.nav.saved, icon: Bookmark },
          { href: `/${userId}/certificates`, label: t.nav.certificates, icon: Award },
          { href: `/${userId}/reports`, label: t.nav.reports, icon: Flag },
          { href: `/${userId}/roadmap`, label: t.nav.roadmaps, icon: Map },
        ]
    : [];

  const groups: SidebarGroup[] = [
    {
      id: "account",
      label: t.nav.groupMyLearning,
      items: accountItems,
    },
  ];

  return (
    <AppSidebar
      groups={groups}
      user={
        user
          ? { username: user.username, email: user.email, avatar: user.avatar }
          : null
      }
      onLogout={() => void logout()}
      logoutLabel={t.common.logout}
    />
  );
}