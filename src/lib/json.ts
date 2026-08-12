import { Prisma } from "@/generated/prisma/client";

/** Casts a typed value to Prisma's JSON input type (strict JSON shapes). */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Casts a stored JSON column value back to a typed shape. */
export function fromJson<T>(value: Prisma.JsonValue): T {
  return value as unknown as T;
}
