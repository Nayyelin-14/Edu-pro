import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Clock,
  CreditCard,
  Infinity as InfinityIcon,
  Lock,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutButton } from "@/components/checkout-button";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  if (!totalSeconds || totalSeconds <= 0) return "Self-paced";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const viewer = await getSessionUser();

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      price: true,
      coverImage: true,
      isPublished: true,
      rating: true,
      ratingCount: true,
      studentCount: true,
      category: { select: { name: true } },
      instructor: { select: { username: true, avatar: true } },
      modules: {
        select: {
          lessons: { select: { videoDuration: true } },
        },
      },
    },
  });

  if (!course || !course.isPublished) notFound();

  const totalLessons = course.modules.reduce((a, m) => a + m.lessons.length, 0);
  const totalDuration = course.modules.reduce(
    (a, m) => a + m.lessons.reduce((lt, l) => lt + (l.videoDuration ?? 0), 0),
    0,
  );
  const free = (course.price ?? 0) === 0;
  const rating = Number(course.rating ?? 0);
  const ratingCount = Number(course.ratingCount ?? 0);
  const studentCount = Number(course.studentCount ?? 0);

  if (!viewer) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${courseId}`)}`);
  }

  const includes = [
    { icon: InfinityIcon, label: "Full lifetime access" },
    { icon: BookOpen, label: `${totalLessons} on-demand lessons` },
    { icon: Clock, label: `Approx. ${formatDuration(totalDuration)} of content` },
    { icon: BadgeCheck, label: "Certificate of completion" },
    { icon: ShieldCheck, label: "30-day money-back guarantee" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link
            href={`/courses/${course.slug}`}
            className="group flex items-center gap-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm transition-all group-hover:border-primary/40 group-hover:text-primary">
              <ArrowLeft className="size-4" />
            </span>
            <span className="hidden sm:inline">Back to course</span>
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Secure checkout
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Checkout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your order before you pay. You&apos;ll be enrolled instantly after payment.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* ── Order summary ── */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex gap-5 p-6">
                <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                  {course.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-3xl">🌿</div>
                  )}
                </div>

                <div className="min-w-0">
                  {course.category && (
                    <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {course.category.name}
                    </span>
                  )}
                  <h2 className="mt-2 text-lg font-bold leading-snug text-foreground">
                    {course.title}
                  </h2>
                  {course.subtitle && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {course.subtitle}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-foreground">
                        {rating.toFixed(1)}
                      </span>
                      {ratingCount > 0 && <span>({ratingCount.toLocaleString("en-US")})</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {studentCount.toLocaleString("en-US")} students
                    </span>
                    {course.instructor?.username && (
                      <span>by {course.instructor.username}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-border px-6 py-5">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  This course includes
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {includes.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3 text-sm text-foreground">
                      <Icon className="size-4 shrink-0 text-emerald-500" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Payment ── */}
          <div className="lg:col-span-5">
            <div className="sticky top-20 overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-primary/5">
              <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-accent" />
              <div className="p-6">
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total
                </div>
                <div className="mb-5 flex items-end gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">
                    {free ? "Free" : `฿${Number(course.price ?? 0).toLocaleString("en-US")}`}
                  </span>
                </div>

                <CheckoutButton
                  courseId={course.id}
                  price={course.price ?? 0}
                  isFree={free}
                />

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Lock className="size-3.5" />
                  Payments are secure and encrypted by Stripe
                </div>

                <ul className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2.5">
                    <CreditCard className="size-4 text-primary" />
                    Visa, Mastercard and more via Stripe
                  </li>
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    Instant enrollment after payment
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
