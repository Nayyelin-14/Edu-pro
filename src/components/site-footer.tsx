"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto mx-auto flex w-full max-w-container-max flex-col justify-between border-t border-outline-variant bg-surface-container-low px-margin-desktop py-stack-lg md:flex-row">
      <div className="mb-6 md:mb-0">
        <div className="mb-2 flex items-center gap-2 text-title-lg font-bold text-primary">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            school
          </span>
          EduPro
        </div>
        <p className="text-label-sm text-on-surface-variant">© 2024 EduPro Corporate Modernism. All rights reserved.</p>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Link href="/about" className="text-body-md text-primary underline opacity-70 transition-opacity hover:opacity-100">
          {t.nav.about}
        </Link>
        <Link href="/courses" className="text-body-md text-on-surface-variant transition-colors hover:text-primary">
          {t.nav.courses}
        </Link>
        <Link href="/privacy" className="text-body-md text-on-surface-variant transition-colors hover:text-primary">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-body-md text-on-surface-variant transition-colors hover:text-primary">
          Terms of Service
        </Link>
        <Link href="/help" className="text-body-md text-on-surface-variant transition-colors hover:text-primary">
          Help Center
        </Link>
      </div>
    </footer>
  );
}
