import { test, describe } from "node:test";
import assert from "node:assert";
import { analyzeGoal, applyClarificationAnswers } from "@/lib/ai/retrieval";
import { needsClarification, buildClarificationQuestions } from "@/server/services/roadmap.generate";

describe("needsClarification", () => {
  test("a vague goal with no signal needs clarification", () => {
    const analysis = analyzeGoal("I want to learn things");
    assert.strictEqual(needsClarification(analysis), true);
  });

  test("a specific goal generates immediately", () => {
    const analysis = analyzeGoal("Become a backend developer and learn PostgreSQL");
    assert.strictEqual(needsClarification(analysis), false);
  });

  test("a skill-only goal generates immediately", () => {
    const analysis = analyzeGoal("I want to learn React and TypeScript");
    assert.strictEqual(needsClarification(analysis), false);
  });
});

describe("buildClarificationQuestions", () => {
  test("produces 1-3 tailored questions for a vague goal", () => {
    const analysis = analyzeGoal("I want to learn things");
    const questions = buildClarificationQuestions(analysis, "en");
    assert.ok(questions.length >= 1 && questions.length <= 3);
    const ids = questions.map((q) => q.id);
    assert.ok(ids.includes("role"), "a role question is offered when no role is known");
    assert.ok(ids.includes("skills"), "a skills question is offered when no skills are known");
  });

  test("a specific goal produces no questions", () => {
    const analysis = analyzeGoal("Become a backend developer and learn PostgreSQL");
    assert.strictEqual(buildClarificationQuestions(analysis, "en").length, 0);
  });

  test("Thai goals get Thai questions", () => {
    const analysis = analyzeGoal("อยากเรียนรู้สิ่งต่างๆ");
    const questions = buildClarificationQuestions(analysis, "th");
    assert.ok(questions.length > 0);
    assert.ok(/[ก-๙]/.test(questions[0]!.question), "question is rendered in Thai");
  });
});

describe("applyClarificationAnswers", () => {
  test("a role answer becomes the role and lifts confidence", () => {
    const analysis = analyzeGoal("I want to learn things");
    const next = applyClarificationAnswers(analysis, [{ id: "role", value: "Data engineer" }]);
    assert.strictEqual(next.role, "Data engineer");
    assert.strictEqual(next.roleId, "data-engineer");
    assert.ok(next.confidence > analysis.confidence);
    assert.ok(!needsClarification(next), "after answering, the goal is clear enough to generate");
  });

  test("skill answers are parsed through the skill vocabulary", () => {
    const analysis = analyzeGoal("I want to learn things");
    const next = applyClarificationAnswers(analysis, [
      { id: "skills", value: "Python, database and REST API" },
    ]);
    assert.ok(next.skills.includes("python"), "python maps to a known skill");
    assert.ok(next.skills.includes("database"), "database maps to a known skill");
    assert.ok(next.skills.includes("api"), "REST API maps to api");
  });

  test("technologies answers enrich skills too", () => {
    const analysis = analyzeGoal("I want to learn things");
    const next = applyClarificationAnswers(analysis, [
      { id: "technologies", value: "Docker Kubernetes" },
    ]);
    assert.ok(next.skills.includes("docker"), "docker maps to a known skill");
    assert.ok(next.skills.includes("kubernetes"), "kubernetes maps to a known skill");
  });

  test("does not mutate the original interpretation", () => {
    const analysis = analyzeGoal("I want to learn things");
    const before = analysis.skills.length;
    applyClarificationAnswers(analysis, [{ id: "skills", value: "Python" }]);
    assert.strictEqual(analysis.skills.length, before, "original analysis is untouched");
  });
});