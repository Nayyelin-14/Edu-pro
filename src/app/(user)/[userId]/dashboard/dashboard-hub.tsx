"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  CheckCircle,
  Clock,
  GraduationCap,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { CourseProgressCard } from "@/components/user/course-progress-card";
import { PageHeader } from "@/components/user/page-header";
import { apiFetch } from "@/lib/api-client";
import { courseGradient, cn } from "@/lib/utils";
import type { PublicUser } from "@/types/user";
import { useI18n } from "@/i18n";
import { useRoadmaps } from "@/hooks/use-roadmaps";
import { Route } from "lucide-react";

interface Certificate {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  pdfUrl: string | null;
  course: { id: string; title: string; slug: string };
}

interface ScoresResponse {
  quizResults: Array<{
    id: string;
    score: number;
    total: number;
    passed: boolean;
    createdAt: string;
    quiz: { id: string; title: string; module: { course: { id: string; title: string } } };
  }>;
  testResults: Array<{
    id: string;
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    submittedAt: string;
    test: { id: string; title: string; course: { id: string; title: string } };
  }>;
}

interface EnrollmentProgress {
  enrolledAt: string;
  course: { id: string; slug: string; title: string; coverImage: string | null; price: number; category: { id: string; name: string } | null };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

function calcGPA(testResults: ScoresResponse["testResults"]): number {
  if (testResults.length === 0) return 0;
  const avg = testResults.reduce((sum, r) => sum + r.percent, 0) / testResults.length;
  return Math.round((avg / 100) * 40) / 10;
}

function calcCredits(enrollments: EnrollmentProgress[]): { completed: number; total: number } {
  const completed = enrollments.filter(e => e.progress.percent === 100 && e.progress.totalLessons > 0).length;
  return { completed, total: enrollments.length * 3 };
}

export default function DashboardHub() {
  const params = useParams();
  const userId = params.userId as string;
  const { user, refresh, setUser } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const [username, setUsername] = useState<string | null>(null);
  const avatar = user?.avatar ?? "";
  const [profileError, setProfileError] = useState("");

  const usernameValue = username ?? user?.username ?? "";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  const { data: certsData, isLoading: certsLoading } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => apiFetch<{ certificates: Certificate[] }>("/api/me/certificates"),
  });

  const { data: scoresData } = useQuery({
    queryKey: ["my-scores"],
    queryFn: () => apiFetch<ScoresResponse>("/api/me/scores"),
  });

  const { data: enrollmentsData } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => apiFetch<{ enrollments: EnrollmentProgress[] }>("/api/me/enrollments"),
  });

  const { data: roadmapsData, isLoading: roadmapsLoading } = useRoadmaps();

  const certificates = certsData?.certificates ?? [];
  const testResults = scoresData?.testResults ?? [];
  const enrollments = enrollmentsData?.enrollments ?? [];

  const gpa = calcGPA(testResults);
  const credits = calcCredits(enrollments);
  const completedCount = enrollments.filter(e => e.progress.percent === 100 && e.progress.totalLessons > 0).length;
  const progressPercent = enrollments.length > 0
    ? Math.round(completedCount / enrollments.length * 100)
    : 0;

  const inProgress = enrollments
    .filter((e) => e.progress.percent > 0 && !(e.progress.percent === 100 && e.progress.totalLessons > 0))
    .sort((a, b) => +new Date(b.enrolledAt) - +new Date(a.enrolledAt));
  const notStarted = enrollments.filter((e) => e.progress.percent === 0);

  const savedRoadmaps = roadmapsData?.roadmaps ?? [];
  const activeRoadmap =
    savedRoadmaps.find((r) => r.nextAction.type !== "none") ?? savedRoadmaps[0] ?? null;

  const twoStep = user?.twoStep ?? "DISABLED";
  const is2faEnabled = twoStep !== "DISABLED";

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    try {
      const data = await apiFetch<{ user: PublicUser }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ username: usernameValue, avatar }),
      });
      setUser(data.user);
      setUsername(null);
      toast("Profile updated", "success");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordLoading(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      toast("Password changed", "success");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDisable2fa = async (e: FormEvent) => {
    e.preventDefault();
    setDisableError("");
    setDisableLoading(true);
    try {
      await apiFetch("/api/auth/disable-2fa", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword }),
      });
      await refresh();
      setDisablePassword("");
      toast("Two-step verification disabled", "success");
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDisableLoading(false);
    }
  };

  const miniStats: { v: string; l: string; I: typeof Award; c: string }[] = [
    { v: gpa.toFixed(1), l: t.dashboard.gpa, I: GraduationCap, c: "text-primary" },
    { v: String(completedCount), l: t.dashboard.coursesCompleted, I: CheckCircle, c: "text-emerald-500" },
    { v: String(certificates.length), l: t.nav.certificates, I: Award, c: "text-amber-500" },
    { v: `${credits.completed}`, l: t.dashboard.creditsCompleted, I: Clock, c: "text-orange-500" },
  ];

  return (
    <div className="space-y-8 md:space-y-10">
      <PageHeader
        eyebrow={t.nav.dashboard}
        title={t.nav.dashboard}
        subtitle={t.dashboard.subtitle}
      />

      {/* Prototype 3-col hub */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2-col: edit form */}
        <div className="space-y-4 lg:col-span-2">
          {/* Profile Information */}
          <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
            <h2 className="mb-4 text-title-lg font-bold text-on-surface">
              {t.profile.personal}
            </h2>
            <div className="mb-5 flex items-center gap-4">
              <Avatar
                src={user?.avatar}
                fallback={user?.username}
                alt={user?.username ?? ""}
                size="xl"
              />
              <div>
                <p className="font-semibold text-on-surface">{user?.username}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {t.profile.level} {gpa.toFixed(1)} · {t.dashboard.gpa}
                </p>
              </div>
            </div>
            <form onSubmit={handleProfileSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  {t.auth.username}
                </Label>
                <Input
                  id="username"
                  value={usernameValue}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={30}
                  className="bg-surface-container-low"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Email
                </Label>
                <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface">
                  {user?.email}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Student ID
                </Label>
                <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-body-md text-on-surface">
                  {user?.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              {profileError && <Alert variant="error" className="md:col-span-2">{profileError}</Alert>}
              <div className="flex justify-end md:col-span-2">
                <Button type="submit">{t.profile.saveChanges}</Button>
              </div>
            </form>
          </div>

          {/* Security */}
          <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
            <h2 className="mb-4 text-title-lg font-bold text-on-surface">
              {t.profile.security}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
                <div>
                  <p className="text-label-md font-medium text-on-surface">
                    {t.profile.twoFactor}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {t.profile.twoFactorDesc}
                  </p>
                </div>
                <Badge variant={is2faEnabled ? "success" : "outline"}>
                  {is2faEnabled ? "Active" : "Inactive"}
                </Badge>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="currentPassword" className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {t.auth.currentPassword}
                    </Label>
                    <PasswordInput
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="bg-surface-container-low"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="newPassword" className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {t.auth.newPassword}
                    </Label>
                    <PasswordInput
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="bg-surface-container-low"
                    />
                  </div>
                </div>
                {passwordError && <Alert variant="error" className="text-sm">{passwordError}</Alert>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordLoading}>
                    {passwordLoading ? t.common.saving : t.profile.updatePassword}
                  </Button>
                </div>
              </form>

              {is2faEnabled && (
                <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <p className="mb-3 text-title-md font-semibold text-on-surface">
                    {t.profile.twoStep} — Disable
                  </p>
                  <form onSubmit={handleDisable2fa} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="disablePassword" className="text-label-md">{t.auth.currentPassword}</Label>
                      <PasswordInput
                        id="disablePassword"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        required
                        className="bg-surface-container-lowest"
                      />
                    </div>
                    {disableError && <Alert variant="error" className="text-sm">{disableError}</Alert>}
                    <Button type="submit" variant="outline" className="w-full" disabled={disableLoading}>
                      {disableLoading ? t.common.saving : "Disable 2FA"}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1-col: stats */}
        <div className="space-y-4">
          {/* Gradient progress card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary via-primary-fixed-variant to-success p-5 text-white shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-label-sm font-medium text-white/70">
                {t.profile.level} {gpa.toFixed(1)} · {user?.username}
              </p>
              <Trophy className="size-5 text-amber-300" aria-hidden="true" />
            </div>
            <p className="mb-0.5 font-mono text-headline-lg font-extrabold">
              {progressPercent}%
            </p>
            <p className="mb-3 text-label-sm text-white/55">
              {t.dashboard.overallProgress}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 2x2 mini stats */}
          <div className="grid grid-cols-2 gap-3">
            {miniStats.map(({ v, l, I, c }) => (
              <div key={l} className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-3 text-center shadow-sm">
                <I className={`mx-auto mb-1 size-4 ${c}`} aria-hidden="true" />
                <p className="font-mono text-title-md font-bold text-on-surface">{v}</p>
                <p className="text-label-sm text-on-surface-variant">{l}</p>
              </div>
            ))}
          </div>

          {/* Continue learning */}
          <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-sm">
            <h3 className="mb-3 text-title-md font-semibold text-on-surface">
              {t.dashboard.continueLearning}
            </h3>
            {inProgress.length === 0 ? (
              <p className="py-4 text-center text-label-md text-on-surface-variant">
                {t.dashboard.noActiveCourses}
              </p>
            ) : (
              <ul className="space-y-1">
                {inProgress.slice(0, 2).map((en) => (
                  <li key={en.course.id}>
                    <Link
                      href={`/learning/${en.course.id}`}
                      className="flex items-center gap-3 rounded-lg py-2 transition-opacity hover:opacity-80"
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                          courseGradient(en.course.category?.name ?? en.course.id),
                        )}
                      >
                        <Sparkles className="size-4 text-white" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label-sm font-medium text-on-surface">
                          {en.course.title}
                        </p>
                        <Progress
                          value={en.progress.percent}
                          className="mt-1 h-1.5"
                          indicatorClassName="bg-gradient-to-r from-primary to-accent"
                        />
                      </div>
                      <span className="shrink-0 font-mono text-label-sm text-on-surface-variant">
                        {en.progress.percent}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Next up in learning path */}
          <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-title-md font-semibold text-on-surface">
              <Route className="size-4 text-primary" aria-hidden="true" />
              {t.dashboard.nextUpInPath}
            </h3>

            {roadmapsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !activeRoadmap ? (
              <div className="py-4 text-center">
                <p className="mb-3 text-label-md text-on-surface-variant">
                  {t.dashboard.noPathYet}
                </p>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/${userId}/roadmap`}>
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    {t.dashboard.buildPath}
                  </Link>
                </Button>
              </div>
            ) : (
              <div>
                <p className="line-clamp-1 text-label-sm font-medium text-on-surface">
                  {activeRoadmap.title}
                </p>
                <div className="mb-3 flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <span>{activeRoadmap.matchedStages} {t.roadmap.courses}</span>
                  <span>·</span>
                  <span>{activeRoadmap.progressPercent}%</span>
                </div>

                {activeRoadmap.nextAction.courseId ? (
                  <Button asChild className="w-full gap-2">
                    <Link href={`/learning/${activeRoadmap.nextAction.courseId}`}>
                      {activeRoadmap.nextAction.type === "complete"
                        ? t.roadmap.reviewCourse
                        : activeRoadmap.nextAction.type === "continue"
                          ? t.dashboard.continueLearning
                          : t.dashboard.startLearning}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="w-full gap-2">
                    <Link href={`/${userId}/roadmap/${activeRoadmap.id}`}>
                      {t.dashboard.viewLearningPath}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active courses */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-title-lg font-bold text-on-surface">{t.dashboard.activeCourses}</h2>
            <p className="text-body-md text-on-surface-variant">{t.dashboard.activeCoursesSubtitle}</p>
          </div>
          <Link
            href={`/${userId}/my-courses`}
            className="shrink-0 text-label-md font-medium text-primary hover:underline"
          >
            {t.dashboard.viewAllCourses}
          </Link>
        </div>
        {enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest/50 p-10 text-center">
            <p className="text-body-md text-on-surface-variant">{t.dashboard.noActiveCourses}</p>
            <Button asChild className="mt-4 gap-2">
              <Link href="/courses">
                {t.dashboard.browseCourses}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...inProgress, ...notStarted].slice(0, 3).map((en) => (
              <CourseProgressCard key={en.course.id} enrollment={en} />
            ))}
          </div>
        )}
      </section>

      {/* Academic performance + recent certificates */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 shadow-sm lg:col-span-5">
          <h2 className="mb-5 flex items-center gap-2 border-b border-outline-variant pb-3 text-title-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">military_tech</span>
            Academic Performance
          </h2>
          <div className="space-y-5">
            <div>
              <div className="mb-1 flex justify-between text-label-md text-on-surface-variant">
                <span>GPA</span>
                <span className="font-semibold text-primary">{gpa.toFixed(1)} / 4.0</span>
              </div>
              <Progress value={Math.min((gpa / 4) * 100, 100)} className="h-2" indicatorClassName="bg-primary" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-label-md text-on-surface-variant">
                <span>{t.dashboard.creditsCompleted}</span>
                <span className="font-semibold text-on-surface">{credits.completed} / {credits.total}</span>
              </div>
              <Progress
                value={credits.total > 0 ? (credits.completed / credits.total) * 100 : 0}
                className="h-2"
                indicatorClassName="bg-success"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-label-md text-on-surface-variant">
                <span>{t.dashboard.overallProgress}</span>
                <span className="font-semibold text-on-surface">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" indicatorClassName="bg-warning" />
            </div>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link href={`/${userId}/roadmap`}>
                <Sparkles className="size-4" />
                {t.dashboard.viewRoadmap}
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between border-b border-outline-variant pb-3">
            <h2 className="text-title-lg font-semibold text-on-surface">{t.dashboard.recentCertificates}</h2>
            <Link
              href={`/${userId}/certificates`}
              className="text-label-md font-medium text-primary hover:underline"
            >
              {t.dashboard.viewAllCertificates}
            </Link>
          </div>
          {certsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-outline-variant p-3">
                  <Skeleton className="size-12 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : certificates.length === 0 ? (
            <div className="py-8 text-center">
              <span
                className="material-symbols-outlined mb-3 block text-6xl text-on-surface-variant/50"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                workspace_premium
              </span>
              <h3 className="text-title-lg font-semibold text-on-surface">{t.profile.noCertificates}</h3>
              <Button asChild className="mt-4 gap-2">
                <Link href="/courses">
                  {t.dashboard.browseCourses}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {certificates.slice(0, 4).map((cert) => (
                <Link
                  key={cert.id}
                  href={cert.pdfUrl || `/certificates/verify?number=${cert.certificateNumber}`}
                  target={cert.pdfUrl ? "_blank" : undefined}
                  rel={cert.pdfUrl ? "noreferrer" : undefined}
                  className="group flex items-center gap-4 rounded-xl border border-outline-variant p-3 transition-colors hover:border-primary"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <span className="material-symbols-outlined" aria-hidden="true">workspace_premium</span>
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-title-md font-semibold text-on-surface">{cert.course.title}</span>
                    <span className="text-label-md text-on-surface-variant">
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}