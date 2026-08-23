"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";

interface Category {
  id: string;
  name: string;
}

export function CourseDetailsForm({
  courseId,
  course,
  categories,
  onSaved,
}: {
  courseId: string;
  course: {
    title: string;
    subtitle: string | null;
    description: string | null;
    coverImage: string | null;
    price: number;
    isFeatured: boolean;
    category: { id: string; name: string } | null;
    difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    estimatedHours: number | null;
    skills: string[] | null;
    prerequisites: string[] | null;
  };
  categories: Category[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [coverImage, setCoverImage] = useState(course.coverImage ?? "");
  const [price, setPrice] = useState(String(course.price ?? 0));
  const [categoryId, setCategoryId] = useState(course.category?.id ?? "");
  const [isFeatured, setIsFeatured] = useState(course.isFeatured);
  const [difficulty, setDifficulty] = useState(course.difficulty ?? "BEGINNER");
  const [estimatedHours, setEstimatedHours] = useState(
    course.estimatedHours != null ? String(course.estimatedHours) : "",
  );
  const [skills, setSkills] = useState((course.skills ?? []).join(", "));
  const [prerequisites, setPrerequisites] = useState(
    (course.prerequisites ?? []).join(", "),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const splitTokens = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(`/api/staff/courses/${courseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          description: description || undefined,
          coverImage: coverImage || undefined,
          price: Number(price) || 0,
          categoryId: categoryId || null,
          ...(isSuperAdmin ? { isFeatured } : {}),
          difficulty,
          estimatedHours: estimatedHours ? Number(estimatedHours) : null,
          skills: splitTokens(skills),
          prerequisites: splitTokens(prerequisites),
        }),
      });
      toast("Course saved", "success");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const selectCls =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover image URL</Label>
            <Input id="coverImage" type="url" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className={selectCls}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {isSuperAdmin ? (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  Featured
                </label>
              </div>
            ) : (
              <div />
            )}
          </div>

          {/* Learning metadata (used by the learning-path matcher) */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="mb-3 text-sm font-semibold">
              Learning metadata
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Used by the AI learning-path matcher to rank and sequence courses.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <select
                  id="difficulty"
                  className={selectCls}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedHours">Estimated hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  min={0}
                  placeholder="e.g. 10"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="skills">Skills taught (comma separated)</Label>
                <Input
                  id="skills"
                  placeholder="e.g. python, data-analysis, pandas"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Canonical skill tokens used for matching goals to courses.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prerequisites">Prerequisite skills (comma separated)</Label>
                <Input
                  id="prerequisites"
                  placeholder="e.g. python"
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}