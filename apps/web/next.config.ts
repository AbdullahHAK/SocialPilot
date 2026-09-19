import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["@socialpilot/db"],
  experimental: {
    serverActions: {
      // Onboarding (logo) and content creation (product/reference images)
      // upload raw files through Server Actions; Next's 1MB default is far
      // too small for real photos. Up to REFERENCE_IMAGE_MAX_COUNT (5)
      // images at REFERENCE_IMAGE_MAX_BYTES (8MB) each - 10mb was too
      // tight for that combination and silently dropped the request
      // (looked like a crash) once someone actually uploaded several
      // real photos.
      bodySizeLimit: "40mb",
    },
  },
};

// Points at ./i18n/request.ts (the default path) - reads the locale from a
// cookie rather than a URL segment, so existing routes (/dashboard, /login,
// etc.) are untouched. See lib/locale.ts for the cookie itself.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
