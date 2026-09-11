import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "apps/worker/src/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
          ],
        },
      },
      {
        root: "./apps/web",
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["**/*.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
