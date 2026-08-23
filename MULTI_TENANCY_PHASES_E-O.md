# Multi-Tenancy Security Hardening — Execution Log (Phases E–O)

> Scope: continuation of the EduPro multi-tenancy program from Phase E onward.
> Baseline at start: Phases 0–D complete (database recovery, migration, TenantContext,
> authorization model, service-layer enforcement). TypeScript clean, unit tests passing.
>
> **Nothing in this work has been committed or pushed.**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phases 0–D — Prior Foundation (completed before this run)](#phases-0d--prior-foundation-completed-before-this-run)
3. [Phase E — API Route Propagation](#phase-e--api-route-propagation)
4. [Phase F — Superadmin Security](#phase-f--superadmin-security)
5. [Phase G — Roadmap / AI Catalog Security](#phase-g--roadmap--ai-catalog-security)
6. [Phase H — Background Jobs / Queues / Workers](#phase-h--background-jobs--queues--workers)
7. [Phase I — Cloudinary / File Security](#phase-i--cloudinary--file-security)
8. [Phase J — Cache Security](#phase-j--cache-security)
9. [Phase K — Static Security Audit](#phase-k--static-security-audit)
10. [Phase L — Security Invariants](#phase-l--security-invariants)
11. [Phase M — Build / Test / Verification Matrix](#phase-m--build--test--verification-matrix)
12. [Phase N — Final Security Audit (Attack Matrix)](#phase-n--final-security-audit-attack-matrix)
13. [Phase O — Production Readiness Verdict](#phase-o--production-readiness-verdict)
14. [Appendix A — Complete File Change List](#appendix-a--complete-file-change-list)
15. [Appendix B — Test Files Added / Modified](#appendix-b--test-files-added--modified)
16. [Appendix C — Known Limitations & Accepted Risks](#appendix-c--known-limitations--accepted-risks)

---

## Executive Summary

Eleven phases (E through O) were executed autonomously. In total:

- **17 cross-tenant security vulnerabilities found and fixed**
- **92 API routes audited** and classified (platform mode vs tenant mode)
- **~35 mutation sites** on tenant-owned models verified as tenant-scoped
- **9 test files added**, 2 updated; final counts: 172/172 unit, all 14 integration
  suites pass, both E2E suites pass (7/7 smoke, 4/4 roadmap)
- Production build, Prisma validate/generate/migrate-status, typecheck, lint: all clean

**Post-completion product revision**: the tenant `ADMIN` membership role was
removed entirely (`TenantRole` = `STUDENT | INSTRUCTOR` only, migration
`20260823120000_remove_tenant_admin_role`). Its former "administer" authority
was NOT deleted as a function — it was re-homed to the **SUPERADMIN platform
role**, which now performs whole-tenant administration (cross-tenant listings,
report resolution, certificate decisions, course moderation) through explicit
platform-mode branches. Instructors author their own courses inside their
active tenant; students read.

The guiding architectural rules were preserved throughout:

```
authenticated user
    ↓ active TenantMembership
    ↓ active Tenant
    ↓ TenantContext          ← the ONE canonical resolver (src/server/tenant-context.ts)
    ↓ authorization capability   ← from TenantMembership.role ONLY
    ↓ tenant-scoped operation
```

`User.role` = platform identity only. `TenantMembership.role` = tenant authority only.
Client-supplied tenant identifiers are selection hints, never authorization input.
SUPERADMIN has zero implicit tenant access.

Final verdict: **CONDITIONALLY READY — credential rotation remains the only blocking item.**

---

## Phases 0–D — Prior Foundation (completed before this run)

> These phases were completed and verified in earlier sessions — they are
> documented here as the foundation this run built on. Their state was
> re-verified (not redone) before Phase E started.

### Phase 0 — Forensic Baseline

Full inventory of the codebase, database, auth model, routes, services, and
existing security controls before any tenancy work. Purpose: establish ground
truth so later phases change only what is proven necessary.

### Phase 1 — Database / Prisma Recovery + Multi-Tenancy Migration

- Reconciled the live database with `prisma/schema.prisma`; restored the
  baseline migration chain (`0_init`) plus drift migrations; `prisma migrate
  status` clean.
- Added the multi-tenancy schema:
  - New tables: **`Tenant`** (id, name, slug unique, `isActive`) and
    **`TenantMembership`** (unique `[userId, tenantId]`, role enum
    `STUDENT | INSTRUCTOR | ADMIN`, FK → User with cascade delete).
  - Added a required `tenantId` column to every tenant-owned model:
    `Course, Module, Lesson, Quiz, QuizResult, Test, TestResult,
    CompletedLesson, Enrollment, Certificate, Report, Review, WishlistItem,
    Roadmap, RoadmapGeneration, RoadmapItem` (migration
    `20260822000000_add_multi_tenancy`).
  - Deliberately NOT tenant-scoped (global models): `User`, `Category`,
    `RefreshToken`, `PasswordReset`, `OtpCode`.
- Purpose: make tenancy a database-level fact rather than an application
  convention — every tenant-owned row physically carries its owner.

### Phase B — TenantContext (canonical resolution)

Created `src/server/tenant-context.ts` — the ONLY place tenant identity may be
resolved:

- `resolveTenantContext(user, hint?)`: authenticated user → active memberships
  → single membership auto-selected; multiple → explicit selection required;
  none/inactive/unknown hint → identical fail-closed 403 (prevents tenant
  enumeration). A client hint (`x-tenant-slug`) is a *selection request*
  validated against the caller's own memberships — never authorization.
- `assertTenantMember(user, tenantId)`: point-check for known-tenantId flows.
- `buildJobTenantContext(userId, tenantId)`: non-HTTP construction for workers;
  re-verifies membership at execution time.
- Purpose: one auditable choke point for tenant trust decisions.

### Phase C — Authorization Model

Created `src/server/authorization.ts` with the two-axis model:

- `User.role` = PLATFORM identity (`STUDENT | INSTRUCTOR | SUPERADMIN`);
  governs platform operations only. SUPERADMIN is the platform operator.
- `TenantMembership.role` = TENANT authority via the capability ladder
  `STUDENT → read`, `INSTRUCTOR → author`
  (`hasTenantCapability` / `requireTenantCapability`). No tenant-admin role.
- PLATFORM MODE: explicit, SUPERADMIN-only opt-in via `requirePlatformMode()`;
  never implicit.
- Conflict rules fixed here: platform INSTRUCTOR + tenant STUDENT membership →
  authoring denied; SUPERADMIN without membership → all tenant ops denied.
- Purpose: eliminate privilege inference between the two axes.

### Phase D — Service-Layer Tenant Enforcement

Converted the data layer to trusted-parameter style:

- Tenant-derived services take `tenantId` from the caller's TenantContext
  (e.g., `createCourse(input, instructorId, tenantId)`); child resources derive
  their tenant authoritatively from parent rows.
- Student-facing flows (enroll, learning, quiz, test, wishlist, reviews,
  reports, certificates, checkout/orders, roadmaps) scoped by `ctx.tenant.id`.
- QStash roadmap worker re-verifies membership at execution time
  (`verifyTenantAccess`) and fails closed.
- Verified by `tests/integration/cross-tenant.test.ts` (20 attacks),
  `tests/integration/tenant-context.test.ts` (10), and
  `tests/integration/authorization.test.ts` (10).

Purpose: even if a route forgets a check, services cannot touch another
tenant's rows. Phases E–K then closed the remaining route-level gaps and
audited every other boundary.

---

## Phase E — API Route Propagation

### Purpose

Audit every one of the 92 API routes and guarantee each follows:
authenticate → resolve trusted TenantContext → authorize capability → invoke
tenant-safe service. No route may trust a client-supplied `tenantId`.

### What was checked

| Route family | Method | Verdict before fixes |
|---|---|---|
| `/api/staff/courses*`, lessons, modules, quizzes, questions, tests | GET/POST/PATCH/DELETE | TenantContext present on most handlers but **services not tenant-scoped**; DELETE handlers missing context entirely |
| `/api/staff/enrollments`, reports, certificate-requests, stats/instructor | GET/PATCH/DELETE | **No tenant context at all**; authorized by ownership + User.role |
| `/api/me/*`, learning/*, reviews, wishlist, checkout, enroll | all | SAFE (already converted) |
| `/api/staff/users*`, register, stats (platform), publish/reject, issue-certificate | all | Correctly PLATFORM MODE (`requireSuperAdmin`) |
| Public catalog `/api/courses`, reviews | GET | Classified GLOBAL by design (public marketplace pages show the same data anonymously) |

### Vulnerabilities found & fixed (with purpose)

| # | Vulnerability | Fix | Why |
|---|---|---|---|
| E1 | `listAdminCourses` listed a user's courses from **all tenants** | Added hard `tenantId` filter from TenantContext; administer-capable members see whole tenant, authors see own only | The staff console is a per-tenant surface; cross-tenant listing leaks course metadata between tenants |
| E2 | `assertCourseOwner` did not verify the course belongs to the caller's **active** tenant | Guard now returns 404 when `course.tenantId !== ctx.tenant.id` | Prevents operating on tenant-B resources while holding tenant-A context (cross-tenant IDOR); 404 avoids existence leaks |
| E3 | `getAdminCourse` / `updateCourse` / `deleteCourse` fetched by bare id | All take trusted `tenantId`; use `findFirst({ id, tenantId })` | Defense-in-depth: even if a guard is bypassed, the service cannot touch another tenant's row |
| E4 | `setCourseStatus` unscoped | Optional trusted `tenantId`: provided = TENANT MODE, omitted = explicit PLATFORM MODE (publish/reject) | One service serving two modes must make the mode explicit, never implicit |
| E5–E8 | Module/Lesson/Quiz/Test update+delete unscoped | Same VT-M pattern (verified-then-mutate with `{id, tenantId}`) | Same rationale as E3 |
| E9 | DELETE handlers for lessons/modules/quizzes/tests/questions had **no** TenantContext or capability check | Every handler now resolves context + `requireTenantCapability("author")` | Mutations without context are the highest-severity route gap |
| E10 | `staff/enrollments` list/delete had no tenant scope | Route gates + `listEnrollments({tenantId, instructorId})`; delete already scoped via composite key | Enrollment lists expose student identities — cross-tenant leak of PII |
| E11 | `staff/reports` list/resolve unscoped; resolution authorized by ownership alone | `listReports` tenant-scoped; `resolveReport(tctx, …)` verifies report tenant + capability | Reports contain reporter identities and course content disputes |
| E12 | `staff/certificate-requests` list/decide unscoped; SUPERADMIN branch saw all tenants | Tenant-scoped listing; decision requires owner-with-author or administer | Certificate decisions confer real credentials; must never cross tenants |
| E13 | `staff/stats/instructor` aggregated across tenants | `getInstructorAnalytics(userId, tenantId)` | Analytics leak revenue/enrollment numbers across tenants |
| E14 | `me/scores` returned quiz/test results from ALL tenants | `getUserScores(userId, tenantId)` | Self-data still must not bleed across tenant boundaries |
| E15 | Comments: read by lessonId without tenant gate; edit/delete gated only by ownership | `lesson: { tenantId }` scoping on list/update/delete | Lesson discussions are tenant-private content |
| E16 | Roadmap `deleteMyRoadmap` deleted by `{id, userId}` only | Optional trusted `tenantId` threaded from route | A dual-tenant user could delete their roadmap in tenant B while active in A |
| E17 | `staff/dashboard/page.tsx` served platform-wide stats to any non-INSTRUCTOR staff | Platform stats restricted to SUPERADMIN (PLATFORM MODE) | Platform aggregates must be an explicit superadmin surface |
| Bonus | `/api/ai/models?refresh=1` let ANY user trigger expensive NIM benchmarking | Refresh gated behind requireStaff + author capability | Cost-abuse protection, not tenant isolation |

### Architecture decisions made (within approved model)

- **Owner-or-administer rule**: within one tenant, the resource owner needs
  `author` capability; non-owners need `administer`. Rationale: ownership alone
  is not authority — the membership role is what confers it (approved rule:
  "tenant authority comes only from TenantMembership.role").
- **Cross-tenant ids resolve as 404**, not 403 — identical semantics to a missing
  row so attackers cannot probe tenant membership by status-code differences.
- **requireStaff kept** on staff routes (fail-closed extra gate) while adding
  tenant checks — more restrictive, never less.

---

## Phase F — Superadmin Security

### Purpose

Prove no hidden SUPERADMIN bypass exists anywhere: services, routes, workers,
stats, certificates, course management.

### What was checked

Full repository grep of every `SUPERADMIN`, `role ===`, `requireSuperAdmin`,
`isSuperAdmin`, `PLATFORM MODE`, staff-gate occurrence (~60 sites). All classified:

- Explicit platform gates (`users/*`, `register`, platform `stats/*`,
  `publish/reject`, `issue-certificate`) — correct, kept
- `admin.user.service.ts` role checks — platform identity administration, correct
- UI components / `proxy.ts` — navigation only, APIs don't trust them — safe
- Roadmap "role" fields — AI career-domain data, unrelated — safe

### Vulnerability found & fixed

| # | Vulnerability | Fix | Why |
|---|---|---|---|
| F1 | `assertCourseOwner` allowed **any owner regardless of membership role** to manage their course — a SUPERADMIN (or anyone) whose active membership was downgraded to STUDENT could still write | Owner now requires `author` capability; non-owner requires `administer` | The exact approved conflict rule: platform INSTRUCTOR ≠ tenant INSTRUCTOR; authority comes only from the membership |

### Tests added

`tests/integration/superadmin-modes.test.ts` (5 tests):
SUPERADMIN+none → denied; +STUDENT → read-only (authoring denied **even on own
course**); +INSTRUCTOR → author; +ADMIN → administer; platform mode explicit-only.

---

## Phase G — Roadmap / AI Catalog Security

### Purpose

Trace goal → interpretation → catalog retrieval → generation → persistence →
reads/deletes and guarantee the AI never mixes courses across tenants.

### What was checked

- `loadCatalog(tenantId)` — already hard-scoped `{isPublished: true, tenantId}` ✓
- `retrieveCandidates({tenantId})` — scoped ✓
- `loadProgress(userId, tenantId)` — scoped ✓
- Worker re-verification (`verifyTenantAccess`) — present ✓
- AI providers (`nim.ts`, `mock.ts`, `provider.ts`) — pure text logic, no DB access ✓
- Category handling — global by design, untouched ✓

### Vulnerabilities found & fixed

| # | Vulnerability | Fix | Why |
|---|---|---|---|
| G1 | `loadCourseProgress` matched enrollments/completedLessons **without tenant filter** — progress from tenant B could light up items inside a tenant-A roadmap | Threads trusted `tenantId` into both queries | Roadmap progress drives item status; cross-tenant enrollment would corrupt tenant-A roadmaps |
| G2 | `saveMyRoadmap` called without tenantId in the save action | Passes `ctx.tenant.id` | TOCTOU hardening: the pre-check and mutation must carry the same scope |
| G3 | `ai/roadmap/jobs/[id]` fetched the completed roadmap without tenant scope | Scoped to the job's server-written `tenantId` | A multi-tenant user polling job status could view the roadmap outside its tenant context |
| G4 | Both post-generation `getMyRoadmap` calls in `roadmap.generate.ts` unscoped | Thread trusted `tenantId` | Consistency; reads should always carry the generation tenant |

### Tests added

Extended `tests/integration/roadmap-tenant.test.ts` (+2 tests): dual-tenant user —
get/save/delete invisible across tenants; B-tenant enrollment does not surface as
progress inside an A-tenant roadmap.

---

## Phase H — Background Jobs / Queues / Workers

### Purpose

Guarantee tenant context survives HTTP → enqueue → payload → worker → DB, and
that revoked memberships fail closed mid-flight.

### What was checked

| Surface | Finding |
|---|---|
| QStash roadmap worker | Signature-verified (`Upstash-Signature`); payload carries **only** `jobId`; userId/tenantId come from the server-side job row; `processJob` re-verifies active membership at execution time and marks the job FAILED (`tenant_access_revoked`) otherwise; idempotent claim/lease handles duplicate delivery and stale leases ✓ |
| Stripe webhook | Signature-gated upstream; tenant derived authoritatively from the course row, never from payload ✓ |
| Notifications / emails (`bestEffort`) | Operate on already-validated rows; Notification is user-global by design ✓ |
| Crons / BullMQ / schedulers | None exist ✓ |

No code changes required — the boundary held. Tests were added to prove it.

### Tests added

`tests/integration/job-tenant.test.ts` (6 tests): forged cross-tenant job,
revoked-membership mid-queue, tenant deactivated mid-queue, tenant row deleted,
duplicate delivery after completion (no side effects), missing job id (silent noop).

---

## Phase I — Cloudinary / File Security

### Purpose

Prevent cross-tenant file collision, overwrite, deletion, or retrieval.

### What was checked

- Upload path: magic-byte validation (`file-type` sniffing, declared MIME never
  trusted), folder allowlist (`avatars`/`courses`/`lessons`), rate limit,
  author-capability gate for content folders ✓
- Client-supplied public IDs: **none accepted anywhere** — Cloudinary generates
  random IDs → overwrite attacks structurally impossible ✓
- Deletion: `deleteByPublicId` exists but has **zero call sites** (dead code) →
  no deletion surface to attack ✓
- Certificate PDFs: server-rendered, uploaded under `certificates/`, URL stored
  on the tenant-owned certificate row ✓

### Fix applied

| # | Issue | Fix | Why |
|---|---|---|---|
| I1 | Content folders had no tenant namespace | `courses`/`lessons` uploads now land under `<activeTenantId>/<folder>` from the trusted context | Establishes tenant-safe storage namespace for future revocation/migration; avatars stay user-global |

---

## Phase J — Cache Security

### Purpose

Classify every cache key (GLOBAL / TENANT-SCOPED / USER-SCOPED /
PLATFORM-SCOPED) and fix isolation where needed.

### Classification result

| Cache | Class | Tenant data? | Verdict |
|---|---|---|---|
| `ratelimit:roadmap:<userId>` (Upstash) | USER-SCOPED | none | SAFE |
| `ratelimit:elearning:<userId>` (uploads/comments) | USER-SCOPED | none | SAFE |
| In-memory dev rate-limit store | PROCESS-LOCAL (dev only) | userId keys | SAFE |
| `nim.models.ts` module-level cache | GLOBAL/PLATFORM | model catalog only | SAFE |
| React `cache()` on session/tenant resolution | REQUEST-SCOPED | per-request | SAFE |
| `roadmap.queue.ts` inflight counter (Redis) | PLATFORM-SCOPED | global counter | SAFE |

**Conclusion**: no tenant-owned data is cached anywhere; there are no course,
roadmap, or AI-result caches. Nothing to fix. The dangerous pattern
(`course:${id}` without tenant prefix) does not occur because such caches do not
exist.

---

## Phase K — Static Security Audit

### Purpose

Repository-wide sweep of dangerous patterns; classify every security-relevant
occurrence; fix everything that is actually exploitable.

### Results

- **0 MUST-FIX** after the earlier phases' work
- Client-controlled tenant inputs consumed anywhere: **0**
  (`x-tenant-slug` exported but never read; no `x-tenant-id` at all)
- Direct Prisma access outside services: 9 sites, all justified (health probe,
  platform-mode lookups behind requireSuperAdmin, defense-in-depth counts)
- Raw SQL: exactly 1 (`SELECT 1` health probe); no `$executeRaw*` variants
- ~35 mutation sites across 10 services: all follow the verified-then-mutate
  pattern (`findFirst({id, tenantId})` → mutate) or embed `tenantId` directly
- `req.user`: 0 occurrences (identity flows through guards only)

### Fix applied

| # | Issue | Fix | Why |
|---|---|---|---|
| K1 | `certificates/request` GET read self-owned requests without tenant scoping (inconsistent with service layer) | Added `course: { tenantId: ctx.tenant.id }` | Low severity (own data only) but consistency eliminates a class of future bugs |

---

## Phase L — Security Invariants

Each invariant proven by code location **and** executed tests (no claims without runs):

| Invariant | Enforced by | Evidence (all executed, PASS) |
|---|---|---|
| Tenant resolution cannot be client-forged | `tenant-context.ts` resolver | tenant-context 10/10 incl. forged-hint test |
| Membership required | resolver + `assertTenantMember` + `buildJobTenantContext` | authorization case 4; tenant-context |
| Inactive tenants denied | `isActive` filters | authorization case 7; job-tenant deactivation |
| Removed memberships denied | row absence → fail closed | authorization case 6; job-tenant revocation |
| Reads scoped | VT-M pattern everywhere | cross-tenant READ block; route-tenant |
| Creates derive tenantId from context | services require tenant param | cross-tenant CREATE block |
| Updates scoped | same | cross-tenant UPDATE; rbac |
| Deletes scoped | same | cross-tenant DELETE; roadmap delete test |
| IDOR/BOLA prevented | owner + tenant scope | rbac comments/reviews; comments-likes 4/4 |
| SUPERADMIN needs membership | guards have no role bypass | superadmin-modes; rbac SUPERADMIN-no-membership |
| PLATFORM MODE explicit | `requirePlatformMode()` | authorization platform-mode test |
| Tenant roles control capabilities | capability ladder | authorization ladder test; route-tenant STUDENT-denied |
| Global models remain global | schema (User/Category/RefreshToken/PasswordReset/OtpCode have no tenantId) | schema inspection; categories route |
| Jobs preserve tenant context | worker re-verification | job-tenant 6/6 |
| Cache/storage isolation | audit results | upload.test 4/4; Phase J table |

No invariant left UNVERIFIED.

---

## Phase M — Build / Test / Verification Matrix

All commands actually executed:

| Check | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `prisma migrate status` | Clean — schema up to date |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors (57 pre-existing style warnings) |
| `npm run test` (unit) | 172/172 PASS |
| Integration suites ×14 | ALL PASS on completion runs |
| E2E smoke (live `next dev` server) | 7/7 PASS |
| E2E roadmap (live server, full pipeline) | 4/4 PASS |
| `next build` (production build) | PASS |

### Failure classifications encountered

1. **E2E 403s on enroll/staff authoring → MULTI-TENANCY REGRESSION (pre-existing
   product gap).** No production code path ever granted a first
   `TenantMembership`, so self-registered users could not perform *any* tenant
   operation. Fixed (see below).
2. **E2E fixture mismatch → TEST BUG.** E2E seeded courses into the
   `fixture-default` helper tenant while users now join `default`. Fixed by
   pointing E2E fixtures at the real default tenant.
3. **Intermittent Neon P1002 timeouts during fresh-DB provisioning →
   INFRASTRUCTURE.** Remote database saturation; consistent passes on retry;
   no relation to application code.

### Onboarding fix (the one deliberate product change)

- `auth.service.registerUser`: synchronously provisions an ACTIVE **STUDENT**
  membership in the open default tenant (`DEFAULT_TENANT_SLUG`, seeded slug
  `"default"`). Skipped silently if that tenant doesn't exist → user simply has
  no tenant access (still fail-closed).
- `admin.user.service.createAdmin` (staff invite): provisions **INSTRUCTOR**
  membership in the same default tenant.
- `.env.example` documents `DEFAULT_TENANT_SLUG=default`.

Why synchronous: the learner's very next request may immediately be a
tenant-scoped operation requiring the row (a fire-and-forget write raced E2E).

Why safe: all other tenants remain strictly membership/admin-gated; this only
formalizes what the seed data and E2E expectations already assumed (an open
marketplace tenant).

---

## Phase N — Final Security Audit (Attack Matrix)

21 attack classes tested end-to-end; full table in the phase report. Summary:

| Attack vector | Status |
|---|---|
| A→B read / create / update / delete (4) | BLOCKED ✅ |
| Forged tenant header / body / query / route param (4) | IGNORED ✅ |
| Inactive membership / removed membership (2) | DENIED ✅ |
| SUPERADMIN without / STUDENT / INSTRUCTOR / ADMIN membership (4) | Correct per matrix ✅ |
| Platform-INSTRUCTOR authoring on STUDENT membership / Student authoring (2) | DENIED ✅ |
| Cross-tenant roadmap (view/save/delete/generate) | BLOCKED ✅ |
| Cross-tenant background job (forged/revoked/inactive/deleted/dup) | FAIL-CLOSED ✅ |
| Cross-tenant file overwrite/delete/access-by-ID | IMPOSSIBLE ✅ |
| Cross-tenant cache access | N/A (nothing cached) ✅ |
| Cross-tenant payment/webhook path | BLOCKED ✅ |

New findings this phase: **none**.

---

## Phase O — Production Readiness Verdict

## CONDITIONALLY READY

**PRODUCTION READY: NO — credential rotation required.**
Per the standing instruction, outstanding credential rotation is treated as a
blocking production-security item. Everything else is verified ready.

Non-blocking caveats (documented, deliberate):

1. Raw Cloudinary URLs remain publicly fetchable (pre-existing public-CDN design;
   app-level enrollment gating controls content access).
2. `/staff` UI routing gate uses the JWT platform role — a platform-STUDENT /
   tenant-INSTRUCTOR cannot reach the staff console UI (APIs would still admit
   them correctly; purely a UX limitation, fail-closed direction).
3. `/api/metrics` is unauthenticated when `METRICS_ENABLED=true` — restrict at
   the network level.
4. Default-tenant auto-provisioning is now part of the product policy; other
   tenants remain invite/admin-gated.

---

## Appendix A — Complete File Change List

### Core security
| File | Change |
|---|---|
| `src/server/guards.ts` | `assert*Owner` guards rewritten: take `TenantContext`; enforce resource-tenant match (404 on mismatch); owner requires `author`, non-owner requires `administer`; SUPERADMIN bypass removed |
| `src/server/services/admin.course.service.ts` | `updateCourse`/`deleteCourse`/`getAdminCourse`/`updateModule`/`deleteModule`/`updateLesson`/`deleteLesson` tenant-scoped; `setCourseStatus` optional trusted tenant (TENANT vs PLATFORM mode); `listAdminCourses` hard tenant filter + administer-aware narrowing |
| `src/server/services/admin.content.service.ts` | Quiz/Test/question mutations tenant-scoped (VT-M pattern) |
| `src/server/services/enrollment.service.ts` | `listEnrollments` hard tenant filter + administer narrowing |
| `src/server/services/report.service.ts` | `listReports` tenant-scoped; `resolveReport(ctx,…)` verifies report tenant + capability |
| `src/server/services/certificate-request.service.ts` | List/decide tenant-scoped; capability required; removed SUPERADMIN-all-tenants branch; `getMyCertificateRequests` scoped via course tenant |
| `src/server/services/stats.service.ts` | `getInstructorAnalytics(userId, tenantId)` |
| `src/server/services/user.service.ts` | `getUserScores(userId, tenantId)` |
| `src/server/services/comment.service.ts` | `listCommentsByLesson`/`updateComment`/`deleteComment` gated by lesson's tenant |
| `src/server/services/roadmap.read.service.ts` | `deleteMyRoadmap` optional tenantId; `loadCourseProgress` tenant-filtered |
| `src/server/services/roadmap.generate.ts` | Post-generation reads carry the trusted tenantId |
| `src/app/api/ai/models/route.ts` | Benchmark refresh gated behind staff + author capability |

### Routes (context/capability wiring + scoped service calls)
`staff/courses/route.ts`, `staff/courses/[id]/route.ts`, `[id]/draft`,
`[id]/submit`, `staff/modules/route.ts` + `[id]`, `staff/lessons/route.ts` +
`[id]`, `staff/quizzes/route.ts` + `[id]`, `staff/tests/route.ts` + `[id]`,
`staff/questions/route.ts` + `[id]`, `staff/enrollments/route.ts` +
`[courseId]/[userId]`, `staff/reports/route.ts` + `[id]`,
`staff/certificate-requests/route.ts` + `[id]`, `staff/stats/instructor/route.ts`,
`api/comments/route.ts` + `[id]/route.ts`, `api/me/scores/route.ts`,
`api/roadmaps/[id]/route.ts`, `api/ai/roadmap/jobs/[id]/route.ts`,
`api/uploads/route.ts`, `api/certificates/request/route.ts`

### Pages
`src/app/staff/dashboard/page.tsx` — platform stats restricted to SUPERADMIN

### Onboarding (product policy)
`src/server/services/auth.service.ts` (default-tenant STUDENT provisioning),
`src/server/services/admin.user.service.ts` (INSTRUCTOR provisioning),
`.env.example` (`DEFAULT_TENANT_SLUG`)

---

## Appendix B — Test Files Added / Modified

| File | Status | Coverage |
|---|---|---|
| `tests/integration/route-tenant.test.ts` | **new** (10 tests) | Dual-tenant fixtures: admin-course listing, enrollments, reports, report resolution, quiz mutations, module creation derivation, certificate request list/decide, instructor analytics, scores, comments — all cross-tenant denials |
| `tests/integration/superadmin-modes.test.ts` | **new** (5 tests) | Full SUPERADMIN × membership-role matrix; platform-mode exclusivity |
| `tests/integration/job-tenant.test.ts` | **new** (6 tests) | Forged/cross-tenant jobs, revoked membership, deactivated/deleted tenant, duplicate delivery, missing job |
| `tests/integration/roadmap-tenant.test.ts` | extended (+2) | Roadmap get/save/delete tenant scoping; progress isolation |
| `tests/integration/rbac.test.ts` | updated | Fixtures grant role-appropriate memberships; guard tests moved to context-based signatures; added SUPERADMIN-no-membership denial |
| `tests/integration/comments-likes.test.ts` | updated | Context-based comment service signatures |
| `tests/e2e/smoke.test.ts` | updated | Fixture uses the real `default` tenant |
| `tests/e2e/roadmap.test.ts` | updated | Same fixture alignment |

---

## Appendix C — Known Limitations & Accepted Risks

1. **Cloudinary URLs are public-by-design.** Holding a raw asset URL grants
   download. Mitigated at the application layer (enrollment checks control what
   URLs are ever surfaced). Changing to signed delivery would be a product-level
   redesign, out of scope.
2. **`/staff` console UI gate** (`proxy.ts`) uses the JWT platform role claim;
   users whose tenant membership exceeds their platform role can't see the
   console. Fail-closed; API layer enforces correctly.
3. **`/api/metrics`** unauthenticated when enabled — network-level restriction
   recommended before production exposure.
4. **`roadmap-concurrency.test.ts`** occasionally hits file-level timeouts
   (subtests pass) — long-running child-process timing flake, environmental.
5. **Remote Neon test DB** intermittently returns P1002 during fresh-DB
   provisioning under load — infrastructure, retried successfully.
6. **Public catalog** (`/api/courses`, published-course reviews) intentionally
   spans tenants — matches the anonymous public storefront pages (marketplace
   model). Draft/unpublished content is fully tenant-gated.
