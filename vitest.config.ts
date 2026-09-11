import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // packages/db's integration tests share one real local Postgres and
    // several of them clean up with an unscoped `organization.deleteMany()`;
    // running test files in parallel lets one file's cleanup delete
    // another's still-in-use fixtures. This is a root-level setting — it
    // doesn't take effect if placed inside an individual project below.
    fileParallelism: false,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "apps/worker/src/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
            // apps/web/lib is plain server-side TS with no React/DOM
            // dependency, so it belongs here rather than in the jsdom
            // "web" project below. Note: none of these files can
            // `import "server-only"` and still be unit-tested - that
            // marker relies on a "react-server" bundler condition that
            // only Next.js's own build resolves; under Vitest it throws
            // unconditionally regardless of environment.
            "apps/web/lib/**/*.test.ts",
          ],
        },
      },
      {
        root: "./apps/web",
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "apps/web"),
          },
        },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["lib/**", "node_modules/**"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
