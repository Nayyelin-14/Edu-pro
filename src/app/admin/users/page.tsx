"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  isBanned: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { enrollments: number; certificates: number };
}

interface UsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, submitted],
    queryFn: () =>
      apiFetch<UsersResponse>(
        `/api/admin/users?page=${page}&pageSize=20${
          submitted ? `&search=${encodeURIComponent(submitted)}` : ""
        }`,
      ),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-users"] });

  const toggleBan = async (u: AdminUser) => {
    try {
      await apiFetch(`/api/admin/users/${u.id}/${u.isBanned ? "unrestrict" : "restrict"}`, {
        method: "POST",
      });
      toast(u.isBanned ? "User unrestricted" : "User restricted", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const changeRole = async (u: AdminUser, role: string) => {
    try {
      await apiFetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast("Role updated", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmitted(search.trim());
  };

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const isSuper = me?.role === "SUPERADMIN";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      <form onSubmit={submitSearch} className="flex max-w-md gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
        />
        <Button type="submit">Search</Button>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.username}</span>
                      <Badge variant="outline">{u.role}</Badge>
                      {u.isBanned && <Badge variant="destructive">Banned</Badge>}
                      {!u.emailVerifiedAt && (
                        <Badge variant="warning">Unverified</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {u.email} · {u._count.enrollments} enrollments ·{" "}
                      {u._count.certificates} certificates
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSuper && (
                      <Select
                        value={u.role}
                        onChange={(e) => void changeRole(u, e.target.value)}
                        className="h-8 w-32"
                      >
                        <option value="STUDENT">Student</option>
                        <option value="INSTRUCTOR">Instructor</option>
                        <option value="SUPERADMIN">Superadmin</option>
                      </Select>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleBan(u)}
                    >
                      {u.isBanned ? "Unrestrict" : "Restrict"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="flex items-center px-2 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
