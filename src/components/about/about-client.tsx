"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

interface AboutTeamMember {
  id: string;
  username: string;
  avatar?: string | null;
  courseCount: number;
}

interface AboutClientProps {
  counts: {
    students: number;
    courses: number;
    certificates: number;
  };
  team: AboutTeamMember[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" as const },
  },
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AboutClient({ counts, team }: AboutClientProps) {
  const { t } = useI18n();

  const stats = [
    { value: "2020", label: t.about.stats.founded, color: "from-indigo-500 to-violet-600" },
    { value: `${formatCount(counts.students)}+`, label: t.about.stats.students, color: "from-cyan-500 to-blue-500" },
    { value: `${formatCount(counts.courses)}+`, label: t.about.stats.courses, color: "from-emerald-500 to-teal-600" },
    { value: `${formatCount(counts.certificates)}+`, label: t.about.stats.certificates, color: "from-amber-400 to-orange-500" },
  ];

  const valueIcons = [Target, ShieldCheck, Award];
  const valueColors = [
    "from-indigo-500 to-violet-600",
    "from-cyan-500 to-blue-500",
    "from-emerald-500 to-teal-600",
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-primary/10 via-accent/5 to-background px-6 py-20 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[-10rem] left-[-6rem] h-80 w-80 rounded-full bg-accent/20 blur-[100px]" />
          <div className="absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-primary/15 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.about.badge}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 bg-gradient-to-r from-primary via-violet-600 to-accent bg-clip-text pb-2 text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          >
            {t.about.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground"
          >
            {t.about.subtitle}
          </motion.p>
        </div>
      </section>

      {/* STATS */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
          >
            <div
              className={`mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} shadow-md`}
            >
              <Award className="h-4 w-4 text-white" />
            </div>
            <p className="font-mono text-2xl font-extrabold text-foreground">
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </motion.section>

      {/* TEAM */}
      {team.length > 0 && (
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t.about.teamTitle}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.about.teamSubtitle}
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: (i % 4) * 0.07, duration: 0.5 }}
                className="rounded-2xl border border-border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-primary text-sm font-bold text-white shadow-md">
                  {initialsOf(member.username)}
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">
                  {member.username}
                </p>
                <p className="mt-0.5 text-xs font-medium text-primary">
                  {t.about.instructor}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.about.coursesTaught(member.courseCount)}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* VALUES */}
      <section className="pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t.about.valuesTitle}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {t.about.valuesSubtitle}
          </p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          {t.about.values.map((value, i) => {
            const Icon = valueIcons[i] ?? BookOpen;
            const color = valueColors[i] ?? "from-indigo-500 to-violet-600";

            return (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                  {value.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {value.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-violet-600 to-accent px-6 py-16 text-center text-white shadow-2xl shadow-primary/20 sm:px-12"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[100px]" />

          <div className="relative mx-auto max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              {t.about.ctaEyebrow}
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {t.about.ctaTitle}
            </h2>

            <Button
              asChild
              size="lg"
              className="mt-9 h-12 bg-white px-7 text-primary shadow-xl hover:bg-white/90"
            >
              <Link href="/courses">
                {t.about.ctaButton}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </main>
  );
}