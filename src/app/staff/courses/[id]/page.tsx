import { CourseEditor } from "@/components/admin/course-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseEditPage({ params }: PageProps) {
  const { id } = await params;
  return <CourseEditor courseId={id} />;
}
