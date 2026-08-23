/**
 * Deterministic, dependency-injected goal interpretation + course retrieval.
 *
 * This module is intentionally PURE: it takes data in and returns structured,
 * ranked data. It never touches the database or an AI provider directly, which
 * makes it trivially unit-testable and easy to swap for embeddings/pgvector
 * later behind the CourseRetriever abstraction in server/services.
 *
 * Role:
 *  - Understands the student's raw goal WITHOUT assuming a small hardcoded list
 *    of roles. The role profiles here are ADDITIVE knowledge hints for careers
 *    we know well — they are never an allowlist. Any legitimate goal is valid.
 *  - Retrieves real catalog courses against a set of competencies (skills),
 *    scoring title/category/description/skill-metadata relevance.
 *  - Computes HONEST coverage: what the catalog can and cannot teach, based
 *    only on real course data — never AI claims.
 */
import type { CourseCandidate } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Importance = "critical" | "important" | "optional";
export type CompetencyCategory = "foundational" | "core" | "advanced";
export type RequiredSkillSource = "profile" | "goal";
export type SkillStatus = "complete" | "partial" | "weak" | "unavailable";
export type SkillReason =
  | "direct_match"
  | "strong_match"
  | "partial_match"
  | "prerequisite"
  | "insufficient_course_depth"
  | "no_catalog_course";
export type SkillQuality = "excellent" | "good" | "partial" | "insufficient";
export type MatchQuality = "DIRECT" | "STRONG" | "RELATED" | "WEAK" | "IRRELEVANT";
export type CatalogCoverage = "COMPLETE" | "PARTIAL" | "WEAK" | "UNAVAILABLE";
export type RoadmapQualityTier = "excellent" | "good" | "partial" | "poor";

export interface Competency {
  name: string;
  rationale?: string | null;
  importance: Importance;
}

export interface GoalAmbiguity {
  isAmbiguous: boolean;
  gaps: string[];
  reason?: string | null;
}

export interface RequiredSkill {
  skill: string;
  importance: Importance;
  category: CompetencyCategory;
  source: RequiredSkillSource;
  prerequisites?: string[];
}

export interface SkillCoverageEntry {
  skill: string;
  importance: Importance;
  category: CompetencyCategory;
  status: SkillStatus;
  reason: SkillReason;
  quality: SkillQuality;
  matchedCourseIds: string[];
  catalogCourseIds: string[];
}

export interface CoverageBreakdown {
  goalCoverage: number;
  courseAvailability: number;
  skills: SkillCoverageEntry[];
}

export interface GoalAnalysis {
  role: string | null;
  /** Canonical role id (hyphenated), e.g. "backend-developer". Null when unknown. */
  roleId: string | null;
  roleSource: "profile" | "general" | "none";
  roleConfidence: number;
  domain: string | null;
  domainConfidence: number;
  /** Skills the student explicitly wants to LEARN (from "learn X" regions). */
  skills: string[];
  /** Skills the student already stated they KNOW. Never re-taught. */
  knownSkills: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  /** 0..1 interpretation confidence. */
  confidence: number;
  assumptions: string[];
  /** What the student wants to become/achieve (e.g. "a YouTuber"). */
  target: string | null;
  /** Intended outcome / end state (e.g. "grow an audience on YouTube"). */
  outcome: string | null;
  /** Free-form competency model derived from understanding the goal — independent of catalog. */
  competencies: Array<{ name: string; rationale?: string | null; importance: Importance }>;
  /** Whether an important decision is missing (independent of retrieval). */
  ambiguity: { isAmbiguous: boolean; gaps: string[]; reason?: string | null };
}

export interface NormalizedGoal {
  goal: string;
  lowered: string;
  tokens: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  skills: string[];
}

export interface ScoredCourse {
  candidate: Omit<CourseCandidate, "key">;
  score: number;
  matchedSkills: string[];
  matches: Array<{ field: "title" | "category" | "description"; skill: string; hits: number }>;
}

export interface RankedCourse {
  candidate: Omit<CourseCandidate, "key">;
  score: number;
  matchedSkills: string[];
}

/** A bounded retrieval result with the evidence the planner and the result UI
 * need: which competencies matched and how confidently. */
export interface RetrievalEvidence {
  candidate: Omit<CourseCandidate, "key">;
  score: number;
  matchedCompetencies: string[];
  matchType: MatchQuality;
  /** Heuristic confidence in the match (DIRECT/STRONG matches are highly
   * confident; keyword-only matches are less so). */
  confidence: number;
}

/** Converts a ranked retrieval hit into evidence for the planner/UI. */
export function toRetrievalEvidence(
  ranked: RankedCourse,
  requiredSkills: RequiredSkill[],
): RetrievalEvidence {
  const matchType = bestMatchQualityForCourse(ranked.candidate, requiredSkills);
  const confidence = matchType === "DIRECT" ? 0.9 : matchType === "STRONG" ? 0.75 : matchType === "RELATED" ? 0.6 : matchType === "WEAK" ? 0.4 : 0.1;
  return {
    candidate: ranked.candidate,
    score: ranked.score,
    matchedCompetencies: ranked.matchedSkills,
    matchType,
    confidence,
  };
}

export interface RoleProfile {
  id: string;
  core: string[];
  important: string[];
}

// ---------------------------------------------------------------------------
// Skill lexicon (bounded, typo-tolerant). Terms map to canonical skill tokens.
// ---------------------------------------------------------------------------

const TERM_TO_SKILL: Record<string, string> = {
  // languages / platforms
  python: "python",
  pyhton: "python",
  py: "python",
  java: "java",
  javascript: "javascript",
  javscript: "javascript",
  js: "javascript",
  typescript: "typescript",
  html: "html",
  css: "css",
  node: "node",
  nodejs: "node",
  express: "express",
  react: "react",
  vue: "vue",
  angular: "angular",
  django: "django",
  flask: "flask",
  spring: "spring",
  springboot: "spring",
  swift: "swift",
  kotlin: "kotlin",
  flutter: "flutter",
  go: "go",
  rust: "rust",
  c: "c",
  cpp: "c-plus-plus",
  postgres: "database",
  postgresql: "database",
  mysql: "database",
  mongodb: "database",
  redis: "caching",
  git: "git",
  bash: "shell",
  shell: "shell",
  linux: "linux",
  aws: "cloud",
  azure: "cloud",
  gcp: "cloud",
  docker: "docker",
  kubernetes: "kubernetes",
  terraform: "terraform",
  // skills
  backend: "backend",
  backends: "backend",
  frontend: "frontend",
  api: "api",
  apis: "api",
  rest: "api",
  restful: "api",
  graphql: "api",
  database: "database",
  databases: "database",
  sql: "database",
  auth: "auth",
  authentication: "auth",
  oauth: "auth",
  jwt: "auth",
  security: "security",
  cybersecurity: "security",
  encryption: "security",
  cryptography: "security",
  testing: "testing",
  test: "testing",
  tdd: "testing",
  jest: "testing",
  mocha: "testing",
  devops: "devops",
  deployment: "devops",
  deploy: "devops",
  ci: "cicd",
  cd: "cicd",
  cicd: "cicd",
  pipeline: "cicd",
  microservices: "microservices",
  microservice: "microservices",
  distributed: "microservices",
  concurrency: "concurrency",
  concurrent: "concurrency",
  async: "concurrency",
  datastructures: "datastructures",
  algorithms: "datastructures",
  algorithm: "datastructures",
  caching: "caching",
  cache: "caching",
  messaging: "messaging",
  kafka: "messaging",
  rabbitmq: "messaging",
  cloud: "cloud",
  "machine-learning": "machine-learning",
  "machinelearning": "machine-learning",
  ml: "machine-learning",
  "deep-learning": "machine-learning",
  "data-analysis": "data-analysis",
  statistics: "statistics",
  stats: "statistics",
  excel: "excel",
  pandas: "data-analysis",
  numpy: "data-analysis",
  "data-science": "data-science",
  visualization: "visualization",
  "data-visualization": "visualization",
  tableau: "visualization",
  "power-bi": "visualization",
  "project-management": "project-management",
  agile: "project-management",
  scrum: "project-management",
  marketing: "marketing",
  seo: "marketing",
  "digital-marketing": "marketing",
  accounting: "accounting",
  finance: "finance",
  photography: "photography",
  photo: "photography",
  "ui": "ui-ux",
  "ux": "ui-ux",
  "ui-ux": "ui-ux",
  "ui-ux-design": "ui-ux",
  figma: "ui-ux",
  "web-development": "web-development",
  "mobile-development": "mobile-development",
  "mobile-apps": "mobile-development",
  "system-design": "system-design",
  "object-oriented": "oop",
  oop: "oop",
  english: "english",
  spanish: "language",
  japanese: "language",
  french: "language",
  "business-analysis": "business-analysis",
  "stakeholder": "stakeholder-engagement",
  "stakeholders": "stakeholder-engagement",
  "requirements": "requirements-documentation",
  "documentation": "requirements-documentation",
  "process-modeling": "process-modeling",
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "with",
  "is",
  "are",
  "be",
  "become",
  "want",
  "wants",
  "i",
  "me",
  "my",
  "learn",
  "learning",
  "study",
  "studying",
  "master",
  "developer",
  "development",
  "engineer",
  "engineering",
  "build",
  "building",
  "using",
  "use",
  "how",
  "what",
  "things",
  "something",
  "everything",
  "stuff",
  "basics",
  "basic",
  "from",
  "into",
  "your",
  "you",
  "about",
  "career",
  "start",
  "get",
  "good",
  "great",
  "need",
  "know",
  "already",
  "have",
  "has",
  "current",
  "currently",
  // Function / low-information words. These must never be mistaken for a role
  // or a skill, otherwise vague goals ("learn new things this year", "prepare
  // for an AWS certification") would invent a fake role and skip clarification.
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "some",
  "any",
  "new",
  "year",
  "years",
  "now",
  "today",
  "tomorrow",
  "more",
  "most",
  "less",
  "other",
  "another",
  "else",
  "every",
  "all",
  "both",
  "each",
  "one",
  "two",
  "thing",
  "field",
  "fields",
  "area",
  "areas",
  "topic",
  "topics",
  "subject",
  "subjects",
  "course",
  "courses",
  "certification",
  "certifications",
  "certificate",
  "certificates",
  "exam",
  "exams",
  "job",
  "jobs",
  "industry",
  "industries",
  "path",
  "paths",
  "level",
  "levels",
]);

// ---------------------------------------------------------------------------
// Edit-distance helpers (typo tolerance)
// ---------------------------------------------------------------------------

function damerauDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[m]![n]!;
}

function fuzzySkillFor(token: string): string | null {
  if (TERM_TO_SKILL[token]) return TERM_TO_SKILL[token];
  // Typo tolerance: allow an edit distance of 2 for longer terms, 1 for short.
  let best: string | null = null;
  let bestDist = Infinity;
  for (const term of Object.keys(TERM_TO_SKILL)) {
    if (term.length < 3) continue;
    const dist = damerauDistance(token, term);
    const maxDist = term.length <= 4 ? 1 : 2;
    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      best = term;
    }
  }
  return best ? TERM_TO_SKILL[best]! : null;
}

/**
 * Normalize a list of skills through the real skill vocabulary: map each entry
 * to its canonical skill (typo-tolerant) and dedupe. Unknown terms are dropped.
 * Used to sanitize AI-provided stage competencies so the roadmap never persists
 * invented skill names.
 */
export function normalizeSkillList(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of skills) {
    if (!s || typeof s !== "string") continue;
    const token = s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, " ");
    const words = token.split(/\s+/).filter((w) => w.length >= 3);
    for (const word of words) {
      const skill = fuzzySkillFor(word);
      if (skill && !seen.has(skill)) {
        seen.add(skill);
        result.push(skill);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Skill extraction
// ---------------------------------------------------------------------------

/** Extract skill tokens from a free-form sentence (whole-string scan). */
export function extractSkills(goal: string): string[] {
  if (!goal) return [];
  const normalized = goal.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    const skill = fuzzySkillFor(token);
    if (skill && !seen.has(skill)) {
      seen.add(skill);
      result.push(skill);
    }
  }
  return result;
}

/** Skills the student explicitly said they already know. Never re-taught. */
export function extractKnownSkills(goal: string): string[] {
  if (!goal) return [];
  const normalized = goal.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const known: string[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < tokens.length) {
    const bigram = tokens.slice(i, i + 2).join(" ");
    if (
      bigram === "already know" ||
      bigram === "have experience" ||
      bigram === "familiar with" ||
      bigram === "experienced with" ||
      bigram === "proficient in" ||
      bigram === "worked with"
    ) {
      // Collect the skills that follow, skipping list connectors and stopping
      // at verbs/phrase boundaries.
      let j = i + 2;
      const collected: string[] = [];
      while (j < tokens.length) {
        const t = tokens[j]!;
        if (t === "and" || t === "or") {
          j += 1;
          continue;
        }
        if (STOPWORDS.has(t) || t === "but") {
          break;
        }
        const skill = fuzzySkillFor(t);
        if (skill) collected.push(skill);
        j += 1;
      }
      for (const s of collected) {
        if (!seen.has(s)) {
          seen.add(s);
          known.push(s);
        }
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return known;
}

/** Skills the student explicitly wants to LEARN (from "learn X" regions). */
function extractLearnedSkills(goal: string): string[] {
  if (!goal) return [];
  const normalized = goal.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();
  const markers = new Set(["learn", "learning", "study", "studying", "master", "with", "using", "focus", "focusing", "prepare", "preparing", "improve", "improving"]);
  let i = 0;
  while (i < tokens.length) {
    if (markers.has(tokens[i]!)) {
      let j = i + 1;
      while (j < tokens.length) {
        const t = tokens[j]!;
        if (t === "and" || t === "or" || t === "to" || t === "i" || t === "want" || t === "be" || t === "become") break;
        if (STOPWORDS.has(t)) {
          j += 1;
          continue;
        }
        const skill = fuzzySkillFor(t);
        if (skill && !seen.has(skill)) {
          seen.add(skill);
          result.push(skill);
        }
        j += 1;
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return result;
}

export function goalKeywords(goal: string): string[] {
  return extractSkills(goal).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Role profiles (ADDITIVE knowledge hints, never an allowlist)
// ---------------------------------------------------------------------------

export const ROLE_PROFILES: Record<string, RoleProfile> = {
  "backend-developer": {
    id: "backend-developer",
    core: ["backend", "node", "api", "database", "auth"],
    important: ["testing", "cicd", "docker", "git"],
  },
  "frontend-developer": {
    id: "frontend-developer",
    core: ["html", "css", "javascript", "react"],
    important: ["typescript", "ui-ux", "api"],
  },
  "full-stack-developer": {
    id: "full-stack-developer",
    core: ["frontend", "backend"],
    important: ["database", "api", "testing", "devops"],
  },
  "web-developer": {
    id: "web-developer",
    core: ["web-development", "html", "css", "javascript"],
    important: ["api", "ui-ux", "git"],
  },
  "data-analyst": {
    id: "data-analyst",
    core: ["sql", "data-analysis", "visualization"],
    important: ["statistics", "excel", "python"],
  },
  "data-scientist": {
    id: "data-scientist",
    core: ["python", "statistics", "machine-learning", "data-analysis"],
    important: ["sql", "visualization", "cloud"],
  },
  "business-analyst": {
    id: "business-analyst",
    core: ["stakeholder-engagement", "requirements-documentation", "process-modeling"],
    important: ["data-analysis", "sql", "visualization"],
  },
  "devops-engineer": {
    id: "devops-engineer",
    core: ["linux", "docker", "kubernetes", "cloud", "cicd"],
    important: ["shell", "git", "security", "testing"],
  },
  "project-manager": {
    id: "project-manager",
    core: ["project-management", "stakeholder-engagement", "requirements-documentation"],
    important: ["agile", "data-analysis"],
  },
  "product-manager": {
    id: "product-manager",
    core: ["project-management", "stakeholder-engagement", "requirements-documentation"],
    important: ["agile", "data-analysis", "ui-ux"],
  },
  "cybersecurity-analyst": {
    id: "cybersecurity-analyst",
    core: ["security", "auth", "network"],
    important: ["linux", "python", "testing"],
  },
  "mobile-developer": {
    id: "mobile-developer",
    core: ["mobile-development", "javascript"],
    important: ["api", "ui-ux", "typescript"],
  },
};

const FILLER_ROLE_WORDS = new Set(["things", "something", "everything", "stuff", "basics", "skills", "skill"]);

// ---------------------------------------------------------------------------
// Competency knowledge base (supporting hints for common roles NOT in profiles)
// These are SUPPORTING knowledge hints, NOT an allowlist. The AI interpretation
// is the primary path; this provides deterministic fallback richness.
// ---------------------------------------------------------------------------

const COMPETENCY_KNOWLEDGE: Record<string, Array<{ name: string; rationale?: string | null; importance: Importance }>> = {
  "youtuber": [
    { name: "content strategy", rationale: "Planning what content to create for target audience", importance: "critical" },
    { name: "storytelling", rationale: "Structuring videos to engage viewers", importance: "critical" },
    { name: "video production", rationale: "Filming, lighting, and on-camera presence", importance: "critical" },
    { name: "video editing", rationale: "Post-production: cutting, pacing, effects, sound", importance: "critical" },
    { name: "audience growth", rationale: "Growing subscribers and community engagement", importance: "important" },
    { name: "channel analytics", rationale: "Understanding metrics to optimize content", importance: "important" },
    { name: "branding & identity", rationale: "Building a recognizable channel brand", importance: "important" },
    { name: "monetization strategies", rationale: "Revenue streams: ads, sponsorships, products", importance: "optional" },
  ],
  "content-creator": [
    { name: "content strategy", rationale: "Planning content pillars and formats", importance: "critical" },
    { name: "storytelling", rationale: "Structuring narratives across platforms", importance: "critical" },
    { name: "video production", rationale: "Filming techniques and on-camera skills", importance: "important" },
    { name: "video editing", rationale: "Editing for pacing and engagement", importance: "important" },
    { name: "audience growth", rationale: "Community building and engagement", importance: "important" },
    { name: "platform algorithms", rationale: "Understanding distribution mechanics", importance: "important" },
  ],
  "photographer": [
    { name: "photography fundamentals", rationale: "Composition, exposure, lighting basics", importance: "critical" },
    { name: "photo editing", rationale: "Post-processing: color, retouching, workflow", importance: "critical" },
    { name: "portrait photography", rationale: "Lighting, posing, and directing subjects", importance: "important" },
    { name: "lighting techniques", rationale: "Natural, studio, and mixed lighting control", importance: "important" },
    { name: "portfolio development", rationale: "Curating a cohesive body of work", importance: "important" },
    { name: "client management", rationale: "Contracts, delivery, and communication", importance: "optional" },
  ],
  "music-producer": [
    { name: "music theory", rationale: "Harmony, melody, rhythm fundamentals", importance: "critical" },
    { name: "audio engineering", rationale: "Recording, mixing, mastering techniques", importance: "critical" },
    { name: "digital audio workstations", rationale: "DAW proficiency (Ableton, Logic, Pro Tools)", importance: "critical" },
    { name: "sound design", rationale: "Synthesis, sampling, texture creation", importance: "important" },
    { name: "mixing and mastering", rationale: "Balance, dynamics, final polish", importance: "critical" },
    { name: "music business", rationale: "Licensing, royalties, distribution", importance: "optional" },
  ],
  "documentary-filmmaker": [
    { name: "documentary storytelling", rationale: "Narrative structure for non-fiction", importance: "critical" },
    { name: "research & fact-finding", rationale: "Investigative skills and source verification", importance: "critical" },
    { name: "filming techniques", rationale: "Cinematography for documentary style", importance: "critical" },
    { name: "video editing", rationale: "Pacing, narrative arc, interview weaving", importance: "critical" },
    { name: "sound design", rationale: "Ambience, music, voiceover integration", importance: "important" },
    { name: "project management", rationale: "Scheduling, budgeting, legal/ethics", importance: "important" },
  ],
  "furniture-restorer": [
    { name: "woodworking fundamentals", rationale: "Joinery, grain understanding, tool use", importance: "critical" },
    { name: "furniture repair", rationale: "Structural repair, joint restoration", importance: "critical" },
    { name: "refinishing techniques", rationale: "Stripping, staining, finishing methods", importance: "critical" },
    { name: "upholstery basics", rationale: "Padding, fabric, springs, webbing", importance: "important" },
    { name: "historical preservation", rationale: "Period-appropriate materials and methods", importance: "important" },
    { name: "design principles", rationale: "Form, proportion, ergonomics", importance: "optional" },
  ],
  "sports-analyst": [
    { name: "sports statistics", rationale: "Advanced metrics, player tracking data", importance: "critical" },
    { name: "data analysis", rationale: "Python/R, SQL, statistical modeling", importance: "critical" },
    { name: "visualization", rationale: "Charts, dashboards, interactive tools", importance: "important" },
    { name: "domain knowledge", rationale: "Rules, tactics, player evaluation", importance: "critical" },
    { name: "reporting & communication", rationale: "Translating data to actionable insights", importance: "important" },
  ],
  "astrophysicist": [
    { name: "physics fundamentals", rationale: "Mechanics, electromagnetism, thermodynamics", importance: "critical" },
    { name: "mathematics", rationale: "Calculus, differential equations, linear algebra", importance: "critical" },
    { name: "astronomy & cosmology", rationale: "Stellar evolution, galaxies, cosmology", importance: "critical" },
    { name: "data analysis", rationale: "Python, scientific computing, simulation", importance: "critical" },
    { name: "research methods", rationale: "Literature review, hypothesis, publication", importance: "important" },
    { name: "scientific computing", rationale: "Numerical methods, HPC, visualization", importance: "important" },
  ],
  "backend-engineer": [
    { name: "api design", rationale: "REST, GraphQL, gRPC, versioning", importance: "critical" },
    { name: "database design", rationale: "SQL/NoSQL, modeling, optimization", importance: "critical" },
    { name: "backend architecture", rationale: "Microservices, modularity, scaling", importance: "critical" },
    { name: "java", rationale: "Core language, ecosystem, build tools", importance: "important" },
    { name: "spring-boot", rationale: "Framework for enterprise backends", importance: "important" },
    { name: "testing", rationale: "Unit, integration, contract testing", importance: "important" },
    { name: "observability", rationale: "Logging, metrics, tracing, debugging", importance: "important" },
  ],
};

// Multi-outcome skills/topics: learning these without a stated purpose is ambiguous
// because the skill applies to many distinct outcomes.
const MULTI_OUTCOME_SKILLS = new Set([
  "python", "javascript", "java", "typescript", "go", "rust", "c", "cpp",
  "sql", "statistics", "math", "mathematics", "english", "excel",
  "machine-learning", "data-science", "marketing", "music", "writing",
  "art", "digital-marketing", "ai", "artificial-intelligence",
  "deep-learning", "programming", "coding", "web-development",
]);

// Uncertainty phrases that signal the learner needs guidance
const UNCERTAINTY_PHRASES = [
  "don't know", "dont know", "do not know", "not sure", "unsure",
  "where to start", "where do i start", "where do i begin",
  "how to start", "how do i start", "how do i begin",
  "i don't know", "i dont know", "i do not know",
  "no idea", "confused", "lost", "need help", "help me",
  "guidance", "direction", "where should i",
];

// Purpose/outcome phrases that clarify intent
const PURPOSE_PHRASES = [
  "to build", "to create", "to make", "to develop",
  "so i can", "so that i can", "in order to",
  "for my", "for a", "to become", "to work as",
  "aiming to", "planning to", "want to become",
];

const ROLE_DOMAIN: Record<string, string> = {
  "backend-developer": "software",
  "frontend-developer": "software",
  "full-stack-developer": "software",
  "mobile-developer": "software",
  "software-developer": "software",
  "software-engineer": "software",
  "devops-engineer": "software",
  "data-analyst": "data",
  "data-scientist": "data",
  "business-analyst": "business",
  "project-manager": "business",
  "cybersecurity-analyst": "security",
  "digital-marketer": "marketing",
  "marketing-manager": "marketing",
  "accountant": "finance",
  "financial-analyst": "finance",
  "photographer": "creative",
  "ui-designer": "design",
  "ux-designer": "design",
  "product-designer": "design",
};

/** Maps a free-text role to a canonical RoleProfile id, if one exists. */
export function matchRoleProfile(role: string): RoleProfile | null {
  if (!role) return null;
  const key = role.replace(/-/g, " ").trim().toLowerCase().replace(/\s+/g, "-");
  if (ROLE_PROFILES[key]) return ROLE_PROFILES[key];
  // Also try matching by removing trailing industry words ("software engineer" vs "engineer").
  const words = key.split("-");
  while (words.length > 1) {
    words.pop();
    const candidate = words.join("-");
    if (ROLE_PROFILES[candidate]) return ROLE_PROFILES[candidate];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deterministic goal interpretation
// ---------------------------------------------------------------------------

const ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\b(backend|back-end)\s+(developer|engineer)/, role: "backend-developer" },
  { pattern: /\b(frontend|front-end)\s+(developer|engineer)/, role: "frontend-developer" },
  { pattern: /\b(full.?stack|fullstack)\s+(developer|engineer)/, role: "full-stack-developer" },
  { pattern: /\b(mobile|android|ios)\s+(developer|engineer)/, role: "mobile-developer" },
  { pattern: /\bdata\s+(scientist|science)/, role: "data-scientist" },
  { pattern: /\bdata\s+analyst/, role: "data-analyst" },
  { pattern: /\bbusiness\s+analyst/, role: "business-analyst" },
  { pattern: /\bdevops\s+(engineer|specialist)?/, role: "devops-engineer" },
  { pattern: /\bproject\s+manager/, role: "project-manager" },
  { pattern: /\bcyber.?security/, role: "cybersecurity-analyst" },
  { pattern: /\bdigital\s+marketer/, role: "digital-marketer" },
  { pattern: /\baccountant\b/, role: "accountant" },
  { pattern: /\bphotographer\b/, role: "photographer" },
  { pattern: /\b(ui|ux|product)\s+designer/, role: "ui-designer" },
  { pattern: /\b(software|web)\s+(developer|engineer)/, role: "software-developer" },
];

const BECOME_CONNECTORS = new Set([
  "and", "or", "to", "with", "using", "for", "in", "learn", "learning", "study",
  "i", "want", "be", "become", "master",
  "also", "but", "then", "though", "however", "yet", "while", "because", "since",
  "where", "how", "when", "what", "why", "who", "which",
  "just", "really", "currently", "now", "actually", "maybe", "perhaps",
  "need", "needs", "needto", "help", "tips", "advice", "guide", "start", "begin",
  "do", "does", "can", "could", "should", "would", "wanna", "gonna", "dont", "dont",
  "please", "so",
]);

function detectRoleId(goal: string): { roleId: string; roleTitle: string } | null {
  const lower = goal.toLowerCase();
  const becomeMatch = lower.match(/(?:become|to be|work as|start a career as|want to be)\s+(.+)/i);
  if (becomeMatch && becomeMatch[1]) {
    const words = becomeMatch[1].trim().split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (const w of words) {
      if (BECOME_CONNECTORS.has(w)) break;
      parts.push(w);
    }
    if (!parts.length) return null;
    const roleTitle = parts
      .join(" ")
      .replace(/^a |^an |^the /, "")
      .replace(/[^a-z0-9 ]+$/i, "")
      .trim();
    const roleId = roleTitle
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
      .join("-");
    return { roleId, roleTitle };
  }
  // No "become" pattern: try explicit role phrases anywhere in the goal.
  for (const { pattern, role } of ROLE_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      return { roleId: role, roleTitle: m[0].trim() };
    }
  }
  return null;
}

/** Deterministic goal interpretation. The AI refines this later. */
export function analyzeGoal(goal: string): GoalAnalysis {
  if (!goal) {
    return {
      role: null,
      roleId: null,
      roleSource: "none",
      roleConfidence: 0,
      domain: null,
      domainConfidence: 0,
      skills: [],
      knownSkills: [],
      level: "BEGINNER",
      confidence: 0,
      assumptions: [],
      target: null,
      outcome: null,
      competencies: [],
      ambiguity: { isAmbiguous: false, gaps: [] },
    };
  }
  const lower = goal.toLowerCase();
  const detected = detectRoleId(goal);

  let roleId: string | null = null;
  let roleTitle: string | null = null;
  let roleSource: GoalAnalysis["roleSource"] = "none";
  let roleConfidence = 0;
  const assumptions: string[] = [];

  if (detected) {
    roleId = detected.roleId;
    roleTitle = detected.roleTitle;
    if (ROLE_PROFILES[roleId]) {
      roleSource = "profile";
      roleConfidence = 0.9;
      assumptions.push(`Detected career goal: become ${roleTitle}. ROLE_PROFILE found.`);
    } else {
      roleSource = "general";
      roleConfidence = 0.6;
      assumptions.push(
        `Detected career goal: become ${roleTitle}. No ROLE_PROFILE available; using catalog and explicit skills.`,
      );
    }
  } else {
    // Fuzzy single-word role match, but ONLY for genuinely role-like words.
    // A word is role-plausible when it carries a common role suffix
    // (developer, manager, designer, scientist, analyst, …). Function/filler
    // words and skill terms never become roles, so vague goals ("learn this
    // year", "AWS certification") keep their honest low-confidence reading
    // and can still be clarified. This is a shape heuristic, NOT an allowlist:
    // any role-looking word is accepted, and the AI (when present) refines it.
    const ROLE_WORD_SUFFIX = /(?:er|or|ist|ian|yst|ent|ant|man|woman)$/;
    const words = lower.split(/\s+/);
    for (const w of words) {
      const cleaned = w.replace(/[^a-z0-9]/g, "");
      if (
        cleaned.length > 3 &&
        ROLE_WORD_SUFFIX.test(cleaned) &&
        !STOPWORDS.has(cleaned) &&
        !FILLER_ROLE_WORDS.has(cleaned) &&
        !fuzzySkillFor(cleaned)
      ) {
        roleId = cleaned
          .split("")
          .map((c, i) => (i > 0 && c === c.toUpperCase() ? "-" + c : c))
          .join("")
          .toLowerCase();
        roleSource = "general";
        roleConfidence = 0.3;
        assumptions.push(`Matched single word: ${w}. Goal is broad; no specific career pattern detected.`);
        break;
      }
    }
  }

  if (!roleId) {
    assumptions.push("No role pattern detected; interpreting from explicit skills and catalog only.");
  }

  // Domain inference.
  let domain: string | null = null;
  let domainConfidence = 0;
  if (roleId) {
    const mapped = ROLE_DOMAIN[roleId] ?? ROLE_DOMAIN[roleId.split("-")[0] ?? ""];
    if (mapped) {
      domain = mapped;
      domainConfidence = roleConfidence;
    } else if (/engineer|developer|programmer|software|frontend|backend|full.?stack|devops|mobile|web/.test(roleId)) {
      // A general role that does not map to a known profile still carries an
      // honest domain hint ("backend engineer" -> software) so retrieval and
      // the planner are seeded with real context, never a fabricated role.
      domain = "software";
      domainConfidence = roleConfidence;
    } else if (/designer|ux|ui|creative/.test(roleId)) {
      domain = "design";
      domainConfidence = roleConfidence;
    } else if (/analyst|manager|consultant|marketer|accountant/.test(roleId)) {
      domain = "business";
      domainConfidence = roleConfidence;
    }
  }
  if (!domain) {
    const words = lower.split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w)).join(" ");
    if (/japanese|language|english|french|spanish/.test(words)) {
      domain = "language";
      domainConfidence = 0.4;
    } else if (/data|analysis|statistics|ml|machine|science/.test(words)) {
      domain = "data";
      domainConfidence = 0.4;
    } else if (/tech|programming|software|computer|code|developer|engineering/.test(words)) {
      domain = "software";
      domainConfidence = 0.3;
    } else if (/business|management|finance|marketing|accounting|startup/.test(words)) {
      domain = "business";
      domainConfidence = 0.4;
    } else if (/science|astrophysics|physics|chemistry|biology|astronomy|neuroscience|geology|research/.test(words)) {
      domain = "science";
      domainConfidence = 0.4;
    } else if (/photo|design|art|creative/.test(words)) {
      domain = "creative";
      domainConfidence = 0.3;
    }
  }

  const knownSkills = extractKnownSkills(goal);
  const learned = extractLearnedSkills(goal).filter((s) => !knownSkills.includes(s));

  // Level heuristic based on goal complexity and stated experience.
  const complexCount = lower.split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w)).length;
  let level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  if (/(advanced|expert|experienced|deepen|mastery)/.test(lower) || complexCount > 15) {
    level = "INTERMEDIATE";
  } else {
    level = "BEGINNER";
  }
  if (knownSkills.length > 0 && complexCount > 8) {
    level = "INTERMEDIATE";
  }

  let confidence = roleConfidence;
  if (learned.length > 0) confidence = Math.min(1, confidence + 0.15);
  if (roleSource === "none") confidence *= 0.5;
  if (roleSource === "general") confidence *= 0.7;

  // ---------------------------------------------------------------------------
  // NEW: Derive target, outcome, competencies, and ambiguity
  // ---------------------------------------------------------------------------

  // target: what they want to become/achieve
  const target = roleTitle;

  // outcome: intended end state
  // If there's a purpose phrase, extract it; otherwise derive from role
  let outcome: string | null = null;
  if (roleTitle) {
    outcome = `become ${roleTitle}`;
  } else if (learned.length > 0) {
    outcome = `learn ${learned.join(", ")}`;
  }

  // ---------------------------------------------------------------------------
  // Build competency model
  // ---------------------------------------------------------------------------
  const competencies: Array<{ name: string; rationale?: string | null; importance: Importance }> = [];

  // 1. Profile competencies (if role matches a profile)
  if (roleId && ROLE_PROFILES[roleId]) {
    const profile = ROLE_PROFILES[roleId] as RoleProfile;
    for (const s of profile.core) {
      competencies.push({ name: s, rationale: `Core skill for ${roleTitle}`, importance: "critical" });
    }
    for (const s of profile.important) {
      competencies.push({ name: s, rationale: `Important skill for ${roleTitle}`, importance: "important" });
    }
  }

  // 2. Explicit skill competencies
  for (const s of learned) {
    if (!competencies.some(c => c.name === s)) {
      competencies.push({ name: s, rationale: `Explicitly stated learning goal`, importance: "important" });
    }
  }

  // 3. Role-region skill competencies (skills embedded in role name)
  if (roleId) {
    for (const part of roleId.split("-")) {
      if (part.length < 3) continue;
      const skill = fuzzySkillFor(part);
      if (skill && !competencies.some(c => c.name === skill)) {
        competencies.push({ name: skill, rationale: `Skill embedded in role "${roleTitle}"`, importance: "important" });
      }
    }
  }

  // 4. Competency knowledge base for common non-profile roles
  if (roleId && COMPETENCY_KNOWLEDGE[roleId]) {
    const knowledge = COMPETENCY_KNOWLEDGE[roleId]!;
    for (const c of knowledge) {
      if (!competencies.some(existing => existing.name === c.name)) {
        competencies.push(c);
      }
    }
  }

  // 5. Fallback: if still no competencies but we have a target, create a foundational competency
  if (competencies.length === 0 && target) {
    competencies.push({
      name: `${target} fundamentals`,
      rationale: `Foundational knowledge for becoming ${target}`,
      importance: "important",
    });
  }

  // Deduplicate competencies by name
  const uniqueCompetencies = competencies.filter(
    (c, i, arr) => arr.findIndex(x => x.name === c.name) === i
  );

  // ---------------------------------------------------------------------------
  // Ambiguity detection
  // ---------------------------------------------------------------------------
  const hasTargetRole = !!roleId;
  const hasExplicitSkills = learned.length > 0;
  const hasDomain = !!domain;
  const hasUncertainty = UNCERTAINTY_PHRASES.some(p => lower.includes(p));
  const hasPurpose = PURPOSE_PHRASES.some(p => lower.includes(p));

  // Detect multi-outcome skills among learned skills
  const multiOutcomeSkills = learned.filter(s => MULTI_OUTCOME_SKILLS.has(s));

  const gaps: string[] = [];
  let isAmbiguous = false;
  let ambiguityReason: string | null = null;

  if (!hasTargetRole && !hasExplicitSkills && !hasDomain) {
    // No signal at all
    isAmbiguous = true;
    gaps.push("goal");
    ambiguityReason = "Goal is too vague to determine what you want to learn or become.";
  } else if (hasTargetRole) {
    // Clear target role
    if (hasUncertainty) {
      isAmbiguous = true;
      if (roleId === "youtuber" || roleId === "content-creator") {
        gaps.push("content-niche");
        ambiguityReason = "The type of content you want to create is unclear.";
      } else {
        gaps.push("starting-point");
        ambiguityReason = "You know what you want to become, but the starting path is unclear.";
      }
    } else {
      isAmbiguous = false;
      ambiguityReason = null;
    }
  } else if (hasExplicitSkills) {
    // Has skills but no clear role
    if (multiOutcomeSkills.length > 0 && !hasPurpose) {
      isAmbiguous = true;
      gaps.push("intended-outcome");
      ambiguityReason = `The skill "${multiOutcomeSkills[0]}" can be used for many outcomes (web dev, data science, AI, etc.). What do you want to do with it?`;
    } else {
      isAmbiguous = false;
      ambiguityReason = null;
    }
  } else if (hasDomain) {
    // Has domain but no role or skills
    isAmbiguous = false;
    ambiguityReason = null;
  }

  const ambiguity = {
    isAmbiguous,
    gaps,
    reason: ambiguityReason,
  };

  return {
    role: roleId ? roleId.replace(/-/g, " ") : null,
    roleId,
    roleSource,
    roleConfidence,
    domain,
    domainConfidence,
    skills: learned,
    knownSkills,
    level,
    confidence,
    assumptions,
    target,
    outcome,
    competencies: uniqueCompetencies,
    ambiguity,
  };
}

/** Build the required-skill model from the interpretation. */
export function buildRequiredSkills(
  analysis: GoalAnalysis,
  roleProfiles: Record<string, RoleProfile> = ROLE_PROFILES,
): RequiredSkill[] {
  const required: RequiredSkill[] = [];
  const seen = new Set<string>();

  const add = (skill: string, importance: Importance, category: CompetencyCategory, source: RequiredSkillSource) => {
    if (seen.has(skill)) return;
    seen.add(skill);
    required.push({ skill, importance, category, source });
  };

  // PRIMARY: Use the competency model from interpretation (AI or deterministic fallback)
  // This ensures competencies from AI understanding drive retrieval, not just profiles/keywords.
  if (analysis.competencies && analysis.competencies.length > 0) {
    for (const c of analysis.competencies) {
      const category = c.importance === "critical" ? "foundational" : c.importance === "important" ? "core" : "advanced";
      add(c.name, c.importance, category, "goal");
    }
    return required;
  }

  // FALLBACK: Legacy behavior (profile + explicit skills) — kept for backward compatibility
  if (analysis.roleId) {
    const profile = roleProfiles[analysis.roleId];
    if (profile) {
      for (const s of profile.core) add(s, "critical", "foundational", "profile");
      for (const s of profile.important) add(s, "important", "core", "profile");
    }
  }

  // Explicitly-stated learning skills become required with a sensible default.
  for (const s of analysis.skills) add(s, "important", "core", "goal");

  // Role-region skills: skill terms stated inside the role phrase itself
  // (e.g. "Become a backend API and database developer" → backend, api,
  // database). These are direct goal statements, not profile guesses, so a
  // goal with no matching profile still produces a retrievable competency set.
  if (analysis.roleId) {
    for (const part of analysis.roleId.split("-")) {
      if (part.length < 3) continue;
      const skill = fuzzySkillFor(part);
      if (skill) add(skill, "important", "core", "goal");
    }
  }

  return required;
}

/** One clarification answer a learner gave for a question id (e.g. "role"). */
export interface ClarificationAnswer {
  id: string;
  value: string;
}

/**
 * Merge clarification answers into a goal interpretation (deterministic, cheap,
 * no second AI call). The learner's answers are treated as direct statements:
 * a role answer becomes the role, skill/technology answers are parsed into
 * learn-skills through the same skill vocabulary as the free-text goal.
 */
export function applyClarificationAnswers(
  analysis: GoalAnalysis,
  answers: ClarificationAnswer[],
): GoalAnalysis {
  const next: GoalAnalysis = {
    ...analysis,
    skills: [...analysis.skills],
    knownSkills: [...analysis.knownSkills],
    assumptions: [...analysis.assumptions],
  };
  const seen = new Set(next.skills);

  for (const a of answers) {
    const value = a.value.trim();
    if (!value) continue;

    if (a.id === "role") {
      next.role = value;
      next.roleId = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (next.roleId) {
        next.roleSource = "general";
        next.roleConfidence = Math.max(next.roleConfidence, 0.8);
      }
      next.confidence = Math.min(1, next.confidence + 0.2);
      continue;
    }

    if (a.id === "skills" || a.id === "technologies") {
      const tokens = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/[\s,]+/)
        .filter((t) => t.length >= 3);
      for (const token of tokens) {
        const skill = fuzzySkillFor(token);
        if (skill && !seen.has(skill)) {
          seen.add(skill);
          next.skills.push(skill);
        }
      }
      if (tokens.length > 0) {
        next.confidence = Math.min(1, next.confidence + 0.15);
      }
    }
  }

  next.assumptions.push("Clarified via follow-up answers.");
  return next;
}

/** Normalize a raw goal into a lightweight object (used for defaults). */
export function normalizeGoal(goal: string): {
  role: string | null;
  skills: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  domain: string | null;
  confidence: number;
  assumptions: string[];
} {
  const analysis = analyzeGoal(goal);
  return {
    role: analysis.role,
    skills: analysis.skills,
    level: analysis.level,
    domain: analysis.domain,
    confidence: analysis.confidence,
    assumptions: analysis.assumptions,
  };
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

function termHits(text: string | null | undefined, skill: string | null | undefined): number {
  if (!text || skill == null) return 0;
  const lower = text.toLowerCase();
  return lower.split(skill.toLowerCase()).length - 1;
}

export function scoreCourse(course: Omit<CourseCandidate, "key">, skills: string[]): ScoredCourse {
  const effective = skills.length && skills.some((s) => s?.length) ? skills : [""];
  const matches: ScoredCourse["matches"] = [];
  let score = 0;
  const matchedSkills = new Set<string>();

  for (const skill of effective) {
    if (!skill) continue;
    const titleHits = termHits(course.title, skill);
    const catHits = termHits(course.category, skill);
    const descHits = termHits(course.description, skill);
    const skillScore = titleHits * 3 + catHits * 2 + descHits * 1;
    score += skillScore;
    if (titleHits || catHits || descHits) {
      matchedSkills.add(skill);
      matches.push({
        field: titleHits ? "title" : catHits ? "category" : "description",
        skill,
        hits: titleHits + catHits + descHits,
      });
    }
  }

  return { candidate: course, score, matchedSkills: Array.from(matchedSkills), matches };
}

export function rankAndFilter(
  candidates: Omit<CourseCandidate, "key">[],
  skills: string[],
  options: { limit?: number; minScore?: number } = {},
): RankedCourse[] {
  const { limit = 15, minScore = 1 } = options;
  return candidates
    .map((c) => scoreCourse(c, skills))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ candidate: s.candidate, score: s.score, matchedSkills: s.matchedSkills }));
}

// ---------------------------------------------------------------------------
// Match quality
// ---------------------------------------------------------------------------

const SKILL_KEYWORD_GROUPS: Record<string, string[]> = {
  frontend: ["javascript", "html", "css", "react", "vue", "angular", "typescript"],
  backend: ["javascript", "node", "express", "api", "database", "sql", "java", "spring"],
  data: ["sql", "python", "r", "statistics", "excel", "pandas"],
  testing: ["jest", "mocha", "tdd", "unit-testing", "selenium", "cypress"],
  devops: ["docker", "kubernetes", "cicd", "deployment", "cloud", "terraform"],
  api: ["rest", "graphql", "json", "endpoint"],
  database: ["sql", "postgres", "mysql", "mongodb"],
  security: ["encryption", "cryptography", "auth", "oauth", "jwt"],
  concurrency: ["async", "parallel", "promises", "callbacks"],
  microservices: ["docker", "kubernetes", "container", "distributed"],
  datastructures: ["array", "linked-list", "tree", "hash-table", "graph", "algorithm"],
  cloud: ["aws", "azure", "gcp", "cloud-platform"],
  caching: ["redis", "memcache", "varnish", "cdn"],
  messaging: ["kafka", "rabbitmq", "mq", "message-queue"],
  python: ["python", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch"],
  java: ["java", "spring", "spring-boot", "jvm"],
};

export function classifyMatchQuality(
  course: Pick<CourseCandidate, "title" | "category" | "description" | "skills"> | Omit<CourseCandidate, "key">,
  skill: string | null | undefined,
): MatchQuality {
  if (skill == null) return "IRRELEVANT";
  const lowerSkill = skill.toLowerCase();
  const courseSkills = (course.skills ?? []).map((s) => s.toLowerCase());
  const title = course.title ?? "";
  const category = course.category ?? "";
  const description = course.description ?? "";

  if (courseSkills.includes(lowerSkill)) return "DIRECT";

  const titleHits = termHits(title, lowerSkill);
  const catHits = termHits(category, lowerSkill);
  const descHits = termHits(description, lowerSkill);

  if (titleHits + catHits >= 2) return "STRONG";
  if (titleHits >= 1 || catHits >= 1) return "WEAK";
  if (titleHits + catHits + descHits >= 1) return "WEAK";

  const group = SKILL_KEYWORD_GROUPS[lowerSkill];
  if (group && courseSkills.some((s) => group.includes(s))) return "STRONG";

  return "IRRELEVANT";
}

export function bestMatchQualityForCourse(
  course: Pick<CourseCandidate, "title" | "category" | "description" | "skills"> | null,
  requiredSkills: RequiredSkill[],
): MatchQuality {
  if (!course || !requiredSkills.length) return "IRRELEVANT";
  let best: MatchQuality = "IRRELEVANT";
  for (const req of requiredSkills) {
    const quality = classifyMatchQuality(course, req.skill);
    if (quality === "DIRECT") return "DIRECT";
    if (quality === "STRONG") best = "STRONG";
    if (quality === "WEAK" && best === "IRRELEVANT") best = "WEAK";
  }
  return best;
}

// ---------------------------------------------------------------------------
// Candidate retrieval (bounded, competency-based)
// ---------------------------------------------------------------------------

export function retrieveCandidatesForRequirements(
  candidates: Omit<CourseCandidate, "key">[],
  requiredSkills: RequiredSkill[],
  options: {
    perSkill?: number;
    maxTotal?: number;
    minScore?: number;
    level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  } = {},
): RankedCourse[] {
  const { perSkill = 5, maxTotal = 50, minScore = 1, level } = options;

  let filtered = candidates;
  if (level) {
    filtered = candidates.filter((c) => !c.difficulty || c.difficulty === level);
  }

  const seen = new Set<string>();
  const collected: Array<{ candidate: Omit<CourseCandidate, "key">; score: number; matchedSkills: string[] }> = [];

  for (const skill of requiredSkills) {
    const scored = filtered
      .map((c) => scoreCourse(c, [skill.skill]))
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score);

    let count = 0;
    for (const s of scored) {
      if (count >= perSkill) break;
      if (seen.has(s.candidate.id)) continue;
      seen.add(s.candidate.id);
      collected.push({ candidate: s.candidate, score: s.score, matchedSkills: s.matchedSkills });
      count += 1;
    }
  }

  // Also surface candidates whose skill metadata directly matches a required
  // skill even when keyword scoring is weak (catalog facts beat prose).
  for (const skill of requiredSkills) {
    for (const c of filtered) {
      if (seen.has(c.id)) continue;
      if ((c.skills ?? []).some((s) => s.toLowerCase() === skill.skill.toLowerCase())) {
        seen.add(c.id);
        collected.push({ candidate: c, score: 3, matchedSkills: [skill.skill] });
      }
    }
  }

  collected.sort((a, b) => b.score - a.score);
  return collected.slice(0, maxTotal).map((s) => s);
}

export function dedupeEquivalentCourses(
  ranked: RankedCourse[],
): RankedCourse[] {
  const bySignature = new Map<string, RankedCourse>();
  const kept: RankedCourse[] = [];

  for (const r of ranked) {
    const skills = r.candidate.skills ?? [];
    if (skills.length === 0) {
      // No metadata: never collapse — the caller keeps them as distinct.
      kept.push(r);
      continue;
    }
    const signature = [...skills].map((s) => s.toLowerCase()).sort().join("|");
    const existing = bySignature.get(signature);
    if (!existing || r.score > existing.score) {
      bySignature.set(signature, r);
    }
  }

  const seenIds = new Set(kept.map((r) => r.candidate.id));
  for (const r of bySignature.values()) {
    if (!seenIds.has(r.candidate.id)) {
      kept.push(r);
      seenIds.add(r.candidate.id);
    }
  }
  return kept;
}

/** Prerequisite-aware ordering: returns a stable order (key -> depth). */
export function orderByPrerequisites(
  courses: Array<{ key: string; prerequisites?: string[] | string }>,
): Array<{ key: string; order: number }> {
  const keyToOrder = new Map<string, number>();
  const visited = new Set<string>();

  function visit(key: string, depth: number): number {
    if (keyToOrder.has(key)) return keyToOrder.get(key)!;
    if (visited.has(key)) return depth;
    visited.add(key);
    const course = courses.find((c) => c.key === key);
    let maxPrereqDepth = depth;
    if (course?.prerequisites) {
      const prereqs = Array.isArray(course.prerequisites)
        ? course.prerequisites
        : String(course.prerequisites).split(",");
      for (const prereq of prereqs) {
        const p = prereq.trim();
        if (p) {
          const d = visit(p, depth + 1);
          maxPrereqDepth = Math.max(maxPrereqDepth, d);
        }
      }
    }
    keyToOrder.set(key, maxPrereqDepth);
    return maxPrereqDepth;
  }

  for (const course of courses) {
    visit(course.key, 0);
  }
  return Array.from(keyToOrder.entries()).map(([key, order]) => ({ key, order }));
}

// ---------------------------------------------------------------------------
// Honest coverage (server-computed, never AI claims)
// ---------------------------------------------------------------------------

const IMPORTANCE_WEIGHT: Record<Importance, number> = { critical: 3, important: 2, optional: 1 };

export function computeSkillCoverage(input: {
  requiredSkills: RequiredSkill[];
  catalog: Array<{ id: string; title: string; category: string | null; description: string | null; skills?: string[] }>;
  matchedCourseIds: string[];
}): CoverageBreakdown {
  const { requiredSkills, catalog, matchedCourseIds } = input;
  const matched = new Set(matchedCourseIds);
  const byId = new Map(catalog.map((c) => [c.id, c]));

  const skills: SkillCoverageEntry[] = [];
  let coveredWeight = 0;
  let availableCount = 0;
  let totalWeight = 0;

  for (const req of requiredSkills) {
    totalWeight += IMPORTANCE_WEIGHT[req.importance] ?? 1;
    const skillLower = req.skill.toLowerCase();

    // Real catalog courses that teach this skill (facts from course metadata
    // OR strong keyword evidence in title/category).
    const catalogCourseIds = catalog
      .filter((c) => {
        if ((c.skills ?? []).some((s) => s.toLowerCase() === skillLower)) return true;
        const quality = classifyMatchQuality(c, req.skill);
        return quality === "DIRECT" || quality === "STRONG";
      })
      .map((c) => c.id);

    if (catalogCourseIds.length > 0) availableCount += 1;

    const matchedForSkill = catalogCourseIds.filter((id) => matched.has(id));
    const prereqsCovered =
      (req.prerequisites ?? []).length === 0 ||
      (req.prerequisites ?? []).every((p) =>
        catalog.some((c) =>
          matched.has(c.id) && (c.skills ?? []).some((s) => s.toLowerCase() === p.toLowerCase()),
        ),
      );

    let status: SkillStatus;
    let reason: SkillReason;
    let quality: SkillQuality;

    if (matchedForSkill.length > 0) {
      const best = bestMatchQualityForCourse(byId.get(matchedForSkill[0]!) ?? null, [req]);
      if (best === "DIRECT") {
        status = "complete";
        reason = "direct_match";
        quality = "excellent";
      } else if (best === "STRONG") {
        status = "complete";
        reason = "strong_match";
        quality = "good";
      } else {
        status = "partial";
        reason = "partial_match";
        quality = "partial";
      }
    } else if (catalogCourseIds.length > 0) {
      // A catalog course exists for this skill but was not placed.
      if ((req.prerequisites ?? []).length > 0 && prereqsCovered) {
        status = "partial";
        reason = "prerequisite";
        quality = "insufficient";
      } else {
        status = "weak";
        reason = "insufficient_course_depth";
        quality = "insufficient";
      }
    } else {
      status = "unavailable";
      reason = "no_catalog_course";
      quality = "insufficient";
    }

    if (status === "complete" || status === "partial") {
      coveredWeight += IMPORTANCE_WEIGHT[req.importance] ?? 1;
    }

    skills.push({
      skill: req.skill,
      importance: req.importance,
      category: req.category,
      status,
      reason,
      quality,
      matchedCourseIds: matchedForSkill,
      catalogCourseIds,
    });
  }

  const goalCoverage = totalWeight === 0 ? 0 : Math.round((coveredWeight / totalWeight) * 100);
  const courseAvailability =
    requiredSkills.length === 0 ? 0 : Math.round((availableCount / requiredSkills.length) * 100);

  return { goalCoverage, courseAvailability, skills };
}

export function computeRoadmapQuality(breakdown: CoverageBreakdown): RoadmapQualityTier {
  if (breakdown.goalCoverage >= 80) return "excellent";
  if (breakdown.goalCoverage >= 60) return "good";
  if (breakdown.goalCoverage >= 40) return "partial";
  return "poor";
}

export function toCatalogCoverage(goalCoverage: number): CatalogCoverage {
  if (goalCoverage >= 80) return "COMPLETE";
  if (goalCoverage >= 60) return "PARTIAL";
  if (goalCoverage >= 40) return "WEAK";
  return "UNAVAILABLE";
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Meaningful roadmap title with a safe fallback derived from the goal. */
export function meaningfulTitle(
  aiTitle: string | null | undefined,
  goal: string,
  normalized: NormalizedGoal,
): string {
  if (aiTitle && /^[a-z0-9 ]{3,120}$/i.test(aiTitle.trim()) && aiTitle.trim().length >= 3) {
    return aiTitle.trim().slice(0, 120);
  }
  if (normalized.tokens.length > 0) {
    const goalTitle = normalized.goal
      .replace(/\s+/g, " ")
      .replace(/^(i want to|i'd like to|i would like to|learn|become a|become an|become)\s+/i, "")
      .trim();
    if (goalTitle.length >= 3) return goalTitle.slice(0, 120);
  }
  return "Learning Roadmap";
}

/** Strip HTML/control characters and bound length. Never trust AI text. */
export function sanitizeText(text: string, maxLength = 2000): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}