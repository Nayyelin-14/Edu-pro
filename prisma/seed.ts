import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, CourseDifficulty } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type SeedCourse = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  isFeatured?: boolean;
  categoryKey: string;
  difficulty: keyof typeof CourseDifficulty;
  skills: string[];
  prerequisites: string[];
  estimatedHours: number;
  moduleTitle: string;
  lessons: { title: string; isFree?: boolean; article: string }[];
  quizTitle: string;
  quizQuestions: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
};

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
  const technology = await upsertCategory("Technology", "technology");
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Tenant", slug: "default" },
  });
  const crafts = await upsertCategory("Arts & Crafts", "arts-crafts");
  const categories = {
    "culture-heritage": culture,
    technology,
    "arts-crafts": crafts,
  } as Record<string, { id: string }>;

  const courses: SeedCourse[] = [
    {
      slug: "introduction-to-edupro",
      title: "Introduction to EduPro",
      subtitle: "A comprehensive guide to the EduPro learning platform",
      description:
        "<p>Discover the features and capabilities of EduPro, and how this modern e-learning platform transforms the learning experience.</p>",
      price: 0,
      isFeatured: true,
      categoryKey: "culture-heritage",
      difficulty: "BEGINNER",
      skills: ["edupro-platform", "e-learning", "online-learning"],
      prerequisites: [],
      estimatedHours: 4,
      moduleTitle: "Getting Started",
      lessons: [
        {
          title: "Welcome to the Course",
          isFree: true,
          article:
            "<p>Welcome! This free lesson introduces the course structure and learning goals.</p>",
        },
        {
          title: "History of EduPro",
          article:
            "<p>EduPro's story is one of innovation — from concept to a comprehensive learning platform.</p>",
        },
      ],
      quizTitle: "Module 1 Quiz",
      quizQuestions: [
        {
          question: "What is EduPro primarily designed for?",
          options: ["Video streaming", "E-learning", "Social networking", "File storage"],
          correctIndex: 1,
        },
        {
          question: "The course is delivered entirely online. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "introduction-to-doi-tung",
      title: "Introduction to Doi Tung",
      subtitle: "Explore the heritage, gardens and community of Doi Tung",
      description:
        "<p>Learn about the history of Doi Tung, its royal development projects, gardens and the local community that makes it unique.</p>",
      price: 0,
      isFeatured: true,
      categoryKey: "culture-heritage",
      difficulty: "BEGINNER",
      skills: ["thai-culture", "doi-tung", "heritage"],
      prerequisites: [],
      estimatedHours: 6,
      moduleTitle: "The Story of Doi Tung",
      lessons: [
        {
          title: "A Royal Development Story",
          isFree: true,
          article:
            "<p>Discover how the Doi Tung development project transformed a mountain community.</p>",
        },
        {
          title: "Gardens and Landmarks",
          article:
            "<p>A tour of the Mae Fah Luang Garden and other landmarks of Doi Tung.</p>",
        },
      ],
      quizTitle: "Doi Tung Essentials",
      quizQuestions: [
        {
          question: "Where is Doi Tung located?",
          options: ["Chiang Rai", "Bangkok", "Chiang Mai", "Phuket"],
          correctIndex: 0,
        },
        {
          question: "The Doi Tung project focuses on sustainable development. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "northern-thai-history",
      title: "Northern Thai History & Heritage",
      subtitle: "A deeper look at Lanna culture and traditions",
      description:
        "<p>Explore the rich history of the Lanna kingdom, its temples, art and enduring cultural traditions.</p>",
      price: 499,
      categoryKey: "culture-heritage",
      difficulty: "INTERMEDIATE",
      skills: ["thai-culture", "lanna-history", "heritage", "art-history"],
      prerequisites: ["thai-culture"],
      estimatedHours: 8,
      moduleTitle: "Lanna Culture",
      lessons: [
        {
          title: "The Lanna Kingdom",
          isFree: true,
          article:
            "<p>An introduction to the rise of the Lanna kingdom and its legacy.</p>",
        },
        {
          title: "Temples and Art",
          article:
            "<p>The distinctive temple architecture and art of northern Thailand.</p>",
        },
      ],
      quizTitle: "Lanna History Quiz",
      quizQuestions: [
        {
          question: "Which region was the heartland of the Lanna kingdom?",
          options: ["Northern Thailand", "Isan", "Southern Thailand", "The Andaman coast"],
          correctIndex: 0,
        },
        {
          question: "Lanna means 'a million rice fields'. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "python-programming-basics",
      title: "Python Programming Basics",
      subtitle: "Start coding with the world's most approachable language",
      description:
        "<p>Learn Python fundamentals: variables, data types, control flow, functions and simple programs.</p>",
      price: 599,
      isFeatured: true,
      categoryKey: "technology",
      difficulty: "BEGINNER",
      skills: ["python", "programming", "basics"],
      prerequisites: [],
      estimatedHours: 10,
      moduleTitle: "Python Fundamentals",
      lessons: [
        {
          title: "Your First Python Program",
          isFree: true,
          article:
            "<p>Write and run your first Python program and learn about variables and data types.</p>",
        },
        {
          title: "Control Flow",
          article:
            "<p>Conditionals and loops: the building blocks of program logic.</p>",
        },
        {
          title: "Functions",
          article:
            "<p>Reusable code with functions and parameters.</p>",
        },
      ],
      quizTitle: "Python Basics Quiz",
      quizQuestions: [
        {
          question: "Which of these is a valid way to define a function in Python?",
          options: ["function foo():", "def foo():", "func foo()", "define foo()"],
          correctIndex: 1,
        },
        {
          question: "Python is an interpreted language. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "web-development-html-css",
      title: "Web Development with HTML & CSS",
      subtitle: "Build beautiful, responsive web pages from scratch",
      description:
        "<p>Learn the structure and styling of the web: semantic HTML, modern CSS, flexbox and responsive design.</p>",
      price: 599,
      categoryKey: "technology",
      difficulty: "BEGINNER",
      skills: ["web-development", "html", "css", "responsive-design"],
      prerequisites: [],
      estimatedHours: 8,
      moduleTitle: "Building the Web",
      lessons: [
        {
          title: "Semantic HTML",
          isFree: true,
          article:
            "<p>Structure a page with semantic HTML5 elements.</p>",
        },
        {
          title: "Styling with CSS",
          article:
            "<p>Colors, typography, spacing and the box model.</p>",
        },
      ],
      quizTitle: "HTML & CSS Quiz",
      quizQuestions: [
        {
          question: "Which tag is used to link a stylesheet?",
          options: ["<link>", "<style-src>", "<css>", "<rel>"],
          correctIndex: 0,
        },
        {
          question: "Flexbox is a CSS layout model. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "javascript-for-beginners",
      title: "JavaScript for Beginners",
      subtitle: "Add interactivity to your web pages",
      description:
        "<p>Master the basics of JavaScript: variables, functions, DOM manipulation and events.</p>",
      price: 799,
      categoryKey: "technology",
      difficulty: "INTERMEDIATE",
      skills: ["javascript", "web-development", "dom"],
      prerequisites: ["web-development"],
      estimatedHours: 12,
      moduleTitle: "JavaScript Essentials",
      lessons: [
        {
          title: "JavaScript Fundamentals",
          isFree: true,
          article:
            "<p>Variables, types and operators in JavaScript.</p>",
        },
        {
          title: "The DOM",
          article:
            "<p>Select and update elements in the page.</p>",
        },
        {
          title: "Events",
          article:
            "<p>Respond to user interactions with event listeners.</p>",
        },
      ],
      quizTitle: "JavaScript Quiz",
      quizQuestions: [
        {
          question: "Which keyword declares a block-scoped variable?",
          options: ["var", "let", "int", "scoped"],
          correctIndex: 1,
        },
        {
          question: "The DOM represents the page structure as a tree. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "data-analysis-python",
      title: "Data Analysis with Python",
      subtitle: "Turn raw data into insights with pandas and matplotlib",
      description:
        "<p>Learn to load, clean, analyze and visualize data using Python's pandas and matplotlib libraries.</p>",
      price: 999,
      isFeatured: true,
      categoryKey: "technology",
      difficulty: "INTERMEDIATE",
      skills: ["python", "data-analysis", "statistics", "pandas", "visualization"],
      prerequisites: ["python"],
      estimatedHours: 14,
      moduleTitle: "Analyzing Data",
      lessons: [
        {
          title: "Pandas DataFrames",
          isFree: true,
          article:
            "<p>Load and explore tabular data with pandas.</p>",
        },
        {
          title: "Cleaning Data",
          article:
            "<p>Handle missing values and transform columns.</p>",
        },
        {
          title: "Visualizing Results",
          article:
            "<p>Create clear charts with matplotlib.</p>",
        },
      ],
      quizTitle: "Data Analysis Quiz",
      quizQuestions: [
        {
          question: "Which library provides DataFrame objects?",
          options: ["pandas", "matplotlib", "numpy", "django"],
          correctIndex: 0,
        },
        {
          question: "Data cleaning only involves deleting rows. (True/False)",
          options: ["True", "False"],
          correctIndex: 1,
        },
      ],
    },
    {
      slug: "traditional-thai-textile",
      title: "Traditional Thai Textile Weaving",
      subtitle: "Learn the craft behind Thai woven fabrics",
      description:
        "<p>Explore the looms, patterns and cultural meaning of traditional Thai textiles.</p>",
      price: 399,
      categoryKey: "arts-crafts",
      difficulty: "BEGINNER",
      skills: ["textile-weaving", "crafts", "thai-culture"],
      prerequisites: [],
      estimatedHours: 6,
      moduleTitle: "The Weaver's Craft",
      lessons: [
        {
          title: "Looms and Techniques",
          isFree: true,
          article:
            "<p>Understand the tools and techniques of traditional weaving.</p>",
        },
        {
          title: "Patterns and Meaning",
          article:
            "<p>The stories woven into Thai textile patterns.</p>",
        },
      ],
      quizTitle: "Textile Weaving Quiz",
      quizQuestions: [
        {
          question: "Thai textiles are woven on a frame called a…",
          options: ["Loom", "Kiln", "Loom-hook", "Spindle"],
          correctIndex: 0,
        },
        {
          question: "Textile patterns can carry cultural meaning. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
    {
      slug: "ceramic-arts-pottery",
      title: "Ceramic Arts & Pottery",
      subtitle: "From clay to kiln — the fundamentals of pottery",
      description:
        "<p>Learn hand-building, wheel throwing, glazing and firing in this hands-on ceramic arts course.</p>",
      price: 699,
      categoryKey: "arts-crafts",
      difficulty: "INTERMEDIATE",
      skills: ["pottery", "ceramics", "crafts"],
      prerequisites: [],
      estimatedHours: 10,
      moduleTitle: "Working with Clay",
      lessons: [
        {
          title: "Hand Building",
          isFree: true,
          article:
            "<p>Create forms with coils, slabs and pinching.</p>",
        },
        {
          title: "Glazing and Firing",
          article:
            "<p>Finish pieces with glaze and fire them in the kiln.</p>",
        },
      ],
      quizTitle: "Pottery Quiz",
      quizQuestions: [
        {
          question: "Which of these is a hand-building technique?",
          options: ["Coiling", "Casting", "Milling", "Turning"],
          correctIndex: 0,
        },
        {
          question: "A kiln is used to fire clay. (True/False)",
          options: ["True", "False"],
          correctIndex: 0,
        },
      ],
    },
  ];

  for (const c of courses) {
    await seedCourse(c, categories[c.categoryKey]!.id);
  }

  console.log(`Seeded ${courses.length} courses.`);
  console.log("Seed complete.");
}

let _tenantId: string | null = null;
async function getDefaultTenantId(): Promise<string> {
  if (_tenantId) return _tenantId;
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Tenant", slug: "default" },
  });
  _tenantId = tenant.id;
  return _tenantId;
}

async function seedCourse(c: SeedCourse, categoryId: string) {
  const tenantId = await getDefaultTenantId();
  const course = await prisma.course.upsert({
    where: { slug: c.slug },
    update: {
      subtitle: c.subtitle,
      description: c.description,
      price: c.price,
      isFeatured: c.isFeatured ?? false,
      isPublished: true,
      approvalStatus: "APPROVED",
      categoryId,
      difficulty: CourseDifficulty[c.difficulty],
      skills: c.skills,
      prerequisites: c.prerequisites,
      estimatedHours: c.estimatedHours,
    },
    create: {
      tenantId,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      price: c.price,
      isPublished: true,
      approvalStatus: "APPROVED",
      isFeatured: c.isFeatured ?? false,
      categoryId,
      difficulty: CourseDifficulty[c.difficulty],
      skills: c.skills,
      prerequisites: c.prerequisites,
      estimatedHours: c.estimatedHours,
    },
  });

  let module = await prisma.module.findFirst({
    where: { courseId: course.id, position: 0 },
  });
  if (!module) {
    module = await prisma.module.create({
      data: {
        courseId: course.id,
        tenantId,
        title: c.moduleTitle,
        description: `${c.title} core content`,
        position: 0,
      },
    });
  }

  const lessonCount = await prisma.lesson.count({ where: { moduleId: module.id } });
  if (lessonCount === 0) {
    for (const [i, l] of c.lessons.entries()) {
      await prisma.lesson.create({
        data: {
          moduleId: module.id,
          tenantId,
          title: l.title,
          position: i,
          isFree: l.isFree ?? false,
          type: "READING",
          article: l.article,
        },
      });
    }
  }

  const quizCount = await prisma.quiz.count({ where: { moduleId: module.id } });
  if (quizCount === 0) {
    await prisma.quiz.create({
      data: {
        moduleId: module.id,
        tenantId,
        title: c.quizTitle,
        questions: c.quizQuestions.map((q, i) => ({
          id: `q${i + 1}`,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
        })),
      },
    });
  }

  console.log(`  - ${course.title} (${course.slug})`);
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