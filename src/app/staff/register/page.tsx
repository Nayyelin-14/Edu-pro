"use client";

import { useState, type FormEvent } from "react";
import { ShieldPlus, KeyRound, UserRound, Mail, Lock, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  Field,
  adminInputClass,
} from "@/components/admin/admin-ui";

export default function AdminRegisterPage() {
  const { toast } = useToast();
  const [inviteToken, setInviteToken] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/staff/register", {
        method: "POST",
        body: JSON.stringify({ inviteToken, username, email, password }),
      });
      setDone(true);
      toast("Instructor created", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <AdminPageHeader title="Register Staff" subtitle="Superadmin only." />
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30">
            <CircleCheck className="size-6 text-white" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-foreground">Instructor created</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The account can now sign in as an instructor.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => setDone(false)}>
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <AdminPageHeader
        title="Register Staff"
        subtitle="Create a new instructor account. Requires the staff invite token."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-orange-500/30">
            <ShieldPlus className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">New instructor account</h3>
            <p className="text-xs text-muted-foreground">
              Ask your platform owner for the invite token.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Field label="Invite token">
              <input
                id="inviteToken"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                required
                className={`${adminInputClass} pl-10`}
              />
            </Field>
            <KeyRound className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" />
          </div>
          <div className="relative">
            <Field label="Username">
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                className={`${adminInputClass} pl-10`}
              />
            </Field>
            <UserRound className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" />
          </div>
          <div className="relative">
            <Field label="Email">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`${adminInputClass} pl-10`}
              />
            </Field>
            <Mail className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" />
          </div>
          <div className="relative">
            <Field label="Password">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={`${adminInputClass} pl-10`}
              />
            </Field>
            <Lock className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <ShieldPlus className="size-4" />
            {loading ? "Creating…" : "Create instructor"}
          </Button>
        </form>
      </div>
    </div>
  );
}