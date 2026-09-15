import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

// Points at ./i18n/request.ts (the default path) - reads the locale from a
// cookie rather than a URL segment, so existing routes (/dashboard, /login,
// etc.) are untouched. See lib/locale.ts for the cookie itself.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
