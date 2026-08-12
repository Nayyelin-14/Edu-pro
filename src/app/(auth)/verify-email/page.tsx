"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useAuth();
  const { t } = useI18n();

  const codeFromUrl = searchParams.get("code");
  const [state, setState] = useState<"checking" | "pending" | "success" | "error">("checking");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyCode = useCallback(async (code: string) => {
    setLoading(true);
    setError("");
    try {
      await apiFetch<{ user: { emailVerified: boolean } }>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      await refresh();
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
      setState("error");
    } finally {
      setLoading(false);
    }
  }, [refresh, t]);

  useEffect(() => {
    let cancelled = false;
    async function checkVerification() {
      if (codeFromUrl) {
        await verifyCode(codeFromUrl);
      } else if (user) {
        if (user.emailVerified) {
          if (!cancelled) setState("success");
        } else {
          if (!cancelled) setState("pending");
        }
      } else {
        if (!cancelled) setState("pending");
      }
    }
    checkVerification();
    return () => { cancelled = true; };
  }, [codeFromUrl, user, verifyCode]);

  const handleVerifyClick = () => {
    if (codeFromUrl) {
      verifyCode(codeFromUrl);
    } else {
      setError(t.auth.enterCodeManually);
      setState("error");
    }
  };

  const resend = async () => {
    if (!user?.email) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
      });
      setInfo(t.auth.verificationSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    router.push("/profile");
    router.refresh();
  };

  const showSuccess = state === "success" || (user?.emailVerified && state !== "error");

  if (showSuccess) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] p-margin-mobile md:p-margin-desktop">
        <div className="text-center mb-8">
          <h1 className="text-display-lg font-display-lg text-primary mb-2">EduPro</h1>
          <p className="text-body-lg font-body-lg text-on-surface-variant">Corporate Modernism Learning Platform</p>
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-stack-lg shadow-sm flex flex-col items-center text-center transition-all duration-300 w-full">
          <div className="w-16 h-16 bg-[#10b981] rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-on-primary text-3xl">check_circle</span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface mb-4">Email Verified!</h2>
          <p className="text-body-md font-body-md text-on-surface-variant mb-8">
            Your email address has been successfully verified. You now have full access to EduPro.
          </p>
          <button
            onClick={goToDashboard}
            className="w-full bg-primary-container text-on-primary py-3 px-6 rounded-DEFAULT text-label-md font-label-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] p-margin-mobile md:p-margin-desktop">
      <div className="text-center mb-8">
        <h1 className="text-display-lg font-display-lg text-primary mb-2">EduPro</h1>
        <p className="text-body-lg font-body-lg text-on-surface-variant">Corporate Modernism Learning Platform</p>
      </div>
      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-stack-lg shadow-sm flex flex-col items-center text-center transition-all duration-300 w-full">
        <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-3xl">mark_email_unread</span>
        </div>
        <h2 className="text-headline-md font-headline-md text-on-surface mb-4">Verify your email address</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mb-8">
          We&apos;ve sent a verification link to your email address. Please check your inbox and click the link to activate your account.
        </p>
        <div className="w-full flex flex-col gap-4">
          <button
            onClick={handleVerifyClick}
            disabled={loading}
            className="w-full bg-primary-container text-on-primary py-3 px-6 rounded-DEFAULT text-label-md font-label-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "I've verified my email"}
          </button>
          <button
            onClick={resend}
            disabled={loading}
            className="w-full bg-surface-container-lowest text-on-surface border border-outline-variant py-3 px-6 rounded-DEFAULT text-label-md font-label-md hover:bg-surface-container-low transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            Resend Email
          </button>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-error-container text-error rounded text-label-sm text-center">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-4 p-3 bg-primary-fixed text-on-primary-fixed rounded text-label-sm text-center">
            {info}
          </div>
        )}
        <a className="mt-6 text-label-sm font-label-sm text-primary hover:underline" href="/help">
          Contact Support
        </a>
      </div>
    </div>
  );
}