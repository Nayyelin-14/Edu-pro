"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api-client";

type Method = "EMAIL" | "GOOGLE_AUTH";

interface InitResponse {
  pending: boolean;
  method: Method;
  totpSecret?: string;
  uri?: string;
}

export function TwoStepPanel() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState<Method | null>(null);
  const [totpSecret, setTotpSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const twoStep = user?.twoStep ?? "DISABLED";
  const isEnabled = twoStep !== "DISABLED";

  const init = async (m: Method) => {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<InitResponse>("/api/auth/enable-2fa", {
        method: "POST",
        body: JSON.stringify({ method: m }),
      });
      setMethod(m);
      setTotpSecret(data.totpSecret ?? "");
      setUri(data.uri ?? "");
      if (m === "EMAIL") toast("A verification code was emailed to you.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/enable-2fa/confirm", {
        method: "POST",
        body: JSON.stringify({ method, code, totpSecret: totpSecret || undefined }),
      });
      await refresh();
      setMethod(null);
      setCode("");
      toast("Two-step verification enabled", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/disable-2fa", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      await refresh();
      setPassword("");
      toast("Two-step verification disabled", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-step verification
          <Badge variant={isEnabled ? "success" : "outline"}>
            {isEnabled ? twoStep : "OFF"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEnabled ? (
          <form onSubmit={disable} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Two-step verification is on. To turn it off, enter your password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="disablePassword">Password</Label>
              <PasswordInput
                id="disablePassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" variant="outline" disabled={loading}>
              {loading ? "Disabling…" : "Disable"}
            </Button>
          </form>
        ) : method ? (
          <form onSubmit={confirm} className="space-y-3">
            {method === "GOOGLE_AUTH" && uri ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with your authenticator app, or enter the secret:
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uri} alt="QR code" className="mx-auto size-40 rounded border" />
                <code className="block break-all rounded bg-muted p-2 text-xs">
                  {totpSecret}
                </code>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code that was emailed to you.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="verifyCode">Code</Label>
              <Input
                id="verifyCode"
                inputMode="numeric"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Confirm"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMethod(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void init("EMAIL")} disabled={loading}>
              Enable via email
            </Button>
            <Button variant="outline" onClick={() => void init("GOOGLE_AUTH")} disabled={loading}>
              Enable via authenticator app
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
