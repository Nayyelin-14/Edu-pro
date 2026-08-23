-- Remove the unused tenant ADMIN role.
-- Product decision: whole-tenant administration belongs to SUPERADMIN
-- (platform mode) alone. Tenant roles are now STUDENT | INSTRUCTOR only.

-- Safety net for any environment that created ADMIN memberships:
-- re-home them to INSTRUCTOR (closest authority) before dropping the role.
UPDATE "TenantMembership" SET "role" = 'INSTRUCTOR' WHERE "role"::text = 'ADMIN';

-- PostgreSQL cannot DROP VALUE from an enum; rebuild the type instead.
-- The column default must be dropped and re-added alongside the type swap.
ALTER TABLE "TenantMembership" ALTER COLUMN "role" DROP DEFAULT;

CREATE TYPE "TenantRole_new" AS ENUM ('STUDENT', 'INSTRUCTOR');

ALTER TABLE "TenantMembership"
  ALTER COLUMN "role" TYPE "TenantRole_new"
  USING "role"::text::"TenantRole_new";

ALTER TYPE "TenantRole" RENAME TO "TenantRole_old";
ALTER TYPE "TenantRole_new" RENAME TO "TenantRole";

ALTER TABLE "TenantMembership"
  ALTER COLUMN "role" SET DEFAULT 'STUDENT'::"TenantRole";

DROP TYPE "TenantRole_old";
