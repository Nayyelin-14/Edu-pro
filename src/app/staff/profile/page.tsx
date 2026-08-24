"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader, Field } from "@/components/admin/admin-ui";
import { apiFetch } from "@/lib/api-client";
import type { PublicUser } from "@/types/user";

export default function StaffProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  // Profile form
  const [username, setUsername] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  if (!user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const usernameValue = username || user.username;
  const is2faEnabled = user.twoStep !== "DISABLED";

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileLoading(true);
    try {
      const data = await apiFetch<{ user: PublicUser }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ username: usernameValue }),
      });
      setUser(data.user);
      setUsername("");
      toast("Profile updated", "success");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordLoading(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed", "success");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Profile"
        subtitle="Your account details and security."
      />

      {/* Account info */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar
            src={user.avatar}
            fallback={user.username}
            alt={user.username}
            size="xl"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{user.username}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                <UserRound className="mr-1 size-3" />
                {user.role.toLowerCase().replace("_", " ")}
              </Badge>
              <Badge variant={is2faEnabled ? "success" : "outline"}>
                <ShieldCheck className="mr-1 size-3" />
                2FA {is2faEnabled ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Username">
              <Input
                id="username"
                value={usernameValue}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
              />
            </Field>
            <Field label="Email">
              <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {user.email}
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Student / Staff ID">
              <div className="rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-sm text-muted-foreground">
                {user.id.slice(0, 8).toUpperCase()}
              </div>
            </Field>
          </div>
          {profileError && <Alert variant="error">{profileError}</Alert>}
          <div className="flex justify-end">
            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>

      {/* Password change */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
            <KeyRound className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Change password</h3>
            <p className="text-xs text-muted-foreground">
              Use at least 8 characters. You&apos;ll stay signed in on this device.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current password">
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4">
              <Field label="New password">
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </div>
          {passwordError && <Alert variant="error">{passwordError}</Alert>}
          <div className="flex justify-end">
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
