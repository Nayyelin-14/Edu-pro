import type { Prisma, UserRole } from "@/generated/prisma/client";
import { conflict, forbidden, notFound, unauthorized } from "@/lib/errors";
import { safeEqual } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function createAdmin(input: {
  inviteToken: string;
  username: string;
  email: string;
  password: string;
}): Promise<void> {
  const expected = process.env.ADMIN_INVITE_TOKEN;
  if (!expected || !safeEqual(input.inviteToken, expected)) {
    throw unauthorized("Invalid admin invite token");
  }
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { id: true },
  });
  if (existing) throw conflict("Username or email is already in use");
  const password = await hashPassword(input.password);
  await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      password,
      role: "INSTRUCTOR",
      emailVerifiedAt: new Date(),
    },
  });
}

export async function listUsers(input: {
  search?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.UserWhereInput = input.search
    ? {
        OR: [
          { username: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar: true,
        isBanned: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            enrollments: true,
            certificates: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function updateUser(
  admin: { id: string; role: UserRole },
  userId: string,
  input: { role?: UserRole; isBanned?: boolean },
) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("User not found");

  if (input.role && input.role !== target.role) {
    if (admin.role !== "SUPERADMIN") {
      throw forbidden("Only superadmins can change roles");
    }
    if (target.role === "SUPERADMIN" && admin.id !== target.id) {
      throw forbidden("Cannot change a superadmin's role");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.isBanned !== undefined ? { isBanned: input.isBanned } : {}),
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isBanned: true,
    },
  });
}

export async function deleteUser(
  admin: { role: UserRole },
  userId: string,
): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("User not found");
  if (admin.role !== "SUPERADMIN") {
    throw forbidden("Only superadmins can delete users");
  }
  if (target.role === "SUPERADMIN") {
    throw forbidden("Cannot delete a superadmin");
  }
  await prisma.user.delete({ where: { id: userId } });
}

export async function setUserBanned(userId: string, banned: boolean) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("User not found");
  if (target.role === "SUPERADMIN") {
    throw forbidden("Cannot restrict a superadmin");
  }
  return prisma.user.update({
    where: { id: userId },
    data: { isBanned: banned },
    select: { id: true, username: true, isBanned: true },
  });
}
