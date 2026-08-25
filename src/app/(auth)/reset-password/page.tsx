"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";

function passwordStrength(val: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let strength = 0;
  if (val.length > 0) strength += 1;
  if (val.length >= 8) strength += 1;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength += 1;
  if (/[^A-Za-z0-9]/.test(val)) strength += 1;

  switch (strength) {
    case 1:
      return { level: 1, label: "Weak", color: "bg-error text-error" };
    case 2:
      return { level: 2, label: "Fair", color: "bg-tertiary text-tertiary" };
    case 3:
      return { level: 3, label: "Good", color: "bg-[#d97706] text-[#d97706]" };
    case 4:
      return { level: 4, label: "Strong", color: "bg-[#10b981] text-[#10b981]" };
    default:
      return { level: 0, label: "", color: "" };
  }
}

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthBarWidth = ["0%", "25%", "50%", "75%", "100%"][strength.level];
  const strengthBarColor = ["", "bg-error", "bg-tertiary", "bg-[#d97706]", "bg-[#10b981]"][strength.level];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-stack-md text-primary">
          <span
            className="material-symbols-outlined text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
        </div>
        <h2 className="text-headline-md font-headline-md text-on-surface mb-stack-sm">
          Password updated
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant mb-stack-lg">
          Your password has been reset successfully. You can now sign in with
          your new password.
        </p>
        <Link
          href="/login"
          className="w-full flex justify-center items-center py-2.5 px-4 bg-primary text-on-primary rounded-lg font-title-md text-title-md shadow-sm hover:shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-stack-lg">
      <div className="space-y-stack-sm">
        <label
          htmlFor="new_password"
          className="block font-label-md text-label-md text-on-surface"
        >
          New Password
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">lock</span>
          </span>
          <PasswordInput
            id="new_password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            className="block w-full pl-10 py-2.5 bg-surface border border-outline-variant rounded-[10px] font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-shadow"
          />
        </div>
      </div>

      <div className="space-y-stack-sm">
        <div className="flex justify-between items-center">
          <span className="font-label-md text-label-md text-on-surface-variant">
            Password Strength
          </span>
          <span className={`font-label-md text-label-md text-outline ${strength.color}`} id="strength-text">
            {strength.label}
          </span>
        </div>
        <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className={`h-full password-strength-meter ${strengthBarColor} transition-all duration-300`}
            style={{ width: strengthBarWidth }}
          />
        </div>
        <p className="font-body-md text-[12px] text-on-surface-variant mt-2 leading-tight">
          Must be at least 8 characters containing a number, an uppercase
          letter, and a special character.
        </p>
      </div>

      <div className="space-y-stack-sm">
        <label
          htmlFor="confirm_password"
          className="block font-label-md text-label-md text-on-surface"
        >
          Confirm New Password
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">lock_reset</span>
          </span>
          <PasswordInput
            id="confirm_password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className="block w-full pl-10 py-2.5 bg-surface border border-outline-variant rounded-[10px] font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-shadow"
          />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="pt-stack-sm">
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full flex justify-center items-center py-2.5 px-4 bg-primary text-on-primary rounded-[10px] font-title-md text-title-md shadow-sm hover:shadow-md hover:opacity-90 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60 disabled:pointer-events-none"
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </div>

      <div className="text-center pt-stack-md border-t border-outline-variant/30">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Sign In
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="bg-background text-on-background min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-desktop antialiased">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-stack-xl">
          <div className="inline-flex items-center justify-center gap-stack-sm mb-stack-md text-primary">
            <span
              className="material-symbols-outlined text-[32px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              school
            </span>
            <span className="font-headline-lg text-headline-lg text-primary tracking-tight">
              EduPro
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-stack-sm">
            Reset your password
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Please enter your new password below.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-stack-lg md:p-[32px] shadow-[0_4px_6px_-1px_rgb(0,0,0,0.05)]">
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
