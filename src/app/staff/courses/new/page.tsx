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
import {
  CloudUpload,
  Check,
  Loader2,
  X,
  FolderOpen,
  DollarSign,
} from "lucide-react";

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
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null,
  );

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
      slug:
        prev.slug === generateSlug(prev.title)
          ? generateSlug(value)
          : prev.slug,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const price =
        formData.pricingType === "paid" ? Number(formData.price) || 0 : 0;

      const data = await apiFetch<CreatedCourse>("/api/staff/courses", {
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

      router.push(`/staff/courses/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    setError("");
    setLoading(true);
    try {
      const price =
        formData.pricingType === "paid" ? Number(formData.price) || 0 : 0;
      const data = await apiFetch<CreatedCourse>("/api/staff/courses", {
        method: "POST",
        body: JSON.stringify({
          title: formData.title || "Untitled course",
          slug: formData.slug || undefined,
          subtitle: formData.subtitle || undefined,
          description: formData.description || undefined,
          coverImage: formData.coverImage || undefined,
          price,
          categoryId: formData.categoryId || null,
          isFeatured: formData.isFeatured,
        }),
      });
      toast("Draft saved", "success");
      router.push(`/staff/courses/${data.id}`);
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

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (result.data?.url) {
        setFormData((prev) => ({
          ...prev,
          coverImage: result.data.url,
        }));

        setCoverImagePreview(result.data.url);
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to upload image",
        "error",
      );
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
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
          Create New Course
        </h1>

        <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Build the foundation of your new course. You can add content later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {/* ================================================================
            BASIC INFORMATION
        ================================================================= */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 px-5 py-5 sm:px-6 sm:py-6">
            <CardTitle className="flex items-center gap-3 text-lg sm:text-xl">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Check className="size-4 text-primary" />
              </span>

              <span className="text-md">Basic Information</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 px-5 py-6 sm:px-6 sm:py-7">
            {/* Course Title */}
            <div className="space-y-2">
              <Label
                htmlFor="courseTitle"
                className="text-sm font-medium text-foreground"
              >
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

              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {formData.title.length}/120 characters
                </p>
              </div>
            </div>

            {/* Course Slug */}
            <div className="space-y-2">
              <Label
                htmlFor="courseSlug"
                className="text-sm font-medium text-foreground"
              >
                Course Slug
              </Label>

              <div className="flex flex-col overflow-hidden rounded-md border border-input bg-background sm:flex-row sm:items-stretch">
                <div className="flex shrink-0 items-center border-b border-input bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground sm:border-b-0 sm:border-r sm:py-0 sm:text-sm">
                  yourdomain.com/courses/
                </div>

                <Input
                  id="courseSlug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      slug: e.target.value,
                    }))
                  }
                  placeholder="advanced-machine-learning"
                  maxLength={120}
                  className="h-11 rounded-none border-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Auto-generated from the title. Use lowercase letters, numbers,
                and hyphens only.
              </p>
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label
                htmlFor="courseSubtitle"
                className="text-sm font-medium text-foreground"
              >
                Subtitle{" "}
                <span className="font-normal text-muted-foreground">
                  (Optional)
                </span>
              </Label>

              <Input
                id="courseSubtitle"
                value={formData.subtitle}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    subtitle: e.target.value,
                  }))
                }
                placeholder="Master the algorithms of the future"
                maxLength={200}
                className="h-11 text-base"
              />

              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {formData.subtitle.length}/200
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="courseDescription"
                className="text-sm font-medium text-foreground"
              >
                Description
              </Label>

              <Textarea
                id="courseDescription"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Detailed description of what students will learn..."
                rows={6}
                className="min-h-[150px] resize-y text-base"
                maxLength={50000}
              />

              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {formData.description.length}/50000
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================
            MEDIA
        ================================================================= */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 px-5 py-5 sm:px-6 sm:py-6">
            <CardTitle className="flex items-center gap-3 text-lg sm:text-xl">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CloudUpload className="size-5 text-primary" />
              </span>

              <span>Media</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="px-5 py-6 sm:px-6 sm:py-7">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Cover Image
              </Label>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  id="coverImageInput"
                />

                <div
                  className={`flex min-h-[240px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 transition-all sm:min-h-[280px] sm:p-8 ${
                    coverImagePreview
                      ? "border-transparent bg-muted/50"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  {coverImagePreview ? (
                    <div className="relative w-full max-w-2xl">
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="aspect-video w-full rounded-lg border border-border object-cover"
                      />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setFormData((prev) => ({
                            ...prev,
                            coverImage: "",
                          }));

                          setCoverImagePreview(null);
                        }}
                        className="absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                        aria-label="Remove cover image"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                        <CloudUpload className="size-7 text-muted-foreground" />
                      </div>

                      <p className="text-sm font-medium text-foreground sm:text-base">
                        Drag and drop an image, or{" "}
                        <span className="text-primary underline underline-offset-2">
                          browse
                        </span>
                      </p>

                      <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        Recommended size: 1280×720px. JPG, PNG, or WebP.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================
            DETAILS
        ================================================================= */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 px-5 py-5 sm:px-6 sm:py-6">
            <CardTitle className="flex items-center gap-3 text-lg sm:text-xl">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FolderOpen className="size-5 text-primary" />
              </span>

              <span>Details</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="px-5 py-6 sm:px-6 sm:py-7">
            {/* 
              Desktop:
              ┌──────────────────────┬──────────────────────┐
              │ Categorization       │ Pricing              │
              │                      │                      │
              └──────────────────────┴──────────────────────┘

              Tablet/mobile:
              ┌─────────────────────────────────────────────┐
              │ Categorization                              │
              ├─────────────────────────────────────────────┤
              │ Pricing                                     │
              └─────────────────────────────────────────────┘
            */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
              {/* Categorization */}
              <section className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground sm:text-lg">
                    Categorization
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Organize your course so students can find it easily.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="courseCategory"
                    className="text-sm font-medium text-foreground"
                  >
                    Category
                  </Label>

                  <select
                    id="courseCategory"
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        categoryId: e.target.value,
                      }))
                    }
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select a category</option>

                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isFeatured: e.target.checked,
                      }))
                    }
                    className="size-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                  />

                  <div>
                    <span className="text-sm font-medium text-foreground">
                      Mark as Featured Course
                    </span>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Highlight this course in featured sections.
                    </p>
                  </div>
                </label>
              </section>

              {/* Pricing */}
              <section className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground sm:text-lg">
                    Pricing
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose whether students can access this course for free or
                    purchase it.
                  </p>
                </div>

                {/* Pricing Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Pricing Type
                  </Label>

                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                        formData.pricingType === "free"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricingType"
                        value="free"
                        checked={formData.pricingType === "free"}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            pricingType: "free",
                          }))
                        }
                        className="size-4 shrink-0 border-border text-primary focus:ring-primary"
                      />

                      <span className="text-sm font-medium text-foreground">
                        Free
                      </span>
                    </label>

                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                        formData.pricingType === "paid"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricingType"
                        value="paid"
                        checked={formData.pricingType === "paid"}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            pricingType: "paid",
                          }))
                        }
                        className="size-4 shrink-0 border-border text-primary focus:ring-primary"
                      />

                      <span className="text-sm font-medium text-foreground">
                        Paid
                      </span>
                    </label>
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <Label
                    htmlFor="coursePrice"
                    className="text-sm font-medium text-foreground"
                  >
                    Price (USD)
                  </Label>

                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="coursePrice"
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.price}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          price: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      disabled={formData.pricingType === "free"}
                      className="h-11 pl-9 text-base"
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {formData.pricingType === "free"
                      ? "Free course — no price required."
                      : "Enter the course price in USD."}
                  </p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================
            ERROR
        ================================================================= */}
        {error && (
          <Alert variant="error" className="w-full">
            {error}
          </Alert>
        )}

        {/* ================================================================
            ACTION BUTTONS
        ================================================================= */}
        <div className="border-t border-border pt-6 sm:pt-7">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left / Cancel */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>

            {/* Right Actions */}
            <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveDraft()}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Draft"
                )}
              </Button>

              <Button
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
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
        </div>
      </form>
    </div>
  );
}
