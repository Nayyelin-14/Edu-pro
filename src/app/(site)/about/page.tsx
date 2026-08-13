"use client";

import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="about-editorial mx-auto flex w-full max-w-container-max flex-col gap-20 px-margin-mobile py-12 md:gap-28 md:px-margin-desktop md:py-20">
      <style jsx>{`
        @keyframes about-fade-up {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes about-soft-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        .about-fade-up {
          animation: about-fade-up 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .about-delay-1 {
          animation-delay: 100ms;
        }

        .about-delay-2 {
          animation-delay: 180ms;
        }

        .about-delay-3 {
          animation-delay: 260ms;
        }

        .about-soft-float {
          animation: about-soft-float 7s ease-in-out infinite;
        }

        .about-value-card {
          transition:
            transform 250ms ease,
            border-color 250ms ease,
            box-shadow 250ms ease;
        }

        .about-value-card:hover {
          transform: translateY(-4px);
          border-color: hsl(var(--primary) / 0.4);
          box-shadow: 0 16px 36px hsl(var(--primary) / 0.08);
        }

        @media (prefers-reduced-motion: reduce) {
          .about-editorial *,
          .about-editorial *::before,
          .about-editorial *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      {/* Quiet, editorial introduction */}
      <section className="grid items-center gap-12 md:grid-cols-[0.95fr_1.05fr] md:gap-20">
        <div className="about-fade-up max-w-xl">
          <p className="mb-6 text-label-md font-semibold uppercase tracking-[0.18em] text-primary">
            About EduPro
          </p>
          <h1 className="text-headline-lg-mobile font-bold leading-[1.08] tracking-[-0.045em] text-on-surface md:text-display-lg">
            Empowering the next generation of{" "}
            <span className="text-primary">professionals.</span>
          </h1>
          <p className="mt-7 max-w-lg text-body-lg leading-relaxed text-on-surface-variant">
            EduPro is a premium learning platform designed to bridge the gap
            between academic theory and practical, real-world skills. We provide
            high-utility courses for driven individuals.
          </p>
          <a
            href="#story"
            className="mt-8 inline-flex items-center gap-2 border-b border-primary/40 pb-1.5 text-label-md font-semibold text-primary transition-colors hover:border-primary hover:text-primary-fixed-variant"
          >
            Discover our story
            <span className="material-symbols-outlined text-base">
              arrow_downward
            </span>
          </a>
        </div>

        <div className="about-fade-up about-delay-1 relative">
          <div className="relative mx-auto aspect-[4/3] max-w-[620px] overflow-hidden rounded-[2rem] border border-outline-variant bg-[#073f43] shadow-[0_18px_60px_rgba(4,71,73,0.16)]">
            <Image
              src="/images/edupro-about-hero.png"
              alt="An open book becoming a pathway of learning"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 52vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#073f43]/25 via-transparent to-white/10" />
            <div className="about-soft-float absolute bottom-5 left-5 rounded-xl border border-white/20 bg-[#073f43]/65 px-4 py-3 text-white backdrop-blur-md">
              <p className="text-label-md text-white/65">Our approach</p>
              <p className="mt-0.5 text-title-md font-bold">
                Practical by design
              </p>
            </div>
          </div>
          <div
            className="about-soft-float absolute -bottom-5 -right-4 -z-10 size-32 rounded-full bg-primary/15 blur-2xl"
            aria-hidden="true"
          />
        </div>
      </section>

      {/* Story */}
      <section className="scroll-mt-24" id="story">
        <div className="grid gap-10 border-y border-outline-variant/70 py-12 md:grid-cols-[0.65fr_1.35fr] md:gap-20 md:py-16">
          <div className="about-fade-up">
            <p className="text-label-md font-semibold uppercase tracking-[0.18em] text-primary">
              Our story
            </p>
            <h2 className="mt-4 text-headline-md font-bold tracking-[-0.035em] text-on-surface">
              Built from a simple belief.
            </h2>
          </div>
          <div className="about-fade-up about-delay-1 space-y-5 text-body-lg leading-relaxed text-on-surface-variant">
            <p>
              Founded in 2020, EduPro began as an internal training tool for a
              top-tier consulting firm before evolving into a public platform
              dedicated to elevating professional standards globally.
            </p>
            <p>
              We believe learning becomes meaningful when it changes what a
              person can do. That is why every part of EduPro is designed around
              clarity, progression, and practical application.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="space-y-10">
        <div className="max-w-2xl">
          <p className="text-label-md font-semibold uppercase tracking-[0.18em] text-primary">
            What we value
          </p>
          <h2 className="mt-4 text-headline-md font-bold tracking-[-0.035em] text-on-surface">
            Precision in education.
          </h2>
          <p className="mt-4 text-body-md leading-relaxed text-on-surface-variant">
            Our foundation is built on structural integrity, cognitive focus,
            and professional rigor.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <article className="about-value-card about-fade-up about-delay-1 rounded-[1.5rem] border border-outline-variant bg-surface-container-low p-7 md:p-8">
            <div className="mb-8 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface">
              Structural Integrity
            </h3>
            <p className="mt-4 text-body-md leading-relaxed text-on-surface-variant">
              We design our curriculum like an architect designs a building:
              with a solid foundation, clear progression paths, and an emphasis
              on functional utility over trendy ornaments. Every course serves a
              distinct professional purpose.
            </p>
          </article>

          <article className="about-value-card about-fade-up about-delay-2 rounded-[1.5rem] border border-outline-variant bg-surface-container-low p-7 md:p-8">
            <div className="mb-8 flex size-11 items-center justify-center rounded-xl bg-secondary/15 text-primary">
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                psychology
              </span>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface">
              Cognitive Focus
            </h3>
            <p className="mt-4 text-body-md leading-relaxed text-on-surface-variant">
              Our platform is designed to reduce cognitive load, allowing the
              course content to remain the absolute focal point of the user
              experience.
            </p>
          </article>

          <article className="about-value-card about-fade-up about-delay-3 rounded-[1.5rem] border border-outline-variant bg-surface-container-low p-7 md:p-8">
            <div className="mb-8 flex size-11 items-center justify-center rounded-xl bg-success/15 text-success">
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface">
              Professional Rigor
            </h3>
            <p className="mt-4 text-body-md leading-relaxed text-on-surface-variant">
              We partner with industry leaders to ensure every certification
              carries weight and respect in the professional marketplace.
            </p>
          </article>
        </div>
      </section>

      {/* Low-pressure closing invitation */}
      <section className="flex flex-col items-start justify-between gap-7 border-t border-outline-variant/70 pt-10 md:flex-row md:items-center">
        <div className="max-w-xl">
          <p className="text-label-md font-semibold uppercase tracking-[0.18em] text-primary">
            Continue exploring
          </p>
          <h2 className="mt-3 text-headline-sm font-bold tracking-[-0.025em] text-on-surface md:text-headline-md">
            See what purposeful learning looks like.
          </h2>
        </div>
        <Link
          href="/courses"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary bg-primary/5 px-5 py-3 text-label-md font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-on-primary"
        >
          Browse Courses
          <span className="material-symbols-outlined text-base">
            arrow_forward
          </span>
        </Link>
      </section>
    </main>
  );
}
