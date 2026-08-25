"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

interface CertificateRequestClientProps {
  courseId: string;
  courseTitle: string;
  hasPassed: boolean;
  score: number | null;
  total: number | null;
  percent: number | null;
  testResultId: string | null;
  existing: { id: string; status: RequestStatus; createdAt: Date | string } | null;
}

export function CertificateRequestClient({
  courseId,
  courseTitle,
  hasPassed,
  score,
  total,
  percent,
  testResultId,
  existing,
}: CertificateRequestClientProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const backToCourse = () => router.push(`/learning/${courseId}`);
  const backToCourses = () => router.push("/courses");

  const request = async () => {
    setState("loading");
    setErrorMsg(null);
    try {
      await apiFetch("/api/certificates/request", {
        method: "POST",
        body: JSON.stringify({ courseId, testResultId }),
      });
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  };

  // --- Already has a PENDING request: show its status, no form. ---
  if (existing?.status === "PENDING") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Loader2 className="size-8 animate-spin" />
            </div>
            <Alert className="text-center">
              Your certificate request is pending review by your instructor.
            </Alert>
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" size="lg" onClick={backToCourse}>
                Back to course
              </Button>
              <Button variant="ghost" size="lg" onClick={backToCourses}>
                Back to all courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Already APPROVED: it's done. ---
  if (existing?.status === "APPROVED") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle className="size-8" />
            </div>
            <Alert variant="success" className="text-center">
              Your certificate request has already been approved.
            </Alert>
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" size="lg" onClick={backToCourse}>
                Back to course
              </Button>
              <Button variant="ghost" size="lg" onClick={backToCourses}>
                Back to all courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Success (just submitted, before a refresh turns it into PENDING). ---
  if (state === "success") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle className="size-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              Your certificate request has been sent to your instructor.
            </p>
            <Alert variant="success" className="text-center">
              They&apos;ll review it and issue your certificate once approved.
            </Alert>
            <div className="flex justify-center gap-3 pt-4">
              <Button size="lg" onClick={backToCourse}>
                Back to course page
              </Button>
              <Button variant="ghost" size="lg" onClick={backToCourses}>
                Back to all courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Hasn't passed the final test: can't request yet. ---
  if (!hasPassed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <XCircle className="size-8" />
            </div>
            <Alert variant="error" className="text-center">
              You need to pass the final test before you can request a certificate.
            </Alert>
            {score != null && total != null && (
              <p className="text-muted-foreground">
                Your last attempt: {score} / {total}
                {percent != null ? ` (${percent}%)` : ""}.
              </p>
            )}
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" size="lg" onClick={backToCourse}>
                Back to course
              </Button>
              <Button variant="ghost" size="lg" onClick={backToCourses}>
                Back to all courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Default: the request form (also reached when a prior request was
  //     REJECTED, since the backend lets the student request again). ---
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Request your certificate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            Would you like to request a certificate for{" "}
            <span className="font-medium text-foreground">{courseTitle}</span>?
            We&apos;ll notify your course instructor to review and issue it.
          </p>

          {score != null && total != null && (
            <Alert variant="success" className="text-center">
              You passed the final test with {score} / {total}
              {percent != null ? ` (${percent}%)` : ""}.
            </Alert>
          )}

          {existing?.status === "REJECTED" && (
            <Alert variant="error" className="text-center">
              Your previous request was rejected. You can submit a new request
              below.
            </Alert>
          )}

          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              onClick={request}
              disabled={state === "loading"}
              className="w-full justify-center gap-2"
            >
              {state === "loading" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Requesting…
                </>
              ) : (
                "Request Certificate"
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-center"
              onClick={() => setCancelOpen(true)}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full justify-center"
              onClick={backToCourses}
            >
              Back to all courses
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        title="Skip certificate request?"
        description="You won't be able to request a certificate again. If you change your mind, you'll need to contact your course instructor directly."
        confirmLabel="Yes, skip"
        cancelLabel="Keep request"
        destructive
        onConfirm={() => {
          setCancelOpen(false);
          router.push("/courses");
        }}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
