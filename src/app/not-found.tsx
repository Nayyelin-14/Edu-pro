"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useI18n } from "@/i18n";

function BlobBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-[800px] w-[800px] md:block"
      style={{
        background:
          "radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

function Illustration() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="h-full w-full object-contain"
      role="img"
      aria-label="Floating books and a graduation cap"
    >
      <circle cx="200" cy="150" r="120" fill="#dbeafe" opacity="0.6" />
      <ellipse cx="200" cy="252" rx="110" ry="14" fill="#94a3b8" opacity="0.3" />
      <g>
        <rect x="128" y="208" width="144" height="26" rx="6" fill="#2563eb" />
        <rect x="132" y="234" width="136" height="6" rx="3" fill="#1e3a8a" />
      </g>
      <g>
        <rect x="136" y="176" width="128" height="26" rx="6" fill="#60a5fa" />
        <rect x="140" y="202" width="120" height="6" rx="3" fill="#3b82f6" />
      </g>
      <g>
        <rect x="148" y="144" width="104" height="26" rx="6" fill="#93c5fd" />
        <rect x="152" y="170" width="96" height="6" rx="3" fill="#60a5fa" />
      </g>
      <g>
        <path d="M200 78 L290 110 L200 142 L110 110 Z" fill="#1e3a8a" />
        <rect x="186" y="142" width="28" height="14" fill="#1e3a8a" />
        <circle cx="200" cy="156" r="4" fill="#f59e0b" />
      </g>
      <path
        d="M92 96 l6 12 l12 6 l-12 6 l-6 12 l-6 -12 l-12 -6 l12 -6 Z"
        fill="#fbbf24"
        opacity="0.9"
      />
      <circle cx="320" cy="120" r="6" fill="#93c5fd" />
      <circle cx="300" cy="210" r="4" fill="#bfdbfe" />
      <circle cx="96" cy="200" r="5" fill="#bfdbfe" />
    </svg>
  );
}

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="relative z-10 flex min-h-screen flex-grow items-center justify-center overflow-hidden bg-background px-6 py-12 md:px-32">
      <BlobBackground />
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <div className="relative mb-6 flex aspect-[4/3] w-full max-w-[500px] animate-[float_6s_ease-in-out_infinite] items-center justify-center">
          <span className="pointer-events-none absolute inset-0 z-10 flex select-none items-center justify-center text-[180px] font-bold leading-none tracking-tighter text-primary/10 md:text-[280px]">
            404
          </span>
          <div className="relative z-20 flex h-[80%] w-[80%] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <Illustration />
          </div>
        </div>
        <div className="relative z-20 flex flex-col items-center space-y-4">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            {t.notFound.title}
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            {t.notFound.subtitle}
          </p>
          <div className="flex w-full flex-col items-center justify-center gap-4 pt-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <ArrowLeft className="h-5 w-5" />
              {t.notFound.back}
            </button>
            <Link
              href="/courses"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted sm:w-auto"
            >
              <Search className="h-5 w-5" />
              {t.notFound.explore}
            </Link>
          </div>
        </div>
        <div className="mt-16">
          <span className="select-none text-2xl font-bold text-primary opacity-50">
            EduPro
          </span>
        </div>
      </div>
    </main>
  );
}
