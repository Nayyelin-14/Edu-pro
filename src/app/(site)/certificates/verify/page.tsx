"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "motion/react";
import { Award, Check, Copy, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api-client";

interface CertificateInfo {
  valid: boolean;
  number?: string;
  userName?: string;
  courseTitle?: string;
  issuedAt?: string;
  error?: string;
}

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" },
} as const;

function VerifyForm() {
  const searchParams = useSearchParams();
  const [number, setNumber] = useState(searchParams.get("number") ?? "");
  const [result, setResult] = useState<CertificateInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!number.trim()) return;
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await apiFetch<CertificateInfo>(
        `/api/certificates/check?number=${encodeURIComponent(number.trim())}`,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyNumber = () => {
    if (result?.number) {
      void navigator.clipboard.writeText(result.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const reset = () => {
    setResult(null);
    setError("");
    setNumber("");
  };

  return (
    <motion.div
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Hero */}
      <motion.div className="text-center" {...cardMotion}>
        <div className="mx-auto mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground">
          Verify a certificate
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Enter the certificate number printed on the certificate to validate it.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form onSubmit={submit} className="w-full" {...cardMotion}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificate number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="number" className="sr-only">
                Certificate number
              </Label>
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                autoComplete="off"
                required
                placeholder="e.g. DT-K3F2X-7LQ1P0"
                className="font-mono text-center text-base tracking-wider"
                disabled={loading}
              />
              <p className="text-center text-xs text-on-surface-variant">
                Numbers look like{" "}
                <span className="font-medium">DT-K3F2X-7LQ1P0</span>
              </p>
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex justify-center">
              <Button type="submit" disabled={loading || !number.trim()}>
                {loading ? "Checking…" : "Verify certificate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.form>

      {/* Loading */}
      {loading && (
        <motion.div className="w-full" {...cardMotion}>
          <Card>
            <CardContent className="py-10">
              <EmptyState
                icon={<Award className="size-7 text-on-surface-variant/40" />}
                title="Verifying…"
                desc="Checking the certificate number."
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Not found */}
      {result && !result.valid && !loading && (
        <motion.div className="w-full" {...cardMotion}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Certificate not found</Badge>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                  <X className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                No certificate matches that number. Double-check the number and
                try again.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" size="sm" onClick={reset}>
                  Try again
                </Button>
                <Link href="/">
                  <Button variant="ghost" size="sm">
                    Back to home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Valid */}
      {result?.valid && result.number && !loading && (
        <motion.div className="w-full" {...cardMotion}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Valid certificate</Badge>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Check className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ResultRow label="Recipient" value={result.userName} />
              <ResultRow label="Course" value={result.courseTitle} />
              <ResultRow
                label="Issued"
                value={
                  result.issuedAt
                    ? new Date(result.issuedAt).toLocaleDateString()
                    : undefined
                }
              />
              <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-container-low px-3 py-2">
                <span className="text-label-sm text-on-surface-variant">
                  Number
                </span>
                <span className="font-mono text-label-sm text-foreground break-all">
                  {result.number}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 px-1.5"
                  onClick={copyNumber}
                  aria-label="Copy certificate number"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Footer back link */}
      {!result && !loading && (
        <motion.p className="text-center text-sm text-muted-foreground" {...cardMotion}>
          <Link
            href="/"
            className="font-medium text-primary hover:underline"
          >
            ← Back to home
          </Link>
        </motion.p>
      )}
    </motion.div>
  );
}

function ResultRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 rounded-xl bg-surface-container-low px-3 py-2">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <span className="font-medium text-foreground truncate">{value}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      {icon}
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

export default function CertificateVerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
