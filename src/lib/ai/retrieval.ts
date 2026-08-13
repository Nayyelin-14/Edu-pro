/**
 * Deterministic, dependency-injected retrieval + relevance ranking.
 *
 * This module is intentionally PURE: it takes data in and returns ranked data.
 * It never touches the database or any AI provider directly, which makes it
 * trivially unit-testable and easy to swap later (e.g. for embeddings/pgvector).
 *
 * The roadmap service injects real Prisma lookups that call into these pure
 * functions, so the ranking logic can be reused and tested in isolation.
 */
import type { CourseCandidate } from "@/lib/ai/provider";

/** Maps a skill keyword to a canonical skill token. */
const SKILL_LEXICON: Array<{ terms: RegExp; skill: string }> = [
  { terms: /\b(backend|server.?side|server|node|nodejs|express)\b/, skill: "backend" },
  { terms: /\b(frontend|client.?side|react|vue|angular)\b/, skill: "frontend" },
  { terms: /\b(api|rest|restful|graphql)\b/, skill: "api" },
  { terms: /\b(database|sql|postgres|mysql|mongodb)\b/, skill: "database" },
  { terms: /\b(auth|authentication|oauth|jwt)\b/, skill: "auth" },
  { terms: /\b(docker|container|devops|kubernetes|deployment|deploy)\b/, skill: "devops" },
  { terms: /\b(testing|test|tdd|jest)\b/, skill: "testing" },
  { terms: /\b(ci.?cd|pipeline)\b/, skill: "cicd" },
  { terms: /\b(cryptography|crypto|security|encryption)\b/, skill: "security" },
  { terms: /\b(concurrency|async|parallel)\b/, skill: "concurrency" },
  { terms: /\b(microservice|microservice|distributed)\b/, skill: "microservices" },
  { terms: /\b(datastructure|algorithm|ds.?a)\b/, skill: "datastructures" },
  { terms: /\b(cloud|aws|azure|gcp)\b/, skill: "cloud" },
  { terms: /\b(caching|cache|redis|memcache)\b/, skill: "caching" },
  { terms: /\b(messaging|queue|message.?queue|kafka|rabbitmq)\b/, skill: "messaging" },
];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "for", "with", "is", "become",
  "want", "i", "me", "my", "learn", "learning", "developer", "development",
  "engineer", "engineering", "build", "building",
]);

export interface SkillMatch {
  skill: string;
  weight: number;
  matched: boolean;
}

/**
 * Deterministic skill extraction from a goal sentence.
 * Replaceable later by an LLM-based structured extractor — same return type.
 */
export function extractSkills(goal: string): string[] {
  if (!goal) return [];
  const normalized = goal.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    for (const entry of SKILL_LEXICON) {
      if (entry.terms.test(token) && !seen.has(entry.skill)) {
        seen.add(entry.skill);
      }
    }
    if (seen.size === SKILL_LEXICON.length) break;
  }
  // Tokens that are themselves meaningful and not stopwords, but didn't map,
  // still surface as generic skill terms.
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    if (token.length < 2) continue;
    if (!seen.has(token)) seen.add(token);
  }
  return Array.from(seen);
}

export interface ScoredCourse {
  candidate: Omit<CourseCandidate, "key">;
  score: number;
  matchedSkills: string[];
  matches: Array<{ field: "title" | "category" | "description"; skill: string; hits: number }>;
}

/** Term frequency inside a text blob (case-insensitive). */
function termHits(text: string | null | undefined, skill: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return lower.split(skill.toLowerCase()).length - 1;
}

/**
 * Deterministic relevance scoring.
 * Weights: title x3, category x2, description x1.
 */
export function scoreCourse(course: Omit<CourseCandidate, "key">, skills: string[]): ScoredCourse {
  if (!skills.length || skills.every((s) => s.length === 0)) {
    // Fallback: still score weakly so nothing is ranked zero.
    skills = [""];
  }
  const matches: ScoredCourse["matches"] = [];
  let score = 0;
  const matchedSkills = new Set<string>();

  for (const skill of skills) {
    if (!skill) continue;
    const titleHits = termHits(course.title, skill);
    const catHits = termHits(course.category, skill);
    const descHits = termHits(course.description, skill);
    const skillScore = titleHits * 3 + catHits * 2 + descHits * 1;
    score += skillScore;
    if (titleHits || catHits || descHits) matchedSkills.add(skill);
    if (skills.length > 0) {
      matches.push({ field: titleHits ? "title" : catHits ? "category" : "description", skill, hits: titleHits + catHits + descHits });
    }
  }

  return { candidate: course, score, matchedSkills: Array.from(matchedSkills), matches };
}

export interface RankedCourse {
  candidate: Omit<CourseCandidate, "key">;
  score: number;
  matchedSkills: string[];
}

/**
 * Ranks candidates by relevance to the extracted skills and filters out
 * irrelevant ones. Pure function — no DB or AI calls.
 *
 * `minScore` excludes courses that share no term with the goal (keeps the LLM
 * context focused; the LLM can still receive all courses if desired).
 */
export function rankAndFilter(
  candidates: Omit<CourseCandidate, "key">[],
  skills: string[],
  options: { limit?: number; minScore?: number } = {},
): RankedCourse[] {
  const { limit = 15, minScore = 1 } = options;
  const scored = candidates
    .map((c) => scoreCourse(c, skills))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({ candidate: s.candidate, score: s.score, matchedSkills: s.matchedSkills }));
}

/** Lightweight keyword extraction used only for catalog search fallback. */
export function goalKeywords(goal: string): string[] {
  return extractSkills(goal).filter((s) => s.length > 0);
}
