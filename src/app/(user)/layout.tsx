import { UserNav } from "@/components/user-nav";
import { UserTopAppBar } from "@/components/user-top-app-bar";

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
    <div className="flex min-h-screen bg-surface overflow-hidden">
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-sidebar-width z-40 border-r border-outline-variant bg-surface flex-col">
        <UserNav />
      </aside>
      <main className="flex-grow flex flex-col md:ml-sidebar-width min-w-0">
        <UserTopAppBar />
        <div className="flex-grow pt-navbar-height md:pt-0 overflow-y-auto">
          <div className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}