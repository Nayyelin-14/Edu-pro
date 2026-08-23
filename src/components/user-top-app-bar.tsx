"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/user/notification-bell";
import { cn } from "@/lib/utils";

type ItemKey =
  | "home"
  | "courses"
  | "dashboard"
  | "myCourses"
  | "saved"
  | "certificates"
  | "reports"
  | "roadmaps";

export function UserTopAppBar() {
  const { user } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const userId = user?.id;

  const items: { href: string; key: ItemKey; icon: string }[] = [
    { href: "/", key: "home", icon: "home" },
    { href: "/courses", key: "courses", icon: "menu_book" },
    { href: `/${userId}/dashboard`, key: "dashboard", icon: "dashboard" },
    { href: `/${userId}/my-courses`, key: "myCourses", icon: "school" },
    { href: `/${userId}/saved`, key: "saved", icon: "bookmark" },
    { href: `/${userId}/certificates`, key: "certificates", icon: "workspace_premium" },
    { href: `/${userId}/reports`, key: "reports", icon: "analytics" },
    { href: `/${userId}/roadmap`, key: "roadmaps", icon: "timeline" },
  ];

  const tKeys: Record<ItemKey, string> = {
    home: t.nav.home,
    courses: t.nav.courses,
    dashboard: t.nav.dashboard,
    myCourses: t.nav.myCourses,
    saved: t.nav.saved,
    reports: t.nav.reports,
    certificates: t.nav.certificates,
    roadmaps: t.nav.roadmaps,
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const iconBtn =
    "rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6">
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={iconBtn}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" className="text-lg font-bold text-primary">
            EduPro
          </Link>
        </div>

        <div className="hidden flex-1 items-center gap-1 md:flex">
          <Link
            href="/"
            className={cn(
              "px-2 py-2 text-sm transition-colors hover:text-primary",
              isActive("/") ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {t.nav.home}
          </Link>
          <Link
            href="/courses"
            className={cn(
              "px-2 py-2 text-sm transition-colors hover:text-primary",
              isActive("/courses") ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {t.nav.courses}
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" className={iconBtn} aria-label={t.common.search}>
            <Search className="size-5" />
          </button>
          <NotificationBell />
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "th" : "en")}
            className="hidden rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            aria-label="Switch language"
          >
            {locale === "en" ? "ไทย" : "EN"}
          </button>
          <ThemeToggle />
          {user && (
            <Link
              href={`/${userId}/dashboard`}
              aria-label={user.username}
              className="rounded-full transition-opacity hover:opacity-80"
            >
              <Avatar
                src={user.avatar}
                fallback={user.username}
                alt={user.username}
                size="sm"
              />
            </Link>
          )}
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-sidebar shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
              <span className="text-lg font-bold text-sidebar-foreground">EduPro</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                aria-label={t.common.close}
              >
                <X className="size-5" />
              </button>
            </div>
            {user && (
              <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent p-3">
                <Avatar
                  src={user.avatar}
                  fallback={user.username}
                  alt={user.username}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">
                    {user.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span>{tKeys[item.key]}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}