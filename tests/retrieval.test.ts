import { test, describe } from "node:test";
import assert from "node:assert";
import { extractSkills, rankAndFilter, scoreCourse, goalKeywords } from "@/lib/ai/retrieval";
import type { CourseCandidate } from "@/lib/ai/provider";

function makeCandidate(overrides: Partial<CourseCandidate> = {}): CourseCandidate {
  return {
    key: "cand-1",
    id: "c1",
    slug: "test-course",
    title: "Backend Development with Node.js",
    subtitle: "Learn backend",
    description: "Build REST APIs with Express and PostgreSQL",
    category: "Backend",
    price: 0,
    lessonCount: 20,
    studentCount: 100,
    rating: 4.5,
    ...overrides,
  };
}

describe("extractSkills", () => {
  test("extracts known skills from goal", () => {
    const skills = extractSkills("I want to learn backend development with Node.js and Express and REST API");
    assert(skills.includes("backend"));
    assert(skills.includes("api"));
  });

  test("returns empty array for empty goal", () => {
    const skills = extractSkills("");
    assert.deepStrictEqual(skills, []);
  });

  test("filters stopwords", () => {
    const skills = extractSkills("I want to learn the basics");
    assert(!skills.includes("the"));
    assert(!skills.includes("to"));
    assert(!skills.includes("learn"));
  });

  test("extracts frontend skills", () => {
    const skills = extractSkills("I want to become a frontend developer with React");
    assert(skills.includes("frontend"));
  });

  test("extracts database skills", () => {
    const skills = extractSkills("I want to learn PostgreSQL and database design");
    assert(skills.includes("database"));
  });

  test("handles unknown tokens as generic skills", () => {
    const skills = extractSkills("I want to learn quantum computing");
    assert(skills.includes("quantum"));
    assert(skills.includes("computing"));
  });
});

describe("scoreCourse", () => {
  test("scores title matches highest", () => {
    const course = makeCandidate({ title: "Backend Development", category: "Backend", description: "Learn backend" });
    const result = scoreCourse(course, ["backend"]);
    // "backend" appears in title (1 hit * 3) + category (1 hit * 2) + description (1 hit * 1) = 6
    assert.strictEqual(result.score, 6);
    assert(result.matchedSkills.includes("backend"));
  });

  test("scores category matches second highest", () => {
    const course = makeCandidate({ title: "Server Programming", category: "Backend", description: "Learn servers" });
    const result = scoreCourse(course, ["backend"]);
    assert.strictEqual(result.score, 2);
  });

  test("scores description matches lowest", () => {
    const course = makeCandidate({ title: "Server Programming", category: "Programming", description: "Backend development with Node" });
    const result = scoreCourse(course, ["backend"]);
    assert.strictEqual(result.score, 1);
  });

  test("combines multiple skill matches", () => {
    const course = makeCandidate({ title: "Backend API Development", category: "Backend", description: "Build REST APIs with database" });
    const result = scoreCourse(course, ["backend", "api", "database"]);
    // title: backend(1)*3 + api(1)*3 = 6
    // category: backend(1)*2 = 2
    // description: api(1)*1 + database(1)*1 = 2
    // total = 10
    assert.strictEqual(result.score, 10);
  });

  test("returns zero score for no matches", () => {
    const course = makeCandidate({ title: "Frontend React", category: "Frontend", description: "Learn React" });
    const result = scoreCourse(course, ["backend"]);
    assert.strictEqual(result.score, 0);
  });

  test("handles empty skills with fallback", () => {
    const course = makeCandidate();
    const result = scoreCourse(course, []);
    assert.strictEqual(result.score, 0);
  });
});

describe("rankAndFilter", () => {
  test("ranks by score descending", () => {
    const candidates = [
      makeCandidate({ id: "1", title: "Frontend React", category: "Frontend" }),
      makeCandidate({ id: "2", title: "Backend Node.js", category: "Backend" }),
      makeCandidate({ id: "3", title: "Fullstack", category: "Fullstack" }),
    ];
    const ranked = rankAndFilter(candidates, ["backend"], { limit: 10, minScore: 1 });
    assert(ranked.length > 0);
    const top = ranked[0]!;
    assert.strictEqual(top.candidate.id, "2");
  });

  test("filters by minScore", () => {
    const candidates = [
      makeCandidate({ id: "1", title: "Frontend React", category: "Frontend" }),
      makeCandidate({ id: "2", title: "Backend Node.js", category: "Backend" }),
    ];
    const ranked = rankAndFilter(candidates, ["backend"], { minScore: 2 });
    assert.strictEqual(ranked.length, 1);
    assert(ranked.length > 0);
    const top = ranked[0]!;
    assert.strictEqual(top.candidate.id, "2");
  });

  test("respects limit", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate({ id: String(i), title: `Backend Course ${i}`, category: "Backend" })
    );
    const ranked = rankAndFilter(candidates, ["backend"], { limit: 5 });
    assert.strictEqual(ranked.length, 5);
  });

  test("returns empty array when no candidates match minScore", () => {
    const candidates = [makeCandidate({ title: "Frontend React", category: "Frontend" })];
    const ranked = rankAndFilter(candidates, ["backend"], { minScore: 1 });
    assert.strictEqual(ranked.length, 0);
  });
});

describe("goalKeywords", () => {
  test("returns extracted skills", () => {
    const keywords = goalKeywords("I want to learn backend and database and REST API");
    assert(keywords.includes("backend"));
    assert(keywords.includes("database"));
    assert(keywords.includes("api"));
  });
});