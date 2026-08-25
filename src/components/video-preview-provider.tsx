"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Loader2, X } from "lucide-react";

interface PreviewTarget {
  courseId: string;
  lessonId?: string;
}

interface PreviewState {
  loading: boolean;
  title?: string;
  url?: string;
  error?: string;
}

interface PreviewContextValue {
  openPreview: (target: PreviewTarget) => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function usePreview() {
  const ctx = useContext(PreviewContext);
  if (!ctx) {
    // Safe no-op when used outside a provider (e.g. in isolated tests).
    return { openPreview: () => {} };
  }
  return ctx;
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [state, setState] = useState<PreviewState>({ loading: false });
  const [visible, setVisible] = useState(false);

  const openPreview = useCallback((t: PreviewTarget) => {
    setTarget(t);
    setVisible(true);
    setState({ loading: true });
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    // Clear after the fade so the video stops playing immediately.
    setTimeout(() => {
      setTarget(null);
      setState({ loading: false });
    }, 150);
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const qs = target.lessonId ? `?lessonId=${encodeURIComponent(target.lessonId)}` : "";
    fetch(`/api/courses/${target.courseId}/preview${qs}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body?.isSuccess) {
          setState({
            loading: false,
            error: body?.message ?? "Preview unavailable",
          });
          return;
        }
        setState({
          loading: false,
          url: body.data.url,
          title: body.data.title,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: "Preview unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  return (
    <PreviewContext.Provider value={{ openPreview }}>
      {children}
      {visible && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              aria-label="Close preview"
            >
              <X className="size-5" />
            </button>

            <div className="aspect-video w-full bg-black">
              {state.loading && (
                <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-white/80">
                  <Loader2 className="size-5 animate-spin" /> Loading preview…
                </div>
              )}
              {state.error && !state.loading && (
                <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/80">
                  {state.error}
                </div>
              )}
              {state.url && !state.loading && (
                <video
                  key={state.url}
                  src={state.url}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            {state.title && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">{state.title}</p>
                <p className="text-xs text-muted-foreground">Free preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </PreviewContext.Provider>
  );
}
