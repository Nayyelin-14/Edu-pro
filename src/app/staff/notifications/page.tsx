"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Award,
  Bell,
  BookOpen,
  CheckCheck,
  Flag,
  Mail,
  MailOpen,
  Map,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; username: string; avatar: string | null } | null;
  course: { id: string; title: string } | null;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unread: number;
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

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  COURSE_APPROVED: BookOpen,
  COURSE_REJECTED: XCircle,
  COURSE_SUBMITTED: BookOpen,
  COURSE_ENROLLED: BookOpen,
  CERTIFICATE_REQUESTED: Award,
  CERTIFICATE_ISSUED: Award,
  CERTIFICATE_REJECTED: XCircle,
  ROADMAP_READY: Map,
  REPORT_RESOLVED: Flag,
  SYSTEM: ShieldAlert,
};

export default function StaffNotificationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-notifications"],
    queryFn: () =>
      apiFetch<NotificationsResponse>("/api/me/notifications?limit=50"),
  });

  const items = data?.items ?? [];

  const markAllRead = async () => {
    try {
      await apiFetch("/api/me/notifications/read", { method: "POST" });
      toast("All notifications marked as read", "success");
      void qc.invalidateQueries({ queryKey: ["staff-notifications"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const setRead = async (n: NotificationItem, read: boolean) => {
    try {
      await apiFetch(`/api/me/notifications/${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({ read }),
      });
      void qc.invalidateQueries({ queryKey: ["staff-notifications"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const remove = async (n: NotificationItem) => {
    setDeletingId(n.id);
    try {
      await apiFetch(`/api/me/notifications/${n.id}`, { method: "DELETE" });
      void qc.invalidateQueries({ queryKey: ["staff-notifications"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Notifications"
        subtitle="Alerts from your courses and the platform."
      >
        {data?.unread ? (
          <Button variant="outline" className="gap-2" onClick={() => void markAllRead()}>
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        ) : null}
      </AdminPageHeader>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Bell className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-semibold text-foreground">No notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border/40">
            {items.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              return (
                <div key={n.id} className="relative">
                  <Link
                    href={`/staff/notifications/${n.id}`}
                    onClick={() => {
                      if (!n.read) void setRead(n, true);
                    }}
                    className={cn(
                      "flex flex-col gap-1 px-5 py-4 pr-24 sm:flex-row sm:items-start sm:gap-3 transition-colors hover:bg-muted/20",
                      !n.read && "bg-primary/[0.04]",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-xl",
                        n.read
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-sm",
                            n.read ? "font-medium text-foreground" : "font-semibold text-foreground",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="size-1.5 flex-shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      )}
                      {n.actor && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary/80">
                          from {n.actor.username}
                          {n.course ? (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span className="text-muted-foreground">{n.course.title}</span>
                            </>
                          ) : null}
                        </p>
                      )}
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {n.type} · {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </Link>
                  <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        void setRead(n, !n.read);
                      }}
                      title={n.read ? "Mark as unread" : "Mark as read"}
                      aria-label={n.read ? "Mark as unread" : "Mark as read"}
                      className="rounded-full p-2 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-primary"
                    >
                      {n.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === n.id}
                      onClick={(e) => {
                        e.preventDefault();
                        void remove(n);
                      }}
                      title="Delete notification"
                      aria-label="Delete notification"
                      className="rounded-full p-2 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
