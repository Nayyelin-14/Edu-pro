-- Content exclusivity at the database level (spec §1: "database constraints
-- where practical"). At most ONE content source may be set on a lesson.
--
-- Completeness (VIDEO has videoUrl, READING has article or pdfUrl) is NOT a
-- DB constraint: the upload lifecycle legitimately holds a VIDEO lesson with
-- a null videoUrl between sign and verified completion (Asset UPLOADING /
-- PROCESSING states). Completeness is enforced by the Zod + service layers.

ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_single_content_source" CHECK (
  NOT ("videoUrl" IS NOT NULL AND "article" IS NOT NULL) AND
  NOT ("videoUrl" IS NOT NULL AND "pdfUrl" IS NOT NULL) AND
  NOT ("pdfUrl" IS NOT NULL AND "article" IS NOT NULL)
);

-- Type/content coherence: a VIDEO lesson can never carry reading-only sources.
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_type_content_coherence" CHECK (
  ("type" = 'READING') OR ("article" IS NULL AND "pdfUrl" IS NULL)
);
