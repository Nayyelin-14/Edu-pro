"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, Bell, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type ItemKey =
  | "home"
  | "courses"
  | "profile"
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
    { href: `/${userId}/profile`, key: "profile", icon: "person" },
    { href: `/${userId}/my-courses`, key: "myCourses", icon: "school" },
    { href: `/${userId}/saved`, key: "saved", icon: "bookmark" },
    { href: `/${userId}/certificates`, key: "certificates", icon: "workspace_premium" },
    { href: `/${userId}/reports`, key: "reports", icon: "analytics" },
    { href: `/${userId}/roadmap`, key: "roadmaps", icon: "timeline" },
  ];

  const tKeys: Record<ItemKey, string> = {
    home: t.nav.home,
    courses: t.nav.courses,
    profile: t.nav.profile,
    myCourses: t.nav.myCourses,
    saved: t.nav.saved,
    reports: t.nav.reports,
    certificates: t.nav.certificates,
    roadmaps: t.nav.roadmaps,
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-navbar-height items-center justify-between gap-4 border-b border-outline-variant bg-surface px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" className="text-title-lg font-bold text-primary">
            EduPro
          </Link>
        </div>

        <div className="hidden flex-1 items-center gap-1 md:flex">
          <Link
            href="/"
            className={cn(
              "px-2 py-2 text-label-md transition-colors hover:text-primary",
              isActive("/") ? "font-semibold text-primary" : "text-on-surface-variant",
            )}
          >
            {t.nav.home}
          </Link>
          <Link
            href="/courses"
            className={cn(
              "px-2 py-2 text-label-md transition-colors hover:text-primary",
              isActive("/courses") ? "font-semibold text-primary" : "text-on-surface-variant",
            )}
          >
            {t.nav.courses}
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            aria-label={t.common.search}
          >
            <Search className="size-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "th" : "en")}
            className="hidden rounded-full px-3 py-1.5 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary sm:flex"
            aria-label="Switch language"
          >
            {locale === "en" ? "ไทย" : "EN"}
          </button>
          <ThemeToggle />
          {user && (
            <Link
              href={`/${userId}/profile`}
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
            className="absolute inset-0 bg-on-surface/50"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between px-margin-mobile py-stack-md">
              <span className="text-title-lg font-bold text-primary">EduPro</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                aria-label={t.common.close}
              >
                <X className="size-5" />
              </button>
            </div>
            {user && (
              <div className="mx-margin-mobile mb-2 flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                <Avatar
                  src={user.avatar}
                  fallback={user.username}
                  alt={user.username}
                />
                <div className="min-w-0">
                  <p className="truncate text-label-md font-semibold text-on-surface">
                    {user.username}
                  </p>
                  <p className="truncate text-label-sm text-on-surface-variant">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-margin-mobile">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3 text-label-md font-medium transition-colors",
                      active
                        ? "bg-primary-container/10 font-semibold text-primary"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-primary",
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