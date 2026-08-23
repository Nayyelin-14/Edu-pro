"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Download, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  Field,
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

export default function AdminCertificatesPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ number: string; pdfUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["cert-users"],
    queryFn: () => apiFetch<UserList>("/api/staff/users?pageSize=100"),
  });
  const coursesQuery = useQuery({
    queryKey: ["cert-courses"],
    queryFn: () => apiFetch<CourseList>("/api/staff/courses?pageSize=100"),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ certificate: { number: string; pdfUrl: string | null } }>(
        "/api/staff/issue-certificate",
        {
          method: "POST",
          body: JSON.stringify({ userId, courseId }),
        },
      );
      setResult(data.certificate);
      toast("Certificate issued", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <AdminPageHeader
        title="Certificates"
        subtitle="Manually award a certificate to a student for a course."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
            <Award className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Issue certificate</h3>
            <p className="text-xs text-muted-foreground">
              The certificate number is generated automatically.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="User">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className={adminSelectClass}
            >
              <option value="" disabled>
                Select a user
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

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Issue automatically when a student finishes a course is handled by the platform.
            </p>
            <Button type="submit" disabled={loading} className="gap-2">
              <BadgeCheck className="size-4" />
              {loading ? "Issuing…" : "Issue certificate"}
            </Button>
          </div>
        </form>

        {result && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="flex items-center gap-2 font-medium text-emerald-500">
              <BadgeCheck className="size-4" />
              Certificate issued
            </p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              Number: {result.number}
            </p>
            {result.pdfUrl && (
              <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
                <a href={result.pdfUrl} target="_blank" rel="noreferrer">
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