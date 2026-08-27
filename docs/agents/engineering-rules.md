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
