"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Award,
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  Flag,
  Mail,
  MailOpen,
  Map,
  ShieldAlert,
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
  const [busyId, setBusyId] = useState<string | null>(null);

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

  // A certificate request notification can be responded to directly here.
  const respondToRequest = async (
    notifId: string,
    requestId: string,
    action: "APPROVE" | "REJECT",
  ) => {
    setBusyId(notifId);
    try {
      await apiFetch(`/api/staff/certificate-requests/${requestId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast(
        action === "APPROVE"
          ? "Certificate issued to the student"
          : "Request declined",
        "success",
      );
      void qc.invalidateQueries({ queryKey: ["staff-notifications"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setBusyId(null);
    }
  };

  const requestIdFrom = (item: NotificationItem): string | null => {
    if (item.type !== "CERTIFICATE_REQUESTED" || !item.link) return null;
    const m = item.link.match(/[?&]focus=([^&]+)/);
    return m?.[1] ?? null;
  };

  const renderActions = (n: NotificationItem) => {
    const requestId = requestIdFrom(n);
    if (!requestId || busyId === n.id) {
      if (busyId === n.id) {
        return (
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        );
      }
      return null;
    }
    return (
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => void respondToRequest(n.id, requestId, "APPROVE")}
        >
          <CheckCircle2 className="size-4" />
          Issue
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => void respondToRequest(n.id, requestId, "REJECT")}
        >
          <XCircle className="size-4" />
          Decline
        </Button>
      </div>
    );
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
              const actionable = !!requestIdFrom(n);
              const row = (
                <div
                  className={cn(
                    "flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:gap-3 transition-colors hover:bg-muted/20",
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
                      <button
                        type="button"
                        onClick={() => void setRead(n, !n.read)}
                        title={n.read ? "Mark as unread" : "Mark as read"}
                        aria-label={n.read ? "Mark as unread" : "Mark as read"}
                        className="ml-auto rounded-full p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-primary"
                      >
                        {n.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                      </button>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
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
                    {renderActions(n)}
                  </div>
                </div>
              );
              return actionable ? (
                <div key={n.id}>{row}</div>
              ) : n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => {
                    if (!n.read) void setRead(n, true);
                  }}
                >
                  {row}
                </Link>
              ) : (
                <div key={n.id}>{row}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}