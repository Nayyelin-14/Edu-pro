import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listPublishedCourses } from "@/server/services/course.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 12),
    );
    const rawSort = searchParams.get("sort");
    const sort =
      rawSort === "POPULAR" || rawSort === "RATING" || rawSort === "PRICE_ASC"
        ? rawSort
        : "NEWEST";
    const categories = searchParams.getAll("category");
    const minPriceRaw = searchParams.get("minPrice");
    const maxPriceRaw = searchParams.get("maxPrice");
    const data = await listPublishedCourses({
      search: searchParams.get("search") || undefined,
      categories: categories.length ? categories : undefined,
      minPrice:
        minPriceRaw && !Number.isNaN(Number(minPriceRaw))
          ? Number(minPriceRaw)
          : undefined,
      maxPrice:
        maxPriceRaw && !Number.isNaN(Number(maxPriceRaw))
          ? Number(maxPriceRaw)
          : undefined,
      sort,
      page,
      pageSize,
    });
    return ok(data);
  });
}
