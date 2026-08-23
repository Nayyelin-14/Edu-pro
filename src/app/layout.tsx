import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import type { Locale } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "EduPro",
    template: "%s | EduPro",
  },
  description:
    "EduPro E-Learning Platform: enroll in courses, take quizzes and tests, earn certificates, and grow.",
  applicationName: "EduPro",
  authors: [{ name: "EduPro" }],
  openGraph: {
    type: "website",
    siteName: "EduPro",
    title: "EduPro",
    description:
      "EduPro E-Learning Platform: enroll in courses, take quizzes and tests, earn certificates, and grow.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EduPro",
    description:
      "EduPro E-Learning Platform: enroll in courses, take quizzes and tests, earn certificates, and grow.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get("elearning.locale")?.value;
  const initialLocale: Locale = localeValue === "th" ? "th" : "en";

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
