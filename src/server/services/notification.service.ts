import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { NotificationType } from "@/generated/prisma/enums";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** User who generated the event. Null/omitted for system-generated events. */
  actorId?: string | null;
  /** Course the event relates to, when applicable. */
  courseId?: string | null;
}

export async function notify(input: NotificationInput) {
  await prisma.notification.create({ data: input });
}

export async function listNotifications(userId: string, limit = 20) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: {
        actor: { select: { id: true, username: true, avatar: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { items, unread };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { success: true };
}

/** Updates a single notification, but only if it belongs to `userId`. */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
  read: boolean,
) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read },
  });
  if (result.count === 0) throw notFound("Notification not found");
  return { success: true };
}

/** Fetches a single notification owned by `userId`. */
export async function getNotification(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    include: {
      actor: { select: { id: true, username: true, avatar: true } },
      course: { select: { id: true, title: true } },
    },
  });
  if (!notification) throw notFound("Notification not found");
  return notification;
}

/** Deletes a single notification, but only if it belongs to `userId`. */
export async function deleteNotification(userId: string, notificationId: string) {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });
  if (result.count === 0) throw notFound("Notification not found");
  return { success: true };
}