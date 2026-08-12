"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const items = [
  { href: "/profile", key: "profile", icon: "person" },
  { href: "/my-courses", key: "myCourses", icon: "school" },
  { href: "/saved", key: "saved", icon: "bookmark" },
  { href: "/certificates", key: "certificates", icon: "workspace_premium" },
  { href: "/reports", key: "reports", icon: "analytics" },
] as const;

type ItemKey = (typeof items)[number]["key"];

export function UserNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const tKeys: Record<ItemKey, string> = {
    profile: t.nav.profile,
    myCourses: t.nav.myCourses,
    saved: t.nav.saved,
    reports: t.nav.reports,
    certificates: t.nav.certificates,
  };

  return (
    <nav className="flex flex-col gap-2 py-stack-lg px-margin-desktop h-full">
      <div className="flex items-center gap-4 mb-stack-lg">
        <div className="w-10 h-10 bg-primary-container rounded flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined">school</span>
        </div>
        <div>
          <div className="text-headline-md font-headline-md font-bold text-on-surface">EduPro</div>
          <div className="text-label-sm font-label-sm text-on-surface-variant">My Account</div>
        </div>
      </div>
      <ul className="flex-1 flex flex-col gap-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-lg text-label-md font-label-md transition-colors",
                  active
                    ? "text-primary font-bold border-l-4 border-primary bg-primary-container/10 translate-x-1"
                    : "text-on-secondary-container hover:bg-surface-container hover:text-primary"
                )}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{tKeys[item.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="mt-auto space-y-2 border-t border-outline-variant pt-4">
        <li>
          <Link
            href="/settings"
            className="flex items-center gap-4 px-4 py-3 rounded-lg text-label-md font-label-md text-on-secondary-container hover:bg-surface-container hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </Link>
        </li>
        <li>
          <Link
            href="/help"
            className="flex items-center gap-4 px-4 py-3 rounded-lg text-label-md font-label-md text-on-secondary-container hover:bg-surface-container hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">help</span>
            <span>Help</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}