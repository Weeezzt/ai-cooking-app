# src/ports

App-owned interfaces the core depends on (inward-facing). TS signatures only — no
implementations here (adapters land in issues #4–#6).

`StoreDiscovery.ts`, `ProductSearch.ts`, `PriceSource.ts`, `NutritionSource.ts`,
`RecipeGenerator.ts` (+ `index.ts`).

**Why these files only re-export:** `tests/architecture.test.ts` allows `src/core`
to import only from within `src/core`, so a type-only `@/ports` import from the pure
engine would trip that guard. The canonical interface definitions therefore live in
`src/core/ports.ts`; these files give them the AD-2 layout for the rest of the app.
