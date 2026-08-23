"use client";

import {
  Clock,
  BookOpen,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  BookMarked,
} from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, statusToVariant } from "@/components/user/status-badge";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/i18n";
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
  skills: string[];
  milestones: string[];
  estimatedWeeks: number;
  matchQuality: string | null;
  matchedCompetencies: string[];
  courseProgress: {
    percent: number;
    completedLessons: number;
    totalLessons: number;
  } | null;
}

interface RoadmapTimelineProps {
  stages: Stage[];
}

export function RoadmapTimeline({ stages }: RoadmapTimelineProps) {
  const { t } = useI18n();

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
            <motion.li
              key={stage.id}
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, ease: "easeOut" }}
            >
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-5 top-12 h-[calc(100%-2rem)] w-px",
                    config.rail,
                  )}
                />
              )}
              <motion.span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-2 z-10 flex size-10 items-center justify-center rounded-full border-2 shadow-sm",
                  config.node,
                )}
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Icon className="size-5" />
              </motion.span>

              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Card
                  className={cn(
                    "ml-14",
                    stage.isTopic &&
                      "border-dashed border-warning/40 bg-warning-container/10",
                  )}
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-label-sm font-medium text-on-surface-variant">
                            <Clock className="size-3.5" />
                            {t.roadmap.weekFormatShort(
                              stage.weekStart,
                              stage.weekEnd,
                            )}
                          </span>
                          <StatusBadge
                            status={stage.status}
                            label={config.label}
                            variant={variant}
                          />
                          {!stage.isTopic && stage.matchQuality && (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-1 text-label-sm font-medium",
                                stage.matchQuality === "DIRECT"
                                  ? "bg-success/15 text-success"
                                  : stage.matchQuality === "STRONG"
                                    ? "bg-primary/15 text-primary"
                                    : stage.matchQuality === "RELATED"
                                      ? "bg-warning/15 text-warning"
                                      : "bg-surface-container text-on-surface-variant",
                              )}
                            >
                              {t.roadmap.matchQuality[
                                stage.matchQuality as keyof typeof t.roadmap.matchQuality
                              ] ?? stage.matchQuality}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-title-lg font-semibold text-on-surface">
                          {stage.title}
                        </h3>
                      </div>
                    </div>

                    {(stage.description || stage.goal) && (
                      <div className="space-y-2 text-body-md text-on-surface-variant">
                        {stage.description && <p>{stage.description}</p>}
                        {stage.goal && (
                          <p className="font-medium text-primary">
                            {stage.goal}
                          </p>
                        )}
                      </div>
                    )}

                    {stage.courseReason && !stage.isTopic && (
                      <Alert className="bg-primary/5 border-primary/20">
                        <BookOpen className="size-4 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm">{stage.courseReason}</p>
                          {stage.matchedCompetencies.length > 0 && (
                            <p className="mt-1 text-label-sm text-on-surface-variant">
                              {t.roadmap.whyThisCourse}
                              {stage.matchedCompetencies.slice(0, 6).map((c, i) => (
                                <span key={i} className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                                  {c}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </Alert>
                    )}

                    {stage.isTopic && (
                      <Alert variant="warning" className="border-warning/40">
                        <AlertCircle className="size-4 text-warning" />
                        <p className="text-sm">{t.roadmap.noMatchingCourse}</p>
                      </Alert>
                    )}

                    {stage.milestones.length > 0 && (
                      <div className="space-y-2 rounded-xl bg-surface-container p-4">
                        <p className="flex items-center gap-1.5 text-label-sm font-semibold text-on-surface-variant">
                          <CheckCircle className="size-4 text-success" aria-hidden="true" />
                          {t.roadmap.milestonesLabel}
                        </p>
                        <ul className="space-y-1.5">
                          {stage.milestones.map((m, i) => (
                            <li
                              key={`${stage.id}-m${i}`}
                              className="flex items-start gap-2 text-body-sm text-on-surface-variant"
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {stage.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {stage.skills.slice(0, 6).map((skill, i) => (
                          <span
                            key={`${stage.id}-s${i}`}
                            className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
