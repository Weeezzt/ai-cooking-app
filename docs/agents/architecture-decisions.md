# Architecture Decisions

_The unified plan. Resolves the planning-phase cross-review contradictions. This document is the
source of truth builders work from; the `docs/agents/planning/*` files are background research and
may contain superseded detail — where they conflict with this file, this file wins._

_Last updated: 2026-08-27 by Master._

---

## AD-0. Scope (locked)

**Build:** one mobile-first `PLAN → SHOP → COOK` journey for one meal, in Swedish.

**In scope (from the reviewer-recommended cut, plus one addition the human kept):**
- Structured constraint inputs + free-text vibe + pantry list.
- ≤ 2 OpenAI calls per plan (1 recipe call required; 1 small intent call allowed if it earns its place).
- **Multi-store price comparison KEPT** (human decision): shortlist 2–3 nearby `full`-tier stores,
  query the same ingredient concepts against all of them, compute a comparable basket per store,
  pick one, and show the comparison ("3 butiker — vald för bäst pris på din korg").
- **Live Primat is P0** (human decision): the demo runs live against the Primat API, with a
  versioned fixture recording as an automatic, clearly-badged fallback.
- Deterministic basket + nutrition + constraint engine.
- Client-side plan persistence (sessionStorage + localStorage). No Vercel Blob, no share links.
- Dark mode only.
- Honest `over_budget` / `infeasible` terminal states after deterministic repair. **No automatic
  AI budget re-plan.** Regeneration is a separate, user-triggered action (capped).
- Demo geography: **Umeå** (17 `full`-tier stores across ICA/Coop/Willys/Lidl verified 2026-08-27).

**Deferred (not in this build):** share links / Blob persistence, dynamic out-of-stock
substitution, live Open Food Facts lookups, service worker / offline install, background &
concurrent timers, price history, nationwide coverage, product images, opening hours,
post-generation portion scaling, provider health endpoint, light mode.

---

## AD-1. Stack

| Choice | Decision | Notes |
|---|---|---|
| Framework | Next.js (App Router, latest 16.x) + TypeScript `strict` | RSC for result pages, route handler for the pipeline |
| Runtime | Node.js (Fluid Compute on Vercel) — **not** Edge | Full Node APIs, longer duration, OpenAI SDK |
| Package manager | pnpm | |
| Node version | Build/CI/prod pinned to Node 22 LTS; local v20.11 is fine for dev | |
| Styling | Tailwind v4 + a hand-authored `tokens.css` design layer | No component library — it fights the visual identity |
| Validation | Zod | AI output + external payload + request validation |
| AI SDK | official `openai` package, Responses API | see AD-6 |
| Tests | Vitest | |
| Prod dependency budget | **7 packages max**; more needs written justification in the PR | |

## AD-2. Repository structure

```
src/
  core/                 # pure domain. NO imports from server/, app/, or any adapter. No I/O.
    types.ts            # Ore, MealRequest, IngredientRequirement, Product, BasketLine, Basket,
                        #   NutritionBreakdown, ConstraintReport, PlanResult, Provenance …
    money.ts            # Ore arithmetic, sv-SE formatting boundary
    units.ts            # unit normalization, g/ml/st, variable-weight math, half-up rounding rule
    basket/             # package selection, per-store basket build, multi-store comparison
    nutrition/          # consumed-gram nutrition aggregation + coverage
    constraints/        # feasibility taxonomy + evaluation + over-budget repair algorithm
    pipeline/           # runPlanPipeline(request, deps, ctx) — orchestrator, dependency-injected
  ports/                # app-owned interfaces the core depends on (inward-facing)
    StoreDiscovery.ts  ProductSearch.ts  PriceSource.ts  NutritionSource.ts  RecipeGenerator.ts
  adapters/
    primat/             # live Primat client (types generated/derived from openapi.json) + mappers
    fixtures/           # fixture implementations of every port; reads src/fixtures data
    openai/             # RecipeGenerator implementation, prompt + schema module
    nutrition/          # OFF snapshot reader + Livsmedelsverket curated table reader
  fixtures/             # committed data: Umeå stores, recorded product/price payloads,
                        #   curated ingredient-nutrition table, OFF nutrition snapshot, demo plan
  server/
    container.ts        # the ONLY file that wires concrete adapters to ports (mode-switched)
    pipeline-route.ts   # POST handler: validate → runPlanPipeline → return PlanResult
  app/                  # Next.js routes: /(plan) /(shop) /(cook) — client routes reading the snapshot
    _components/        # UI primitives + per-mode components
  lib/                  # client-side plan store, formatting, small helpers
tests/
  architecture.test.ts  # asserts core/ imports nothing outward; asserts no forbidden keys in AI schema
  core/                 # heavy unit coverage of the engine, incl. golden determinism test
  adapters/             # contract tests run against BOTH primat and fixture adapters
```

An ESLint `import/no-restricted-paths` rule enforces the `core/` boundary; `tests/architecture.test.ts`
is a second mechanical guard.

---

## AD-3. The canonical pipeline (resolves cross-review B1)

`runPlanPipeline(request, deps, ctx)` — pure orchestration, every dependency injected, every stage
bounded by `ctx.deadlineAt` (a shared global deadline — retries do **not** reset it).

1. Validate the request and öre budget; resolve and shortlist at most three chain-diversified full stores.
2. Generate one Swedish recipe first. Input is vibe, portions, dietary constraints, time preference,
   pantry names, and a coarse per-portion tier: `<35 kr = snav`, `<75 kr = lagom`, otherwise `generos`.
3. For every store and ingredient, search by `namn`, then deterministically filter lexical/category
   matches, prepared/frozen/canned food, bad units, amounts, and prices. Pantry matches are owned.
4. Select packages and rank stores by matched coverage, total, distance, then stable store key.
   Missing products become `unmatchedIngredients`; they cost 0 kr and do not invalidate the recipe.
5. Compute purchase totals in öre and nutrition from consumed recipe quantities, evaluate constraints,
   optionally repair over-budget baskets with cheaper same-ingredient candidates, and return `PlanResult`.

Honest MVP SLO (measured, not promised): fixture path p95 < 3 s; live path target p50 < 12 s,
p95 < 25 s. The generating UI is **narrated activity**, not a literal per-stage progress bar,
unless measured latency later justifies a durable job + polling.

---

## AD-4. Deterministic basket engine

- **Money is integer öre** end to end (`type Ore = number & { readonly __brand: 'Ore' }`). SEK
  floats exist only at the sv-SE formatting boundary. Parse Primat's decimal SEK → öre once, at
  the adapter edge, half-up.
- **Recipe quantity ≠ purchase quantity.** Nutrition uses `recipeGrams`; cost uses the purchased
  pack(s) or exact variable weight. Never prorate a fixed pack.
- **Price policy (decided):** the basket total uses **`prices.regular`** — the shelf price a
  non-member pays. `member`, `offer`, and `multiprice` are surfaced as "möjlig besparing" secondary
  info, never in the headline total. One rule, documented, applied everywhere.
- **Variable-weight branch:** detect and buy exact grams at `comparison.price / 1000` per gram,
  rounded half-up to öre.
- **Multi-store comparison:** same selection rules per store; the comparison object records each
  store's basket total, coverage, distance, and missing concepts.
- **Golden determinism test:** run the whole pipeline twice on frozen inputs with a `FixedClock`
  and deep-equal the results.

---

## AD-5. Constraint feasibility taxonomy (resolves S3)

Every constraint check is one of:

| Class | Meaning | UI treatment |
|---|---|---|
| `verified` | Deterministic from trusted facts (budget vs. basket in öre; distance from resolved coords; portions equality) | Real pass / fail. Green check or red. |
| `estimated` | Model or heuristic estimate (cook time; nutrition with partial coverage) | Shown with `ca` + a confidence/coverage note. Never a hard red. |
| `unsupported` | Cannot be established from available data (allergen safety, detailed dietary guarantees) | Never rendered as a green "pass". Non-dismissible disclaimer. |

Overall outcome aggregation:
- `ok` — all `verified` checks pass.
- `over_budget` — the budget `verified` check fails after repair; everything else may still pass.
- `infeasible` — a `verified` check is provably failed by valid facts (no store in range;
  core-ingredient coverage impossible).
- `unknown` — a provider/coverage failure prevented a `verified` check from being computed.

`infeasible` and `unknown` are **business results**, returned `200`, rendered as a decision screen —
not `503`.

---

## AD-6. AI boundary & OpenAI integration (resolves B2, B4, B5)

**Information-flow rule.** The recipe call receives only vibe, portions, dietary constraints,
maximum cook time, pantry names, and `snav | lagom | generos`. It never receives the SEK amount,
products, brands, retailers, prices, availability, nutrition, or distance.

**The model owns:** Swedish recipe title/explanation, ordinary ingredient names and amounts,
cooking sequence, name-based step attribution, and estimated time. Deterministic code owns all
factual store values and resolves names to products after generation.

**Schema guard:** `tests/architecture.test.ts` runs `assertNoForbiddenKeys()` over every AI schema —
`price`, `pris`, `kr`, `ore`, `store`, `butik`, `retailer`, `kcal`, `kalori`, `protein`, `carb`,
`kolhydrat`, `fat`, `fett`, `gtin`, `distance`, `avstånd`, `stock`, `lager` — CI fails if any appear.

**API:** Responses API + Structured Outputs (`text.format` json_schema, `strict: true`), official
`openai` SDK, `responses.parse` + a zod-derived schema. Server-side only. `OPENAI_API_KEY` from env,
never logged, never returned by an endpoint, absent from `.env.example`.

**Model IDs — do not hardcode a guess.** At startup the server queries the models available to the
account, verifies Responses API + structured output support, and selects one low-latency model
(intent, if used) and one quality model (recipe). Verified IDs live in env/config and are validated
by a startup health check. The planning doc's `gpt-5.6-luna/terra` names were a Codex-tier
confusion and must not be copied into code. Record the actually-returned IDs (dated) once the key
exists. Recompute cost/latency from the then-current pricing page.

**Failure:** graceful per-error UI state, one repair retry (same deadline), then serve the
persistently-badged pre-baked demo recipe. Never fabricate factual values. Never silently swap in a
fixture recipe outside an explicit, badged fallback.

**Prompts:** Swedish output directly, exact portions and dietary constraints, self-contained steps
with amounts/times, ordinary ingredient names, and no codes. Budget tier is guidance, not a number.

---

## AD-7. Over-budget: one deterministic repair algorithm (resolves B3)

Pre-processing (not repair rungs, done before the first price): apply pantry caps, merge duplicate
product lines.

Repair (pure, terminating, no AI):
1. Enumerate only **authorized alternatives for the same canonical concept** — other filtered
   candidates in the chosen store (cheaper SKU, different sufficient pack size).
2. Choose the feasible basket by a fixed lexicographic objective: preserve all `core` + `supporting`
   requirements → satisfy dietary rules → minimize budget overshoot → minimize number of
   substitutions → minimize leftover waste → stable ids.
3. Optionally remove requirements the model explicitly tagged `optional_garnish`, and
   deterministically strip their references from the steps.
4. If still over budget → return `over_budget` with the cheapest valid basket under the objective
   and the exact overshoot.

Never reduce a `core` quantity without model-provided min/max tolerances (out of MVP scope).
"Generate a different recipe" is a separate user action, capped at 3 per session, not a repair rung.

---

## AD-8. Plan persistence & state (resolves B9)

- The pipeline returns the **complete immutable `PlanResult`** in the POST response body.
- The client writes it to `sessionStorage` (primary) and `localStorage` (survives reload) under an
  unguessable local key. `/plan`, `/shop`, `/cook` are **client routes** that read the same
  snapshot — they cannot disagree because there is one object.
- `localStorage` also holds per-view UI state: checked shopping items, current cook step.
- A plan older than **24 h** is shown with a "priser kontrollerades {date}" staleness notice.
- No server persistence, no Blob, no share URL, no `MemoryPlanStore`. Deferred.

---

## AD-9. Data layer & fixtures (resolves B8)

- **Two fixture classes, never conflated:**
  1. `fixtures/raw/` — verbatim recorded Primat HTTP responses, used by adapter contract tests to
     prove the mapper handles the real shape.
  2. `fixtures/domain/` — small normalized `Product` / `StoreOption` / nutrition objects, used by
     engine + demo. Produced by running raw recordings through the real mapper (a checked-in script).
- **Provider ports:** `StoreDiscovery`, `ProductSearch`, `PriceSource`, `NutritionSource`,
  `RecipeGenerator`. Each has a Primat/OpenAI/OFF live adapter and a fixture adapter.
- **Mode switch** via `DATA_SOURCE` env (`live` | `fixture`) resolved in `server/container.ts`.
  Fixture mode needs no secrets and no network. Live mode with any provider failure → automatic,
  **badged** fallback to fixture for that provider; live store data is never mixed with fixture
  product data silently — the badge says which.
- **Primat client** typed from `https://primat.nu/api/v3/openapi.json`. Cache store-resolve and
  common store-scoped searches (in-memory, TTL, deadline-aware). Attribution "Prisdata från
  primat.nu" is mandatory and rendered.
- **Category → section** normalizer (`FRUKT & GRÖNT` / `KÖTT & PROTEIN` / `MEJERI` / `TORRVAROR` /
  `KRYDDOR` / `ÖVRIGT`): per-chain mapping table + `null`/unknown → `ÖVRIGT`. We own this.
- **Nutrition:** OFF snapshot keyed by GTIN in `fixtures/` (captured offline, never a request-path
  call) + a Livsmedelsverket-seeded curated per-ingredient table (CC-BY-4.0, checked in) as the
  fallback for GTIN-less / generic requirements. `NutritionSource` reports a coverage ratio;
  below 0.7 the per-portion macro display is suppressed with a footnote (per Product/UX).
- **Licensing:** free/demo Primat tier is dev/test only; no dataset redistribution (do not publish
  fixtures as a standalone dataset / the repo stays private or fixtures stay minimal & attributed);
  OFF is ODbL (attribution + keep the snapshot as a separable cache); Livsmedelsverket CC-BY-4.0.
  A data-credits UI area renders all three attributions.

---

## AD-10. Privacy & security (resolves S7)

- User coordinates: sent to the store resolver, **never persisted, never logged**. Round to ~1 km
  where the resolver accepts it.
- Free-text vibe may contain health info — never written to logs, never captured into fixtures.
- No secret in the repo, in `.env.example`, in logs, or in any API response. Server errors are
  sanitized before reaching the client.
- `.env.example` documents `OPENAI_API_KEY`, `PRIMAT_API_KEY` (optional in fixture mode),
  `DATA_SOURCE`, `APP_MODE`.

---

## AD-11. Degradation state machine (resolves B7)

One table. No unlabelled fallback anywhere.

| Failure | Behaviour |
|---|---|
| Missing location, live mode | Ask for postcode. Do not guess. |
| Missing location, demo mode | Use the visibly-labelled Umeå default. |
| Store resolve fails | `unknown` outcome + retry affordance. |
| No `full` store in range | `infeasible` (decision screen: widen distance / change location — user's choice, never automatic). |
| Primat search fails | Badged automatic fallback to fixture products for the whole plan (banner: "Visar sparade priser"). |
| Core-concept coverage impossible | `infeasible` — never a mutilated recipe. |
| OpenAI intent call fails | Fall back to deterministic concept mapping (no user-visible error). |
| OpenAI recipe call fails after 1 repair | Serve pre-baked demo recipe, persistently badged "Demoläge". |
| Nutrition coverage < 0.7 | Suppress per-portion macros with a footnote; plan still `ok`. |
| Plan write (client) fails | Render result inline; disable SHOP/COOK deep navigation with an explanation. |

---

## AD-12. CI baseline

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` run on every PR via GitHub Actions.
All four green is the merge bar. `tests/architecture.test.ts` (boundary + forbidden-keys) is part
of `pnpm test`. No PR may introduce a new failure. Coverage target for `src/core/` is high
(the engine is the credibility surface); UI coverage is pragmatic.

---

## AD-13. Cross-cutting contracts (pinned after PRs #12–#20)

These emerged as friction during implementation. Pinned here so #9/#10/#11 and any resuming
Master don't re-litigate them.

- **`ProductSearch.search(query, opts) → ProductSearchResult`** where
  `ProductSearchResult = { products: Product[]; rejections: CandidateRejection[]; attribution? }`.
  The adapter normalizes provider results; the pure ingredient resolver owns deterministic
  lexical/category/unit/price filtering and the pipeline merges all rejection evidence.
- **`Product.section: StoreSection`** (`"FRUKT & GRÖNT" | "KÖTT & PROTEIN" | "MEJERI" | "TORRVAROR"
  | "KRYDDOR" | "ÖVRIGT"`) — populated by the adapter's per-chain normalizer. SHOP groups on this.
- **Ingredient resolution:** accent-folded whole-word/compound name match plus section plausibility;
  reject prepared/frozen/canned candidates for `huvud`/`komplement` unless the named ingredient is
  itself a sauce or pantry food. Pick smallest sufficient package, then unit price, then stable id.
  An unresolved ingredient is honest `unmatched`, never a fabricated substitute.
- **Latency budgets**: `PLAN_DEADLINE_MS = 32000`; `PipelineContext.stageBudgets` sub-divides it
  (store-resolve ≤ 4s, product fan-out ≤ 8s, recipe ≤ 18s, nutrition ≤ 2s). Product fan-out is a
  bounded-concurrency pool (≤ 6). `verifyModels()` runs at `createServerContainer()` startup, off
  the request deadline. The repair retry is skipped when < 10s remain.
- **Whole-plan fallback**: if ANY live data provider falls back to fixture, ALL providers snap to
  fixture for that plan (live `StoreOption` ids don't match fixture keys). `status.isDemoData` is
  true if data OR recipes fell back. Every fallback is badged.
- **Route status codes**: `ok | over_budget | infeasible | unknown` are all `200` business results.
  `422 {error:{code,message}}` for bad input (`LOCATION_REQUIRED` distinct from `INVALID_REQUEST`).
  `503` only for a container/infra throw.
- **Client state**: the full `PlanResult` + `status` is stored client-side under `plan:<planId>`
  (session + localStorage); `plan:latest` pointer; per-view state (`:shop` checks, `:cook` step).
  No server persistence, no share links.

---

## AD-14. Pipeline pivot — the AI names the ingredients (2026-09-02, supersedes parts of AD-3/AD-6/AD-13)

**Human decision.** The deterministic `deriveConcepts` archetype/keyword layer + the "give the AI a
pre-filtered product menu to cook from" design is being **removed**. It was fragile
("kycklingpasta" → nötfärs, frozen ready-meals matched to "kyckling") and produced worse recipes
than just asking the model.

**New flow:** one AI recipe call → `{ titel, förklaring, uppskattadTidMin, ingredienser:[{namn,
mängd, enhet, kategori, roll}], steg:[{text, ingredienser:[namn], tidSek}] }` (strict schema,
Swedish). Then deterministic code resolves each `namn` → a real Primat product (whole-word/compound
match, category plausibility, **reject prepared/frozen/canned for raw-ingredient roles**, smallest
sufficient package → cheapest) → real price → basket in öre → nutrition → constraints. An
ingredient with no acceptable product is `unmatched` (shown honestly, 0 kr, excluded from the
total). Over budget → exact overshoot (optional one cheaper-swap pass).

**Separation preserved:** the AI owns the ingredient list + amounts + steps (culinary reasoning —
AD-6's GOOD example is exactly `{ingredient, requiredGrams}`); the engine owns every price /
package / total / nutrition number; `assertNoForbiddenKeys` still guards the AI schema.

Full spec + acceptance criteria: **GitHub issue #28**. The implementing PR rewrites AD-3 (the
pipeline), AD-6 (the recipe call), and AD-13 (drop the concept-vocabulary contract; add the
ingredient-resolution contract). Supersedes the concept parts of #22 and all of #27.
