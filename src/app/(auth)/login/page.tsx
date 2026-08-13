"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { apiFetch } from "@/lib/api-client";
import { sanitizeReturnTo } from "@/lib/urls";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { setRememberMe } from "@/lib/remember-me";
import type { PublicUser } from "@/types/user";
import { ArrowLeft, Lock, User } from "lucide-react";

interface LoginResponse {
  user?: PublicUser;
  needsTwoFactor?: boolean;
  method?: "EMAIL" | "GOOGLE_AUTH";
  mfaToken?: string;
}

const inputClass =
  "block w-full rounded-md border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const submitButtonClass =
  "flex w-full justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
        fill="#EA4335"
      />
      <path
        d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
        fill="#4285F4"
      />
      <path
        d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
        fill="#FBBC05"
      />
      <path
        d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
        fill="#34A853"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        clipRule="evenodd"
        d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function OtpInputs({
  onComplete,
  autoFocus = true,
}: {
  onComplete: (value: string) => void;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const commit = (next: string[]) => {
    setDigits(next);
    onComplete(next.join(""));
  };

  const handleChange = (index: number, raw: string) => {
    const char = raw.replace(/\D/g, "");
    const next = [...digits];
    next[index] = char ? char.slice(-1) : "";
    commit(next);
    if (char && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill("");
    text.split("").forEach((c, i) => (next[i] = c));
    commit(next);
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-14 w-full max-w-14 rounded-md border border-input bg-background text-center text-2xl font-semibold text-foreground transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ))}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, user, loading: authLoading } = useAuth();
  const next = sanitizeReturnTo(searchParams.get("next") ?? "/");
  const { t } = useI18n();

  // When an existing (refreshable) session is detected on the login page —
  // e.g. the access JWT expired while the refresh token is still valid — send
  // the user straight back to where they were heading instead of showing the
  // form. `next` is sanitized against open-redirect attackers.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(next);
    }
  }, [authLoading, user, next, router]);

  const [view, setView] = useState<"login" | "mfa">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<"EMAIL" | "GOOGLE_AUTH">("EMAIL");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      setRememberMe(remember);
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, remember }),
      });
      if (data.needsTwoFactor && data.mfaToken) {
        setMfaToken(data.mfaToken);
        setMfaMethod(data.method ?? "EMAIL");
        setCode("");
        setView("mfa");
        return;
      }
      if (data.user) setUser(data.user);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { user } = await apiFetch<{ user: PublicUser }>(
        "/api/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ token: mfaToken, code }),
        },
      );
      setUser(user);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      setRememberMe(remember);
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, remember }),
      });
      if (data.needsTwoFactor && data.mfaToken) {
        setMfaToken(data.mfaToken);
        setMfaMethod(data.method ?? "EMAIL");
        setInfo(t.auth.verificationSent);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setView("login");
    setError("");
    setInfo("");
    setCode("");
  };

  if (view === "mfa") {
    return (
      <div
        key="mfa"
        className="animate-in fade-in-0 slide-in-from-right-4 duration-300"
      >
        <button
          type="button"
          onClick={backToLogin}
          className="mb-6 flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t.common.back}
        </button>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.auth.twoFactorTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mfaMethod === "GOOGLE_AUTH"
              ? t.auth.verifySubtitle
              : t.auth.twoFactorSubtitle}
          </p>
        </div>
        <form onSubmit={submitOtp} className="space-y-6">
          <OtpInputs autoFocus onComplete={setCode} />
          {error && <Alert variant="error">{error}</Alert>}
          {info && <Alert variant="success">{info}</Alert>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className={submitButtonClass}
          >
            {loading ? t.common.loading : t.auth.verifyAndLogin}
          </button>
        </form>
        {mfaMethod === "EMAIL" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t.auth.noCode}{" "}
            <button
              type="button"
              onClick={resendCode}
              className="ml-1 font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {t.auth.resendCode}
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div key="login" className="animate-in fade-in-0 duration-300">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-bold tracking-tight">{t.auth.loginTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.auth.loginDetail}</p>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {t.auth.username}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={t.auth.username}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              {t.auth.password}
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {t.auth.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="ml-2 text-sm text-muted-foreground">
              {t.auth.rememberMe}
            </span>
          </label>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <button type="submit" disabled={loading} className={submitButtonClass}>
          {loading ? t.common.loading : t.common.login}
        </button>
      </form>
      <div className="mt-8">
        <div className="relative">
          <div aria-hidden="true" className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs font-medium">
            <span className="bg-background px-2 text-muted-foreground">
              {t.auth.orContinue}
            </span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center justify-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <GoogleIcon />
            Google
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center justify-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <GithubIcon />
            GitHub
          </a>
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t.auth.noAccount}{" "}
        <Link
          href="/register"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          {t.common.register}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#2563eb] to-[#3b82f6]" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0f2557]/90 via-[#0f2557]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 p-12 text-white">
          <div className="mb-4 text-5xl font-bold tracking-tight">
            EduPro
          </div>
          <p className="max-w-md text-lg text-white/90">{t.home.heroSubtitle}</p>
        </div>
      </div>
      <div className="relative z-10 flex flex-1 flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:px-20 lg:shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.15)] xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-[400px]">
          <span className="mb-8 block text-center text-2xl font-bold text-primary lg:hidden">
            EduPro
          </span>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
