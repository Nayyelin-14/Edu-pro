"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api-client";

interface CertificateInfo {
  valid: boolean;
  certificate?: {
    id: string;
    certificateNumber: string;
    issuedAt: string;
    course: { title: string };
    user: { username: string };
  };
  error?: string;
}

function VerifyForm() {
  const searchParams = useSearchParams();
  const [number, setNumber] = useState(searchParams.get("number") ?? "");
  const [result, setResult] = useState<CertificateInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<CertificateInfo>(
        `/api/certificates/check?number=${encodeURIComponent(number)}`,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Verify a certificate</h1>
      <p className="mt-2 text-muted-foreground">
        Enter the certificate number printed on the certificate.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="number">Certificate number</Label>
          <Input
            id="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
            placeholder="e.g. DT-2026-000001"
          />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" disabled={loading}>
          {loading ? "Checking…" : "Verify"}
        </Button>
      </form>

      {result && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.valid ? (
                <Badge variant="success">Valid certificate</Badge>
              ) : (
                <Badge variant="destructive">Not found</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.valid && result.certificate ? (
              <>
                <p>
                  <strong>Recipient:</strong> {result.certificate.user.username}
                </p>
                <p>
                  <strong>Course:</strong> {result.certificate.course.title}
                </p>
                <p>
                  <strong>Issued:</strong>{" "}
                  {new Date(result.certificate.issuedAt).toLocaleDateString()}
                </p>
                <p>
                  <strong>Number:</strong>{" "}
                  {result.certificate.certificateNumber}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No certificate matches that number.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/" className="font-medium text-primary hover:underline">
          ← Back to home
        </Link>
      </p>
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
