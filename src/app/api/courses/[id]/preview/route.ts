import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/server/storage";
import { notFound } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated preview of a FREE lesson's video. This is the only
 * media endpoint that does not require enrollment — it is gated on the lesson
 * being `isFree` and the backing asset being READY. Paid lessons return 403 so
 * we never leak purchasable content.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lessonId = req.nextUrl.searchParams.get("lessonId") ?? undefined;

  const course = await prisma.course.findUnique({
    where: { id, isPublished: true },
    select: { id: true, tenantId: true },
  });
  if (!course) throw notFound("Course not found");

  const lesson = await prisma.lesson.findFirst({
    where: {
      module: { courseId: course.id },
      isFree: true,
      type: "VIDEO",
      ...(lessonId ? { id: lessonId } : {}),
    },
    orderBy: lessonId ? undefined : { position: "asc" },
    select: { id: true, title: true, videoUrl: true },
  });
  if (!lesson || !lesson.videoUrl) {
    return NextResponse.json(
      { isSuccess: false, message: "No free preview available" },
      { status: 404 },
    );
  }

  const ref = lesson.videoUrl;
  let url: string;

  if (ref.startsWith("cloudinary:")) {
    const publicId = ref.slice("cloudinary:".length);
    const asset = await prisma.asset.findFirst({
      where: { publicId, tenantId: course.tenantId },
      select: { status: true, kind: true },
    });
    if (!asset || asset.status !== "READY") {
      return NextResponse.json(
        { isSuccess: false, message: "Preview is not ready yet" },
        { status: 404 },
      );
    }
    const provider = getStorageProvider();
    const signed = await provider.getSignedDeliveryUrl(publicId, "VIDEO", 60 * 60);
    url = signed.url;
  } else if (ref.startsWith("http://") || ref.startsWith("https://")) {
    // Legacy / external reference — served as-is.
    url = ref;
  } else {
    return NextResponse.json(
      { isSuccess: false, message: "Unsupported preview source" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    isSuccess: true,
    data: { lessonId: lesson.id, title: lesson.title, url },
  });
}
