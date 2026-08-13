"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Bookmark, Flag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 4;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();

  const userId = user?.id;
  const items = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: `/${userId}/my-courses`, label: t.nav.myCourses, icon: BookOpen },
    { href: `/${userId}/saved`, label: t.nav.saved, icon: Bookmark },
    { href: `/${userId}/reports`, label: t.nav.reports, icon: Flag },
  ].slice(0, MAX_VISIBLE);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-label-sm transition-colors",
                active
                  ? "font-semibold text-primary"
                  : "text-on-surface-variant hover:text-primary",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="line-clamp-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}