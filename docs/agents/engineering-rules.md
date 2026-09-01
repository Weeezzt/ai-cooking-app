# Engineering Rules

_Short, proven conventions. Grows only when a real PR teaches us something. Full context in
`architecture-decisions.md`._

## Boundaries
- `src/core/**` imports nothing from `server/`, `app/`, `adapters/`, or any SDK. Pure functions,
  no I/O, no `Date.now()` (take a clock). Enforced by ESLint + `tests/architecture.test.ts`.
- Concrete adapters are wired to ports in exactly one file: `src/server/container.ts`.
- Business logic never lives in a React component. Components render `PlanResult`; they don't compute it.

## Money & numbers
- Integer öre (`Ore` branded type) everywhere in the engine. Parse SEK→öre once at the adapter edge,
  half-up. Format to `sv-SE` only at render.
- `recipeGrams` (nutrition) and `purchase.purchasedGrams` / `purchase.priceOre` (cost) are separate
  fields on `BasketLine` and must never be merged.
- Nutrition keeps full precision internally; round only at display. Don't assert per-portion ×
  portions == rounded total — reconcile from unrounded values.

## AI
- The recipe model call gets opaque `optionId`s + generic culinary descriptors ONLY. Never a price,
  package size, brand, retailer, macro, distance, or availability. See AD-6 forbidden-key list.
- Model IDs are never hardcoded — resolved & health-checked at startup from the account's live model
  list, stored in env/config.
- Every AI schema is `strict: true`, Zod-derived, and passes `assertNoForbiddenKeys()`.
- One repair retry (shared deadline), then the badged demo fallback. Never fabricate facts.

## External data
- Types for Primat come from `openapi.json`, not prose.
- Every displayed fact carries `Provenance` (source, retrieved-at, price type/eligibility, coverage).
- No unlabelled fallback. Live store data is never silently mixed with fixture product data.
- Deadline (`ctx.deadlineAt`) is threaded to every provider call; retries share it, never reset it.
- No secret in logs, responses, or `.env.example`. Coordinates never persisted or logged.

## Testing
- The engine (`src/core`) is TDD, high coverage, includes the golden determinism test.
- Adapter contract tests run against BOTH the live-shaped and fixture implementations.
- CI bar: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green. No new failures in a PR.

## Dependencies
- 7 production packages max. Adding one requires a written justification in the PR description.

## Git / PR
- Branch per issue: `feat/<issue-slug>` or `<issue#>-<slug>`. Never commit to `main` directly.
- PR body: what changed, which acceptance criteria it meets, validation run (paste output),
  design references for UI work.
- Builders do not merge their own work or mark it approved.

## Learned from PR reviews (#12–#18)

- **No non-deterministic defaults.** Never `new Date()` / `Date.now()` / `Math.random()` as a
  parameter default or inline in a mapper/adapter/engine path — take a `clock` or an explicit
  timestamp arg. Non-deterministic defaults break parity tests and reproducibility. (#14, #17)
- **Deterministic logic the pipeline consumes lives where the pipeline can reach it.** A filter /
  normalizer / aggregation that `runPlanPipeline` depends on goes in `src/core`, or is surfaced
  through a **port return type** (e.g. `ProductSearch → { products, rejections }`). Never ship it as
  an adapter-only helper — `src/core` can't import `src/adapters`, so it becomes dead code. (#17)
- **Variable-weight detection = `/_KG$/i` on the product id OR `/\bca\.?\b/i` on the name**, AND a
  real per-kg/l `comparison` price. Primat sets `comparison.unit: "kg"` on *every* weight-priced
  product — it is NOT a variable-weight signal. (#17)
- **A fixture/demo result served in place of a live one must be badged** (`isDemoFallback: true` /
  `isDemoData: true`). No silent unbadged substitution, ever. (#18, AD-6/AD-11)
- **Cache the success, not the failure.** A memoized `verifyModels()`-style promise must clear
  itself on rejection so a transient error doesn't poison the process. (#18)
- Mode switches read `APP_MODE` / `DATA_SOURCE`, not raw key presence. (#18)
