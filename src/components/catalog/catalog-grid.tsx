"use client";

import { motion } from "motion/react";

import { CourseCard, type CourseCardCourse } from "@/components/course-card";

export function CatalogGrid({ courses }: { courses: CourseCardCourse[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {courses.map((course, i) => (
        <motion.div
          key={course.id}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: (i % 4) * 0.05, duration: 0.45, ease: "easeOut" }}
          className="h-full"
        >
          <CourseCard course={course} />
        </motion.div>
      ))}
    </div>
  );
}