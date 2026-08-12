"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { CloudUpload, Check, Loader2, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CreatedCourse {
  id: string;
  slug: string;
}

interface FormData {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  coverImage: string;
  price: string;
  categoryId: string;
  isFeatured: boolean;
  pricingType: "free" | "paid";
}

const initialFormData: FormData = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  coverImage: "",
  price: "0",
  categoryId: "",
  isFeatured: false,
  pricingType: "free",
};

export default function NewCoursePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/api/categories"),
  });
  const categories = categoriesQuery.data ?? [];

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      title: value,
      slug: prev.slug === generateSlug(prev.title) ? generateSlug(value) : prev.slug,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const price = formData.pricingType === "paid" ? Number(formData.price) || 0 : 0;
      const data = await apiFetch<CreatedCourse>("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          title: formData.title,
          slug: formData.slug || undefined,
          subtitle: formData.subtitle || undefined,
          description: formData.description || undefined,
          coverImage: formData.coverImage || undefined,
          price,
          categoryId: formData.categoryId || null,
          isFeatured: formData.isFeatured,
        }),
      });
      toast("Course created successfully", "success");
      router.push(`/admin/courses/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    try {
      const formData_upload = new FormData();
      formData_upload.append("file", file);
      formData_upload.append("folder", "elearning/covers");

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData_upload,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      if (result.data?.url) {
        setFormData((prev) => ({ ...prev, coverImage: result.data.url }));
        setCoverImagePreview(result.data.url);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to upload image", "error");
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleCoverImageUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleCoverImageUpload(file);
    }
  };

  const isFormValid = formData.title.trim().length >= 3;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Create New Course</h1>
        <p className="text-lg text-muted-foreground">
          Build the foundation of your new course. You can add content later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Check className="size-5 text-primary" />
              </span>
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="courseTitle" className="text-sm font-medium text-foreground">
                Course Title
              </Label>
              <Input
                id="courseTitle"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Advanced Machine Learning"
                required
                minLength={3}
                maxLength={120}
                className="h-11 text-base"
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/120 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseSlug" className="text-sm font-medium text-foreground">
                Course Slug
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  yourdomain.com/courses/
                </span>
                <Input
                  id="courseSlug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="advanced-machine-learning"
                  className="h-11 text-base pl-48"
                  maxLength={120}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-generated from title. Lowercase letters, numbers and hyphens only.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseSubtitle" className="text-sm font-medium text-foreground">
                Subtitle (Optional)
              </Label>
              <Input
                id="courseSubtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Master the algorithms of the future"
                maxLength={200}
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseDescription" className="text-sm font-medium text-foreground">
                Description
              </Label>
              <Textarea
                id="courseDescription"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of what students will learn..."
                rows={5}
                className="text-base"
                maxLength={50000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Media Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CloudUpload className="size-5 text-primary" />
              </span>
              Media
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label className="text-sm font-medium text-foreground">Cover Image</Label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="coverImageInput"
              />
              <div
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 transition-all ${
                  coverImagePreview
                    ? "border-transparent bg-muted/50"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById("coverImageInput")?.click()}
              >
                {coverImagePreview ? (
                  <div className="relative w-full max-w-md">
                    <img
                      src={coverImagePreview}
                      alt="Cover preview"
                      className="w-full h-auto rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, coverImage: "" }));
                        setCoverImagePreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
                      aria-label="Remove cover image"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <CloudUpload className="size-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-base font-medium text-foreground">
                        Drag and drop an image, or{" "}
                        <span className="text-primary font-medium underline underline-offset-2 cursor-pointer">
                          browse
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Recommended size: 1280×720px (JPG, PNG, WebP)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CloudUpload className="size-5 text-primary" />
              </span>
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Categorization */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Categorization</h3>
                <div className="space-y-2">
                  <Label htmlFor="courseCategory" className="text-sm font-medium text-foreground">
                    Category
                  </Label>
                  <select
                    id="courseCategory"
                    value={formData.categoryId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a category</option>
                    <option value="">None</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Mark as Featured Course</span>
                </label>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Pricing</h3>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Pricing Type</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pricingType"
                        value="free"
                        checked={formData.pricingType === "free"}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pricingType: e.target.value as "free" }))}
                        className="h-4 w-4 border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Free</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pricingType"
                        value="paid"
                        checked={formData.pricingType === "paid"}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pricingType: e.target.value as "paid" }))}
                        className="h-4 w-4 border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Paid</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coursePrice" className="text-sm font-medium text-foreground">
                    Price (USD)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base font-medium">
                      $
                    </span>
                    <Input
                      id="coursePrice"
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                      disabled={formData.pricingType === "free"}
                      className="h-11 text-base pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.pricingType === "free" ? "Free course - no price required" : "Enter price in USD"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end items-center gap-4 pt-6 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <div className="flex w-full sm:w-auto gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                router.push(`/admin/courses/${Date.now()}/edit`);
              }}
              className="flex-1 sm:flex-none"
            >
              Save Draft
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormValid}
              className="flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Next: Add Content"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}