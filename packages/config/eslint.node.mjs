// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared flat ESLint config for Node/TypeScript packages (worker, db). */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "generated/**", "node_modules/**"],
  },
);
