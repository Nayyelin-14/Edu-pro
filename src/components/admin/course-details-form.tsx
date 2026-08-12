"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
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
  };
  categories: Category[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [coverImage, setCoverImage] = useState(course.coverImage ?? "");
  const [price, setPrice] = useState(String(course.price ?? 0));
  const [categoryId, setCategoryId] = useState(course.category?.id ?? "");
  const [isFeatured, setIsFeatured] = useState(course.isFeatured);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          description: description || undefined,
          coverImage: coverImage || undefined,
          price: Number(price) || 0,
          categoryId: categoryId || null,
          isFeatured,
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
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
