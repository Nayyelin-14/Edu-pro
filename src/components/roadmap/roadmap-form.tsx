"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { RoadmapGenerating } from "@/components/roadmap/roadmap-generating";
import { useGenerateRoadmap } from "@/hooks/use-roadmaps";
import type { RoadmapJobStatus } from "@/hooks/use-roadmaps";

export interface GeneratedRoadmapInfo {
  id: string;
  title: string;
  goal: string;
}

export function RoadmapForm({ onGenerated }: { onGenerated?: (roadmap: GeneratedRoadmapInfo) => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { mutate, isPending, error: mutationError } = useGenerateRoadmap();
  const onGeneratedRef = useRef(onGenerated);
  onGeneratedRef.current = onGenerated;
  const [polling, setPolling] = useState(false);

  const isGenerating = isPending || polling;

  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">("BEGINNER");
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [hoursPerWeek, setHoursPerWeek] = useState(8);
  const [language, setLanguage] = useState<"en" | "th">("en");

  const levels = [
    { value: "BEGINNER", label: t.roadmap.levelBeginner },
    { value: "INTERMEDIATE", label: t.roadmap.levelIntermediate },
    { value: "ADVANCED", label: t.roadmap.levelAdvanced },
  ] as const;

  const durations = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 52];
  const hoursOptions = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutate(
      { goal: goal.trim(), level, durationWeeks, hoursPerWeek, language },
      {
        onSuccess: async (data) => {
          if (data.roadmap?.id) {
            // Synchronous completion (dev inline path).
            toast(t.roadmap.generatedSuccess, "success");
            onGeneratedRef.current?.({
              id: data.roadmap.id,
              title: data.roadmap.title,
              goal: data.roadmap.goal,
            });
            return;
          }
          if (!data.jobId) return;
          // Asynchronous path: poll the job until it completes or fails.
          setPolling(true);
          try {
            for (;;) {
              await new Promise((r) => setTimeout(r, 3000));
              const res = await apiFetch<RoadmapJobStatus>(`/api/ai/roadmap/jobs/${data.jobId}`);
              if (res.status === "COMPLETED" && res.roadmap?.id) {
                setPolling(false);
                toast(t.roadmap.generatedSuccess, "success");
                onGeneratedRef.current?.({
                  id: res.roadmap.id,
                  title: res.roadmap.title,
                  goal: res.roadmap.goal,
                });
                return;
              }
              if (res.status === "FAILED") {
                setPolling(false);
                toast(t.roadmap.generationFailed, "error");
                return;
              }
            }
          } catch (err) {
            setPolling(false);
            toast(err instanceof Error ? err.message : t.common.error, "error");
          }
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : t.common.error, "error");
        },
      },
    );
  };

  if (isGenerating) {
    return <RoadmapGenerating />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t.roadmap.createTitle}</CardTitle>
        <CardDescription>{t.roadmap.createSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="goal">{t.roadmap.goalLabel}</Label>
            <Textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t.roadmap.goalPlaceholder}
              rows={4}
              required
              minLength={5}
              maxLength={500}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">{goal.length}/500</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.roadmap.levelLabel}</Label>
              <Select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} disabled={isGenerating}>
                {levels.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.roadmap.durationLabel}</Label>
              <Select value={durationWeeks} onChange={(e) => setDurationWeeks(Number(e.target.value))} disabled={isGenerating}>
                {durations.map((w) => (
                  <option key={w} value={w}>
                    {t.roadmap.weekFormat(w)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.roadmap.hoursLabel}</Label>
              <Select value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} disabled={isGenerating}>
                {hoursOptions.map((h) => (
                  <option key={h} value={h}>
                    {t.roadmap.hourFormat(h)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.roadmap.languageLabel}</Label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "th")} disabled={isGenerating}>
                <option value="en">English</option>
                <option value="th">ไทย</option>
              </Select>
            </div>
          </div>

          {mutationError && (
            <Alert variant="error">
              <AlertCircle className="size-4" />
              {mutationError instanceof Error ? mutationError.message : t.common.error}
            </Alert>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isGenerating || !goal.trim()}>
            {isGenerating ? t.roadmap.generating : t.roadmap.generateBtn}
            <ArrowRight className="size-4 ml-2" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {t.roadmap.footerNote}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}