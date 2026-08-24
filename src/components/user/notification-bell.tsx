"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unread: number;
}

interface NotificationBellProps {
  /**
   * Base path of the notification detail page. When set, items link to
   * `${detailBase}/${id}` instead of the notification's raw link.
   */
  detailBase?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ detailBase }: NotificationBellProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setData(await apiFetch<NotificationsResponse>("/api/me/notifications"));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    if (user) queueMicrotask(() => void load());
  }, [user, load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const markAllRead = async () => {
    try {
      await apiFetch("/api/me/notifications/read", { method: "POST" });
      setData((prev) =>
        prev
          ? { ...prev, unread: 0, items: prev.items.map((n) => ({ ...n, read: true })) }
          : prev,
      );
    } catch {
      /* ignore */
    }
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/me/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read: true }) });
      setData((prev) =>
        prev
          ? {
              ...prev,
              unread: Math.max(0, prev.unread - 1),
              items: prev.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
            }
          : prev,
      );
    } catch {
      /* ignore */
    }
  };

  const removeItem = async (id: string) => {
    const prevSnapshot = data;
    setData((prev) => {
      if (!prev) return prev;
      const removed = prev.items.find((n) => n.id === id);
      return {
        items: prev.items.filter((n) => n.id !== id),
        unread: removed && !removed.read ? Math.max(0, prev.unread - 1) : prev.unread,
      };
    });
    try {
      await apiFetch(`/api/me/notifications/${id}`, { method: "DELETE" });
    } catch {
      setData(prevSnapshot);
    }
  };

  const unread = data?.unread ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-on-error">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <p className="text-label-md font-semibold text-on-surface">Notifications</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                aria-label="Mark all as read"
              >
                <CheckCheck className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!data ? (
              <p className="px-4 py-8 text-center text-label-sm text-on-surface-variant">
                Loading…
              </p>
            ) : data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-label-sm text-on-surface-variant">
                No notifications yet
              </p>
            ) : (
              data.items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group relative border-b border-outline-variant/60 transition-colors hover:bg-surface-container-low",
                    !n.read && "bg-primary-container/10",
                  )}
                >
                  <Link
                    href={detailBase ? `${detailBase}/${n.id}` : n.link ?? "#"}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read) void markRead(n.id);
                    }}
                    className="flex flex-col gap-0.5 px-4 py-3 pr-10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-label-md font-semibold text-on-surface">
                        {n.title}
                      </p>
                      <span className="shrink-0 text-label-xs text-on-surface-variant">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    {n.body ? (
                      <p className="text-label-sm text-on-surface-variant">{n.body}</p>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      void removeItem(n.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-on-surface-variant/60 transition-colors hover:bg-error/10 hover:text-error"
                    aria-label="Delete notification"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}