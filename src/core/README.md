# src/core

Pure domain. **No I/O, no `Date.now()` (take a clock), no imports from `src/server`,
`src/app`, `src/adapters`, or any external SDK.** See AD-2 and `docs/agents/engineering-rules.md`.

Enforced two ways:

- ESLint `import/no-restricted-paths` + `no-restricted-imports` (`eslint.config.mjs`,
  `core-boundary/paths` block).
- `tests/architecture.test.ts` scans every file here for outward imports.

Contents (issue #3):

- `types.ts` — domain types. `Ore` branded integer; `BasketLine` keeps
  `recipeGrams` (nutrition) separate from `purchase.{purchasedGrams,priceOre}` (cost).
- `money.ts` — `Ore` arithmetic, `parseSekToOre` (half-up), `formatOre` (sv-SE).
- `units.ts` — g/ml/st normalization, variable-weight detection + per-gram pricing,
  `packsForNeed`. Half-up rounding, same rule as `money.ts`.
- `clock.ts` — injected `Clock` capability + `FixedClock`; `PipelineContext`.
- `src/ports/*` — canonical type-only inward-facing interfaces; core uses only
  `import type` across that boundary.
- `basket/` — package selection, per-store build, multi-store comparison + objective.
- `nutrition/` — consumed-gram aggregation, coverage ratio, `< 0.7` suppression.
- `constraints/` — evidence taxonomy, pantry caps, evaluation, AD-7 over-budget repair.
- `pipeline/` — `runPlanPipeline(request, deps, ctx)` orchestrator (AD-3).

Engine unit + golden-determinism tests: `tests/core/`.
