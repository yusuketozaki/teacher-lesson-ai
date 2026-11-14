import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
]);
