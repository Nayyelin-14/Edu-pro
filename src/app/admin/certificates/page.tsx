"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

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
    queryFn: () => apiFetch<UserList>("/api/admin/users?pageSize=100"),
  });
  const coursesQuery = useQuery({
    queryKey: ["cert-courses"],
    queryFn: () => apiFetch<CourseList>("/api/admin/courses?pageSize=100"),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ certificate: { number: string; pdfUrl: string | null } }>(
        "/api/admin/issue-certificate",
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
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Issue certificate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manually award a certificate to a student for a course.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Issue</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <select
                id="user"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <select
                id="course"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
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
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading}>
              {loading ? "Issuing…" : "Issue certificate"}
            </Button>
          </form>

          {result && (
            <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-4">
              <p className="font-medium text-emerald-700">Certificate issued.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Number: {result.number}
              </p>
              {result.pdfUrl && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <a href={result.pdfUrl} target="_blank" rel="noreferrer">
                    Download PDF
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
