"use client";

import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";

export function UserTopAppBar() {
  const { user } = useAuth();
  const { locale, setLocale } = useI18n();

  return (
    <header className="bg-surface text-primary fixed top-0 left-0 w-full h-navbar-height z-50 flex justify-between items-center px-margin-desktop max-w-container-max mx-auto border-b border-outline-variant md:w-[calc(100%-280px)] md:ml-[280px] md:relative">
      <div className="flex items-center gap-4 md:hidden">
        <span className="material-symbols-outlined text-on-surface">menu</span>
        <span className="text-title-lg font-title-lg font-bold text-primary">EduPro</span>
      </div>
      <div className="hidden md:flex flex-grow items-center">
      </div>
      <div className="flex items-center gap-4">
        <button
          className="rounded-full p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container-low"
          aria-label="Search"
        >
          <span className="material-symbols-outlined">search</span>
        </button>
        <button
          className="rounded-full p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container-low"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          onClick={() => setLocale(locale === "en" ? "th" : "en")}
          className="hidden sm:flex items-center gap-1 rounded-full px-3 py-1.5 text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container-low"
          aria-label="Switch language"
        >
          <span className="material-symbols-outlined text-sm">language</span>
          {locale === "en" ? "ไทย" : "EN"}
        </button>
        {user && (
          <img
            alt="User profile"
            className="w-8 h-8 rounded-full border border-outline-variant object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnK4_Or3MmOL3p35IOf_Vz4M7HzZsiA864jouSUIDFrf6F829FVWbAjrVtM7tWk3nMLN57AZ6kprFKpMevpY-BURlfbq_46c1_8Df4tmIcSXuLYPtRR0AHbr2gPqybLGRMtbpcvN2rfAeXIgtFbgpfI2TIPBNhb63e4HOFPuoCXqjCqVwve39LOX1dd3Pn4E1tCIc2zyegn3wfVEF5BKDM2O2rQa6a69IGHzepkITfIFL1eRyISL-0DQ"
          />
        )}
      </div>
    </header>
  );
}