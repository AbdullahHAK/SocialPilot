import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["@socialpilot/db"],
  experimental: {
    serverActions: {
      // Onboarding (logo) and content creation (product/reference images)
      // upload raw files through Server Actions; Next's 1MB default is far
      // too small for real photos. Up to REFERENCE_IMAGE_MAX_COUNT (5)
      // images at REFERENCE_IMAGE_MAX_BYTES (8MB) each is 41,943,040 bytes
      // - confirmed (via next/dist/compiled/bytes, what Next actually uses
      // to parse this string) that "40mb" parses to exactly that same
      // 41,943,040, leaving zero room for the multipart boundaries/headers
      // and the prompt text that ride along with the files in the same
      // request body. A real 5-image upload near the per-file cap tips
      // over that exact limit and gets a 413 within seconds - fast enough
      // to look like an immediate crash rather than a real generation
      // attempt, which takes far longer. "50mb" leaves real headroom.
      bodySizeLimit: "50mb",
    },
  },
};

// Points at ./i18n/request.ts (the default path) - reads the locale from a
// cookie rather than a URL segment, so existing routes (/dashboard, /login,
// etc.) are untouched. See lib/locale.ts for the cookie itself.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
