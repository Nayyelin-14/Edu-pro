import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash(
    process.env.SUPERADMIN_PASSWORD || "change-me",
    12,
  );

  await prisma.user.upsert({
    where: { username: process.env.SUPERADMIN_USERNAME || "root" },
    update: {},
    create: {
      username: process.env.SUPERADMIN_USERNAME || "root",
      email: process.env.SUPERADMIN_EMAIL || "admin@example.com",
      password,
      role: "SUPERADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  console.log("Superadmin ready.");

  const culture = await upsertCategory("Culture & Heritage", "culture-heritage");
  await upsertCategory("Technology", "technology");
  await upsertCategory("Arts & Crafts", "arts-crafts");

  const course = await prisma.course.upsert({
    where: { slug: "introduction-to-edupro" },
    update: {},
    create: {
      slug: "introduction-to-edupro",
      title: "Introduction to EduPro",
      subtitle: "A comprehensive guide to the EduPro learning platform",
      description:
        "<p>Discover the features and capabilities of EduPro, and how this modern e-learning platform transforms the learning experience.</p>",
      price: 0,
      isPublished: true,
      isFeatured: true,
      categoryId: culture.id,
    },
  });

  const module1 = await prisma.module.create({
    data: {
      courseId: course.id,
      title: "Getting Started",
      description: "Welcome and course overview",
      position: 0,
    },
  });

  await prisma.lesson.create({
    data: {
      moduleId: module1.id,
      title: "Welcome to the Course",
      position: 0,
      isFree: true,
      article:
        "<p>Welcome! This free lesson introduces the course structure and learning goals.</p>",
    },
  });

  await prisma.lesson.create({
    data: {
      moduleId: module1.id,
      title: "History of EduPro",
      position: 1,
      article:
        "<p>EduPro's story is one of innovation — from concept to a comprehensive learning platform.</p>",
    },
  });

  await prisma.quiz.create({
    data: {
      moduleId: module1.id,
      title: "Module 1 Quiz",
      questions: [
        {
          id: "q1",
          question: "What is EduPro primarily designed for?",
          options: ["Video streaming", "E-learning", "Social networking", "File storage"],
          correctIndex: 1,
        },
        {
          id: "q2",
          question: "The course is delivered entirely online. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
  });

  await prisma.test.create({
    data: {
      courseId: course.id,
      title: "Final Assessment",
      description: "Complete the final test to earn your certificate.",
      passingScore: 60,
      timeLimitMinutes: 20,
      attemptLimit: 3,
      questions: [
        {
          id: "tq1",
          question: "What type of platform is EduPro?",
          options: ["E-learning platform", "Video streaming service", "Social network", "Cloud storage"],
          correctIndex: 0,
        },
        {
          id: "tq2",
          question: "EduPro supports quizzes, tests, and certificates. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
  });

  console.log(`Seeded course: ${course.title} (${course.slug})`);
  console.log("Seed complete.");
}

async function upsertCategory(name: string, slug: string) {
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name, slug, description: `${name} courses` },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
