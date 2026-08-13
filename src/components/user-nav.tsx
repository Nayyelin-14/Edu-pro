"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

type ItemKey =
  | "home"
  | "courses"
  | "profile"
  | "myCourses"
  | "saved"
  | "certificates"
  | "reports"
  | "roadmaps";

export function UserNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();

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

  return (
    <nav className="flex h-full flex-col gap-6 px-margin-desktop py-stack-lg">
      <Link href="/" className="flex items-center gap-3" aria-label="EduPro">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
          <span className="material-symbols-outlined">school</span>
        </span>
        <span>
          <span className="block text-headline-md font-bold leading-tight text-on-surface">
            EduPro
          </span>
          <span className="block text-label-sm text-on-surface-variant">
            {t.nav.home}
          </span>
        </span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-4 rounded-xl px-4 py-3 text-label-md font-medium transition-colors",
                  active
                    ? "bg-primary-container/10 font-semibold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined",
                    active && "text-primary",
                  )}
                  style={
                    active ? { fontVariationSettings: "'FILL' 1" } : undefined
                  }
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span>{tKeys[item.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-outline-variant pt-4">
        {user && (
          <div className="mb-3 flex items-center gap-3 px-2">
            <Avatar
              src={user.avatar}
              fallback={user.username}
              alt={user.username}
              size="sm"
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
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            logout
          </span>
          <span>{t.common.logout}</span>
        </button>
      </div>
    </nav>
  );
}
