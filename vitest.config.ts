import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // `.tsx` covers the UI tests, which render components to static markup with
    // `react-dom/server` — no DOM environment and no new dependency needed.
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      provider: "v8",
      // The engine is the credibility surface (AD-12): report on it explicitly.
      include: ["src/core/**/*.ts"],
      exclude: [
        "src/core/**/*.d.ts",
        // Barrel files (re-exports only) and the type-only port declarations
        // carry no runtime logic to cover.
        "src/core/**/index.ts",
        "src/core/ports.ts",
      ],
      reporter: ["text", "text-summary"],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
