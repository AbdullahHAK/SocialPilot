import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@socialpilot/db"],
  experimental: {
    serverActions: {
      // Onboarding (logo) and content creation (product/reference images)
      // upload raw files through Server Actions; Next's 1MB default is far
      // too small for real photos.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
