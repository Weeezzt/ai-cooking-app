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

1. **Validate** the structured request (Zod). Convert budget to integer öre. Classify each
   constraint by evidence class (AD-5). Flag unsupported safety claims (allergies).
2. **Resolve location → stores.** `StoreDiscovery.resolve(place|postcode)` → geocoded point +
   ranked stores with distance. Live mode requires a valid location; demo/fixture mode uses the
   fixed, visibly-labelled Umeå location.
3. **Shortlist stores.** Keep at most **3** stores that are (a) `tier === "full"`, (b) within the
   user's max distance, (c) supported chain. Deterministic ranking: distance asc, then freshness
   (`confirmed_at`), then stable `chain:store_id`. Reject `offers_only` and register-only doors for
   full-basket claims. If fewer than 1 qualifies → `infeasible` (reason: no store in range).
4. **Derive search concepts.** 6–8 canonical ingredient/archetype concepts from the request.
   Prefer deterministic mapping (vibe keywords → concept list); a small timed AI intent call is
   allowed **only** if an eval shows it materially improves Swedish search recall. Concepts are
   generic ("kokosmjölk", "kycklinglårfilé"), never SKUs.
5. **Search products** for those concepts against **every** shortlisted store, bounded concurrency
   (≤ 6), ≤ 5 results per concept per store, each call sharing the deadline. Normalize to `Product`.
6. **Filter candidates** deterministically (resolves B5/S5). A candidate enters the option set only
   if it passes: category-path allowlist for the concept, unit compatibility (can it satisfy a
   grams/ml requirement?), price/`comparison`-unit plausibility band, amount-range sanity, and
   dietary-evidence check. Record every rejection with a reason. **The LLM never performs this join.**
7. **Per-store provisional basket + store selection.** For each shortlisted store, build a proxy
   basket over the filtered candidates using the same deterministic selection rules (AD-4). Choose
   the store by lexicographic objective: **core-concept coverage** first, then **complete basket
   cost**, then **distance**, then stable key. Never compare totals across stores of differing
   coverage without labelling it. Keep the losing stores' baskets for the comparison UI.
8. **Issue option handles.** For the chosen store, build request-scoped opaque `optionId`s for each
   approved candidate. Server keeps the `optionId → Product` map. This map is the only place SKU
   facts live.
9. **Generate recipe** — one OpenAI call (AD-6). Input: the option handles + generic culinary
   descriptors only. Output: recipe concept, per-requirement `{ optionId, requiredGrams|Ml|Count,
   role }`, self-contained Swedish steps with per-step ingredient refs + durations, an estimated
   cook time (treated as an estimate, AD-5), and a user-facing "why this fits" explanation. Validate
   every `optionId`, quantity, portion count, and step against the schema + business rules; one
   repair retry via `previous_response_id`, then fall to the demo recipe.
10. **Resolve purchase quantities.** For each requirement, map `requiredGrams` to a real purchase:
    fixed-pack → smallest sufficient pack count; variable-weight (`_KG` / `comparison.unit==="kg"`
    / "ca" in name) → buy exact grams priced at `comparison.price`. `BasketLine` carries
    `recipeGrams` (drives nutrition) and `purchase.purchasedGrams` + `purchase.priceOre` (drives
    cost) as **separate fields**.
11. **Apply pantry caps.** A pantry claim removes a requirement from the basket **only** for
    finite, low-quantity staple items (salt, pepper, oil, common dry spices) up to a capped amount.
    Larger or non-staple quantities stay in the basket. Documented cap table in `core/constraints`.
12. **Compute** the basket total (integer öre), budget remaining/overshoot, and nutrition
    (total + per portion) from `recipeGrams`, with a coverage ratio.
13. **Evaluate constraints** by evidence class (AD-5) and run the **deterministic repair
    algorithm** (AD-7) if over budget.
14. **Return** a single immutable `PlanResult` with outcome `ok | over_budget | infeasible |
    unknown`, full provenance per displayed fact, the store comparison, and a `BasketAdjustment[]`
    audit trail. The client persists it (AD-8).

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

**Information-flow rule (replaces the slogan).** The recipe call's input projection may contain
**only**: opaque request-scoped `optionId`s, and for each, sanitized generic culinary descriptors —
a generic ingredient label, food form, coarse category, and dietary assertions whose provenance is
known. It must **not** receive: package sizes or labels, brands, retailer names, prices, price
tiers, `comparison` unit prices, availability, nutrition numbers, or distances. The server
`optionId → Product` map owns every SKU fact and is re-joined after the model returns.

**The model owns:** culinary interpretation, recipe concept, which options to use and in what
`requiredGrams`, cooking method/sequence, per-step ingredient attribution, an *estimated* cook
time, and the Swedish user-facing explanation. It does **not** own any factual/numeric store value.

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

**Prompts:** Swedish user-facing output generated directly (not translated). System prompt states
the model must only use provided option handles and must not invent ingredients or quantities it
cannot tie to a handle.

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
  The adapter runs the deterministic category/plausibility/unit-compat filter and returns kept +
  rejected. The pipeline merges `rejections`; it does NOT re-filter beyond structural safety.
- **`Product.section: StoreSection`** (`"FRUKT & GRÖNT" | "KÖTT & PROTEIN" | "MEJERI" | "TORRVAROR"
  | "KRYDDOR" | "ÖVRIGT"`) — populated by the adapter's per-chain normalizer. SHOP groups on this.
- **Concept vocabulary** (`deriveConcepts`, `src/core/pipeline/concepts.ts`): coarse grocery-search
  archetypes only (`ost` not `riven parmesan`), **≤ 2 `core`** per request (one protein/main + one
  carb/base), everything else `supporting`. Missing `supporting` must never force `infeasible`.
  Dietary overrides the protein slot. The AI recipe call picks the specific ingredients from the
  `RecipeOptionHandle` pool — that is its job, not the deterministic mapper's.
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
