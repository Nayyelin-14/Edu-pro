import { UserNav } from "@/components/user-nav";
import { UserTopAppBar } from "@/components/user-top-app-bar";
import { MobileBottomNav } from "@/components/user/mobile-bottom-nav";
import { SidebarProvider } from "@/components/sidebar-context";
import { SidebarShell } from "@/components/sidebar-shell";

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
    <div className="min-h-screen bg-background">
      <SidebarProvider>
        <UserNav />
        <SidebarShell>
          <UserTopAppBar />
          <main className="flex-1 pb-24 md:pb-0">
            <div className="mx-auto w-full max-w-container-max p-margin-mobile md:p-margin-desktop">
              {children}
            </div>
          </main>
        </SidebarShell>
        <MobileBottomNav />
      </SidebarProvider>
    </div>
  );
}