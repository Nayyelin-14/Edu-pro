"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { Award, Check, Copy, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

interface CertificateInfo {
  valid: boolean;
  number?: string;
  userName?: string;
  courseTitle?: string;
  issuedAt?: string;
  error?: string;
}

export function VerifyCertificateForm() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [number, setNumber] = useState("");
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
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const copyNumber = () => {
    if (result?.number) {
      void navigator.clipboard.writeText(result.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast("License key copied", "success");
    }
  };

  const reset = () => {
    setResult(null);
    setError("");
    setNumber("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="border border-outline-variant/70 bg-surface-container-lowest shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-title-md font-semibold text-on-surface">
            <div className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent h-9 w-9 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            {t.certificates.verify}
          </CardTitle>
          <p className="text-body-sm text-on-surface-variant">
            {t.certificates.subtitle}
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="verify-number" className="text-label-sm">
                {t.certificates.verifyCertificate ?? "Certificate number"}
              </Label>
              <Input
                id="verify-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                autoComplete="off"
                required
                placeholder="e.g. DT-K3F2X-7LQ1P0"
                className="font-mono"
                disabled={loading}
              />
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <Button
              type="submit"
              disabled={loading || !number.trim()}
              size="sm"
              className="w-full sm:w-auto"
            >
              {loading ? "Checking…" : t.certificates.verify}
            </Button>
          </form>

          {loading && (
            <EmptyResult
              icon={<Award className="size-7 text-on-surface-variant/40" />}
              title={t.certificates.verifying ?? "Verifying…"}
              desc={t.certificates.verifyingDesc ?? "Checking the certificate number."}
            />
          )}

          {result && !result.valid && !loading && (
            <EmptyResult
              icon={<X className="size-7 text-rose-500" />}
              title={t.certificates.notFound ?? "Certificate not found"}
              desc={t.certificates.notFoundDesc ?? "No certificate matches that number."}
              action={
                <Button type="button" variant="outline" size="sm" onClick={reset}>
                  {t.certificates.verifyAgain ?? "Verify another"}
                </Button>
              }
            />
          )}

          {result?.valid && result.number && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="success">{t.certificates.valid ?? "Valid certificate"}</Badge>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Check className="h-4 w-4" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm">
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
                  <span className="text-label-sm text-on-surface-variant">Number</span>
                  <span className="font-mono text-label-sm text-on-surface break-all">
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ResultRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 rounded-xl bg-surface-container-low px-3 py-2">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <span className="font-medium text-on-surface truncate">{value}</span>
    </div>
  );
}

function EmptyResult({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant py-8 text-center">
      {icon}
      <p className="font-semibold text-on-surface">{title}</p>
      <p className="text-sm text-on-surface-variant max-w-sm">{desc}</p>
      {action}
    </div>
  );
}
