import next from "eslint-config-next";

/**
 * Flat ESLint config.
 *
 * The `core-boundary` block is the primary mechanical guard for AD-2 / the
 * engineering-rules "Boundaries" section: nothing under `src/core/**` may import
 * from `src/server`, `src/app`, `src/adapters`, or an external SDK. A second
 * guard lives in `tests/architecture.test.ts`.
 */
const config = [
  ...next,

  {
    name: "core-boundary/paths",
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/core",
              from: ["./src/server", "./src/app", "./src/adapters"],
              message:
                "src/core is pure domain (AD-2): no imports from src/server, src/app, or src/adapters.",
            },
          ],
        },
      ],
      // Path-based rules cannot see bare package specifiers, so block SDKs here.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "openai",
                "openai/*",
                "next",
                "next/*",
                "react",
                "react-dom",
                "react-dom/*",
                "zod",
                "@/server",
                "@/server/*",
                "@/app",
                "@/app/*",
                "@/adapters",
                "@/adapters/*",
              ],
              message:
                "src/core is pure domain (AD-2): no framework/SDK imports and nothing from server/app/adapters.",
            },
          ],
        },
      ],
    },
  },

  {
    name: "project/ignores",
    ignores: ["node_modules/**", ".next/**", "**/.next/**", ".claude/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },
];

export default config;
