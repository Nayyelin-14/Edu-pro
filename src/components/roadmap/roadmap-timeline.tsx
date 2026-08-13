"use client";

import { ArrowRight, BookOpen, GraduationCap, Clock, CheckCircle, HelpCircle, AlertCircle, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/user/progress-ring";
import { StatusBadge, statusToVariant } from "@/components/user/status-badge";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  stageNumber: number;
  title: string;
  description: string | null;
  goal: string | null;
  weekStart: number;
  weekEnd: number;
  courseId: string | null;
  courseTitle: string | null;
  courseReason: string | null;
  courseSlug: string | null;
  status: string;
  isTopic: boolean;
  courseProgress: {
    percent: number;
    completedLessons: number;
    totalLessons: number;
  } | null;
}

interface RoadmapTimelineProps {
  stages: Stage[];
  roadmapId: string;
  overallProgress: number;
  matchedStages: number;
  completedStages: number;
}

export function RoadmapTimeline({
  stages,
  overallProgress,
  matchedStages,
  completedStages,
}: RoadmapTimelineProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const handleEnroll = async (courseId: string, slug: string) => {
    setEnrolling(courseId);
    try {
      await apiFetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
      toast("Enrolled!", "success");
      router.push(`/learning/${slug}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Enrollment failed", "error");
    } finally {
      setEnrolling(null);
    }
  };

  const getStatusConfig = (stage: Stage) => {
    if (stage.isTopic) {
      return {
        label: t.roadmap.suggestedTopic,
        icon: HelpCircle,
        node: "border-warning bg-warning-container/40 text-warning",
        rail: "bg-warning/40",
      };
    }
    switch (stage.status) {
      case "COMPLETED":
        return {
          label: t.roadmap.statusCompleted,
          icon: CheckCircle,
          node: "border-success bg-success-container text-on-success-container",
          rail: "bg-success",
        };
      case "IN_PROGRESS":
        return {
          label: t.roadmap.statusInProgress,
          icon: BookOpen,
          node: "border-primary bg-primary text-primary-foreground",
          rail: "bg-primary",
        };
      case "NOT_STARTED":
        return {
          label: t.roadmap.statusNotStarted,
          icon: BookMarked,
          node: "border-outline-variant bg-surface-container text-on-surface-variant",
          rail: "bg-outline-variant",
        };
      default:
        return {
          label: t.roadmap.suggestedTopic,
          icon: HelpCircle,
          node: "border-warning bg-warning-container/40 text-warning",
          rail: "bg-warning/40",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall progress header */}
      <div className="flex flex-col gap-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface-container-low to-surface-container-lowest p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <ProgressRing
            value={overallProgress}
            size={88}
            strokeWidth={9}
            colorClassName="text-primary"
            label={
              <span className="text-title-lg font-bold text-on-surface">
                {overallProgress}%
              </span>
            }
          />
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-wide text-primary">
              {t.roadmap.overallProgress}
            </p>
            <p className="mt-1 text-body-md text-on-surface-variant">
              {t.roadmap.stagesCompletedFormat(completedStages, matchedStages)}
            </p>
          </div>
        </div>
        <Progress value={overallProgress} className="h-3 sm:w-64" indicatorClassName="bg-primary" />
      </div>

      {/* Stages timeline */}
      <ol className="space-y-4">
        {stages.map((stage, idx) => {
          const config = getStatusConfig(stage);
          const Icon = config.icon;
          const variant = stage.isTopic
            ? "info"
            : statusToVariant(stage.status);
          const isLast = idx === stages.length - 1;

          return (
            <li key={stage.id} className="relative">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn("absolute left-5 top-12 h-[calc(100%-2rem)] w-px", config.rail)}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-2 z-10 flex size-10 items-center justify-center rounded-full border-2 shadow-sm",
                  config.node,
                )}
              >
                <Icon className="size-5" />
              </span>

              <Card className={cn("ml-14", stage.isTopic && "border-dashed border-warning/40 bg-warning-container/10")}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-label-sm font-medium text-on-surface-variant">
                          <Clock className="size-3.5" />
                          {t.roadmap.weekFormatShort(stage.weekStart, stage.weekEnd)}
                        </span>
                        <StatusBadge status={stage.status} label={config.label} variant={variant} />
                      </div>
                      <h3 className="mt-2 text-title-lg font-semibold text-on-surface">
                        {stage.title}
                      </h3>
                    </div>
                  </div>

                  {(stage.description || stage.goal) && (
                    <div className="space-y-2 text-body-md text-on-surface-variant">
                      {stage.description && <p>{stage.description}</p>}
                      {stage.goal && <p className="font-medium text-primary">{stage.goal}</p>}
                    </div>
                  )}

                  {stage.courseReason && !stage.isTopic && (
                    <Alert className="bg-primary/5 border-primary/20">
                      <BookOpen className="size-4 text-primary" />
                      <p className="text-sm">{stage.courseReason}</p>
                    </Alert>
                  )}

                  {stage.isTopic && (
                    <Alert variant="warning" className="border-warning/40">
                      <AlertCircle className="size-4 text-warning" />
                      <p className="text-sm">{t.roadmap.noMatchingCourse}</p>
                    </Alert>
                  )}

                  {!stage.isTopic && stage.courseProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-label-sm text-on-surface-variant">
                        <span>{t.roadmap.courseProgress}</span>
                        <span>{stage.courseProgress.percent}%</span>
                      </div>
                      <Progress
                        value={stage.courseProgress.percent}
                        className="h-1.5"
                        indicatorClassName={stage.status === "COMPLETED" ? "bg-success" : "bg-primary"}
                      />
                      <p className="text-label-sm text-on-surface-variant">
                        {stage.courseProgress.completedLessons} / {stage.courseProgress.totalLessons}{" "}
                        {t.roadmap.lessonsCompleted}
                      </p>
                    </div>
                  )}

                  {!stage.isTopic && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {stage.status === "COMPLETED" ? (
                        <Button variant="outline" asChild className="gap-2">
                          <a href={`/learning/${stage.courseSlug}`}>
                            <GraduationCap className="size-4" />
                            {t.roadmap.reviewCourse}
                          </a>
                        </Button>
                      ) : stage.courseProgress && stage.courseProgress.percent > 0 ? (
                        <Button asChild className="gap-2">
                          <a href={`/learning/${stage.courseSlug}`}>
                            <ArrowRight className="size-4" />
                            {t.roadmap.continueLearning}
                          </a>
                        </Button>
                      ) : stage.courseId && stage.courseSlug ? (
                        <Button
                          className="gap-2"
                          disabled={enrolling === stage.courseId}
                          onClick={() => handleEnroll(stage.courseId!, stage.courseSlug!)}
                        >
                          {enrolling === stage.courseId ? "Enrolling…" : t.roadmap.startCourse}
                          <ArrowRight className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}