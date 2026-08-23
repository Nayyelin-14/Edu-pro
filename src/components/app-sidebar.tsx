"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

export interface SidebarItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional stable key for React list rendering (defaults to `href`). */
  key?: string;
  /** Match the pathname exactly (defaults to prefix matching). */
  exact?: boolean;
  /** Custom pathname matcher — overrides `exact`/prefix matching. */
  match?: (pathname: string) => boolean;
}

export interface SidebarGroup {
  id: string;
  label: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
}

export interface SidebarUser {
  username: string;
  email: string;
  avatar?: string | null;
}

interface AppSidebarProps {
  groups: SidebarGroup[];
  user: SidebarUser | null;
  bottomItems?: SidebarItem[];
  onLogout?: () => void;
  logoutLabel?: string;
}

export function AppSidebar({
  groups,
  user,
  bottomItems = [],
  onLogout,
  logoutLabel = "Sign out",
}: AppSidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  const [open, setOpen] = useState<Record<string, boolean>>(
    groups.reduce<Record<string, boolean>>((acc, g) => {
      acc[g.id] = g.defaultOpen ?? true;
      return acc;
    }, {}),
  );
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const isActive = (item: SidebarItem) =>
    item.match
      ? item.match(pathname)
      : item.exact
        ? pathname === item.href
        : pathname.startsWith(item.href);

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-xl text-sm font-medium transition-all duration-150",
      collapsed ? "justify-center py-2" : "gap-2.5 px-3 py-2",
      active
        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
        : "text-sidebar-foreground hover:bg-sidebar-accent",
    );

  const ItemLink = ({ item }: { item: SidebarItem }) => {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={linkClass(active)}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        {!collapsed && <span className="truncate text-xs">{item.label}</span>}
        {!collapsed && active && (
          <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-70" />
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-200",
        collapsed ? "w-20" : "w-sidebar-width",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "py-[18px] border-b border-sidebar-border flex-shrink-0 flex items-center",
          collapsed ? "justify-center" : "px-5",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-extrabold text-[17px] text-sidebar-foreground tracking-tight">
              EduPro
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
        {collapsed ? (
          <div className="space-y-0.5">
            {groups.flatMap((g) => g.items).map((item) => (
              <ItemLink key={item.key ?? item.href} item={item} />
            ))}
          </div>
        ) : (
          groups.map((group) => {
            const isOpen = open[group.id] ?? true;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-2">
                        {group.items.map((item) => (
                          <ItemLink key={item.key ?? item.href} item={item} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0 space-y-1">
        {collapsed ? (
          <>
            {bottomItems.map((item) => (
              <ItemLink key={item.key ?? item.href} item={item} />
            ))}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title={logoutLabel}
                className="w-full flex items-center justify-center rounded-xl py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
              >
                <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="w-full flex items-center justify-center rounded-xl py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
            >
              <ChevronsRight className="h-3.5 w-3.5 flex-shrink-0" />
            </button>
          </>
        ) : (
          <>
            {bottomItems.length > 0 && (
              <div className="space-y-0.5">
                {bottomItems.map((item) => (
                  <ItemLink key={item.key ?? item.href} item={item} />
                ))}
              </div>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
              >
                <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{logoutLabel}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
            >
              <ChevronsLeft className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Collapse</span>
            </button>
          </>
        )}
        {user && (
          <div
            className={cn(
              "flex items-center gap-3 py-2 pt-3 border-t border-sidebar-border mt-1",
              collapsed ? "justify-center px-0" : "px-3",
            )}
          >
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt={user.username}
                className="h-9 w-9 rounded-full object-cover flex-shrink-0 border border-sidebar-border"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center flex-shrink-0 font-semibold text-white text-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">
                  {user.username}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}