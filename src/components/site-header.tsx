"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader() {
  const { user, logout, loading } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isStaff = user?.role === "INSTRUCTOR" || user?.role === "SUPERADMIN";

  const links = [
    { href: "/about", label: t.nav.about },
    { href: "/courses", label: t.nav.courses },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className="sticky top-0 left-0 z-50 w-full border-b border-outline-variant bg-surface transition-all duration-200"
    >
      <div className="mx-auto flex h-navbar-height max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-gutter">
          <Link
            href="/"
            className="flex items-center gap-2 text-title-lg font-bold text-primary"
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              school
            </span>
            EduPro
          </Link>
          <div className="ml-8 hidden gap-6 md:flex">
            {links.map((l) => {
              const active =
                l.href === "/about"
                  ? pathname === "/about"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-label-md px-1 py-4 transition-all duration-200 ${
                    active
                      ? "border-b-2 border-primary font-bold text-primary"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            aria-label="Notifications"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">
              notifications
            </span>
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>

          <div className="flex items-center gap-2">
            {loading ? null : user ? (
              <>
                {isStaff && (
                  <Link
                    href="/admin/dashboard"
                    className="hidden items-center gap-1 px-2 py-2 text-label-md text-on-surface-variant transition-colors hover:text-primary sm:flex"
                  >
                    <LayoutDashboard className="size-4" />
                    {t.nav.admin}
                  </Link>
                )}
                <Link
                  href={`/${user.id}/profile`}
                  className="hidden px-2 py-2 text-label-md text-on-surface-variant transition-colors hover:text-primary sm:block"
                >
                  {user.username}
                </Link>
                <button
                  aria-label={t.common.logout}
                  onClick={() => void logout()}
                  className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden border border-outline px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low sm:block"
                >
                  {t.common.login}
                </Link>
                <Link
                  href="/register"
                  className="rounded bg-primary-container px-4 py-2 text-label-md text-white transition-colors hover:bg-primary-fixed-variant"
                >
                  {t.common.register}
                </Link>
              </>
            )}
          </div>

          <button
            className="flex items-center md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-outline-variant bg-surface px-margin-mobile py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {user ? (
                <>
                  {isStaff && (
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setOpen(false)}
                      className="rounded border border-outline px-4 py-2 text-label-md text-on-surface"
                    >
                      {t.nav.admin}
                    </Link>
                  )}
                  <Link
                    href={`/${user.id}/profile`}
                    onClick={() => setOpen(false)}
                    className="rounded border border-outline px-4 py-2 text-label-md text-on-surface"
                  >
                    {user.username}
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="rounded border border-outline px-4 py-2 text-label-md text-on-surface"
                  >
                    {t.common.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded border border-outline px-4 py-2 text-label-md text-on-surface"
                  >
                    {t.common.login}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded bg-primary-container px-4 py-2 text-label-md text-white"
                  >
                    {t.common.register}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </nav>
  );
}
