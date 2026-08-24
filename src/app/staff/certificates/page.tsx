"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Download, BadgeCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  Avi,
  Field,
  TableShell,
  TableTh,
  TableTd,
  adminSelectClass,
} from "@/components/admin/admin-ui";

interface UserOption {
  id: string;
  username: string;
  email: string;
}

interface CourseOption {
  id: string;
  title: string;
}

interface UserList {
  items: UserOption[];
}

interface CourseList {
  items: CourseOption[];
}

interface CertificateRow {
  id: string;
  certificateNumber: string;
  pdfUrl: string | null;
  issuedAt: string;
  user: { id: string; username: string; email: string; avatar: string | null };
  course: { id: string; title: string; slug: string };
}

interface CertificatesResponse {
  items: CertificateRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminCertificatesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);

  // Issue form state
  const [userId, setUserId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [issueError, setIssueError] = useState("");
  const [issueResult, setIssueResult] = useState<{ number: string; pdfUrl: string | null } | null>(null);
  const [issuing, setIssuing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-certificates", page, submitted],
    queryFn: () =>
      apiFetch<CertificatesResponse>(
        `/api/staff/certificates?page=${page}&pageSize=20${
          submitted ? `&search=${encodeURIComponent(submitted)}` : ""
        }`,
      ),
  });

  const usersQuery = useQuery({
    queryKey: ["cert-users"],
    queryFn: () => apiFetch<UserList>("/api/staff/users?pageSize=100"),
  });
  const coursesQuery = useQuery({
    queryKey: ["cert-courses"],
    queryFn: () => apiFetch<CourseList>("/api/staff/courses?pageSize=100"),
  });

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmitted(search.trim());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setIssueError("");
    setIssueResult(null);
    setIssuing(true);
    try {
      const res = await apiFetch<{ certificate: { number: string; pdfUrl: string | null } }>(
        "/api/staff/issue-certificate",
        {
          method: "POST",
          body: JSON.stringify({ userId, courseId }),
        },
      );
      setIssueResult(res.certificate);
      toast("Certificate issued", "success");
      void qc.invalidateQueries({ queryKey: ["admin-certificates"] });
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIssuing(false);
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Certificates"
        subtitle="Every certificate issued on the platform — who earned it, and for which course."
      >
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, course, or number..."
            className="w-56 rounded-xl border-0 bg-muted py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>
      </AdminPageHeader>

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
                <TableTh>Student</TableTh>
                <TableTh>Course</TableTh>
                <TableTh>Certificate #</TableTh>
                <TableTh>Issued</TableTh>
                <TableTh className="text-right">PDF</TableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <TableTd colSpan={5} className="py-12 text-center text-muted-foreground">
                    No certificates issued yet.
                  </TableTd>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/20">
                    <TableTd>
                      <div className="flex items-center gap-2.5">
                        <Avi name={c.user.username} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{c.user.username}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.user.email}</p>
                        </div>
                      </div>
                    </TableTd>
                    <TableTd className="max-w-[220px]">
                      <Link
                        href={`/courses/${c.course.slug}`}
                        className="truncate text-foreground hover:text-primary hover:underline"
                      >
                        {c.course.title}
                      </Link>
                    </TableTd>
                    <TableTd className="font-mono text-xs text-muted-foreground">
                      {c.certificateNumber}
                    </TableTd>
                    <TableTd className="font-mono text-xs text-muted-foreground">
                      {new Date(c.issuedAt).toLocaleDateString()}
                    </TableTd>
                    <TableTd className="text-right">
                      {c.pdfUrl ? (
                        <Button asChild size="icon" variant="ghost" title="Download PDF">
                          <a href={c.pdfUrl} target="_blank" rel="noreferrer">
                            <Download className="size-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 2), Math.min(totalPages, page + 2))
              .map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
            <Award className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Issue certificate manually</h3>
            <p className="text-xs text-muted-foreground">
              The certificate number is generated automatically.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Student">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className={adminSelectClass}
            >
              <option value="" disabled>
                Select a student
              </option>
              {(usersQuery.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course">
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              className={adminSelectClass}
            >
              <option value="" disabled>
                Select a course
              </option>
              {(coursesQuery.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>

          {issueError && <Alert variant="error">{issueError}</Alert>}

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={issuing} className="gap-2">
              <BadgeCheck className="size-4" />
              {issuing ? "Issuing…" : "Issue certificate"}
            </Button>
          </div>
        </form>

        {issueResult && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="flex items-center gap-2 font-medium text-emerald-500">
              <BadgeCheck className="size-4" />
              Certificate issued
            </p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              Number: {issueResult.number}
            </p>
            {issueResult.pdfUrl && (
              <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
                <a href={issueResult.pdfUrl} target="_blank" rel="noreferrer">
                  <Download className="size-3.5" />
                  Download PDF
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
