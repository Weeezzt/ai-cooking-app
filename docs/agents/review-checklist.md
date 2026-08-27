# Review Checklist

_Recurring review concerns. Seeded from the planning cross-review; grows from real PR findings._

## Every PR
- [ ] Acceptance criteria in the issue are each met (name them in the PR body).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green; output pasted in PR.
- [ ] No new dependency without written justification (7-package prod cap).
- [ ] Scope matches the issue — no drive-by changes.

## Domain / engine
- [ ] `src/core` imports nothing outward; no `Date.now()` / I/O in core.
- [ ] Money is `Ore` end-to-end; SEK only at format boundary.
- [ ] `recipeGrams` vs `purchasedGrams` kept distinct.
- [ ] Variable-weight vs fixed-pack branch handled.
- [ ] Over-budget repair is pure and terminating; no AI call inside it.
- [ ] Constraint checks tagged verified / estimated / unsupported.
- [ ] Golden determinism test present for new pipeline logic.

## AI
- [ ] Model call input has no forbidden keys (price/package/brand/retailer/macro/distance/stock).
- [ ] Schema is `strict: true` and passes `assertNoForbiddenKeys()`.
- [ ] Model IDs come from startup resolution, not a literal.
- [ ] Failure path: 1 repair retry then badged demo fallback; no fabricated facts.

## External data
- [ ] Primat types derived from `openapi.json`.
- [ ] Every displayed fact has `Provenance`.
- [ ] Fallback is badged; live + fixture data never silently mixed.
- [ ] Deadline threaded; retries share it.
- [ ] No secret / coordinate in logs or responses.

## UI (source review is NOT enough — run it in a browser, mobile viewport)
- [ ] Smell tests 1–4 pass at 390×844 (see design-system.md).
- [ ] Radius only 0 / 2px / 50%; no shadow tokens; no gradients.
- [ ] Comparable numbers are tabular mono in a fixed column; Swedish formatting.
- [ ] ≥ 3 identity carriers on the screen.
- [ ] Loading / empty / error / over-budget / infeasible states all render acceptably.
- [ ] No console errors.
