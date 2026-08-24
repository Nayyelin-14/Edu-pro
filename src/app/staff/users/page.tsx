"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  Avi,
  FilterPills,
  RoleBadge,
  StatusBadge,
  TableShell,
  TableTh,
  TableTd,
} from "@/components/admin/admin-ui";

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

const ROLE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "STUDENT", label: "Student" },
  { value: "INSTRUCTOR", label: "Instructor" },
  { value: "SUPERADMIN", label: "Superadmin" },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banLoading, setBanLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, submitted, roleFilter],
    queryFn: () =>
      apiFetch<UsersResponse>(
        `/api/staff/users?page=${page}&pageSize=20${
          submitted ? `&search=${encodeURIComponent(submitted)}` : ""
        }${roleFilter !== "ALL" ? `&role=${roleFilter}` : ""}`,
      ),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-users"] });

  const toggleBan = async (u: AdminUser) => {
    setBanLoading(true);
    try {
      await apiFetch(`/api/staff/users/${u.id}/${u.isBanned ? "unrestrict" : "restrict"}`, {
        method: "POST",
      });
      toast(u.isBanned ? "User unrestricted" : "User restricted", "success");
      setBanTarget(null);
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setBanLoading(false);
    }
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmitted(search.trim());
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const isSuper = me?.role === "SUPERADMIN";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="User Management"
        subtitle="Manage roles, access, and account status."
      >
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-44 rounded-xl border-0 bg-muted py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>
      </AdminPageHeader>

      <FilterPills
        options={ROLE_FILTERS}
        value={roleFilter}
        onChange={(v) => {
          setRoleFilter(v);
          setPage(1);
        }}
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
                <TableTh>User</TableTh>
                <TableTh>Role</TableTh>
                <TableTh>Enrollments</TableTh>
                <TableTh>Joined</TableTh>
                <TableTh>Status</TableTh>
                <TableTh className="text-right">Actions</TableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <TableTd colSpan={6} className="py-12 text-center text-muted-foreground">
                    No users found.
                  </TableTd>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/20">
                    <TableTd>
                      <div className="flex items-center gap-2.5">
                        <Avi name={u.username} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{u.username}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableTd>
                    <TableTd>
                      <RoleBadge role={u.role} />
                    </TableTd>
                    <TableTd className="font-mono">{u._count.enrollments}</TableTd>
                    <TableTd className="font-mono text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableTd>
                    <TableTd>
                      {u.isBanned ? (
                        <StatusBadge status="BANNED" />
                      ) : !u.emailVerifiedAt ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          Unverified
                        </span>
                      ) : (
                        <StatusBadge status="ACTIVE" />
                      )}
                    </TableTd>
                    <TableTd className="text-right">
                      {isSuper && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={u.isBanned ? "gap-1.5 text-emerald-500" : "gap-1.5 text-rose-500"}
                          onClick={() => setBanTarget(u)}
                        >
                          {u.isBanned ? (
                            <>
                              <ShieldCheck className="size-3" />
                              Unban
                            </>
                          ) : (
                            <>
                              <Ban className="size-3" />
                              Ban
                            </>
                          )}
                        </Button>
                      )}
                    </TableTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      <ConfirmDialog
        open={!!banTarget}
        title={banTarget?.isBanned ? "Unban this user?" : "Ban this user?"}
        description={
          banTarget?.isBanned
            ? `${banTarget?.username} will regain full access to the platform.`
            : `${banTarget?.username} will be immediately signed out and blocked from signing in until unbanned.`
        }
        confirmLabel={banTarget?.isBanned ? "Unban user" : "Ban user"}
        destructive={!banTarget?.isBanned}
        loading={banLoading}
        onConfirm={() => banTarget && void toggleBan(banTarget)}
        onCancel={() => (banLoading ? undefined : setBanTarget(null))}
      />

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
    </div>
  );
}
