"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, ExternalLink, CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  FilterPills,
  StatusBadge,
  TableShell,
  TableTh,
  TableTd,
} from "@/components/admin/admin-ui";

type ApprovalStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

type CourseAction = "publish" | "reject" | "draft" | "submit" | "delete";

const ACTION_META: Record<
  CourseAction,
  { title: string; description: (title: string) => string; confirm: string; destructive: boolean; toast: string }
> = {
  publish: {
    title: "Approve & publish this course?",
    description: (t) => `"${t}" will be approved and immediately visible to students in the catalog.`,
    confirm: "Approve & publish",
    destructive: false,
    toast: "Course approved and published",
  },
  reject: {
    title: "Reject this course?",
    description: (t) => `"${t}" will be sent back to the instructor as rejected. They can revise and resubmit it.`,
    confirm: "Reject course",
    destructive: true,
    toast: "Course rejected",
  },
  draft: {
    title: "Unpublish this course?",
    description: (t) => `"${t}" will be removed from the catalog. Enrolled students keep their access.`,
    confirm: "Unpublish",
    destructive: true,
    toast: "Course unpublished",
  },
  submit: {
    title: "Submit for review?",
    description: (t) => `"${t}" will be sent to a superadmin for approval before it can be published.`,
    confirm: "Submit for review",
    destructive: false,
    toast: "Submitted for review",
  },
  delete: {
    title: "Delete this course?",
    description: (t) => `"${t}" and all its modules, lessons, and enrollments will be permanently deleted. This cannot be undone.`,
    confirm: "Delete course",
    destructive: true,
    toast: "Course deleted",
  },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING_REVIEW", label: "Pending" },
  { value: "DRAFT", label: "Draft" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_BADGES: Record<ApprovalStatus, "ACTIVE" | "PENDING" | "DRAFT" | "REJECTED"> = {
  APPROVED: "ACTIVE",
  PENDING_REVIEW: "PENDING",
  DRAFT: "DRAFT",
  REJECTED: "REJECTED",
};

interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  price: number;
  isPublished: boolean;
  approvalStatus: ApprovalStatus;
  studentCount: number;
  category: { id: string; name: string } | null;
  _count: { modules: number; enrollments: number };
}

interface CoursesResponse {
  items: AdminCourse[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminCoursesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [status, setStatus] = useState("ALL");
  const [pendingAction, setPendingAction] = useState<{ course: AdminCourse; action: CourseAction } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-courses", status, submitted],
    queryFn: () =>
      apiFetch<CoursesResponse>(
        `/api/staff/courses?status=${status}&pageSize=50${
          submitted ? `&search=${encodeURIComponent(submitted)}` : ""
        }`,
      ),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-courses"] });

  const runAction = async () => {
    if (!pendingAction) return;
    const { course, action } = pendingAction;
    setActionLoading(true);
    try {
      if (action === "delete") {
        await apiFetch(`/api/staff/courses/${course.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/api/staff/courses/${course.id}/${action}`, { method: "POST" });
      }
      toast(ACTION_META[action].toast, "success");
      setPendingAction(null);
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(search.trim());
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={isSuperAdmin ? "Courses" : "My Courses"}
        subtitle={isSuperAdmin ? "Manage and moderate all courses." : "Create, edit, and manage your courses."}
      >
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="w-44 rounded-xl border-0 bg-muted py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>
        <Button asChild className="gap-2 shadow-md shadow-primary/30">
          <Link href="/staff/courses/new">
            <Plus className="size-4" />
            New Course
          </Link>
        </Button>
      </AdminPageHeader>

      <FilterPills
        options={STATUS_FILTERS}
        value={status}
        onChange={(v) => setStatus(v)}
      />

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ) : (
        <TableShell>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <TableTh>Course</TableTh>
                <TableTh>Category</TableTh>
                <TableTh>Status</TableTh>
                <TableTh className="text-center">Modules</TableTh>
                <TableTh className="text-center">Students</TableTh>
                <TableTh className="text-right">Price</TableTh>
                <TableTh className="text-right">Actions</TableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <TableTd colSpan={7} className="py-12 text-center text-muted-foreground">
                    No courses found.
                  </TableTd>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/20">
                    <TableTd className="max-w-[260px]">
                      <p className="truncate font-medium text-foreground">{c.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                    </TableTd>
                    <TableTd className="text-muted-foreground">
                      {c.category?.name ?? "—"}
                    </TableTd>
                    <TableTd>
                      <StatusBadge status={STATUS_BADGES[c.approvalStatus]} />
                    </TableTd>
                    <TableTd className="text-center font-mono">{c._count.modules}</TableTd>
                    <TableTd className="text-center font-mono">{c.studentCount}</TableTd>
                    <TableTd className="text-right font-mono text-emerald-500">
                      ${c.price.toFixed(2)}
                    </TableTd>
                    <TableTd>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild size="icon" variant="ghost" title="Edit">
                          <Link href={`/staff/courses/${c.id}`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                        {isSuperAdmin && c.approvalStatus !== "APPROVED" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Approve & publish"
                            className="text-emerald-500"
                            onClick={() => setPendingAction({ course: c, action: "publish" })}
                          >
                            <CircleCheck className="size-4" />
                          </Button>
                        ) : null}
                        {isSuperAdmin && c.approvalStatus === "PENDING_REVIEW" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Reject"
                            className="text-rose-500"
                            onClick={() => setPendingAction({ course: c, action: "reject" })}
                          >
                            <CircleX className="size-4" />
                          </Button>
                        ) : null}
                        {isSuperAdmin && c.approvalStatus === "APPROVED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingAction({ course: c, action: "draft" })}
                          >
                            Unpublish
                          </Button>
                        ) : null}
                        {!isSuperAdmin &&
                        (c.approvalStatus === "DRAFT" || c.approvalStatus === "REJECTED") ? (
                          <Button
                            size="sm"
                            onClick={() => setPendingAction({ course: c, action: "submit" })}
                          >
                            {c.approvalStatus === "REJECTED" ? "Resubmit" : "Submit"}
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete"
                          className="text-rose-500"
                          onClick={() => setPendingAction({ course: c, action: "delete" })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction ? ACTION_META[pendingAction.action].title : ""}
        description={
          pendingAction
            ? ACTION_META[pendingAction.action].description(pendingAction.course.title)
            : ""
        }
        confirmLabel={pendingAction ? ACTION_META[pendingAction.action].confirm : "Confirm"}
        destructive={pendingAction ? ACTION_META[pendingAction.action].destructive : false}
        loading={actionLoading}
        onConfirm={() => void runAction()}
        onCancel={() => (actionLoading ? undefined : setPendingAction(null))}
      />
    </div>
  );
}
