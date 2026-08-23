import { test, describe } from "node:test";
import assert from "node:assert";
import {
  extractSkills,
  extractKnownSkills,
  rankAndFilter,
  scoreCourse,
  goalKeywords,
  analyzeGoal,
  matchRoleProfile,
  buildRequiredSkills,
  classifyMatchQuality,
  computeSkillCoverage,
  computeRoadmapQuality,
  retrieveCandidatesForRequirements,
  dedupeEquivalentCourses,
  normalizeSkillList,
} from "@/lib/ai/retrieval";
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

  test("extracts frontend skills from explicit mentions", () => {
    const skills = extractSkills("I want to become a frontend developer with React");
    assert(skills.includes("react"));
  });

  test("extracts database skills", () => {
    const skills = extractSkills("I want to learn PostgreSQL and database design");
    assert(skills.includes("database"));
  });

  test("ignores unknown words (they never become skills)", () => {
    const skills = extractSkills("I want to learn quantum computing");
    assert.deepStrictEqual(skills, []);
  });

  test("ignores typo/noise words in the golden example", () => {
    const skills = extractSkills("I want to become a business analyst and waht are the things i should learn");
    for (const noise of ["waht", "are", "things", "should"]) {
      assert(!skills.includes(noise), `"${noise}" must never become a skill`);
    }
  });

  test("tolerates typos inside explicit skill phrases", () => {
    assert(extractSkills("I want to learn pyhton").includes("python"));
    assert(extractSkills("I want to learn databse design").includes("database"));
    assert(extractSkills("I want to learn javscript").includes("javascript"));
  });

  test("extracts existing knowledge separately from new skills", () => {
    const goal = "I already know JavaScript and Node.js but want to become a backend engineer";
    assert(extractKnownSkills(goal).includes("javascript"));
    assert(extractKnownSkills(goal).includes("node"));
    assert(!extractKnownSkills(goal).includes("backend"), "role phrase is not existing knowledge");
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

describe("normalizeSkillList", () => {
  test("maps entries to canonical skills and dedupes", () => {
    const skills = normalizeSkillList(["Backend", "backend", "Node.js", "SQL"]);
    assert.deepStrictEqual(skills, ["backend", "node", "database"]);
  });

  test("drops unknown/hallucinated skills", () => {
    const skills = normalizeSkillList(["quantum alchemy", "backend", "nonsense"]);
    assert.deepStrictEqual(skills, ["backend"]);
  });

  test("returns an empty array for empty input", () => {
    assert.deepStrictEqual(normalizeSkillList([]), []);
  });
});

describe("analyzeGoal", () => {
  test("extracts role, domain, confidence and assumptions", () => {
    const analysis = analyzeGoal("I want to become a backend developer and learn PostgreSQL");
    assert.strictEqual(analysis.role, "backend developer");
    assert.strictEqual(analysis.domain, "software");
    assert.ok(analysis.confidence > 0.5, "specific goals are interpreted with high confidence");
    assert.strictEqual(analysis.roleId, "backend-developer", "roleId should be backend-developer");
    assert.ok(analysis.skills.includes("database"), "database skill must be extracted from the 'learn' region");
    assert(!analysis.skills.includes("backend"), "backend must come from profile, not from word-scraping");
  });

  test("low confidence for a vague goal produces an assumption", () => {
    const analysis = analyzeGoal("I want to learn things");
    assert.ok(analysis.confidence < 0.5);
    assert.ok(analysis.assumptions.length > 0, "ambiguity is surfaced as an assumption");
  });

  test("role maps to a canonical profile", () => {
    assert.strictEqual(matchRoleProfile("full stack developer")?.id, "full-stack-developer");
    assert.strictEqual(matchRoleProfile("data analyst")?.id, "data-analyst");
    assert.strictEqual(matchRoleProfile("unknown weird role") , null);
  });
});

describe("buildRequiredSkills", () => {
  test("merges profile skills with directly-stated goal skills", () => {
    const analysis = analyzeGoal("Become a full stack developer with Python");
    const required = buildRequiredSkills(analysis);
    const bySkill = new Map(required.map((r) => [r.skill, r]));
    assert.ok(bySkill.get("frontend"), "profile skills are included");
    assert.ok(bySkill.get("backend"), "profile skills are included");
    assert.strictEqual(bySkill.get("python")?.source, "goal", "directly-stated skills keep goal source");
    assert.ok(required.some((r) => r.importance === "critical"), "critical importance is assigned by the profile");
  });

  test("bare goal skills get a sensible default importance", () => {
    const analysis = analyzeGoal("Learn React and TypeScript");
    const required = buildRequiredSkills(analysis);
    const react = required.find((r) => r.skill === "react");
    assert.ok(react);
    assert.strictEqual(react.importance, "important");
    assert.strictEqual(react.source, "goal");
  });
});

describe("classifyMatchQuality", () => {
  test("direct skill metadata is a DIRECT match", () => {
    const course = makeCandidate({ skills: ["backend", "node"] });
    assert.strictEqual(classifyMatchQuality(course, "backend"), "DIRECT");
  });

  test("related-skill overlap is STRONG", () => {
    const course = makeCandidate({ title: "Modern Web Apps", skills: ["javascript", "html", "css"] });
    assert.strictEqual(classifyMatchQuality(course, "frontend"), "STRONG");
  });

  test("strong title/category hits are STRONG, single keyword hits are WEAK", () => {
    const strong = makeCandidate({ title: "Backend Backend Backend", category: "Backend" });
    assert.strictEqual(classifyMatchQuality(strong, "backend"), "STRONG");
    const weak = makeCandidate({ title: "Intro to Backend", category: "General" });
    assert.strictEqual(classifyMatchQuality(weak, "backend"), "WEAK");
    const none = makeCandidate({ title: "Photography Basics", category: "Creative" });
    assert.strictEqual(classifyMatchQuality(none, "backend"), "IRRELEVANT");
  });
});

describe("computeSkillCoverage", () => {
  const catalog = [
    makeCandidate({ id: "c1", title: "Backend with Node.js", skills: ["backend", "api", "node"] }),
    makeCandidate({ id: "c2", title: "SQL Database Design", skills: ["database", "sql"] }),
  ];
  const required = [
    { skill: "backend", importance: "critical" as const, category: "foundational" as const, source: "profile" as const },
    { skill: "database", importance: "important" as const, category: "core" as const, source: "profile" as const },
    { skill: "docker", importance: "optional" as const, category: "advanced" as const, source: "profile" as const },
  ];

  test("reports per-skill status, reason and quality honestly", () => {
    const breakdown = computeSkillCoverage({ requiredSkills: required, catalog, matchedCourseIds: ["c1"] });
    const backend = breakdown.skills.find((s) => s.skill === "backend")!;
    assert.strictEqual(backend.status, "complete");
    assert.strictEqual(backend.reason, "direct_match");
    assert.strictEqual(backend.quality, "excellent");
    const database = breakdown.skills.find((s) => s.skill === "database")!;
    assert.strictEqual(database.status, "weak");
    assert.strictEqual(database.reason, "insufficient_course_depth");
    const docker = breakdown.skills.find((s) => s.skill === "docker")!;
    assert.strictEqual(docker.status, "unavailable");
    assert.strictEqual(docker.reason, "no_catalog_course");
  });

  test("goal coverage is weighted by importance", () => {
    const allPlaced = computeSkillCoverage({ requiredSkills: required, catalog, matchedCourseIds: ["c1", "c2"] });
    assert.ok(allPlaced.goalCoverage > 0);
    const nonePlaced = computeSkillCoverage({ requiredSkills: required, catalog, matchedCourseIds: [] });
    assert.strictEqual(nonePlaced.goalCoverage, 0);
    // database (2) + backend (3) covered out of total 3+2+1=6 -> (5/6)*100
    assert.strictEqual(allPlaced.goalCoverage, 83);
    assert.strictEqual(allPlaced.courseAvailability, 67, "docker has no catalog course");
  });

  test("a placed prerequisite course counts as partial coverage", () => {
    const withPrereq = [
      ...required.map((r) => (r.skill === "database" ? { ...r, prerequisites: ["backend"] } : r)),
    ];
    const breakdown = computeSkillCoverage({ requiredSkills: withPrereq, catalog, matchedCourseIds: ["c1"] });
    const database = breakdown.skills.find((s) => s.skill === "database")!;
    assert.strictEqual(database.status, "partial");
    assert.strictEqual(database.reason, "prerequisite");
  });

  test("roadmap quality tiers derive from coverage", () => {
    const good = computeSkillCoverage({ requiredSkills: required, catalog, matchedCourseIds: ["c1", "c2"] });
    assert.strictEqual(computeRoadmapQuality(good), "excellent");
    const poor = computeSkillCoverage({ requiredSkills: required, catalog, matchedCourseIds: [] });
    assert.strictEqual(computeRoadmapQuality(poor), "poor");
  });
});

describe("retrieveCandidatesForRequirements", () => {
  test("bounds the candidate set and covers each required skill", () => {
    const catalog = Array.from({ length: 40 }, (_, i) =>
      makeCandidate({ id: `c-${i}`, title: `Backend Course ${i}`, category: "Backend", skills: ["backend", "api"] }),
    );
    const required = [{ skill: "backend", importance: "critical" as const, category: "foundational" as const, source: "profile" as const }];
    const picked = retrieveCandidatesForRequirements(catalog, required, { perSkill: 4, maxTotal: 8 });
    assert.ok(picked.length <= 8, "candidate set is bounded");
    assert.ok(picked.length > 0, "at least one candidate is retrieved");
    assert.ok(picked.every((r) => r.candidate.id.startsWith("c-")), "candidates come from the catalog");
  });

  test("never exceeds the total budget even with many skills", () => {
    const catalog = Array.from({ length: 60 }, (_, i) =>
      makeCandidate({ id: `c-${i}`, title: `Fullstack Course ${i}`, category: "Fullstack", skills: ["backend", "frontend", "database", "api", "html", "css"] }),
    );
    const required = [
      { skill: "backend", importance: "critical" as const, category: "foundational" as const, source: "profile" as const },
      { skill: "frontend", importance: "critical" as const, category: "foundational" as const, source: "profile" as const },
      { skill: "database", importance: "important" as const, category: "core" as const, source: "profile" as const },
      { skill: "api", importance: "important" as const, category: "core" as const, source: "profile" as const },
      { skill: "html", importance: "critical" as const, category: "foundational" as const, source: "profile" as const },
      { skill: "css", importance: "critical" as const, category: "foundational" as const, source: "profile" as const },
    ];
    const picked = retrieveCandidatesForRequirements(catalog, required, { perSkill: 4, maxTotal: 24 });
    assert.ok(picked.length <= 24, "total budget respected");
  });
});

describe("dedupeEquivalentCourses", () => {
  test("collapses near-identical skill sets, keeps distinct courses", () => {
    const ranked = [
      { candidate: makeCandidate({ id: "a1", title: "Node Backend A", skills: ["backend", "api"] }), score: 9, matchedSkills: ["backend", "api"] },
      { candidate: makeCandidate({ id: "a2", title: "Node Backend B", skills: ["backend", "api"] }), score: 8, matchedSkills: ["backend", "api"] },
      { candidate: makeCandidate({ id: "b1", title: "SQL Database", skills: ["database", "sql"] }), score: 7, matchedSkills: ["database", "sql"] },
    ];
    const kept = dedupeEquivalentCourses(ranked);
    assert.strictEqual(kept.length, 2);
    assert.ok(kept.some((r) => r.candidate.id === "a1"));
    assert.ok(kept.some((r) => r.candidate.id === "b1"));
  });

  test("courses without skill metadata are never collapsed", () => {
    const ranked = [
      { candidate: makeCandidate({ id: "x1", title: "Course One" }), score: 5, matchedSkills: [] },
      { candidate: makeCandidate({ id: "x2", title: "Course Two" }), score: 4, matchedSkills: [] },
    ];
    const kept = dedupeEquivalentCourses(ranked);
    assert.strictEqual(kept.length, 2, "no metadata means no dedup");
  });
});