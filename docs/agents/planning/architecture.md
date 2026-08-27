# Architecture — AI Cooking App

_Author: Software Architect (planning specialist). Date: 2026-08-27. Status: proposed, awaiting cross-review._

This document is the executable blueprint for the builder team. It is **planning only** — no
application code has been written.

## 0. The one rule everything else derives from

Three kinds of truth, never mixed:

| Layer | Owns | Lives in | Never owns |
|---|---|---|---|
| **SEMANTIC** (OpenAI) | intent interpretation, dish ideas, culinary quantities, prep steps, user-facing prose | `src/ai/**` | prices, package sizes, totals, distances, macros, stock |
| **FACTUAL** (external APIs) | products, prices, package sizes, store coords, nutrition per 100 g | `src/integrations/**` | culinary judgement, arithmetic on our behalf |
| **DETERMINISTIC** (our code) | basket cost, purchase quantities, macro totals, distances, constraint verdicts | `src/core/**` | calling out to anything (zero I/O) |

Enforcement is mechanical, not cultural:

- `src/core/**` has **no imports** from `src/ai`, `src/integrations`, `src/app`, or `next/*`.
  Enforced by an ESLint `no-restricted-imports` boundary rule + a `tests/architecture.test.ts`
  that greps the import graph.
- Every AI response schema is run through `assertNoForbiddenKeys(schema)` in a unit test.
  Forbidden key fragments: `price`, `cost`, `sek`, `ore`, `total`, `store`, `retailer`,
  `distance`, `kcal`, `protein`, `packageSize`, `inStock`. A future prompt author literally
  cannot add a price field to an AI schema without breaking CI.
- `src/ai/**`, `src/integrations/**`, `src/server/**` each start with `import 'server-only'`.

---

## 1. Stack decision

| Concern | Decision | Why |
|---|---|---|
| Framework | **Next.js 16.x, App Router, TypeScript 5.x, React 19** | Deploy target is Vercel; App Router gives us RSC so the PLAN/SHOP/COOK pages can read a server-persisted plan without shipping domain logic or provider clients to the browser. Route handlers give a plain JSON contract for the pipeline that is testable without booting Next. |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` | The whole value proposition is a deterministic engine. Weak types here are the bug. |
| Runtime | **Node.js 22 LTS** (`.nvmrc` = `22`, `engines.node: ">=20.11 <23"`, Vercel project runtime Node 22) | Local is v20.11 which satisfies Next 16's `>=20.9` floor and will run dev fine, but Node 20 is past LTS maintenance — pin builds to 22 so prod and CI don't sit on an EOL runtime. Builder should `nvm install 22` but is not blocked if they don't. |
| Package manager | **pnpm** (`packageManager` field pinned, lockfile committed) | Strict node_modules layout catches accidental phantom dependencies — matters because we are deliberately keeping deps lean. First-class on Vercel. |
| Styling | **Tailwind CSS v4** + a small hand-written token layer in `src/ui/theme/tokens.css`; **no component library** | "Midnight Supermarket Editorial" is an explicit non-generic identity — shadcn/MUI would fight it. Tailwind v4's CSS-first `@theme` lets the Art Direction agent own tokens in one file. Zero runtime CSS-in-JS. Roughly 4 hand-built primitives (`Button`, `Field`, `Card`, `Stat`) live in `src/ui/primitives`. |
| Validation | **Zod v4** | One schema source for: HTTP request validation, OpenAI structured outputs (`zodTextFormat`), adapter response parsing, and `PlanResult` persistence round-trip. |
| AI SDK | **official `openai` npm package**, Responses API, `zodTextFormat` structured outputs | Mandated by brief. Not Vercel AI SDK — we do not need provider abstraction or streaming UI primitives, and one SDK is leaner. |
| Test runner | **Vitest 4** (+ `@testing-library/react` only where a component genuinely needs it) | Same ESM/TS pipeline as the app, no separate transform config, fast watch mode for engine TDD. |
| E2E | **Playwright**, one smoke spec, run against demo mode only | Guards the PLAN→SHOP→COOK navigation contract without external calls. |
| Lint/format | ESLint flat config (`eslint-config-next` + `import/no-restricted-paths`) + Prettier | The boundary rule is the load-bearing part. |
| Plan persistence | **`@vercel/blob`** | See §6. One dependency, no database, no accounts. |

**Dependency budget (production):** `next`, `react`, `react-dom`, `openai`, `zod`,
`@vercel/blob`, `tailwindcss`. Anything beyond this list needs a written justification in the PR.
Explicitly rejected: date libs (use `Intl`), lodash, an ORM, a state-management library, an
HTTP client (use `fetch`), a geo library (haversine is 8 lines and we want to own it).

---

## 2. Repository structure

```
cooking-app/
├─ .nvmrc                                  # 22
├─ .env.example                            # KEY NAMES ONLY — never values, never real secrets
├─ vitest.config.ts
├─ playwright.config.ts
├─ next.config.ts
├─ eslint.config.mjs                       # incl. the core→outward import ban
├─ docs/agents/…                           # planning + persistent project knowledge
│
├─ src/
│  ├─ app/                                 # ROUTING + RENDERING ONLY. No business logic.
│  │  ├─ layout.tsx                        # shell, fonts, theme tokens
│  │  ├─ page.tsx                          # landing + PLAN form entry
│  │  ├─ plan/[planId]/page.tsx            # RSC: loads PlanResult, renders PLAN view
│  │  ├─ shop/[planId]/page.tsx            # RSC: renders basket as a store-ordered shopping list
│  │  ├─ cook/[planId]/page.tsx            # RSC: renders recipe steps + timers
│  │  ├─ api/
│  │  │  ├─ plan/route.ts                  # POST — the only entry point to the pipeline
│  │  │  ├─ plan/[planId]/route.ts         # GET — JSON PlanResult (debug + client refetch)
│  │  │  └─ health/route.ts                # GET — provider health, no secrets in body
│  │  └─ error.tsx / not-found.tsx
│  │
│  ├─ core/                                # ═══ DOMAIN CORE. Pure. Zero I/O. Zero framework. ═══
│  │  ├─ types/
│  │  │  ├─ request.ts                     # MealRequest, NutritionGoals, DietaryRestriction, PantryItem
│  │  │  ├─ preferences.ts                 # InterpretedPreferences, IngredientConcept
│  │  │  ├─ recipe.ts                      # RecipeConcept, IngredientRequirement, RecipeStep
│  │  │  ├─ product.ts                     # Product, StoreOption, DataSource, IngredientOption
│  │  │  ├─ basket.ts                      # Basket, BasketLine, PurchaseQuantity, BasketAdjustment
│  │  │  ├─ nutrition.ts                   # NutritionFacts, NutritionBreakdown
│  │  │  ├─ plan.ts                        # PlanResult, ConstraintReport, Provenance, Degradation
│  │  │  └─ money.ts                       # Ore branded type + arithmetic helpers
│  │  ├─ ports/                            # ═ APP-OWNED INTERFACES (the seams) ═
│  │  │  ├─ grocery-data-provider.ts
│  │  │  ├─ store-location-provider.ts
│  │  │  ├─ geocoding-provider.ts
│  │  │  ├─ nutrition-provider.ts
│  │  │  ├─ recipe-generation-service.ts
│  │  │  ├─ plan-store.ts
│  │  │  └─ clock.ts                       # injected — determinism in tests
│  │  ├─ units/
│  │  │  ├─ convert.ts                     # dl/msk/tsk/st/g/kg → grams; Swedish measures
│  │  │  └─ density-table.ts               # curated g-per-dl for common ingredients
│  │  ├─ geo/haversine.ts                  # distance in km. WE compute distance, never the AI.
│  │  ├─ matching/
│  │  │  ├─ product-matcher.ts             # concept → ranked candidate products (deterministic scoring)
│  │  │  └─ pantry-matcher.ts              # pantry item → requirement offset
│  │  ├─ basket/
│  │  │  ├─ basket-engine.ts               # ★ recipe qty → purchase qty → cost
│  │  │  └─ purchase-quantity.ts           # packs vs variable weight vs discrete units
│  │  ├─ nutrition/
│  │  │  └─ nutrition-engine.ts            # ★ consumed grams → totals + per portion
│  │  ├─ constraints/
│  │  │  ├─ constraint-solver.ts           # ★ evaluate() — pass/warn/fail per constraint
│  │  │  └─ budget-repair.ts               # ★ the over-budget ladder (deterministic, terminating)
│  │  └─ pipeline/
│  │     ├─ plan-pipeline.ts               # ★ orchestrator: takes ports as args, returns PlanResult
│  │     └─ pipeline-errors.ts
│  │
│  ├─ ai/                                  # ═══ EVERY OpenAI CALL IN THE APP LIVES HERE ═══
│  │  ├─ client.ts                         # singleton OpenAI client, timeouts, maxRetries=0 (we retry)
│  │  ├─ models.ts                         # model ids per task + fallback chain, one place
│  │  ├─ run.ts                            # runStructured(): call → parse → validate → retry → AiResult
│  │  ├─ schemas/
│  │  │  ├─ interpreted-preferences.schema.ts
│  │  │  └─ recipe-concept.schema.ts
│  │  ├─ prompts/
│  │  │  ├─ interpret-intent.prompt.ts
│  │  │  └─ generate-recipe.prompt.ts
│  │  ├─ tasks/
│  │  │  └─ openai-recipe-generation-service.ts   # implements RecipeGenerationService
│  │  ├─ fallback/
│  │  │  └─ heuristic-intent-interpreter.ts       # keyword rules, no network — AI-down path
│  │  ├─ guards/forbidden-keys.ts          # the schema-drift assertion used by tests
│  │  └─ errors.ts                         # AiError taxonomy: timeout|rate_limit|schema|refusal|auth
│  │
│  ├─ integrations/                        # ═══ ADAPTERS. Implement core/ports. ═══
│  │  ├─ grocery/
│  │  │  ├─ primat/
│  │  │  │  ├─ primat-grocery-provider.ts  # implements GroceryDataProvider
│  │  │  │  ├─ primat-client.ts            # HTTP, auth header, timeout, retry
│  │  │  │  ├─ primat-dto.schema.ts        # zod schema of THEIR payload
│  │  │  │  └─ primat-mapper.ts            # their DTO → our Product (öre conversion here)
│  │  │  ├─ fixture/fixture-grocery-provider.ts   # implements the SAME port from fixtures
│  │  │  └─ resilient-grocery-provider.ts  # decorator: primary → cache → fallback + degradation log
│  │  ├─ stores/
│  │  │  ├─ static-store-provider.ts       # curated real SE store coords (MVP default)
│  │  │  ├─ overpass-store-provider.ts     # OpenStreetMap Overpass, optional live source
│  │  │  └─ postnummer-geocoder.ts         # SE postal code → lat/lng, local table
│  │  ├─ nutrition/
│  │  │  ├─ product-nutrition-provider.ts  # macros carried on the Product itself
│  │  │  ├─ table-nutrition-provider.ts    # curated per-100g table, keyed by concept
│  │  │  └─ chained-nutrition-provider.ts  # resolution order + per-value confidence
│  │  └─ cache/request-cache.ts            # per-request memo + short TTL Vercel runtime cache
│  │
│  ├─ fixtures/                            # ═══ DATA ONLY. No logic. Never imported by integrations/primat. ═══
│  │  ├─ README.md                         # "This is illustrative data, not live store data."
│  │  ├─ products.sv.json                  # ~250 real-shaped Swedish products, priced in öre
│  │  ├─ stores.sv.json                    # real chains/addresses for GBG/STO/MMX
│  │  ├─ nutrition.per100g.json
│  │  └─ scripted-ai/                      # recorded OpenAI outputs for demo + tests
│  │     ├─ index.ts                       # scenario key → payload
│  │     └─ *.json
│  │
│  ├─ server/                              # server-only glue; the composition root
│  │  ├─ env.ts                            # zod-validated env. Reads process.env ONCE. Never logged.
│  │  ├─ container.ts                      # buildContainer(mode) → { grocery, stores, nutrition, ai, planStore, clock }
│  │  ├─ plan-store/
│  │  │  ├─ blob-plan-store.ts             # @vercel/blob
│  │  │  └─ memory-plan-store.ts           # dev + tests
│  │  ├─ logging.ts                        # structured logs w/ a redaction allow-list
│  │  └─ mode.ts                           # 'live' | 'live_with_fallback' | 'demo'
│  │
│  ├─ ui/                                  # ═══ PRESENTATION ONLY. Props in, pixels out. ═══
│  │  ├─ theme/tokens.css
│  │  ├─ primitives/                       # Button, Field, Card, Stat, Badge
│  │  ├─ plan/                             # PlanForm (client), ConstraintPanel, BudgetMeter, NutritionPanel
│  │  ├─ shop/                             # StoreCard, ShoppingList, BasketLineRow, LeftoverNote
│  │  ├─ cook/                             # StepList, StepTimer, PortionScaler (display only)
│  │  └─ system/                           # DemoDataBadge, DegradationBanner, ProvenanceFooter
│  │
│  └─ lib/format.ts                        # öre→"79,90 kr", km, minutes — sv-SE Intl formatting
│
└─ tests/
   ├─ unit/core/**                         # the hard math — highest coverage bar
   ├─ contract/grocery-provider.contract.ts# ONE suite run against Primat + Fixture adapters
   ├─ integration/plan-pipeline.test.ts    # full pipeline w/ fake ports
   ├─ integration/api-plan.route.test.ts
   ├─ golden/plan-snapshots.test.ts        # determinism: same input ⇒ byte-identical PlanResult
   ├─ architecture.test.ts                 # import-boundary + forbidden-AI-key assertions
   ├─ fakes/                               # FakeGroceryProvider, FakeRecipeGenerationService, FixedClock
   └─ e2e/demo-flow.spec.ts                # Playwright, demo mode only
```

★ = the deterministic engine. These files must be pure, synchronous, and unit-tested hard.

---

## 3. Module / service boundaries

All interfaces live in `src/core/ports/`. The core depends only on these; adapters depend on the
core. Nothing depends on a concrete adapter except `src/server/container.ts`.

### 3.1 Shared plumbing types

```ts
// core/types/money.ts — ALL money is integer öre. Never a float. Never SEK in the engine.
export type Ore = number & { readonly __brand: 'Ore' };
export const ore = (n: number): Ore => Math.round(n) as Ore;
export const sekToOre = (sek: number): Ore => Math.round(sek * 100) as Ore;
export const addOre = (...xs: Ore[]): Ore => xs.reduce((a, b) => (a + b) as Ore, 0 as Ore);

export interface GeoPoint { lat: number; lng: number }

export interface DataSource {
  kind: 'primat' | 'openstreetmap' | 'livsmedelsverket' | 'curated_table' | 'fixture';
  verified: boolean;        // false ⇒ UI MUST NOT claim it is live store data
  fetchedAt: string | null; // ISO
  note?: string;
}

export interface RequestContext {
  requestId: string;
  mode: 'live' | 'live_with_fallback' | 'demo';
  signal: AbortSignal;
  deadlineAt: number;       // epoch ms — every provider must respect the wall clock
  locale: 'sv-SE';
}

export interface ProviderHealth { id: string; ok: boolean; latencyMs: number | null; detail?: string }
```

### 3.2 `GroceryDataProvider` — factual product data

**Responsibility:** turn ingredient search terms into real purchasable `Product` records for
given stores. Owns prices, package sizes, EANs. Owns nothing culinary.
**Implementations:** `PrimatGroceryProvider`, `FixtureGroceryProvider`,
`ResilientGroceryProvider` (decorator wrapping primary + fallback).
**Called by:** `plan-pipeline.ts` only.

```ts
export interface ProductQuery {
  terms: string[];                 // Swedish search terms from one IngredientConcept
  storeIds: string[];
  dietaryFilters: DietaryFlag[];   // hard exclusions applied by the ADAPTER where supported
  maxResultsPerTerm: number;       // default 8
}

export interface ProductSearchResult {
  byTerm: Record<string, Product[]>;
  source: DataSource;
  partial: boolean;                // true if some terms failed/returned nothing
  failedTerms: string[];
}

export interface GroceryDataProvider {
  readonly id: string;
  searchProducts(queries: ProductQuery[], ctx: RequestContext): Promise<ProductSearchResult>;
  getProductsByIds(productIds: string[], ctx: RequestContext): Promise<Product[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

Note it takes `ProductQuery[]` — one batched call, so the adapter controls fan-out concurrency
and the pipeline stays flat.

### 3.3 `StoreLocationProvider` + `GeocodingProvider` — factual store data

**Responsibility:** which stores exist near a point. Returns coordinates; **the app computes
distance** (`core/geo/haversine.ts`), because distance is deterministic calculation, not data
we accept on faith.
**Called by:** `plan-pipeline.ts`.

```ts
export interface StoreSearchInput { origin: GeoPoint; maxDistanceKm: number; limit: number; chains?: StoreChain[] }

export interface StoreLocationProvider {
  readonly id: string;
  findStores(input: StoreSearchInput, ctx: RequestContext): Promise<StoreOption[]>; // distanceKm filled by caller
  healthCheck(): Promise<ProviderHealth>;
}

export interface GeocodingProvider {
  resolve(input: { postalCode?: string; city?: string; point?: GeoPoint }): Promise<GeoPoint | null>;
}
```

### 3.4 `NutritionProvider` — factual macros

**Responsibility:** per-100 g facts for a product or, failing that, for a generic ingredient
concept. Returns facts + confidence + source. Does **no** scaling or summing — that is the
engine's job.
**Implementations:** `ProductNutritionProvider` → `TableNutritionProvider`, composed by
`ChainedNutritionProvider`.

```ts
export interface NutritionLookupRef {
  key: string;                 // ingredientId
  productId?: string;
  ean?: string | null;
  conceptLabel: string;        // e.g. "kycklingfilé" — fallback lookup key
}

export interface NutritionRecord {
  per100g: NutritionFacts;
  source: DataSource;
  confidence: 'high' | 'medium' | 'low';
}

export interface NutritionProvider {
  readonly id: string;
  lookup(refs: NutritionLookupRef[], ctx: RequestContext): Promise<Map<string, NutritionRecord>>;
}
```

### 3.5 `RecipeGenerationService` — the ONLY semantic surface

**Responsibility:** the two OpenAI calls. Everything about prompts, models, schemas, retries,
parsing, and validation is behind this port. Route handlers and components never import `openai`.
**Implementations:** `OpenAiRecipeGenerationService`, `ScriptedRecipeGenerationService` (demo/tests).

```ts
export type AiResult<T> =
  | { ok: true; value: T; model: string; usage: { inputTokens: number; outputTokens: number }; latencyMs: number }
  | { ok: false; error: AiError; degraded: true };

export interface RecipeGenerationInput {
  request: MealRequest;
  preferences: InterpretedPreferences;
  /** Verified availability, price-free by construction. The ONLY product knowledge the AI sees. */
  availableIngredients: IngredientOption[];
  /** Set on a budget-repair re-plan; null on the first pass. */
  costSignal: CostSignal | null;
}

/** Coarse, non-numeric cost hints. We never hand the model a price. */
export interface CostSignal {
  overBudgetSeverity: 'slightly' | 'significantly';
  expensiveIngredientIds: string[];   // app-derived, ranked by our own arithmetic
  guidance: string;                   // "prefer plant protein and pantry staples"
}

export interface RecipeGenerationService {
  readonly id: string;
  interpretIntent(request: MealRequest, ctx: RequestContext): Promise<AiResult<InterpretedPreferences>>;
  generateRecipe(input: RecipeGenerationInput, ctx: RequestContext): Promise<AiResult<RecipeConcept>>;
}
```

`IngredientOption` is the price-free projection handed to the model:

```ts
export interface IngredientOption {
  ingredientId: string;             // app-issued opaque handle, "ing_07"
  conceptId: string;
  displayName: string;              // "Kycklingfilé naturell"
  packageLabel: string;             // "700 g" — descriptive text, NOT a number the AI does math on
  soldBy: 'unit' | 'weight';
  dietaryFlags: DietaryFlag[];
}
```

The AI answers **only** in terms of `ingredientId`. `validateRecipeAgainstOptions()` in
`core/pipeline` rejects any id it did not issue.

### 3.6 `BasketEngine` — ★ deterministic, pure, synchronous

**Responsibility:** the recipe-quantity vs purchase-quantity distinction, and every krona.
**Called by:** `plan-pipeline.ts`, and by `budget-repair.ts` during the repair loop.

```ts
export interface BasketBuildInput {
  requirements: IngredientRequirement[];
  selection: Record<string /* ingredientId */, Product>;
  pantry: PantryItem[];
  budgetOre: Ore;
  portions: number;
  storeId: string;
}

export interface BasketEngine {
  build(input: BasketBuildInput): Basket;                              // pure
  priceLine(req: IngredientRequirement, product: Product, pantryCoveredGrams: number): BasketLine;
}
```

Rules it implements (these are the acceptance criteria):

1. `neededGrams = max(0, requiredGrams - pantryCoveredGrams)`.
2. `soldBy: 'unit'` with a package size → `packs = max(1, ceil(neededGrams / packageSizeGrams))`,
   `lineCostOre = packs * product.priceOre`, `purchasedGrams = packs * packageSizeGrams`.
   *500 g needed, 700 g pack at 79,90 ⇒ 1 pack ⇒ 7990 öre.*
3. `soldBy: 'weight'` → `purchasedGrams = neededGrams`,
   `lineCostOre = round(neededGrams / 1000 * pricePerKgOre)`.
4. Discrete countables (ägg, lime) use `packageCount` + `gramsPerUnit`, same ceil logic on units.
5. `neededGrams === 0` ⇒ a zero-cost `pantryLine`, still counted in nutrition.
6. Two requirements resolving to the same `productId` are **merged before packing** — you don't
   buy two jars of the same paste.
7. Rounding happens per line; the total is the sum of already-rounded lines. Never round the total.
8. `leftoverGrams = purchasedGrams - recipeGrams` — surfaced in SHOP as an honest note.

### 3.7 `NutritionEngine` — ★ deterministic, pure

**Responsibility:** scale per-100 g facts by **consumed** grams (`recipeGrams`, never
`purchasedGrams`), sum, divide by portions, and report coverage honestly.

```ts
export interface NutritionEngine {
  compute(input: {
    lines: readonly BasketLine[];
    facts: ReadonlyMap<string /* ingredientId */, NutritionRecord>;
    portions: number;
  }): NutritionBreakdown;
}
```

Coverage rule: `ratio = gramsWithData / gramsTotal`. `ratio < 0.7` ⇒ `confidence: 'low'` and the
UI shows "näringsvärden baserade på X % av ingredienserna". We never silently extrapolate.

### 3.8 `ConstraintSolver` + `budget-repair` — ★ deterministic, pure

```ts
export interface ConstraintSolver {
  evaluate(input: {
    request: MealRequest;
    recipe: RecipeConcept;
    basket: Basket;
    nutrition: NutritionBreakdown;
    store: StoreOption;
  }): ConstraintReport;
}

export interface RepairInput {
  requirements: IngredientRequirement[];
  candidates: Record<string /* ingredientId */, Product[]>;  // ranked, cheapest-acceptable available
  selection: Record<string, Product>;
  pantry: PantryItem[];
  budgetOre: Ore;
  portions: number;
  storeId: string;
  maxIterations: number;   // 12
}

export interface RepairOutcome {
  basket: Basket;
  selection: Record<string, Product>;
  droppedIngredientIds: string[];
  adjustments: BasketAdjustment[];    // full audit trail, rendered in the UI
  resolved: boolean;
  needsAiReplan: boolean;
}

export function repairBudget(input: RepairInput): RepairOutcome;   // pure, terminating
```

**The over-budget ladder** (ordered, deterministic, each rung re-priced by `BasketEngine`, stop
as soon as `budgetRemainingOre >= 0`):

| Rung | Action | Guard |
|---|---|---|
| 0 | Apply pantry offsets | always, pre-pricing |
| 1 | Merge duplicate products across requirements | always |
| 2 | Swap to a cheaper candidate for the same concept, greedy by **öre saved per swap**, ties broken by `productId` (stable) | only where `substitutionAllowed === true` and dietary flags still satisfied |
| 3 | Downsize pack: prefer a smaller package that still covers `neededGrams` | never below the requirement |
| 4 | Drop `importance: 'garnish'` requirements, cheapest-culinary-impact first | max 2 drops |
| 5 | **One** budget-aware AI re-plan (`generateRecipe` with `costSignal`), then re-run rungs 0–4 | hard cap: once per request |
| 6 | Terminal: `status: 'over_budget'` | returns the closest basket + exact `overshootOre` + which rungs were tried |

Rung 6 is the defined non-silent outcome: the UI shows "37 kr över budget" with the adjustment
log and two explicit user actions (raise budget / reduce portions), never a quietly-too-expensive
basket. `maxIterations` guarantees termination; a golden test asserts the ladder is idempotent
and order-stable.

### 3.9 `PlanStore`

```ts
export interface PlanStore {
  save(plan: PlanResult): Promise<{ planId: string }>;
  load(planId: string): Promise<PlanResult | null>;
}
```

### 3.10 `plan-pipeline.ts` — the orchestrator

```ts
export interface PipelineDeps {
  ai: RecipeGenerationService;
  grocery: GroceryDataProvider;
  stores: StoreLocationProvider;
  geocoder: GeocodingProvider;
  nutrition: NutritionProvider;
  basket: BasketEngine;
  nutritionEngine: NutritionEngine;
  constraints: ConstraintSolver;
  clock: Clock;
}

export async function runPlanPipeline(
  request: MealRequest,
  deps: PipelineDeps,
  ctx: RequestContext,
): Promise<PlanResult>;
```

Everything it touches arrives as an argument. That is what makes the whole flow unit-testable
without a network, a server, or an API key.

---

## 4. The core pipeline

`POST /api/plan` → `runPlanPipeline` → `PlanResult`. **Exactly 2 OpenAI calls on the happy path**
(a 3rd only on budget-repair rung 5).

| # | Step | Module | Kind |
|---|---|---|---|
| 1 | Parse + validate the submitted form against `MealRequestSchema`; reject with 422 + field errors | `app/api/plan/route.ts` | deterministic |
| 2 | Build `RequestContext` (requestId, mode, 60 s deadline, AbortSignal); build the container for the mode | `server/container.ts` | — |
| 3 | Resolve `location` → `GeoPoint` (postal code table or supplied coords). Unresolvable ⇒ `needs_input` response, not a crash | `GeocodingProvider` | factual |
| 4 | **AI CALL #1 — interpret intent.** vibe + constraints → `InterpretedPreferences` (dish archetype, cuisine tags, flavour axes, `IngredientConcept[]` with Swedish `searchTerms`, avoid-list, user-facing rationale). No products exist yet, so the model cannot possibly touch prices | `ai/tasks/openai-recipe-generation-service.ts` | **semantic** |
| 4b | Validate against zod; on schema failure retry once with the validator errors; on hard failure fall back to `HeuristicIntentInterpreter` and record a degradation | `ai/run.ts` | deterministic |
| 5 | `findStores({origin, maxDistanceKm})`, then compute `distanceKm` ourselves with haversine and filter. Zero stores in radius ⇒ `status: 'infeasible'` with the nearest actual distance | `StoreLocationProvider` + `core/geo` | factual + deterministic |
| 6 | Pick the primary store: most concepts covered, then shortest distance, ties by `storeId`. Keep the rest as `alternativeStores` | `core/matching` | deterministic |
| 7 | One batched `searchProducts()` for all concepts × the primary store's id | `GroceryDataProvider` | factual |
| 8 | Rank candidates per concept (term match, dietary flags, package fit vs `approxGrams`, price-per-kg). Emit `IngredientOption[]` — **price fields stripped** — and keep the full `Product` map server-side, keyed by `ingredientId` | `core/matching/product-matcher.ts` | deterministic |
| 9 | **AI CALL #2 — generate recipe.** Input: preferences + `availableIngredients` (price-free). Output: `RecipeConcept` — title, timings, `IngredientRequirement[]` (`{ingredientId, requiredGrams, importance, substitutionAllowed}`), `RecipeStep[]`, and the user-facing explanation | `RecipeGenerationService` | **semantic** |
| 10 | **Re-validate the model's output against reality:** every `ingredientId` was issued by us; `requiredGrams` within sane bounds (1–3000 g); `servings === request.portions`; no unknown or invented ingredients. Unknown ids are dropped and logged as `unmatched` | `core/pipeline/validate-recipe.ts` | deterministic |
| 11 | Match pantry items against requirements → `pantryCoveredGrams` | `core/matching/pantry-matcher.ts` | deterministic |
| 12 | **`BasketEngine.build()`** — recipe grams → purchase quantities → line costs → subtotal → `budgetRemainingOre` → cost per portion | `core/basket` | **deterministic** |
| 13 | `NutritionProvider.lookup()` for every line (products first, curated table second) | `NutritionProvider` | factual |
| 14 | **`NutritionEngine.compute()`** — scale by consumed grams, total + per portion + coverage | `core/nutrition` | **deterministic** |
| 15 | **`ConstraintSolver.evaluate()`** — budget / cook time / distance / dietary / nutrition goals / portions → per-constraint pass·warn·fail | `core/constraints` | **deterministic** |
| 16 | **If `budget` fails → `repairBudget()`** — the rung ladder in §3.8. Rungs 0–4 are pure code with zero network. Rung 5 optionally re-invokes AI call #2 **once** with a non-numeric `CostSignal`, then re-runs rungs 0–4 and re-evaluates. Rung 6 is the honest terminal `over_budget` state | `core/constraints/budget-repair.ts` | **deterministic** (+ ≤1 AI) |
| 17 | Assemble `PlanResult`: request, preferences, store, recipe, basket, nutrition, constraint report, `Provenance`, `Degradation[]`, timings | `core/pipeline` | deterministic |
| 18 | `PlanStore.save()` → `planId`. On write failure return the plan inline with `shareable: false` | `server/plan-store` | — |
| 19 | Respond `201 { planId }`; client `router.push('/plan/' + planId)` | route handler | — |
| 20 | `/plan/[planId]` RSC loads the snapshot and renders. SHOP and COOK read the **same** snapshot — no recomputation, so the three views can never disagree | `app/**` | — |

Constraint checks happen at step 15 (all constraints) and again after every repair rung.
Deterministic calculation is steps 5–6, 8, 10–12, 14–17. AI touches only steps 4 and 9.

---

## 5. Data model

```ts
// ───────── request ─────────
export type DietaryRestriction =
  | 'vegetarian' | 'vegan' | 'pescetarian' | 'gluten_free' | 'lactose_free'
  | 'nut_free' | 'no_pork' | 'halal' | 'kosher';

export interface NutritionGoals {
  minProteinGPerPortion?: number;
  maxKcalPerPortion?: number;
  minFiberGPerPortion?: number;
  maxSaltGPerPortion?: number;
}

export interface PantryItem { label: string; approxGrams: number | null; conceptHint?: string }

export interface MealRequest {
  requestId: string;
  createdAt: string;                       // ISO, from the injected Clock
  vibe: string;                            // free text, max 500 chars
  portions: number;                        // 1–8
  budgetOre: Ore;
  maxCookMinutes: number;
  maxDistanceKm: number;
  location: { kind: 'coords'; point: GeoPoint } | { kind: 'postal'; postalCode: string };
  nutritionGoals: NutritionGoals;
  dietary: DietaryRestriction[];
  pantry: PantryItem[];
}

// ───────── AI output #1 ─────────
export interface IngredientConcept {
  conceptId: string;                       // slug, normalised by us after the model returns
  label: string;                           // "kycklingfilé"
  searchTerms: string[];                   // Swedish query terms for the grocery API
  role: 'protein' | 'base' | 'vegetable' | 'aromatic' | 'sauce' | 'garnish' | 'pantry';
  approxGramsPerPortion: number;           // culinary estimate — the model legitimately owns this
  substitutionAllowed: boolean;
}

export interface InterpretedPreferences {
  dishArchetype: string;                   // "wok med nudlar"
  cuisineTags: string[];
  flavorProfile: { spice: 0 | 1 | 2 | 3; richness: 0 | 1 | 2 | 3; freshness: 0 | 1 | 2 | 3 };
  proteinFocus: 'meat' | 'poultry' | 'fish' | 'plant' | 'any';
  ingredientConcepts: IngredientConcept[];
  avoid: string[];
  rationale: string;                       // user-facing, shown on PLAN
  confidence: number;                      // 0–1
}

// ───────── AI output #2 ─────────
export interface IngredientRequirement {
  ingredientId: string;                    // MUST be an id we issued
  requiredGrams: number;                   // total for all portions, CONSUMED amount
  preparation?: string;                    // "finhackad"
  importance: 'core' | 'supporting' | 'garnish';
  substitutionAllowed: boolean;
}

export interface RecipeStep {
  order: number;
  instruction: string;
  minutes: number;
  usesIngredientIds: string[];
  isPassive: boolean;                      // simmering ≠ hands-on time
}

export interface RecipeConcept {
  title: string;
  summary: string;
  servings: number;
  activeMinutes: number;
  totalMinutes: number;
  requirements: IngredientRequirement[];
  steps: RecipeStep[];
  explanation: string;                     // why this matches the vibe — user-facing
}

// ───────── factual ─────────
export type DietaryFlag = 'vegetarian' | 'vegan' | 'gluten_free' | 'lactose_free' | 'contains_nuts' | 'contains_pork';

export interface Product {
  productId: string;
  storeId: string;
  name: string;
  brand: string | null;
  priceOre: Ore;
  pricePerKgOre: Ore | null;
  packageSizeGrams: number | null;
  packageCount: number | null;             // eggs: 6
  gramsPerUnit: number | null;             // egg: 58
  soldBy: 'unit' | 'weight';
  unitLabel: string;                       // "700 g"
  ean: string | null;
  categoryPath: string[];
  dietaryFlags: DietaryFlag[];
  nutritionPer100g: NutritionFacts | null;
  imageUrl: string | null;
  source: DataSource;                      // verified:false ⇒ never labelled as live
}

export type StoreChain = 'ica' | 'coop' | 'willys' | 'hemkop' | 'lidl' | 'citygross' | 'other';

export interface StoreOption {
  storeId: string;
  chain: StoreChain;
  name: string;
  address: string;
  location: GeoPoint;
  distanceKm: number;                      // computed by us
  openingHoursToday: string | null;
  source: DataSource;
}

// ───────── deterministic outputs ─────────
export interface PurchaseQuantity {
  mode: 'packs' | 'variable_weight' | 'units';
  packs: number;
  packageSizeGrams: number | null;
  purchasedGrams: number;                  // ≥ recipeGrams
}

export interface BasketLine {
  ingredientId: string;
  conceptLabel: string;
  product: Product;
  recipeGrams: number;                     // CONSUMED — drives nutrition
  pantryCoveredGrams: number;
  purchase: PurchaseQuantity;              // PURCHASED — drives cost
  lineCostOre: Ore;
  leftoverGrams: number;
  substituted: boolean;
  substitutionNote?: string;
}

export type BasketAdjustment =
  | { rung: 1; kind: 'merged_duplicate'; ingredientIds: string[]; savedOre: Ore }
  | { rung: 2; kind: 'cheaper_substitute'; ingredientId: string; fromProductId: string; toProductId: string; savedOre: Ore }
  | { rung: 3; kind: 'downsized_pack'; ingredientId: string; savedOre: Ore }
  | { rung: 4; kind: 'dropped_garnish'; ingredientId: string; savedOre: Ore }
  | { rung: 5; kind: 'ai_replan'; reason: string };

export interface Basket {
  storeId: string;
  lines: BasketLine[];
  subtotalOre: Ore;
  budgetOre: Ore;
  budgetRemainingOre: Ore;                 // negative ⇒ over budget
  overshootOre: Ore;                       // 0 when within budget
  costPerPortionOre: Ore;
  adjustments: BasketAdjustment[];
  coverage: { met: number; total: number; unmatchedConcepts: string[] };
}

export interface NutritionFacts {
  kcal: number; proteinG: number; carbsG: number; sugarsG: number | null;
  fatG: number; saturatedG: number | null; fiberG: number | null; saltG: number | null;
}

export interface NutritionBreakdown {
  total: NutritionFacts;
  perPortion: NutritionFacts;
  perIngredient: Array<{ ingredientId: string; grams: number; facts: NutritionFacts; confidence: 'high' | 'medium' | 'low' }>;
  coverage: { gramsWithData: number; gramsTotal: number; ratio: number; missingIngredientIds: string[] };
  confidence: 'high' | 'medium' | 'low';
  sources: DataSource[];
}

export interface ConstraintCheck {
  id: 'budget' | 'cook_time' | 'distance' | 'dietary' | 'protein' | 'kcal' | 'portions' | 'coverage';
  label: string;                           // sv-SE
  status: 'pass' | 'warn' | 'fail';
  target: string;                          // "≤ 250 kr"
  actual: string;                          // "213,40 kr"
  detail?: string;
}

export interface ConstraintReport { checks: ConstraintCheck[]; overall: 'pass' | 'warn' | 'fail' }

export interface Provenance {
  priceSource: 'primat_live' | 'primat_cached' | 'fixture_demo';
  priceAsOf: string | null;
  storeSource: 'openstreetmap' | 'curated' | 'fixture_demo';
  nutritionSource: Array<'product' | 'curated_table' | 'livsmedelsverket'>;
  aiModel: string | 'none_heuristic_fallback';
  isDemoData: boolean;                     // true ⇒ DemoDataBadge is rendered, non-negotiable
  disclaimerSv: string;
}

export interface Degradation {
  dependency: 'openai' | 'primat' | 'stores' | 'geocoding' | 'nutrition' | 'plan_store';
  severity: 'info' | 'warn';
  code: string;                            // 'primat_timeout_fixture_fallback'
  userMessageSv: string;                   // shown in DegradationBanner
}

export interface PlanResult {
  planId: string;
  schemaVersion: 1;
  createdAt: string;
  request: MealRequest;
  interpreted: InterpretedPreferences;
  store: StoreOption;
  alternativeStores: StoreOption[];
  recipe: RecipeConcept;
  basket: Basket;
  nutrition: NutritionBreakdown;
  constraints: ConstraintReport;
  status: 'ok' | 'ok_with_warnings' | 'over_budget' | 'infeasible';
  provenance: Provenance;
  degradations: Degradation[];
  timingsMs: Record<string, number>;
}
```

---

## 6. State / API boundaries

### Server side (everything that matters)

- `POST /api/plan` — Node runtime, `export const maxDuration = 60`, `dynamic = 'force-dynamic'`.
  The only path into the pipeline. Returns `201 { planId }` (or `422` field errors, `503`
  with a `Degradation[]` when infeasible). Chosen over a Server Action because it is a plain
  JSON contract testable with `fetch` in Vitest, and because we may add SSE progress later.
- `/plan/[planId]`, `/shop/[planId]`, `/cook/[planId]` — **React Server Components** that
  `await planStore.load(planId)` and pass plain props down. Zero domain logic in the browser.
- `src/ai/**`, `src/integrations/**`, `src/server/**` are `server-only`. `OPENAI_API_KEY` and
  Primat credentials are read exclusively in `server/env.ts`, never re-exported, never in a log
  line (structured logger uses a redaction allow-list), never in an HTTP response body,
  never in `.env.example` — that file carries key **names** and a comment only.

### Client side (thin)

- `PlanForm` (`'use client'`) — the only meaningful client component. Validates with the **same**
  `MealRequestSchema` for instant feedback, then POSTs. Progress is an optimistic stepper.
- SHOP tick-off state and COOK step timers — `useState`, mirrored into `localStorage` under
  `plan:{planId}:ui`. Ephemeral UI convenience only; never authoritative, and the page renders
  correctly when it is absent (private windows throw on access — every read/write is wrapped).

### How a PlanResult reaches SHOP and COOK — decision: **server-persisted snapshot behind an opaque `planId`**

Storage: `@vercel/blob`, key `plans/{planId}.json`, `planId` = 22-char random base62 (unguessable),
written with `addRandomSuffix: false`, `access: 'public'` but effectively private via entropy;
a 30-day lifecycle rule prunes it. `MemoryPlanStore` in dev and tests.

Rejected alternatives:

- **URL state** — a full `PlanResult` is 30–80 KB (products, images, steps); far past URL limits,
  and it would leak the whole model into the address bar.
- **localStorage** — no shareable link (a demo audience can't open the plan on their phone),
  forces SHOP/COOK to be client-rendered, loses the RSC benefit, and evaporates in a private window
  mid-presentation.
- **A database** — needs schema, migrations, a provisioning step, and buys nothing without accounts.

Why the snapshot wins: no accounts needed (the id *is* the capability), one dependency, PLAN/SHOP/COOK
provably show the same numbers because they read the same immutable blob, links are shareable and
demo-safe, and the pipeline never runs twice for one plan. A `localStorage` "recent plans" list on
the landing page is a pure convenience index over ids, not a source of truth.

---

## 7. Error handling & degradation matrix

Global rule: **degrade visibly, never invent.** Every fallback appends a `Degradation` that the UI
renders. Fixture data always sets `source.verified = false` and forces `isDemoData: true`.

Timeouts: OpenAI intent 20 s, OpenAI recipe 35 s, Primat 6 s per call / 12 s for the fan-out,
stores 5 s, geocode 2 s, blob 3 s. Route wall-clock budget 60 s, enforced via `ctx.deadlineAt`.
Retries are ours (`maxRetries: 0` on the SDK) so backoff is uniform and observable.

| Dependency | Failure mode | App behaviour |
|---|---|---|
| **OpenAI** | timeout / 5xx / connection | 2 retries, exponential + jitter (1 s, 3 s), inside the deadline |
| | still failing on **intent** | `HeuristicIntentInterpreter` (keyword rules over the vibe text) → `Degradation{openai, warn, 'ai_intent_heuristic'}`, banner "Vi tolkade din beskrivning utan AI just nu." Pipeline continues |
| | still failing on **recipe** | live mode: `status: 'infeasible'`, 503, retry CTA. demo/fallback mode: scripted recipe nearest the archetype, clearly badged. Never a silently fabricated recipe |
| | schema validation fails | one repair call including the zod error paths; then treat as failure above |
| | refusal / content filter | 422 with a rephrase prompt; no fallback (the request itself is the problem) |
| | 429 rate limit | honour `retry-after` up to 5 s once, else the fallback path |
| | missing/invalid `OPENAI_API_KEY` | `/api/plan` 503 `ai_unconfigured` with an operator-facing code (no key material, no key prefix). **Demo mode still works fully** |
| **Primat** | timeout / 5xx | 1 retry, then per-request cache, then `FixtureGroceryProvider` → `priceSource: 'fixture_demo'`, `isDemoData: true`, persistent badge "Demofakta – inte live-priser" |
| | 401/403 (bad or missing creds) | no retry; log `provider=primat status=401` only; straight to fixtures; health endpoint reports `ok: false` |
| | partial results (some terms empty) | continue with what we have; unmatched concepts listed in `basket.coverage.unmatchedConcepts`; `coverage` constraint → `warn`; SHOP shows "hittades inte i butiken" rows |
| | zero results for a **core** ingredient | drop it from the recipe, mark the constraint `fail` if `< 70 %` of core requirements matched, offer "try another store" using `alternativeStores` |
| | malformed payload (DTO schema mismatch) | log the shape mismatch (no payload contents), treat as a hard failure → fixtures. A contract test guards this |
| **Store location** | provider down / timeout | `StaticStoreProvider` (curated real chains + coords for the major SE cities) → `storeSource: 'curated'`, banner "Butikslistan är ungefärlig." |
| | geocoding fails | do **not** guess a location: 422 `needs_input`, form asks for a postal code |
| | no store within `maxDistanceKm` | `status: 'infeasible'`, `distance: fail`, show the nearest real distance + "utöka radien till X km" CTA |
| **Nutrition** | product carries no macros | chain to the curated per-100 g table by concept label |
| | table has no entry either | ingredient excluded from totals, added to `missingIngredientIds`, coverage ratio drops |
| | coverage `< 0.7` | `confidence: 'low'`, NutritionPanel shows the percentage and a caveat. Nutrition constraints downgrade `fail` → `warn` — we never fail a user on data we don't have |
| | Livsmedelsverket source down | curated table only; a `Degradation{info}` |
| **Plan store** | write fails | return the full `PlanResult` inline in the 201 body; client holds it in `sessionStorage` for this session; `shareable: false` disables the share button |
| | read miss / expired id | 404 page: "Planen finns inte längre" + "skapa en ny plan" |
| **Everything** | unexpected throw | `pipeline-errors.ts` maps to a typed `PipelineError`; route returns a sanitised body `{ code, messageSv, requestId }`. Stack traces go to the server log only |

---

## 8. Testing architecture

**Unit — `src/core/**`, the hard bar (≥ 90 % lines, 100 % on `basket/`, `nutrition/`, `constraints/`).**
Pure functions, no mocks needed:

- `purchase-quantity`: 500 g needed / 700 g pack ⇒ 1 pack; 900 g needed / 700 g pack ⇒ 2 packs;
  variable weight ⇒ exact grams; discrete units; `neededGrams === 0` ⇒ pantry line, zero cost.
- `basket-engine`: pack-price ≠ consumed-price (the flagship assertion), duplicate-product merge,
  per-line rounding then sum (never round the total), `budgetRemainingOre` sign, `costPerPortionOre`.
- `money`: öre arithmetic never produces a float; `sekToOre(79.90) === 7990`.
- `units/convert`: dl/msk/tsk/st → g via the density table; unknown ingredient ⇒ explicit failure,
  not a silent 0.
- `nutrition-engine`: scaling uses `recipeGrams` not `purchasedGrams`; per-portion division and
  rounding; coverage ratio; missing data does not become zero.
- `constraint-solver`: each check's pass/warn/fail boundary, including exact-equality edges.
- `budget-repair`: the ladder runs in order, terminates within `maxIterations`, is deterministic
  (same input ⇒ same rung sequence), never violates a dietary restriction while substituting,
  never drops a `core` requirement, and rung 6 reports the exact overshoot.
- `geo/haversine`: known SE city-pair distances within 1 %.

**Golden / determinism tests.** `tests/golden/`: a set of frozen `MealRequest` + frozen fixture
inputs + a `FixedClock` → a checked-in `PlanResult` snapshot. Run the pipeline **twice** in one
test and `expect(a).toEqual(b)` — that is the mechanical proof that nothing non-deterministic
leaked into the engine. Snapshot diffs in a PR are a deliberate review signal.

**Contract tests.** `tests/contract/grocery-provider.contract.ts` exports
`describeGroceryProvider(name, factory)` and is executed against **both** `FixtureGroceryProvider`
and `PrimatGroceryProvider` (the latter against recorded HTTP fixtures). Guarantees swapping the
adapter cannot change engine behaviour. Same pattern for `StoreLocationProvider` and
`NutritionProvider`.

**How AI and external APIs are faked.** No test ever hits OpenAI or Primat.

- `FakeRecipeGenerationService` — implements the port, returns canned `AiResult`s, and can be
  scripted to fail (`timeout`, `schema`, `refusal`) to exercise every degradation row in §7.
- `tests/fixtures/openai-responses/*.json` — **real recorded** OpenAI payloads. A test parses each
  through the production zod schema, so a schema change that would break against the live model
  fails in CI.
- `tests/architecture.test.ts` — (a) `src/core` imports nothing from `ai`/`integrations`/`app`/`next`;
  (b) `assertNoForbiddenKeys()` over every AI schema, so no one can ever add a price field to an
  AI response; (c) no `process.env` access outside `server/env.ts`.
- Primat HTTP is faked with recorded JSON through an injected `fetch` on `PrimatClient` — no
  network mocking library.

**Integration.** `runPlanPipeline` with a fully faked `PipelineDeps`: happy path; over-budget →
each ladder rung; AI down → heuristic; Primat down → fixture + badge; no store in radius →
infeasible. Plus route-handler tests that POST real JSON through `/api/plan` with an overridden
container.

**E2E.** One Playwright spec in demo mode: submit the form → PLAN renders numbers → SHOP shows the
same subtotal → COOK shows the same step count → the demo badge is visible on all three.

**CI (GitHub Actions, Node 22, pnpm, one workflow, blocks merge):**

```
pnpm install --frozen-lockfile
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint, incl. the import-boundary rule
pnpm test           # vitest run --coverage (thresholds enforced)
pnpm build          # next build
pnpm check:secrets  # grep for sk-/api-key patterns in tracked files; assert .env.example has no values
pnpm test:e2e       # playwright, demo mode
```

A `pnpm test:live` script exists for manual smoke-testing against real OpenAI/Primat. It is
**excluded from CI** and skips itself when the keys are absent.

---

## 9. Demo mode

Goal: a live presentation that cannot be broken by a flaky network, an expired key, or a rate limit.

**Three modes**, resolved once in `server/mode.ts`:

| Mode | Grocery | Stores | AI | Use |
|---|---|---|---|---|
| `live` | Primat only, **fails loudly** | live | OpenAI only | verifying the real integration |
| `live_with_fallback` | Primat → fixtures | live → curated | OpenAI → heuristic | **production default** |
| `demo` | fixtures only | fixtures only | scripted only | presentations, E2E, CI |

Selection: `PLAN_DATA_MODE` env var (default `live_with_fallback`), overridable per request by
`?mode=demo` — read **server-side** in the route handler, never trusted from a client header.

**How demo mode is wired.** `buildContainer('demo')` returns `FixtureGroceryProvider`,
`FixtureStoreProvider`, `TableNutritionProvider`, `ScriptedRecipeGenerationService`, and
`MemoryPlanStore` seeded from disk. Zero outbound network calls — verifiable by an E2E test that
fails if `fetch` is invoked.

**`ScriptedRecipeGenerationService`** replays recordings from `src/fixtures/scripted-ai/`, keyed by
a normalised hash of `(vibe, portions, dietary, proteinFocus)`. An unknown key resolves to the
nearest scenario by keyword overlap and still returns a valid `RecipeConcept` — so an improvised
prompt from the audience produces something sensible rather than an error.

**Pre-baked plans.** Three curated scenarios are stored as complete `PlanResult` snapshots at
`/plan/demo-vardagsmiddag`, `/plan/demo-hogprotein-asiatiskt`, `/plan/demo-vegan-lagbudget`. These
render instantly with zero computation — the guaranteed-safe path if anything at all goes wrong on
stage. The presenter can still run the live form for the "watch it think" moment.

**Honesty guardrails (non-negotiable).** In demo mode every `Product.source.verified` is `false`,
`Provenance.isDemoData` is `true`, and `<DemoDataBadge/>` renders persistently on PLAN, SHOP and
COOK: *"Demofakta – priser och butiker är illustrativa, inte live-data."* A unit test asserts the
badge cannot be suppressed when `isDemoData` is true. Fixture prices are realistic Swedish
2026 prices, but the app never claims they are current.

**Keeping fixtures honest.** `pnpm demo:record` (manual, requires real credentials) captures live
Primat + OpenAI responses into the fixture files, so demo data mirrors real payload shapes rather
than drifting into fiction.

---

## 10. Open questions

### For Product / UX
- **[PRODUCT-1]** When rung 6 is reached (still over budget), which is the primary CTA — raise the
  budget, cut portions, or accept the overshoot? The engine can serve all three; the UI must pick a
  default.
- **[PRODUCT-2]** Single store or multi-store baskets? This architecture assumes **one store per
  plan** (simpler, matches a real shopping trip). Multi-store would change `Basket.storeId` into a
  per-line store and add a travel-time constraint. Confirm single-store for MVP.
- **[PRODUCT-3]** Leftovers: 700 g bought, 500 g used. Do we surface leftovers as a positive
  ("nog för ett mål till") or as waste? Affects `BasketLine.leftoverGrams` presentation.
- **[PRODUCT-4]** Is the plan link intended to be shareable (it will be, by construction)? If so,
  the share affordance and the "this link expires in 30 days" copy need designing.
- **[PRODUCT-5]** Location input: browser geolocation, postal code, or both? Geolocation adds a
  permission prompt mid-demo — postal code is safer on stage.
- **[PRODUCT-6]** Do we support editing a plan (swap an ingredient, change portions) or only
  regenerate? Editing means a re-pricing endpoint; regeneration is 2 more AI calls.

### For the AI / Prompt Architect
- **[AI-1]** Confirm the two-call split (interpret → generate) is right. The alternative — one call
  after we fetch products — halves latency but forces the model to invent search terms and products
  in the same breath. I recommend two.
- **[AI-2]** `approxGramsPerPortion` comes from call #1 and drives package-fit ranking before call
  #2 sets final grams. Acceptable, or should ranking use a static table instead?
- **[AI-3]** Model selection per task — cheap/fast for intent interpretation, stronger for recipe
  generation? Needs a concrete pair pinned in `ai/models.ts`.
- **[AI-4]** `CostSignal` deliberately contains **no numbers** (only `'slightly' | 'significantly'`
  plus ids). Is that enough steering for a useful re-plan, or does the model need a coarse bucket?
- **[AI-5]** All user-facing prose is Swedish. Should prompts be Swedish, or English prompts with a
  Swedish output instruction? Affects ingredient-term quality against a Swedish grocery API.
- **[AI-6]** What is the repair strategy when the model returns an `ingredientId` we never issued —
  drop it silently, or one corrective retry? I've assumed drop + log.

### For the Data / API specialist
- **[DATA-1]** **Primat capability inventory — the biggest unknown.** Does it support store-scoped
  search, free-text queries, category filters, EAN lookup, per-kg pricing for variable-weight goods,
  and does it return package size as a **structured number** or only as a label like `"700 g"`? If
  the latter, `primat-mapper.ts` needs a parser and a test corpus of real labels.
- **[DATA-2]** Rate limits and latency budget. The pipeline fans out ~8–12 concept searches; if
  Primat is 1 req/s we must batch differently or pre-warm a cache.
- **[DATA-3]** Does Primat carry nutrition per 100 g? If yes, `NutritionProvider` collapses to a
  thin wrapper and the curated table becomes fallback-only.
- **[DATA-4]** Store list source — does Primat expose store locations with coordinates, or do we
  need OpenStreetMap Overpass / a curated list? Affects whether `overpass-store-provider.ts` gets built.
- **[DATA-5]** Are prices store-specific or chain-national? Determines whether store choice must
  precede product search (as modelled at step 7) or can follow it.
- **[DATA-6]** Postal-code → coordinate table: is there a redistributable Swedish dataset small
  enough to bundle (target < 500 KB), or do we need a geocoding call?
- **[DATA-7]** Licensing on fixture data — can we ship real product names, brands, and images from
  Primat in a public repo, or must the fixtures be generic?

---

## Appendix — non-negotiables for the builder team

1. `src/core/**` imports nothing from `ai`, `integrations`, `app`, or `next`. CI enforces it.
2. Every AI response schema passes `assertNoForbiddenKeys`. CI enforces it.
3. Money is integer öre inside the engine. SEK floats only at the formatting boundary.
4. Nutrition uses `recipeGrams`. Cost uses `purchase.purchasedGrams`. Never the same number.
5. Any fixture-sourced value sets `source.verified = false` and forces the demo badge.
6. Secrets are read only in `server/env.ts`; never logged, never in a response body, never in
   `.env.example`.
7. Every external call goes through a port and has a defined failure row in §7.
8. Visual components take props and render. No fetching, no arithmetic, no `openai` import.
