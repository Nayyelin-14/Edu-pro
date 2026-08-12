# Build Log — EduPro E-Learning Platform (Next.js + Prisma migration)

Autonomous build session log. Records what was built, judgment calls, and
deferred items for review.

## Phase 0 — Scaffold (complete)

- Next.js 16.3 (App Router, RSC, TS strict), Tailwind v4, shadcn/ui config.
- `src/app` scaffold, `src/lib/utils.ts`, health route, globals with
  neutral oklch theme, eslint config (Backend/Frontend excluded from lint).
- `.gitignore`, `.env.example`, `components.json`, package scripts.
- Verified: `tsc --noEmit`, `eslint .`, `next build` all green.
- Note: npm installed the environment's current stable set: Next 16.3.0,
  React 19.2.8, TS 6.0.3, zod 4, Prisma 7.9.1, jose 6, lucide 1.31.

## Phase 1 — Prisma (in progress)

## Phase 5 — UI & Pages (in progress)

Backend/API layers were already complete and verified green (see earlier
session notes for phases 1–4). This session built the full client UI.

### Built this session

- UI primitives (`src/components/ui/`): input, textarea, label, card, badge,
  select, alert, skeleton/spinner, separator, toast (context-based).
- Providers: ThemeProvider (next-themes), ToastProvider, QueryClientProvider,
  LocaleProvider; root layout reads `elearning.locale` cookie for SSR locale.
- Hooks: `use-auth` (AuthProvider exposing user/loading/refresh/logout,
  backed by `/api/auth/me`), reused across all client pages.
- i18n: `src/i18n/en.ts` + `th.ts` + `dictionaries.ts` (server-safe) +
  `index.tsx` (client provider). Split dictionaries into a pure module so
  server components (home page) can import `getDictionary` without pulling in
  React hooks.
- Site shell: `site-header` (auth-aware nav + locale switcher + theme toggle +
  mobile menu), `site-footer`, `(site)` layout group.
- Public pages: home (featured courses + categories), catalog (`/courses`
  with search/category/sort/pagination), course detail (`/courses/[slug]`
  with curriculum, tests, reviews, client `CourseActions` for
  enroll/wishlist/continue), about, certificate verify (`/certificates/verify`).
- Auth pages (`(auth)` group): login (incl. 2FA OTP step via mfaToken),
  register, forgot-password, reset-password, verify-email.
- User pages (`(user)` group + `/learning`): profile (info form, two-step
  enable/disable incl. TOTP QR, change password, certificates, scores),
  my-courses (progress bars), saved, reports (create + list), certificates,
  learning page (`/learning/[courseId]` server page with lesson nav,
  LessonView with video/article + comments, QuizRunner), test page
  (`/learning/[courseId]/test/[testId]` with TestRunner: status, countdown
  timer, submit, certificate on pass).
- Admin pages (`/admin`): layout with staff guard (defense-in-depth beyond
  proxy), dashboard (stats server-side), users (search, restrict/unrestrict,
  role change for superadmin), courses list (publish/draft/delete),
  new course, course editor (`/[id]`: details form, modules with lessons +
  quizzes via dynamic QuestionEditor, final tests), enrollments, reports
  (resolve/dismiss), create admin (superadmin + invite token), issue
  certificate.
- Proxy (`src/proxy.ts`): added `/my-courses`, `/certificates` to
  USER_PREFIXES; `/certificates/verify` kept public; removed `/verify-email`
  from AUTH_PAGES so logged-in users can reach the email-verification page
  (the endpoint requires a session via `requireUser`).

### Judgment calls

- `verify-email` page moved out of the "logged-in users redirected away"
  set in the proxy because email verification requires an authenticated
  session; unauth users see a "sign in" prompt on the page instead.
- Learning pages live outside the `(user)` route group (root `/learning/...`)
  to avoid the sidebar layout; the proxy still protects them.
- Certificate verify is public; the page reads `?number=` and calls the
  public `GET /api/certificates/check`.
- Quiz/test client components strip `correctIndex` (answers) before sending
  question data to the browser where applicable (tests via `toQuestionView`;
  quizzes strip it when passing to `QuizRunner`).
- All server pages that query the DB export `dynamic = "force-dynamic"` so
  `next build` does not attempt static prerendering without a database.

### Refactors to keep files ≤300 lines

- Split `auth.service.ts` (341 → 183) into `auth.service.ts`,
  `auth.verification.service.ts`, `auth.twoStep.service.ts`.
- Split `course-editor.tsx` (346) into `course-editor.tsx`,
  `course-details-form.tsx`, `test-section.tsx`, `module-card.tsx`.

### Verification

- `tsc --noEmit`: clean.
- `eslint src`: clean (0 errors, 0 warnings).
- `next build`: success — all pages + API routes compiled, 9 static pages
  generated, proxy built.

## End-of-session notes

- Only remaining stubs/deferred: none known. Full end-to-end runtime test
  against a live Postgres (migrate + seed + login flow) still to be done in
  a runnable environment.


## UI Migration: Course Detail page (Stitch design)
- Migrated /courses/[slug] to Stitch-inspired layout (hero card, overview,
  curriculum accordion, reviews, sticky enrollment panel).
- New client component src/components/course-curriculum.tsx (accordion).
- Reworked src/components/course-actions.tsx into full enrollment card; still
  uses existing APIs (enroll, enrollment-status, wishlist, /api/me/enrollments
  for real progress). No mock data.
- Added formatDuration/formatPrice to src/lib/utils.ts.
- Judgment call: switched global --primary/--ring to blue (Stitch palette).
  Data not in backend (instructor, level, subtitles, outcomes) intentionally
  omitted rather than fabricated.
- Verification: tsc, eslint, next build all clean; live page returns 200 with
  real DB data.

## UI Migration: Course Catalog page (Stitch design)
- Rebuilt /courses with Stitch layout: sticky filter sidebar (desktop) +
  mobile filter drawer, search bar, sort select, course grid, empty state,
  pagination.
- Extended backend listPublishedCourses to support multi-category, minPrice,
  maxPrice, and sort (POPULAR/NEWEST/RATING/PRICE_ASC). API /api/courses
  updated accordingly. All filters drive real DB queries via searchParams.
- New client component src/components/catalog-controls.tsx (URL-synced filters).
- Fixed CourseCard bug: read coverImage (not nonexistent thumbnail); styled to
  Stitch card (hover zoom, stars, price, Featured badge).
- Difficulty-level filter omitted: Course has no level field (no fabrication).
- Verification: tsc + eslint clean; live API + page tested for category, price,
  search, sort, empty state.

## UI Migration: Learning Player page (Stitch design)
- Rebuilt /learning/[courseId] with Stitch layout: top contextual nav (back,
  progress bar, discussion), sticky left curriculum sidebar (search,
  expandable modules, lesson states: completed/current/locked), video
  player with custom controls (play/pause, seek, volume, fullscreen),
  lesson header with mark-complete + prev/next, discussion section
  (comments with replies, instructor badge).
- New client components: src/components/learning/curriculum-sidebar.tsx,
  rewrote lesson-view.tsx with native HTML5 video + custom controls.
- All data from existing getCourseForLearning service; progress computed
  from completedLessonIds; comments API preserved; mark-complete API
  preserved; prev/next navigation via URL searchParams.
- Removed difficulty filter (no backend field). Omitted instructor badge
  (no instructor field in data).
- Verification: tsc + eslint + next build all clean.
