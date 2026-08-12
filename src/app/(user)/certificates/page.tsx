"use client";

import Link from "next/link";
import { CertificatesPanel } from "@/components/user/certificates-panel";

export default function CertificatesPage() {
  return (
    <div className="flex flex-col flex-1">
      <div className="mb-stack-lg">
        <h2 className="text-headline-lg font-headline-lg text-on-surface mb-2">My Certificates</h2>
        <p className="text-body-lg font-body-lg text-on-surface-variant">View, download, and verify your earned credentials.</p>
      </div>
      <CertificatesPanel />
      <footer className="mt-auto flex flex-col md:flex-row justify-between border-t border-outline-variant bg-surface-container-low px-margin-desktop py-stack-lg max-w-container-max mx-auto w-full">
        <div className="mb-4 md:mb-0">
          <span className="text-title-lg font-title-lg font-bold text-primary block mb-2">EduPro</span>
          <p className="text-body-md font-body-md text-on-surface-variant">© 2024 EduPro Corporate Modernism. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Link href="/about" className="text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">About</Link>
          <Link href="/courses" className="text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">Courses</Link>
          <Link href="/privacy" className="text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
          <Link href="/help" className="text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">Help Center</Link>
        </div>
      </footer>
    </div>
  );
}