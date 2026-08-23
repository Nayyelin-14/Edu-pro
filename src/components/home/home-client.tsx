"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Play,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";

import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

interface Category {
  id: string;
  name: string;
  slug: string;
  _count: { courses: number };
}

interface HomeClientProps {
  featured: CourseCardCourse[];
  categories: Category[];
  counts: { students: number; courses: number; certificates: number };
}

const categoryThemes = [
  {
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    glow: "bg-violet-300/40",
    icon: BookOpen,
  },
  {
    gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    glow: "bg-cyan-300/40",
    icon: Zap,
  },
  {
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "bg-emerald-300/40",
    icon: Users,
  },
  {
    gradient: "from-orange-400 via-rose-500 to-pink-600",
    glow: "bg-orange-300/40",
    icon: Sparkles,
  },
  {
    gradient: "from-fuchsia-500 via-purple-500 to-violet-600",
    glow: "bg-fuchsia-300/40",
    icon: Play,
  },
];

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

function StatPill({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Users; color: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className={`mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="font-mono text-2xl font-extrabold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
}

export function HomeClient({ featured, categories, counts }: HomeClientProps) {
  const { t } = useI18n();

  const stats = [
    { label: t.home.stats.students, value: `${formatCount(counts.students)}+`, icon: Users, color: "from-indigo-500 to-violet-600" },
    { label: t.home.stats.courses, value: `${formatCount(counts.courses)}+`, icon: BookOpen, color: "from-cyan-500 to-blue-500" },
    { label: t.home.stats.rating, value: "4.8★", icon: Star, color: "from-amber-400 to-orange-500" },
    { label: t.home.stats.certificates, value: `${formatCount(counts.certificates)}+`, icon: Award, color: "from-emerald-500 to-teal-600" },
  ];

  const steps = [
    { n: "01", title: t.home.steps[0]!.title, desc: t.home.steps[0]!.desc, Icon: Target, color: "from-indigo-500 to-violet-600" },
    { n: "02", title: t.home.steps[1]!.title, desc: t.home.steps[1]!.desc, Icon: Play, color: "from-cyan-500 to-blue-500" },
    { n: "03", title: t.home.steps[2]!.title, desc: t.home.steps[2]!.desc, Icon: Award, color: "from-emerald-500 to-teal-600" },
  ];

  const testimonials = [
    { quote: t.home.testimonials.quotes[0]!, role: t.home.testimonials.roles[0]!, initials: "FD" },
    { quote: t.home.testimonials.quotes[1]!, role: t.home.testimonials.roles[1]!, initials: "PD" },
    { quote: t.home.testimonials.quotes[2]!, role: t.home.testimonials.roles[2]!, initials: "DA" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-accent p-8 sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-black/15 blur-3xl" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          <div className="relative max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
            >
              <Sparkles className="h-3 w-3 text-amber-300" />
              {t.home.heroBadge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              {t.home.heroTitle}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-5 max-w-md text-[15px] leading-relaxed text-white/75"
            >
              {t.home.heroSubtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Button
                asChild
                size="lg"
                className="h-12 bg-white px-6 text-primary shadow-lg hover:bg-white/90"
              >
                <Link href="/courses">
                  {t.home.exploreCourses}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-12 border border-white/25 bg-white/15 px-6 text-white backdrop-blur-sm hover:bg-white/25"
              >
                <Link href="/about">
                  <Play className="h-4 w-4 fill-current" />
                  {t.home.learnMore}
                </Link>
              </Button>
            </motion.div>
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
          {stats.map((s) => (
            <StatPill key={s.label} {...s} icon={s.icon} />
          ))}
        </motion.section>

        {/* FEATURED COURSES */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-end justify-between"
          >
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {t.home.featured}
              </div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                {t.home.featuredSubtitle}
              </h2>
            </div>
            <Button asChild variant="ghost" className="group text-sm text-primary">
              <Link href="/courses" className="flex items-center gap-1">
                {t.common.viewAll}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </motion.div>

          {featured.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.slice(0, 3).map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.07, duration: 0.5, ease: "easeOut" }}
                >
                  <CourseCard course={course} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {t.home.empty.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.home.empty.subtitle}
              </p>
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="py-8"
        >
          <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">{t.home.howItWorks}</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {steps.map(({ n, title, desc, Icon, color }) => (
              <div
                key={n}
                className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-4xl font-black text-primary/15">{n}</span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CATEGORIES */}
        {categories.length > 0 && (
          <section className="py-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                {t.home.categories.eyebrow}
              </p>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                {t.home.categories.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.home.categories.subtitle}
              </p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category, index) => {
                const theme = categoryThemes[index % categoryThemes.length];
                const isLarge = index % 5 === 0;
                const Icon = theme?.icon || BookOpen;

                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: index * 0.05, duration: 0.5 }}
                    className={isLarge ? "sm:col-span-2 lg:col-span-2" : ""}
                  >
                    <Link
                      href={`/courses?category=${category.id}`}
                      className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${theme?.gradient} p-6 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/20`}
                    >
                      <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full ${theme?.glow} blur-3xl transition-transform duration-500 group-hover:scale-150`} />
                      <div className="absolute -bottom-16 -right-8 h-40 w-40 rounded-full border border-white/20" />

                      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="relative mt-16">
                        <h3 className="text-xl font-bold">{category.name}</h3>
                        <div className="mt-2 flex items-center text-sm font-medium text-white/70 transition-colors group-hover:text-white">
                          {t.home.courseCount(category._count.courses)}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* TESTIMONIALS */}
        <section className="py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-6 flex items-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t.home.testimonials.title}</h2>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-3">
            {testimonials.map((tItem, i) => (
              <motion.div
                key={tItem.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <p className="mb-5 text-sm italic leading-relaxed text-muted-foreground">
                  &ldquo;{tItem.quote}&rdquo;
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-primary text-sm font-semibold text-white">
                    {tItem.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tItem.role}</p>
                    <p className="text-xs text-muted-foreground">{t.home.testimonials.verified}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-violet-600 to-accent px-6 py-16 text-center text-white shadow-2xl shadow-primary/20 sm:px-12"
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[100px]" />

            <div className="relative mx-auto max-w-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-xl backdrop-blur-xl">
                <Sparkles className="h-6 w-6" />
              </div>

              <h2 className="mt-7 text-3xl font-bold tracking-tight sm:text-5xl">
                {t.home.cta.title}
              </h2>

              <p className="mx-auto mt-5 max-w-xl text-white/75">
                {t.home.cta.subtitle}
              </p>

              <Button
                asChild
                size="lg"
                className="mt-9 h-12 bg-white px-7 text-primary shadow-xl hover:bg-white/90"
              >
                <Link href="/courses">
                  {t.home.cta.button}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}