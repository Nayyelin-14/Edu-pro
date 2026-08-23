"use client";

/**
 * Direct-to-storage upload widget for instructors (spec §11/§19).
 *
 * Shows file name/size, live progress with percentage/speed/ETA, cancel,
 * retry, resume-after-interruption, and the processing state for videos.
 * Never shows "complete" while the video is still processing.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, RotateCcw, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import {
  findResumable,
  ResumableUploader,
  type UploadProgress,
  type UploadSession,
} from "@/lib/direct-upload";

type Phase =
  | { state: "idle" }
  | { state: "resumable"; offset: number }
  | { state: "uploading" }
  | { state: "processing" }
  | { state: "ready" }
  | { state: "failed"; reason: string };

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaUploader({
  kind,
  lessonId,
  moduleId,
  onChanged,
}: {
  kind: "VIDEO" | "PDF";
  /** Existing lesson target. */
  lessonId?: string;
  /** Creation mode: lesson is created together with its first upload. */
  moduleId?: string;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [pendingSession, setPendingSession] = useState<{
    session: UploadSession;
    offset: number;
  } | null>(null);
  const uploaderRef = useRef<ResumableUploader | null>(null);

  const isVideo = kind === "VIDEO";
  const accept = isVideo ? "video/mp4,video/webm,video/quicktime" : "application/pdf";

  useEffect(() => () => uploaderRef.current?.cancel(), []);

  const runUpload = async (f: File, offset: number) => {
    setPhase({ state: "uploading" });
    try {
      const payload = lessonId
        ? { lessonId, kind, filename: f.name }
        : { moduleId, title: f.name.replace(/\.[^.]+$/, ""), kind, filename: f.name };
      const session = await apiFetch<UploadSession>("/api/staff/uploads/sign", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const uploader = new ResumableUploader(f, lessonId ?? "", kind, {
        onProgress: setProgress,
        onProcessing: () => setPhase({ state: "processing" }),
        onReady: () => {
          setPhase({ state: "ready" });
          toast(isVideo ? "Video ready" : "Document ready", "success");
          onChanged();
        },
        onError: (outcome) => setPhase({ state: "failed", reason: outcome.reason }),
        onCancelled: () => setPhase({ state: "idle" }),
      });
      uploaderRef.current = uploader;
      await uploader.run(session, offset);
    } catch (err) {
      setPhase({
        state: "failed",
        reason: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  const pickFile = async (f: File) => {
    setFile(f);
    setProgress(null);
    // Offer resume when this exact file was mid-upload before.
    if (f.size > 8 * 1024 ** 2 && lessonId) {
      const resumable = await findResumable(lessonId, kind, f);
      if (resumable) {
        setPendingSession(resumable);
        setPhase({ state: "resumable", offset: resumable.offset });
        return;
      }
    }
    await runUpload(f, 0);
  };

  const cancel = () => {
    uploaderRef.current?.cancel();
    setPhase({ state: "idle" });
    setProgress(null);
  };

  const inputId = `media-upload-${kind.toLowerCase()}`;

  return (
    <div className="space-y-2">
      <Label>{isVideo ? "Lesson video" : "Lesson document (PDF)"}</Label>

      {phase.state === "idle" || phase.state === "ready" ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={phase.state === "ready" ? "outline" : "default"}
            onClick={() => document.getElementById(inputId)?.click()}
          >
            {phase.state === "ready" ? (
              <>
                <RotateCcw className="size-4" /> Replace
              </>
            ) : (
              <>
                <UploadCloud className="size-4" />
                {isVideo ? "Upload video" : "Upload PDF"}
              </>
            )}
          </Button>
          {phase.state === "ready" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" /> Uploaded & verified
            </span>
          )}
        </div>
      ) : null}

      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pickFile(f);
        }}
      />

      {phase.state === "resumable" && pendingSession && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm space-y-2">
          <p>
            Previous upload of <strong>{pendingSession.session.assetId}</strong>{" "}
            reached {Math.round((pendingSession.offset / (file?.size || 1)) * 100)}%.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const f = file;
                setPendingSession(null);
                if (f) void runUpload(f, phase.offset);
              }}
            >
              Resume upload
            </Button>
            <Button size="sm" variant="outline" onClick={() => document.getElementById(inputId)?.click()}>
              Choose different file
            </Button>
          </div>
        </div>
      )}

      {(phase.state === "uploading" || phase.state === "processing") && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate flex items-center gap-2">
              {isVideo ? <UploadCloud className="size-4 flex-none" /> : <FileText className="size-4 flex-none" />}
              {file?.name ?? "…"}
            </span>
            <button
              type="button"
              onClick={cancel}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Cancel upload"
            >
              <X className="size-4" />
            </button>
          </div>

          {phase.state === "uploading" && progress && (
            <>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full bg-primary rounded-full transition-[width] duration-300")}
                  style={{ width: `${progress.percent.toFixed(1)}%` }}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground font-mono">
                <span>{progress.percent.toFixed(0)}%</span>
                <span>
                  {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                </span>
                {progress.speedBps > 0 && (
                  <span>{(progress.speedBps / 1024 ** 2).toFixed(1)} MB/s</span>
                )}
                {progress.etaSeconds !== null && progress.percent < 99.5 && (
                  <span>ETA: {progress.etaSeconds}s</span>
                )}
              </div>
            </>
          )}

          {phase.state === "processing" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" /> Upload complete. Processing video…
            </p>
          )}
        </div>
      )}

      {phase.state === "failed" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
          <p className="text-destructive">Upload failed: {phase.reason}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!file}
              onClick={() => file && void runUpload(file, 0)}
            >
              <RotateCcw className="size-3.5" /> Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPhase({ state: "idle" })}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
