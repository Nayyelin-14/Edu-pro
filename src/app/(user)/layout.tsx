import { UserNav } from "@/components/user-nav";
import { UserTopAppBar } from "@/components/user-top-app-bar";
import { MobileBottomNav } from "@/components/user/mobile-bottom-nav";

export const metadata = {
  title: "My account",
};

export const dynamic = "force-dynamic";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar-width border-r border-outline-variant bg-surface md:block">
        <UserNav />
      </aside>
      <div className="flex min-h-screen flex-col md:ml-sidebar-width">
        <UserTopAppBar />
        <main className="flex-1 pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-container-max p-margin-mobile md:p-margin-desktop">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}