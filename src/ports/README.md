# src/ports

App-owned interfaces the core depends on (inward-facing). TS signatures only — no
implementations here (adapters land in issues #4–#6).

`StoreDiscovery.ts`, `ProductSearch.ts`, `PriceSource.ts`, `NutritionSource.ts`,
`RecipeGenerator.ts` (+ `index.ts`).

**Why these files only re-export:** `tests/architecture.test.ts` allows `src/core`
to import only from within `src/core`, so a type-only `@/ports` import from the pure
engine would trip that guard. The canonical interface definitions therefore live in
These files are the canonical AD-2 interfaces. They contain types only; core may
reference them with `import type` and never introduces a runtime dependency.
