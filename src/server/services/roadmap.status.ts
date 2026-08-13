/**
 * Derives the display status of a roadmap item from live enrollment/progress data.
 * This is the single source of truth for item status — always computed on read,
 * never stored as a separate source of truth.
 *
 * Rules:
 * - No courseId (suggested topic)     → SUGGESTED
 * - Course completed (100% + lessons)  → COMPLETED
 * - Enrolled + progress > 0           → IN_PROGRESS
 * - Enrolled but 0%                   → NOT_STARTED
 * - Not enrolled                      → NOT_STARTED
 */
import { RoadmapItemStatus } from "@/generated/prisma/enums";

export interface StatusInput {
  courseId: string | null;
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  isTopic?: boolean;
}

export function deriveItemStatus(input: StatusInput): RoadmapItemStatus {
  const { courseId, enrolled, completedLessons, totalLessons, isTopic = courseId === null } = input;

  // Suggested topic (no matching EduPro course)
  if (isTopic || courseId === null) return RoadmapItemStatus.SUGGESTED;

  // Completed: 100% and has lessons
  if (totalLessons > 0 && completedLessons >= totalLessons) {
    return RoadmapItemStatus.COMPLETED;
  }

  // In progress: enrolled and made some progress
  if (enrolled && completedLessons > 0) {
    return RoadmapItemStatus.IN_PROGRESS;
  }

  // Not started: either not enrolled, or enrolled but 0% progress
  return RoadmapItemStatus.NOT_STARTED;
}