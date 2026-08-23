/**
 * Integration tests for lesson comments (reply grouping) and comment likes.
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import {
  createComment,
  listCommentsByLesson,
  toggleCommentLike,
} from "@/server/services/comment.service";
import { enroll } from "@/server/services/enrollment.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { fixtureTenantId, grantMembership, ctxFor } from "../helpers/tenant";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;

async function seedUser(): Promise<string> {
  seq += 1;
  const id = `cm-user-${Date.now()}-${seq}`;
  await prisma.user.create({
    data: { id, email: `${id}@example.com`, username: id, password: "x" },
  });
  await grantMembership(id);
  return id;
}

async function seedCourseWithLesson(): Promise<{ courseId: string; lessonId: string }> {
  seq += 1;
  const tenantId = await fixtureTenantId();
  const course = await prisma.course.create({
    data: {
      slug: `cm-course-${Date.now()}-${seq}`,
      title: `Comments course ${seq}`,
      price: 0,
      isPublished: true,
      tenantId,
    },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "Module", position: 1, tenantId },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "Lesson", type: "READING", position: 1, tenantId },
  });
  return { courseId: course.id, lessonId: lesson.id };
}

before(async () => {
  await provisionFreshTestDatabase();
});

test("createComment() requires enrollment in the course", async () => {
  const userA = await seedUser();
  const { lessonId } = await seedCourseWithLesson();

  await assert.rejects(
    async () => createComment(await ctxFor(userA), { lessonId, content: "Hello" }),
    /Enroll in the course/,
  );
});

test("listCommentsByLesson() groups replies under their parent", async () => {
  const userA = await seedUser();
  const userB = await seedUser();
  const { courseId, lessonId } = await seedCourseWithLesson();
  await enroll(await ctxFor(userA), courseId);
  await enroll(await ctxFor(userB), courseId);

  const top = await createComment(await ctxFor(userA), { lessonId, content: "Top level" });
  await createComment(await ctxFor(userB), { lessonId, content: "Reply 1", parentId: top.id });
  await createComment(await ctxFor(userA), { lessonId, content: "Reply 2", parentId: top.id });

  const comment = (await listCommentsByLesson(lessonId, await ctxFor(userA)))[0]!;
  assert.strictEqual(comment.content, "Top level");
  assert.strictEqual(comment.replies.length, 2);
  assert.strictEqual(comment.liked, false);
});

test("createComment() rejects an invalid parent", async () => {
  const userA = await seedUser();
  const { courseId, lessonId } = await seedCourseWithLesson();
  await enroll(await ctxFor(userA), courseId);

  const otherLesson = await prisma.lesson.create({
    data: {
      module: {
        create: { courseId, title: "Other module", position: 999 + seq, tenantId: await fixtureTenantId() },
      },
      title: "Other lesson",
        type: "READING",
        position: 1,
      tenantId: await fixtureTenantId(),
    },
  });

  await assert.rejects(
    async () =>
      createComment(await ctxFor(userA), {
        lessonId,
        content: "Cross-reply",
        parentId: otherLesson.id,
      }),
    /Parent comment is invalid/,
  );
});

test("toggleCommentLike() adds then removes a like and keeps likeCount in sync", async () => {
  const userA = await seedUser();
  const userB = await seedUser();
  const { courseId, lessonId } = await seedCourseWithLesson();
  await enroll(await ctxFor(userA), courseId);
  await enroll(await ctxFor(userB), courseId);

  const comment = await createComment(await ctxFor(userA), { lessonId, content: "Likeable" });

  const first = await toggleCommentLike(await ctxFor(userB), comment.id);
  assert.deepStrictEqual(first, { liked: true, likeCount: 1 });

  const listed = (await listCommentsByLesson(lessonId, await ctxFor(userB)))[0]!;
  assert.strictEqual(listed.liked, true);
  assert.strictEqual(listed.likeCount, 1);

  const second = await toggleCommentLike(await ctxFor(userB), comment.id);
  assert.deepStrictEqual(second, { liked: false, likeCount: 0 });

  const afterUnlike = (await listCommentsByLesson(lessonId, await ctxFor(userB)))[0]!;
  assert.strictEqual(afterUnlike.liked, false);
  assert.strictEqual(afterUnlike.likeCount, 0);
  assert.strictEqual(
    await prisma.commentLike.count({ where: { commentId: comment.id } }),
    0,
  );
});