import type { PlannerContext } from "./provider";

/** Maps a competency category to a difficulty hint the planner may use to order
 * stages (foundational → BEGINNER, core → INTERMEDIATE, advanced → ADVANCED). */
function difficultyHint(category: string): string {
  if (category === "advanced") return "ADVANCED";
  if (category === "core") return "INTERMEDIATE";
  return "BEGINNER";
}

/** Builds the planner instruction + user prompt shared by every provider. */
export function buildPrompt(ctx: PlannerContext): string {
  const history = Array.from(ctx.progress.values()).filter((p) => p.completed);
  const historyText = history.length
    ? history.map((p) => `  - "${p.courseId}" is COMPLETED`).join("\n")
    : "  (none)";

  const catalogText = ctx.candidates
    .map((c) => {
      const progress = ctx.progress.get(c.id);
      const state = progress
        ? `${progress.percent}% (enrolled${progress.completed ? ", completed" : ""})`
        : "not enrolled";
      const skills = c.skills?.length ? c.skills.join(", ") : "n/a";
      const prereqs = c.prerequisites?.length ? c.prerequisites.join(", ") : "none";
      const hours = c.estimatedHours ?? "n/a";
      const matches = c.matchedCompetencies?.length ? c.matchedCompetencies.join(", ") : "none";
      const match = c.matchType ?? "UNKNOWN";
      return `- key: ${c.key} | title: "${c.title}" | difficulty: ${c.difficulty ?? "BEGINNER"} | skills: ${skills} | prerequisites: ${prereqs} | category: ${c.category ?? "uncategorized"} | est. hours: ${hours} | price: ${c.price === 0 ? "free" : `${c.price} THB`} | progress: ${state} | matches competencies: ${matches} | server match quality: ${match}`;
    })
    .join("\n");

  const requiredSkillsText = ctx.interpretation.requiredSkills
    .map((s) => {
      const preview = ctx.interpretation.coveragePreview.skills.find((e) => e.skill === s.skill);
      const catalogState = preview
        ? `catalog: ${preview.status}${preview.catalogCourseIds.length ? ` (${preview.catalogCourseIds.length} course(s) available)` : " (none)"}`
        : "catalog: unknown";
      const prereqText = s.prerequisites?.length ? `, requires ${s.prerequisites.join(" + ")}` : "";
      return `- ${s.skill} (importance: ${s.importance}, category: ${s.category}, difficulty hint: ${difficultyHint(s.category)})${prereqText} · ${catalogState}`;
    })
    .join("\n");

  const outputLanguage = ctx.language === "th" ? "Thai (ภาษาไทย)" : "English";

  return `You are EduPro's personalized learning-path planner. Your only source of truth for courses is the catalog below — never invent courses, keys, IDs, lessons, instructors, certificates, skills, durations, or prices. Do not praise the learner or the courses; be precise, direct, and useful.

USER GOAL (verbatim): "${ctx.goal}"
Interpreted goal title: ${ctx.interpretation.role ?? ctx.normalizedGoal.role ?? "Custom path"}
Outcome the learner wants: ${ctx.normalizedGoal.outcome || "(not stated)"}
Interpretation confidence: ${Math.round(ctx.interpretation.confidence * 100)}%
Planner assumptions (from interpretation): ${ctx.interpretation.assumptions.length ? ctx.interpretation.assumptions.join(" | ") : "none"}
Learner level: ${ctx.level} (assumed)
Estimated schedule: ${ctx.durationWeeks} weeks, ${ctx.hoursPerWeek} hours/week
Language for ALL explanations (stage titles, descriptions, goals, reasons, milestones): ${outputLanguage}

REQUIRED COMPETENCIES (server-computed — authoritative). Cover as many critical and important competencies as the catalog allows. NEVER drop or reorder a critical competency to fit a stage; if no catalog course covers a required competency, mark that gap honestly instead of forcing a weak course into it:
${requiredSkillsText}

User's already-completed courses (do NOT re-recommend these as new stages):
${historyText}

EduPro course catalog (your ONLY source of truth for courses). Refer to each course ONLY by its opaque "key" value — never by its title text. The difficulty, skills, prerequisites, hours, price and progress are real database values you must respect when ordering stages. The "server match quality" for each course says how confidently it covers the required competencies; only DIRECT and STRONG matches may be recommended as confident matches, weaker ones only as partial coverage with an honest note:
${catalogText}

Output rules (STRICT — violation causes validation failure):
- Produce STRICT JSON only. No prose, no code fences.
- Output a top-level object with exactly: "title" (short, meaningful name for the path), "summary" (a 1-2 sentence overview of the whole path), and "stages".
- Maximum 8 stages, ordered by stageNumber.
- Each stage: stageNumber (int 1..N), title, description, goal, weekStart, weekEnd, courseKey (an EXACT key from the catalog above, or null), reason, isTopic (boolean), skills (array of skills gained), milestones (array: what the learner can do after this stage).
- weekStart <= weekEnd and within 1..${ctx.durationWeeks}.
- A stage may reference at MOST ONE course. Order stages so that a course whose prerequisites are taught by another course comes AFTER it, and easier courses come before harder ones on the same topic.
- If you recommend a course the user already completed, that is an error — skip it.
- Never invent courses, keys, IDs, lessons, instructors, certificates, durations, skills, prerequisites, or URLs.
- courseKey must be one of the keys listed in the catalog above exactly, or null.
- Use the course's REAL skills for the stage's skills field; never fabricate skills.
- If no catalog course sufficiently matches a stage's intent, set courseKey to null and isTopic true, and provide a clear reason.
- Do NOT create a fake generic topic when a catalog course partially matches. Instead, set courseKey to the most relevant catalog key and explain what is covered and what is missing.
- A weak or barely-related course must NEVER be presented as an exact match for a required competency. If the best available course only partially covers a required competency (server match quality RELATIVE or WEAK), set courseKey to it and note the gap honestly in the stage's reason.
- The path's title must be a short, meaningful name (e.g. "AI Engineer Foundations"), never a copy of the user's raw goal and never gibberish.
- All human-readable text must be written in ${outputLanguage}.

Important: Your output will be validated against a schema on the server. Any courseKey that cannot be resolved to a real catalog course is rejected, and the path's coverage is recalculated from real course data. Do not rely on this — always prefer a real catalog key when one is meaningfully relevant.`;
}

export function buildSystemInstruction(): { role: string; parts: { text: string }[] } {
  return {
    role: "user",
    parts: [
      {
        text:
          "You are EduPro's learning-path planner. Always respond with strict JSON that validates against a schema. " +
          "You only recommend real courses from the supplied catalog and may suggest topics where no course exists. " +
          "You never invent courses, IDs, URLs, or completion status. " +
          "You never output prose outside of JSON. " +
          "Do not praise the learner or the courses.",
      },
    ],
  };
}