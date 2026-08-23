import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js"],
  async redirects() {
    return [
      {
        source: "/admin/:path*",
        destination: "/staff/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
