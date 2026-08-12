"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  price: number;
  isPublished: boolean;
  studentCount: number;
  category: { id: string; name: string } | null;
  _count: { modules: number; enrollments: number };
}

interface CoursesResponse {
  items: AdminCourse[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminCoursesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [status, setStatus] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-courses", status, submitted],
    queryFn: () =>
      apiFetch<CoursesResponse>(
        `/api/admin/courses?status=${status}&pageSize=20${
          submitted ? `&search=${encodeURIComponent(submitted)}` : ""
        }`,
      ),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-courses"] });

  const togglePublish = async (c: AdminCourse) => {
    try {
      await apiFetch(`/api/admin/courses/${c.id}/${c.isPublished ? "draft" : "publish"}`, {
        method: "POST",
      });
      toast(c.isPublished ? "Course unpublished" : "Course published", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const remove = async (c: AdminCourse) => {
    if (!window.confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/courses/${c.id}`, { method: "DELETE" });
      toast("Course deleted", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(search.trim());
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Courses</h1>
        <Button asChild>
          <Link href="/admin/courses/new">New course</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={submitSearch} className="flex max-w-md flex-1 gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
          />
          <Button type="submit">Search</Button>
        </form>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Drafts</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/courses/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{c.category?.name ?? "No category"}</span>
                      <span>·</span>
                      <span>{c._count.modules} modules</span>
                      <span>·</span>
                      <span>{c._count.enrollments} enrollments</span>
                    </div>
                  </div>
                  <Badge variant={c.isPublished ? "success" : "secondary"}>
                    {c.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/courses/${c.id}`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void togglePublish(c)}>
                    {c.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(c)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
