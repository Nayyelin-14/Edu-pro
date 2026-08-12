"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-margin-mobile md:p-margin-desktop text-on-surface">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-stack-xl">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              school
            </span>
            <span className="text-headline-md font-headline-md text-primary tracking-tight">
              EduPro
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-stack-lg md:p-stack-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1)] relative overflow-hidden transition-all duration-300">
          {!sent ? (
            <div className="transition-opacity duration-300 opacity-100">
              <h1 className="text-headline-md font-headline-md text-on-surface mb-stack-sm text-center">
                Reset your password
              </h1>
              <p className="text-body-md font-body-md text-on-surface-variant text-center mb-stack-lg">
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>
              <form onSubmit={submit} className="space-y-stack-md">
                <div className="flex flex-col gap-stack-sm">
                  <label
                    htmlFor="email"
                    className="text-label-md font-label-md text-on-surface"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-lg">
                      mail
                    </span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                  </div>
                </div>
                {error && <Alert variant="error">{error}</Alert>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-container text-on-primary text-title-md font-title-md py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-stack-lg group disabled:opacity-60 disabled:pointer-events-none"
                >
                  {loading ? "Sending…" : "Send Reset Link"}
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-stack-md text-primary">
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  mark_email_read
                </span>
              </div>
              <h2 className="text-headline-md font-headline-md text-on-surface mb-stack-sm">
                Check your inbox
              </h2>
              <p className="text-body-md font-body-md text-on-surface-variant mb-stack-lg">
                We&apos;ve sent a password reset link to{" "}
                <span className="font-medium text-on-surface">{email}</span>.
              </p>
              <div className="bg-surface-container-low p-stack-md rounded-lg text-left w-full border border-outline-variant mb-stack-lg">
                <p className="text-label-md font-label-md text-on-surface-variant mb-2 font-medium">
                  Didn&apos;t receive the email?
                </p>
                <ul className="text-body-md font-body-md text-on-surface-variant list-disc pl-5 space-y-1">
                  <li>Check your spam or junk folder</li>
                  <li>Verify the email address provided is correct</li>
                  <li>Wait a few minutes as delivery can be delayed</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setError("");
                }}
                className="text-primary hover:text-primary-container text-title-md font-title-md transition-colors flex items-center gap-2 mt-auto"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="mt-stack-lg text-center">
          <Link
            href="/login"
            className="text-body-md font-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
