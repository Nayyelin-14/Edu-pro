import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Learning",
};

export default function LearningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
