"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Trash2, BookOpen, GraduationCap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n";
import { useDeleteRoadmap } from "@/hooks/use-roadmaps";
import { useToast } from "@/components/ui/toast";

interface RoadmapCardProps {
  roadmap: {
    id: string;
    title: string;
    goal: string;
    level: string;
    durationWeeks: number;
    hoursPerWeek: number;
    createdAt: string;
    totalStages: number;
    matchedStages: number;
    completedStages: number;
    progressPercent: number;
  };
}

export function RoadmapCard({ roadmap }: RoadmapCardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams();
  const userId = params.userId as string;
  const { mutate: deleteRoadmap, isPending: deleting } = useDeleteRoadmap();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const progress = roadmap.matchedStages === 0 ? 0 : roadmap.progressPercent;

  const handleConfirmDelete = () => {
    deleteRoadmap(roadmap.id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        toast(t.roadmap.deleted, "success");
      },
      onError: (err) => toast(err instanceof Error ? err.message : t.common.error, "error"),
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{roadmap.title}</CardTitle>
            <p className="text-sm text-muted-foreground truncate mt-1">{roadmap.goal}</p>
          </div>
          <div className="flex items-center gap-1">
            {roadmap.matchedStages === 0 ? (
              <Badge variant="secondary">{t.roadmap.noCourses}</Badge>
            ) : (
              <>
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="size-3" />
                  {roadmap.matchedStages} {t.roadmap.courses}
                </Badge>
                <Badge variant={roadmap.progressPercent === 100 ? "success" : "outline"}>
                  <GraduationCap className="size-3" />
                  {roadmap.progressPercent}%
                </Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {t.roadmap.durationFormat(roadmap.durationWeeks)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {t.roadmap.hoursPerWeekFormat(roadmap.hoursPerWeek)}
          </span>
          <Badge variant="secondary" className="capitalize">
            {roadmap.level}
          </Badge>
          <span className="flex items-center gap-1 ml-auto">
            <span className="size-3.5 rounded-full" />
            {formatDistanceToNow(new Date(roadmap.createdAt), { addSuffix: true })}
          </span>
        </div>

        {roadmap.matchedStages > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t.roadmap.progress}</span>
              <span>{roadmap.completedStages} / {roadmap.matchedStages}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs"
          >
            <Trash2 className="size-3.5 mr-1" />
            {t.roadmap.delete}
          </Button>
          <Button
            asChild
            className="ml-auto"
            variant={roadmap.matchedStages === 0 ? "outline" : "default"}
          >
            <Link href={`/${userId}/roadmap/${roadmap.id}`}>
              {roadmap.matchedStages === 0 ? t.roadmap.view : t.roadmap.continue}
              <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmingDelete}
        title={t.roadmap.deleteRoadmapTitle}
        description={t.roadmap.deleteRoadmapDescription}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Card>
  );
}