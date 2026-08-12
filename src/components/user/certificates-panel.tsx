"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

interface Certificate {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  pdfUrl: string | null;
  course: { id: string; title: string; slug: string };
}

const certificateImages = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD3-pAQQ4Ch_pOWXRvxt4vraJZTEcpZLhY6CFyuZFfRxMKdBApCEPZ7T9FLggB13ouVR4uBvS-rtcMIkcArK9Y3-fYdwCGbIBM5hm9za0A0mJYbN5EYuOckFk6fQEkI9whw29kk2v6ZUzGN-2OewW4XZpKb6v8ErOM_b2PJHHlbHJA6yjYKl7bhSXaUu51PcXQHgZgs7jVw2UgzR7gehQyG84fLI-oLQgWJ4N3QYdgtS0ONakEBn5c8UA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgI1RNK9GPduThyjg4weQfSwA8tq7IxwOL48VxmaA5d8opOhnNuIkw7PFzVcCtYKUpSSnZYRwPnW2Kn7_t5L7pGCGrezq5Vb1eCvk896u6nTprl44ydYtrrnvawNK9eJcZyjPKbpfCAf62m8gDZA5djxrjPiSJ7x6rOAuYnsiwRLrrdD6lJhIJEt__wPHuJpEd6JfMvsDlaqruV6eyt6S-wNUg1Nj8G_zNq5b1LzPVJ8HYKR5vQ52LIw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCtLrO4FLpSULexCfL9yBUmW0kl8KhEqRytHyCw8u6rZsnktKl9qu4fBacHKRYwpN0s5BkCjDebW5201LHhX9H3JArfUEXILyckgMgTPskG38Ej9_2kA6Fg9Yx7OC1CeaPtZHQ_BtOXHCF7d-hQDuYzvxbhmDKxtr9IcCwP2NX0vwjNNdo_9MPBlFFsXnBogH9_-OXBYA59IyNDyDhyDjxErSmqfACA6tcNs1b4ufSQF35vspNLNYlhAg",
];

export function CertificatesPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () =>
      apiFetch<{ certificates: Certificate[] }>("/api/me/certificates"),
  });

  const certificates = data?.certificates ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <div className="p-6 space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
              <div className="flex gap-2 mt-6">
                <Skeleton className="flex-1 h-10" />
                <Skeleton className="w-10 h-10 rounded" />
                <Skeleton className="w-10 h-10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-body-md text-on-surface-variant">
        Failed to load certificates.
      </p>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="text-center py-12">
        <span
          className="material-symbols-outlined text-6xl text-on-surface-variant/50 mb-4 block"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          workspace_premium
        </span>
        <h3 className="text-title-lg text-on-surface mb-2">No certificates yet</h3>
        <p className="text-body-md text-on-surface-variant">
          Complete a course and pass the final test to earn your first certificate.
        </p>
        <Link
          href="/courses"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 text-label-md text-white transition-colors hover:bg-primary-fixed-variant"
        >
          Browse Courses
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
      {certificates.map((cert, index) => (
        <div
          key={cert.id}
          className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] transition-shadow"
        >
          <div className="relative h-40 bg-surface-container flex items-center justify-center p-6 border-b border-outline-variant">
            <div
              className="absolute inset-0 bg-cover bg-center w-full h-full opacity-50"
              style={{ backgroundImage: `url(${certificateImages[index % certificateImages.length]})` }}
            />
            <span
              className="material-symbols-outlined text-primary text-[64px] z-10"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              workspace_premium
            </span>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <span className="inline-block px-2 py-1 bg-primary-container/10 text-primary-fixed-variant text-label-sm font-label-sm rounded mb-2">
                Completed
              </span>
              <h3 className="text-title-lg font-title-lg text-on-surface mb-1 line-clamp-2">
                {cert.course.title}
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Issued: {new Date(cert.issuedAt).toLocaleDateString()}
              </p>
              <p className="text-label-sm text-outline mt-1">
                ID: {cert.certificateNumber}
              </p>
            </div>
            <div className="flex gap-2 mt-6">
              <Link
                href={cert.pdfUrl || `/certificates/verify?number=${cert.certificateNumber}`}
                target={cert.pdfUrl ? "_blank" : undefined}
                rel={cert.pdfUrl ? "noreferrer" : undefined}
                className="flex-1 bg-primary-container text-on-primary text-label-md font-label-md py-2 rounded font-medium transition-colors text-center hover:bg-primary"
              >
                View
              </Link>
              {cert.pdfUrl && (
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-none w-10 h-10 border border-outline-variant rounded flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                  title="Download"
                >
                  <FileDown className="size-5" />
                </a>
              )}
              <Link
                href={`/certificates/verify?number=${cert.certificateNumber}`}
                className="flex-none w-10 h-10 border border-outline-variant rounded flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                title="Verify"
              >
                <span className="material-symbols-outlined text-base">verified</span>
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}