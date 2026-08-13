"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/user/stat-card";
import { ProgressRing } from "@/components/user/progress-ring";
import { CourseProgressCard } from "@/components/user/course-progress-card";
import { apiFetch } from "@/lib/api-client";
import type { PublicUser } from "@/types/user";
import { useI18n } from "@/i18n";

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

export default function ProfileHub() {
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

  const continueEnrollment = inProgress[0] ?? notStarted[0] ?? null;

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Welcome hero */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface-container-low to-surface-container-lowest p-6 md:p-10">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Avatar
              src={user?.avatar}
              fallback={user?.username}
              alt={user?.username ?? ""}
              size="xl"
              className="ring-4 ring-primary/10"
            />
            <div>
              <p className="mb-1 flex items-center gap-2 text-label-sm font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="size-4" />
                {t.nav.profile}
              </p>
              <h1 className="text-headline-lg font-bold text-on-surface">
                {t.dashboard.welcome(user?.username ?? "")}
              </h1>
              <p className="mt-1 text-body-md text-on-surface-variant">
                {t.dashboard.subtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/${userId}/roadmap`}>
                <Sparkles className="size-4" />
                {t.dashboard.viewRoadmap}
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/courses">
                {t.dashboard.browseCourses}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.dashboard.gpa}
          value={
            <span>
              {gpa.toFixed(1)}
              <span className="ml-1 text-label-md font-medium text-on-surface-variant">/ 4.0</span>
            </span>
          }
          hint={`${testResults.length} ${t.profile.testResults.toLowerCase()}`}
          icon={<GraduationCap className="size-6" />}
          accent="primary"
        />
        <StatCard
          label={t.dashboard.creditsCompleted}
          value={
            <span>
              {credits.completed}
              <span className="ml-1 text-label-md font-medium text-on-surface-variant">/ {credits.total}</span>
            </span>
          }
          icon={<Award className="size-6" />}
          accent="success"
        />
        <StatCard
          label={t.dashboard.coursesCompleted}
          value={completedCount}
          hint={`${enrollments.length} ${t.roadmap.courses}`}
          icon={<Trophy className="size-6" />}
          accent="warning"
        />
        <StatCard
          label={t.dashboard.overallProgress}
          value={
            <span className="flex items-center gap-3">
              <ProgressRing
                value={progressPercent}
                size={40}
                strokeWidth={5}
                colorClassName="text-primary"
                label={
                  <span className="text-label-sm font-bold text-on-surface">
                    {progressPercent}%
                  </span>
                }
              />
            </span>
          }
          icon={<TrendingUp className="size-6" />}
          accent="info"
        />
      </section>

      {/* Continue learning */}
      {continueEnrollment && (
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface-container-low to-surface-container-lowest p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex-1">
              <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-primary">
                {t.dashboard.continueLearning}
              </p>
              <h2 className="line-clamp-2 text-headline-md font-bold text-on-surface">
                {continueEnrollment.course.title}
              </h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                {continueEnrollment.progress.completedLessons} / {continueEnrollment.progress.totalLessons}{" "}
                {t.dashboard.lessonsCompleted}
              </p>
              <div className="mt-4 flex max-w-md items-center gap-4">
                <Progress
                  value={continueEnrollment.progress.percent}
                  className="h-2.5"
                  indicatorClassName="bg-primary"
                />
                <span className="shrink-0 text-label-md font-semibold text-on-surface">
                  {continueEnrollment.progress.percent}%
                </span>
              </div>
              <Button asChild className="mt-6 gap-2">
                <Link href={`/learning/${continueEnrollment.course.id}`}>
                  {t.dashboard.continueLearning}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="md:w-64">
              {continueEnrollment.course.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={continueEnrollment.course.coverImage}
                  alt={continueEnrollment.course.title}
                  className="aspect-video w-full rounded-2xl object-cover shadow-lg md:aspect-[4/3]"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-primary-container/10 md:aspect-[4/3]">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontSize: "56px" }}
                    aria-hidden="true"
                  >
                    school
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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

      {/* Personal info + Security */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 shadow-sm md:col-span-8">
          <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-3 text-title-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">badge</span>
            {t.profile.personal}
          </h2>
          <form onSubmit={handleProfileSave} className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="relative shrink-0">
              <Avatar src={user?.avatar} fallback={user?.username} alt={user?.username ?? ""} size="xl" />
            </div>
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
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
                  Student ID
                </Label>
                <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface">
                  {user?.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Email
                </Label>
                <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface">
                  {user?.email}
                </div>
              </div>
              {profileError && <Alert variant="error" className="md:col-span-2">{profileError}</Alert>}
              <Button type="submit" className="md:col-span-2">
                {t.common.save}
              </Button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-6 md:col-span-4">
          <div className="flex-1 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-3 text-title-lg font-semibold text-on-surface">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              {t.profile.security}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <div>
                  <p className="text-title-md font-semibold text-on-surface">{t.profile.twoStep}</p>
                  <p className="text-label-md text-on-surface-variant">
                    {is2faEnabled
                      ? `Enabled via ${twoStep === "EMAIL" ? "Email" : "Authenticator App"}`
                      : "Disabled"}
                  </p>
                </div>
                <Badge variant={is2faEnabled ? "success" : "outline"}>
                  {is2faEnabled ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <p className="mb-3 text-title-md font-semibold text-on-surface">{t.profile.changePassword}</p>
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="currentPassword" className="text-label-md">{t.auth.currentPassword}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="bg-surface-container-lowest"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newPassword" className="text-label-md">{t.auth.newPassword}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="bg-surface-container-lowest"
                    />
                  </div>
                  {passwordError && <Alert variant="error" className="text-sm">{passwordError}</Alert>}
                  <Button type="submit" className="w-full" disabled={passwordLoading}>
                    {passwordLoading ? t.common.saving : t.profile.changePassword}
                  </Button>
                </form>
              </div>

              {is2faEnabled && (
                <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <p className="mb-3 text-title-md font-semibold text-on-surface">
                    {t.profile.twoStep} — Disable
                  </p>
                  <form onSubmit={handleDisable2fa} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="disablePassword" className="text-label-md">{t.auth.currentPassword}</Label>
                      <Input
                        id="disablePassword"
                        type="password"
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