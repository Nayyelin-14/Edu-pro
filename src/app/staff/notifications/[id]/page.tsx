"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Bell,
  BookOpen,
  ExternalLink,
  Flag,
  MailOpen,
  Map,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

interface NotificationDetail {
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

export default function NotificationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<NotificationDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<NotificationDetail>(`/api/me/notifications/${id}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        if (!res.read) {
          void apiFetch(`/api/me/notifications/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ read: true }),
          }).catch(() => undefined);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Notification not found");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Notification" subtitle="Something went wrong." />
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Bell className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            {error || "Notification not found"}
          </h3>
          <Button asChild variant="outline" className="mt-4 gap-2">
            <Link href="/staff/notifications">
              <ArrowLeft className="size-4" />
              Back to notifications
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const Icon = TYPE_ICON[data.type] ?? Bell;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/staff/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All notifications
      </Link>

      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-xl",
              data.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{data.title}</h1>
              {!data.read && (
                <>
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    <MailOpen className="size-3" />
                    New
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {data.type} · {new Date(data.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {data.body && (
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {data.body}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          {data.actor && (
            <p className="text-xs text-muted-foreground">
              from{" "}
              <span className="font-medium text-foreground">{data.actor.username}</span>
            </p>
          )}
          {data.course && (
            <p className="text-xs text-muted-foreground">
              course{" "}
              <Link
                href={`/staff/courses/${data.course.id}`}
                className="font-medium text-primary hover:underline"
              >
                {data.course.title}
              </Link>
            </p>
          )}
          {data.link && (
            <Button asChild className="ml-auto gap-2">
              <Link href={data.link}>
                Open related page
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
