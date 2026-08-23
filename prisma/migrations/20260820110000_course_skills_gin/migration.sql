-- Support DB-side candidate retrieval (CourseRetriever): GIN indexes on the
-- JSONB skill/prerequisite arrays make array-contains lookups indexable.
CREATE INDEX "Course_skills_gin" ON "Course" USING GIN ("skills");
CREATE INDEX "Course_prerequisites_gin" ON "Course" USING GIN ("prerequisites");