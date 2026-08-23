"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Mail, Sparkles } from "lucide-react";

import {
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa";

import { useI18n } from "@/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="relative overflow-hidden bg-[#08070d] text-white">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/4 top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-15rem] right-[-5rem] h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* =====================================================
            TOP CTA
        ====================================================== */}
        <div className="border-b border-white/10 py-14 sm:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-violet-300">
                <Sparkles className="h-4 w-4" />
                {t.footer.keepLearning}
              </div>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t.footer.nextSkillTitle}
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/50 sm:text-base">
                {t.footer.nextSkillSubtitle}
              </p>
            </div>

            <Link
              href="/courses"
              className="group inline-flex h-12 w-fit items-center rounded-xl bg-white px-6 text-sm font-semibold text-black transition-all hover:bg-white/90 hover:shadow-[0_0_40px_rgba(139,92,246,.25)]"
            >
              {t.footer.exploreCourses}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* MAIN FOOTER */}
        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr] lg:py-16">
          {/* Brand */}
          <div>
            <Link href="/" className="group inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 shadow-[0_0_25px_rgba(139,92,246,.25)]">
                <BookOpen className="h-5 w-5" />
              </div>

              <span className="text-xl font-bold tracking-tight">EduPro</span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-6 text-white/45">
              {t.footer.brandTagline}
            </p>

            {/* Social */}
            <div className="mt-6 flex items-center gap-2">
              <SocialLink
                href="#"
                label="Facebook"
                icon={<FaFacebookF className="h-4 w-4" />}
              />

              <SocialLink
                href="#"
                label="Instagram"
                icon={<FaInstagram className="h-4 w-4" />}
              />

              <SocialLink
                href="#"
                label="LinkedIn"
                icon={<FaLinkedinIn className="h-4 w-4" />}
              />

              <SocialLink
                href="#"
                label="GitHub"
                icon={<FaGithub className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-semibold text-white">{t.footer.platform}</h3>

            <nav className="mt-5 flex flex-col gap-3">
              <FooterLink href="/courses">{t.nav.courses}</FooterLink>

              <FooterLink href="/about">{t.nav.about}</FooterLink>

              <FooterLink href="/help">{t.footer.helpCenter}</FooterLink>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white">{t.footer.company}</h3>

            <nav className="mt-5 flex flex-col gap-3">
              <FooterLink href="/about">{t.footer.aboutEduPro}</FooterLink>

              <FooterLink href="/privacy">{t.footer.privacyPolicy}</FooterLink>

              <FooterLink href="/terms">{t.footer.termsOfService}</FooterLink>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-white">{t.footer.contact}</h3>

            <div className="mt-5">
              <a
                href="mailto:support@edupro.com"
                className="group inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 text-violet-400" />
                support@edupro.com
              </a>
            </div>

            <p className="mt-4 text-xs leading-5 text-white/30">
              {t.footer.supportQuestion}
            </p>
          </div>
        </div>

        {/* =====================================================
            BOTTOM BAR
        ====================================================== */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-7 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} EduPro. {t.footer.allRightsReserved}
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              {t.footer.privacy}
            </Link>

            <Link href="/terms" className="transition-colors hover:text-white">
              {t.footer.terms}
            </Link>

            <Link href="/help" className="transition-colors hover:text-white">
              {t.footer.help}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   FOOTER LINK
============================================================ */

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="w-fit text-sm text-white/45 transition-all hover:translate-x-0.5 hover:text-white"
    >
      {children}
    </Link>
  );
}

/* ============================================================
   SOCIAL LINK
============================================================ */

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/4 text-white/45 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {icon}
    </a>
  );
}
