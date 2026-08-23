import type { MetadataRoute } from "next";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/staff/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/learning/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}