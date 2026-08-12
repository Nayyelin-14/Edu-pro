"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { PublicUser } from "@/types/user";

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
  const { user, refresh, setUser } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState(user?.username ?? "");
  const [avatar] = useState(user?.avatar ?? "");
  const [profileError, setProfileError] = useState("");

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
  const progressPercent = enrollments.length > 0
    ? Math.round(enrollments.filter(e => e.progress.percent === 100 && e.progress.totalLessons > 0).length / enrollments.length * 100)
    : 0;

  const twoStep = user?.twoStep ?? "DISABLED";
  const is2faEnabled = twoStep !== "DISABLED";

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    try {
      const data = await apiFetch<{ user: PublicUser }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ username, avatar }),
      });
      setUser(data.user);
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

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Profile Hub</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage your academic identity and security settings.</p>
        </div>
        <Button className="bg-primary text-on-primary px-4 py-2 rounded-lg font-title-md text-title-md hover:bg-primary-container transition-colors shadow-sm">
          Edit Profile
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-1 md:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="font-title-lg text-title-lg text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant pb-3">
            <span className="material-symbols-outlined text-primary">badge</span>
            Personal Information
          </h2>
          <form onSubmit={handleProfileSave} className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-low shrink-0 shadow-sm relative group cursor-pointer">
              <img
                alt="User Avatar"
                src={avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuBhVRdvjybrmg0mCN5Oe1la9Ss_V4z5PxdXxXxLsXTluQLl1lTlAme9IQWq5j3Ci3O8Ue3PzLMJtbXcrRoWzcgPH9tZeougheqgR0Ds9hTlFmBXkNYkjDv_5eoibuvufOEMXFaqzXy5DMTOrVm-pYkV-4vOu-Ar6GqDLFWNIGcfcmNYmFuf4gc_CwEPVFyJToG3ARQuHARM5XDX_z6MrJnpyFVgqE7aOdouRBGemrpOP6_TLfDr54jm"}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-on-surface/50 hidden group-hover:flex items-center justify-center transition-opacity">
                <span className="material-symbols-outlined text-surface-container-lowest">photo_camera</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="flex flex-col gap-1">
                <Label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Full Name</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={30}
                  className="bg-surface-container-low border-outline-variant"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Student ID</Label>
                <div className="font-body-lg text-body-lg text-on-surface bg-surface-container-low px-3 py-2 rounded-md border border-outline-variant">
                  {user?.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Email Address</Label>
                <div className="font-body-lg text-body-lg text-on-surface bg-surface-container-low px-3 py-2 rounded-md border border-outline-variant">
                  {user?.email}
                </div>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Degree Program</Label>
                <div className="font-body-lg text-body-lg text-on-surface bg-surface-container-low px-3 py-2 rounded-md border border-outline-variant">
                  Master of Science in Data Analytics
                </div>
              </div>
            </div>
          </form>
          {profileError && <Alert variant="error" className="mt-4">{profileError}</Alert>}
        </div>

        <div className="col-span-1 md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col">
          <h2 className="font-title-lg text-title-lg text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant pb-3">
            <span className="material-symbols-outlined text-primary">security</span>
            Security
          </h2>
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-between">
              <div>
                <p className="font-title-md text-title-md text-on-surface">Two-Factor Auth</p>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {is2faEnabled ? `Enabled via ${twoStep === "EMAIL" ? "Email" : "Authenticator App"}` : "Disabled"}
                </p>
              </div>
              <Badge variant={is2faEnabled ? "success" : "outline"}>
                {is2faEnabled ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant">
              <p className="font-title-md text-title-md text-on-surface mb-1">Password</p>
              <p className="font-label-md text-label-md text-on-surface-variant mb-3">Last changed 45 days ago</p>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="currentPassword" className="font-label-md text-label-md">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="bg-surface-container-lowest border-outline-variant"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newPassword" className="font-label-md text-label-md">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="bg-surface-container-lowest border-outline-variant"
                  />
                </div>
                {passwordError && <Alert variant="error" className="text-sm">{passwordError}</Alert>}
                <Button type="submit" className="w-full py-2" disabled={passwordLoading}>
                  {passwordLoading ? "Saving…" : "Change Password"}
                </Button>
              </form>
            </div>

            {is2faEnabled && (
              <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant mt-auto">
                <p className="font-title-md text-title-md text-on-surface mb-3">Disable 2FA</p>
                <form onSubmit={handleDisable2fa} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="disablePassword" className="font-label-md text-label-md">Confirm password</Label>
                    <Input
                      id="disablePassword"
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      required
                      className="bg-surface-container-lowest border-outline-variant"
                    />
                  </div>
                  {disableError && <Alert variant="error" className="text-sm">{disableError}</Alert>}
                  <Button type="submit" variant="outline" className="w-full py-2" disabled={disableLoading}>
                    {disableLoading ? "Disabling…" : "Disable 2FA"}
                  </Button>
                </form>
              </div>
            )}

            <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant mt-auto">
              <p className="font-title-md text-title-md text-on-surface mb-2">Active Sessions</p>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-sm">laptop_mac</span>
                <span className="font-body-md text-body-md text-on-surface-variant">Current Device</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="font-title-lg text-title-lg text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant pb-3">
            <span className="material-symbols-outlined text-primary">military_tech</span>
            Academic Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-bright border border-outline-variant rounded-xl p-4 shadow-sm">
              <h3 className="font-title-md text-title-md text-on-surface mb-4">Current Standing</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-label-md text-label-md text-on-surface-variant">GPA</span>
                    <span className="font-title-md text-title-md text-primary">{gpa.toFixed(1)} / 4.0</span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(gpa / 4 * 100, 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-label-md text-label-md text-on-surface-variant">Credits Completed</span>
                    <span className="font-title-md text-title-md text-on-surface">{credits.completed} / {credits.total}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full" style={{ width: `${credits.total > 0 ? credits.completed / credits.total * 100 : 0}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-label-md text-label-md text-on-surface-variant">Overall Progress</span>
                    <span className="font-title-md text-title-md text-on-surface">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary rounded-full" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-surface-bright border border-outline-variant rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-title-md text-title-md text-on-surface">Recent Certificates</h3>
                <Link href="/profile/certificates" className="font-label-md text-label-md text-primary hover:underline">
                  View All
                </Link>
              </div>
              {certsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3 border border-outline-variant rounded-lg bg-surface-container-lowest">
                      <Skeleton className="w-12 h-12 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : certificates.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/50 mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>
                    workspace_premium
                  </span>
                  <h3 className="font-title-lg text-title-lg text-on-surface mb-1">No certificates yet</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                    Complete a course and pass the final test to earn your first certificate.
                  </p>
                  <Link href="/courses" className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 text-label-md text-white transition-colors hover:bg-primary-fixed-variant">
                    Browse Courses
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {certificates.slice(0, 4).map((cert) => (
                    <Link
                      key={cert.id}
                      href={cert.pdfUrl || `/certificates/verify?number=${cert.certificateNumber}`}
                      target={cert.pdfUrl ? "_blank" : undefined}
                      rel={cert.pdfUrl ? "noreferrer" : undefined}
                      className="flex items-center gap-4 p-3 border border-outline-variant rounded-lg bg-surface-container-lowest hover:border-primary transition-colors group"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined">workspace_premium</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-title-md text-title-md text-on-surface line-clamp-1">{cert.course.title}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant">Issued: {new Date(cert.issuedAt).toLocaleDateString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}