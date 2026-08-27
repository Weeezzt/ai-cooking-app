# AI Architecture — Cooking / Grocery Planner

Status: PLANNING (no application code). Owner: AI / Prompt Architect.
Last verified against OpenAI docs: **2026-08-27**.

This document defines how the app uses the OpenAI API: which API surface, which
models, the minimal set of model calls, every structured-output schema, prompt
strategy, validation/retry, and fallback behavior.

Guiding rule for the whole pipeline:

> **SEMANTIC REASONING** (AI) is separated from **FACTUAL DATA** (external
> retailer / nutrition data) and from **DETERMINISTIC CALCULATION** (app code).
> The model is asked only for things the model owns: cuisine interpretation,
> recipe design, ingredient requirements in canonical grams, self-contained
> preparation steps, complexity estimates, and Swedish user-facing explanations.
> The model is never the source of prices, package sizes, stock, distances,
> store identity, or calorie/macro totals.

---

## 1. OpenAI API choice

### Decision: **Responses API**, official SDK (`openai` npm), server-side only.

Docs checked on 2026-08-27:

- Responses vs Chat Completions guidance —
  <https://developers.openai.com/api/docs/guides/responses-vs-chat-completions>
- Structured outputs guide —
  <https://developers.openai.com/api/docs/guides/structured-outputs>
- Structured outputs announcement —
  <https://openai.com/index/introducing-structured-outputs-in-the-api/>
- Reasoning guide —
  <https://developers.openai.com/api/docs/guides/reasoning>
- GPT-5 new params (reasoning effort `minimal`, `verbosity`) —
  <https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_new_params_and_tools>
- Pricing — <https://developers.openai.com/api/docs/pricing>
- Models — <https://developers.openai.com/api/docs/models>

Rationale:

| Option | Verdict | Why |
| --- | --- | --- |
| **Responses API** | **Chosen** | Docs state: *"While Chat Completions remains supported, Responses is recommended for all new projects."* Better prompt-cache utilization (docs cite 40–80% improvement), native support for `reasoning.effort` / `verbosity` on the GPT-5 family, structured outputs via `text.format`, and simpler state handling (`previous_response_id`) which we use for the cheap "repair" retry. |
| Chat Completions | Rejected (still fine as a portability fallback) | No functional need it uniquely serves for us; we would lose cache efficiency and the cleaner reasoning-param surface. Keep the client abstraction thin enough that a swap is a config change. |
| Assistants API | Rejected | Deprecated 2025-08-26, **sunset 2026-08-26** (already past). Do not build on it. |

### Structured-output mechanism

Responses API structured outputs use `text.format` with a JSON Schema:

```jsonc
// request shape (conceptual)
{
  "model": "...",
  "input": [ { "role": "system", "content": "..." }, { "role": "user", "content": "..." } ],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "generated_recipe",
      "strict": true,
      "schema": { /* JSON Schema, additionalProperties:false everywhere */ }
    }
  },
  "max_output_tokens": 3000,
  "reasoning": { "effort": "low" }
}
```

With the **JS SDK** we use `client.responses.parse({ ..., text: { format: zodTextFormat(Schema, "generated_recipe") } })`
and read `response.output_parsed`. `zodTextFormat` compiles the Zod schema to a
strict JSON Schema automatically. (Python equivalent: pass a Pydantic model as
`text_format` and read `output_parsed`.)

**Strict-schema adherence** is achieved by `strict: true`, which constrains
decoding to the grammar. Current constraints we must design within (per the
structured-outputs guide, verified 2026-08-27):

- Root must be an object; **every** object needs `additionalProperties: false`.
- **Every** property must be listed in `required` — no optional keys. Optional
  fields are modeled as `anyOf` with an explicit `"null"` branch (Zod `.nullable()`).
- Max nesting depth ~5 levels; up to ~100 object properties total; large
  string/enum sets are capped. Our schemas stay well under these.
- Not all JSON-Schema keywords are honored: numeric `minimum`/`maximum`,
  most `pattern`/`format` constraints, and `allOf` are **not** enforced. So
  "grams > 0", "sum of step quantities ≈ requirement", enum membership against a
  runtime catalog, and "no digits in the nutrition text" are enforced in **app
  validation**, not the schema.
- A safety refusal surfaces as a `refusal` field, not as malformed JSON — handle
  it explicitly.

---

## 2. Model selection

Prices below are per 1M tokens, standard tier, from the pricing page on
2026-08-27. Batch ≈ −50%; Fast mode ≈ ×2. Model IDs are volatile — they live in
one config module (`lib/ai/models.ts`), never inline.

| Pipeline call | Primary | Cheaper fallback | Rationale |
| --- | --- | --- | --- |
| **A. Interpret intent** | `gpt-5.6-luna` ($0.20 in / $0.02 cached / $1.20 out), `reasoning.effort: "minimal"` | `gpt-5-nano` ($0.05 / $0.40) or `gpt-5-mini` ($0.25 / $2.00) | Short, latency-sensitive, light semantic mapping of a vibe string to structured preference tags. No deep reasoning needed. ~1k in / ~0.5k out → ~$0.0008/call. |
| **B. Generate recipe** | `gpt-5.6-terra` ($2.00 in / $0.20 cached / $12.00 out), `reasoning.effort: "low"` (escalate to `"medium"` on repair retry) | `gpt-5.6-luna` at `effort: "medium"`, then `gpt-5-mini` | Needs strong culinary reasoning, constraint juggling (budget tier × time × macros × diet × catalog), concrete instructions, and fluent Swedish. Sol/GPT-5.5 add cost without meaningful gain for a recipe-sized task. ~3k in / ~2.5k out → ~$0.036/call. |
| **C. Finalize steps after forced substitution** *(conditional, rare)* | same as B | same as B | Only fires when product resolution forced a substitution the model did not pre-authorize. |

`verbosity: "low"` on both calls (schema controls structure; we don't want prose
padding). System prompts are static and sent first so they hit the prompt cache.

---

## 3. Call plan (minimal)

Two model calls on the happy path. A third only on forced substitution.

### Call A — Interpret intent

- **Purpose:** turn hard constraints + the free-text "vibe" + pantry into
  structured *semantic* preferences that downstream product selection and recipe
  generation can consume.
- **Fires:** immediately after the user submits the PLAN form, before store /
  product lookup (its output steers product candidate selection).
- **Given:** raw vibe string; dietary restrictions; nutrition goals; portions;
  max cooking minutes; coarse `costTier` (see below); pantry item names; locale `sv-SE`.
- **NOT given:** store list, product catalog, prices, package sizes, distances,
  geolocation coordinates, retailer names, any nutrition numbers computed later.
- **Input:** one JSON object in the user message under `planRequest`.
- **Output schema:** `InterpretedPreferences` (§4.1).

### Call B — Generate recipe (concept + ingredients + steps)

- **Purpose:** design one recipe that satisfies all hard constraints, expressed
  as ingredient requirements in canonical grams plus self-contained COOK steps.
- **Fires:** after (1) Call A, (2) nearby-store resolution, (3) product candidate
  selection have all completed. The app passes in an **abstracted candidate
  ingredient list** derived from real resolved products.
- **Given:** `InterpretedPreferences` from Call A; hard constraints (portions,
  maxCookMinutes, dietary restrictions, nutrition targets as *targets to aim
  for*); `costTier`; pantry list; `availableIngredients[]` = `{ catalogIngredientId,
  displayName, category, typicalPackageGrams[], coarseCostTier, perishability }`
  (names/sizes only — **no prices, no SKUs, no stock**); equipment assumptions.
- **NOT given:** actual prices, exact SKUs, basket total, budget in SEK,
  distances, store names/addresses, stock status, computed calorie/macro totals.
- **Input:** one JSON object under `recipeBrief`.
- **Output schema:** `GeneratedRecipe` (§4.2).

### Call C — Finalize steps (conditional)

- **Fires:** only if the deterministic resolver had to substitute an ingredient
  in a way not covered by `acceptableSubstitutions`, or scaled a requirement
  enough to change technique.
- **Given:** the original `GeneratedRecipe` plus a `substitutionDelta[]`
  (`{ fromIngredientId, toDisplayName, newRequiredGrams, reason }`). Still no
  prices / totals.
- **Output schema:** `{ steps, complexity, fitExplanation, riskFlags }` subset of
  `GeneratedRecipe`.

### What `costTier` is (and why not raw SEK)

App code maps `budgetSEK / portions` into `"tight" | "moderate" | "generous"`.
The model receives the tier, never the kronor figure, so it cannot anchor on or
echo a fake price. It uses the tier only to bias ingredient choices
(e.g. `tight` → fewer premium proteins, more legumes/eggs, larger shared bases).

### Deterministic steps that are NOT model calls

1. Nearby store resolution — external store/location data.
2. Product candidate selection — grocery API + local fixtures, filtered by
   Call A's `ingredientAffinities` / `ingredientExclusions`.
3. **BasketEngine** — maps each `ingredientRequirement.catalogIngredientId` to a
   real product, computes `packagesToBuy = ceil(requiredGrams / packageGrams)`,
   `lineCost = packagesToBuy × price`, `leftoverGrams`, basket total, budget
   remaining, and nutrition totals/per-portion from per-100g data.
4. Hard-constraint check — budget, portions, max minutes, distance, macro floors/ceilings.
5. PLAN → SHOP → COOK rendering.

---

## 4. Schemas

TS types are the source of truth; the JSON-Schema shape is what `zodTextFormat`
emits (strict: all keys required, optionals as `T | null`,
`additionalProperties:false`). Enums use English tokens; free-text user-facing
strings are Swedish (`sv-SE`).

### 4.1 `InterpretedPreferences` (Call A output)

```ts
type PerishabilityBias = "low" | "medium" | "high";
type Heaviness = "light" | "medium" | "hearty";
type DishFormat =
  | "one_pot" | "stir_fry" | "bowl" | "sheet_pan" | "salad"
  | "soup" | "grain_plate" | "handheld" | "braise" | "noodle";

interface InterpretedPreferences {
  schemaVersion: "1.0";
  cuisineInterpretation: string[];      // e.g. ["japansk", "koreansk"] (sv)
  dishFormat: DishFormat;
  flavorProfile: {
    lean_into: string[];                // sv, e.g. ["umami", "syrligt", "sesam"]
    avoid: string[];                    // sv
  };
  texturalGoals: string[];              // sv, e.g. ["krispigt", "fräscht"]
  heaviness: Heaviness;
  proteinStrategy: string;              // sv, one sentence
  perishabilityBias: PerishabilityBias; // "fresh but..." pushes this up
  ingredientAffinities: string[];       // canonical-ish sv ingredient names to prefer
  ingredientExclusions: string[];       // from dietary restrictions + vibe; hard
  nutritionLevers: string[];            // sv, qualitative, e.g. ["öka protein via tofu/ägg"]
  pantryUsageIntent: string[];          // which pantry items to build around (sv)
  rationale: string;                    // sv, user-facing "varför detta matchar din vibe"
  confidence: number;                   // 0..1 (validate range in app)
  clarificationNeeded: string | null;   // sv question if the vibe is contradictory/empty
}
```

Contains **no** prices, quantities in grams, macros, or store data. Pure interpretation.

### 4.2 `GeneratedRecipe` (Call B output)

```ts
type IngredientCategory =
  | "produce" | "meat" | "seafood" | "dairy_egg" | "dry_goods"
  | "pantry_staple" | "spice" | "condiment_sauce" | "bakery" | "frozen" | "plant_protein";
type IngredientRole = "core" | "supporting" | "seasoning" | "garnish";
type Perishability = "high" | "medium" | "low" | "shelf_stable";
type UnitType = "g" | "ml" | "piece";
type ComplexityLevel = "enkel" | "medel" | "avancerad";
type KnifeworkLevel = "minimal" | "moderate" | "significant";
type SourcePreference = "catalog" | "additional";

interface AcceptableSubstitution {
  displayName: string;          // sv
  conversionRatio: number;      // multiply requiredGrams by this for the sub (by weight)
  notes: string;                // sv, culinary caveat
}

interface IngredientRequirement {
  id: string;                       // stable slug, e.g. "kycklingfile"
  displayName: string;              // sv
  category: IngredientCategory;
  role: IngredientRole;
  requiredGrams: number;            // CANONICAL total for the whole recipe at `servings`
  displayQuantity: {               // human-friendly echo, non-authoritative
    unitType: UnitType;
    amount: number;
    unitLabel: string;             // sv, e.g. "msk", "st", "dl"
  };
  preparationState: string | null; // sv, e.g. "tärnad", "finriven"
  perishability: Perishability;    // culinary knowledge, not a shelf-life date
  substitutionAllowed: boolean;
  acceptableSubstitutions: AcceptableSubstitution[];  // [] if none
  pantryEligible: boolean;         // can be met from a typical pantry / user pantry
  sourcePreference: SourcePreference;
  catalogIngredientId: string | null; // set when sourcePreference === "catalog"
}

interface RecipeStep {
  stepNumber: number;              // 1-based, contiguous
  instruction: string;             // sv, SELF-CONTAINED: qty + temp + time + pan
  usesIngredientIds: string[];     // must all exist in ingredientRequirements[].id
  quantitiesUsed: { ingredientId: string; grams: number }[]; // sums ≈ requiredGrams across steps
  durationMinutes: number | null;
  activeTime: boolean;             // true = hands-on, false = passive (simmer/rest)
  temperatureC: number | null;
  equipment: string[];             // sv
  technique: string | null;        // sv
  donenessCue: string;             // sv sensory cue, e.g. "tills löken är blank"
}

interface GeneratedRecipe {
  schemaVersion: "1.0";
  title: string;                   // sv
  summary: string;                 // sv, 1–2 sentences, user-facing
  cuisineTags: string[];           // sv
  servings: number;                // MUST equal requested portions
  ingredientRequirements: IngredientRequirement[];
  steps: RecipeStep[];
  equipmentNeeded: string[];       // sv, union of steps
  complexity: {
    level: ComplexityLevel;
    estimatedTotalMinutes: number; // model estimate; app still enforces maxCookMinutes
    estimatedActiveMinutes: number;
    knifeworkLevel: KnifeworkLevel;
    simultaneousTasks: number;
    rationale: string;             // sv
  };
  nutritionReasoning: string;      // sv, QUALITATIVE ONLY — no numbers. Why it should hit goals.
  fitExplanation: string;          // sv, user-facing "varför den här passar dina val"
  assumptions: string[];           // sv, e.g. ["antar att du har olja och salt"]
  riskFlags: string[];             // sv, e.g. ["svårt att hålla under 30 min om riset kokas från grunden"]
}
```

### 4.3 JSON-Schema shape (illustrative, `GeneratedRecipe` root)

```jsonc
{
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion","title","summary","cuisineTags","servings",
    "ingredientRequirements","steps","equipmentNeeded","complexity",
    "nutritionReasoning","fitExplanation","assumptions","riskFlags"],
  "properties": {
    "schemaVersion": { "type": "string", "enum": ["1.0"] },
    "title": { "type": "string" },
    "servings": { "type": "number" },
    "ingredientRequirements": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id","displayName","category","role","requiredGrams",
          "displayQuantity","preparationState","perishability",
          "substitutionAllowed","acceptableSubstitutions","pantryEligible",
          "sourcePreference","catalogIngredientId"],
        "properties": {
          "id": { "type": "string" },
          "requiredGrams": { "type": "number" },
          "preparationState": { "anyOf": [ { "type": "string" }, { "type": "null" } ] },
          "catalogIngredientId": { "anyOf": [ { "type": "string" }, { "type": "null" } ] },
          "acceptableSubstitutions": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["displayName","conversionRatio","notes"],
              "properties": {
                "displayName": { "type": "string" },
                "conversionRatio": { "type": "number" },
                "notes": { "type": "string" }
              }
            }
          }
          /* ...remaining properties... */
        }
      }
    }
    /* ...steps, complexity, etc... */
  }
}
```

Deepest nesting: root → `ingredientRequirements[]` → item → `acceptableSubstitutions[]`
→ item = 4 levels, within the ~5 limit.

### 4.4 How BasketEngine maps requirements → real products

For each `IngredientRequirement`:

1. If `sourcePreference === "catalog"` → join on `catalogIngredientId` to the
   resolved product row (price, `packageGrams`, per-100g nutrition, retailer, stock).
2. Else (`"additional"`) → run a supplementary product lookup by `displayName` +
   `category`; if nothing acceptable is found, pick the best
   `acceptableSubstitutions` entry that resolves, applying `conversionRatio` to
   `requiredGrams`. If a substitution outside the authorized list is unavoidable →
   trigger **Call C**.
3. `packagesToBuy = ceil(effectiveGrams / product.packageGrams)`,
   `lineCost = packagesToBuy × product.price`, `leftoverGrams = packagesToBuy ×
   packageGrams − effectiveGrams`.
4. Nutrition per line = `perProduct100g × (effectiveGrams / 100)` (consumed grams,
   not purchased grams).
5. Aggregate → basket total, `budgetRemaining = budgetSEK − basketTotal`,
   nutrition totals, per-portion = totals / `servings`.
6. Hard-constraint gate. Any failure → structured `constraintViolations[]` for the UI.

Canonical `requiredGrams` + stable `catalogIngredientId` are the two fields that
make this deterministic; everything the model returns is unit-normalized before
it arrives.

---

## 5. The two-phase question

**Recommendation: one call (option a) on the happy path — `GeneratedRecipe`
returns concept + ingredients + steps together — with a conditional Call C only
when product resolution forces an unauthorized substitution.**

Why:

- **Determinism.** Steps are written against *recipe quantities in grams*
  (`"stek 200 g nudlar"`), never against purchased package sizes
  (`"öppna 500 g-paketet"`). The recipe's internal logic does not depend on which
  SKU the BasketEngine picks, so there is nothing for a second call to "finalize"
  in the normal case. The package-vs-need gap (bought 1 kg, use 200 g) is a
  deterministic UI concern shown in SHOP/COOK, not a prompt concern.
- **Latency.** One round of Call B (~6–12 s) instead of two. A second call would
  add ~5–10 s to every PLAN for output that is usually identical.
- **Cost.** Option (b) roughly doubles Call B token spend (the concept +
  ingredient context is re-sent to regenerate steps). Option (a) + rare Call C
  pays that only when it actually matters (estimate: <15% of plans).
- **Instruction quality.** A model writing ingredients and steps in the same pass
  keeps them coherent (quantities in steps match the requirement list, technique
  matches the cut). Splitting risks drift between the two calls.
- **Handled downside:** when a forced substitution *does* change technique
  (e.g. firm tofu → silken), Call C regenerates just `steps` / `complexity` /
  `fitExplanation` / `riskFlags` with the delta — cheaper and more targeted than
  always doing two calls.

---

## 6. Prompt strategy

### System prompt principles (static, cached; one per call in `lib/ai/prompts/`)

- **Role:** "Du är en svensk måltidsplanerare och receptutvecklare."
- **Ownership boundary, stated explicitly:** *"Du anger ENDAST fälten i schemat.
  Du får aldrig ange priser, butiksnamn, lagerstatus, avstånd, eller kalori-/
  makrosiffror. Systemet beräknar allt sådant. Mängder anges i gram."*
- **Canonical units:** all quantities in grams (or ml / pieces) for the whole
  recipe at the given number of portions; `displayQuantity` is a friendly echo only.
- **Hard vs soft:** hard constraints (portions, max minutes, dietary
  restrictions, nutrition floors/ceilings) are inviolable. If there is tension
  the model cannot fully resolve, it must surface it in `riskFlags` and still
  return its best legal recipe — never silently break a constraint.
- **Catalog first:** build the recipe from `availableIngredients`; mark anything
  else `sourcePreference: "additional"` and keep such items few and
  substitutable.
- **Concrete steps:** every step self-contained — quantity used, pan/vessel,
  heat level, °C where relevant, minutes, and a sensory doneness cue.
- **Language:** all user-facing text in Swedish (`sv-SE`, `du`-form, plain and
  warm, not chatty). Enum tokens, ids, and keys stay English.

### How constraints are conveyed

A single JSON object in the user message, with hard and soft cleanly separated:

```jsonc
{
  "hardConstraints": {
    "servings": 4,
    "maxCookMinutes": 30,
    "dietaryRestrictions": ["laktosfri"],
    "nutritionTargets": { "proteinGramsPerPortionMin": 35, "kcalPerPortionMax": 700 }
  },
  "softPreferences": { /* InterpretedPreferences from Call A */ },
  "costTier": "moderate",
  "pantry": ["soja", "vitlök", "ris", "olja"],
  "availableIngredients": [ /* name/category/packageGrams/costTier/perishability only */ ]
}
```

`nutritionTargets` are passed **as targets to design toward**, with the standing
instruction that the model expresses fit qualitatively in `nutritionReasoning`
and returns no numbers.

### Keeping the model off factual fields

1. The schema has **no** fields for price, total, distance, stock, or macro
   numbers — there is nowhere to put a hallucinated value.
2. System prompt states those are system-computed.
3. App validation rejects the response if `nutritionReasoning` / `summary` /
   `fitExplanation` contain digit sequences that look like quantized claims
   (allow "1", "2 dl" style cooking quantities; reject "≈620 kcal", "45 g
   protein", "89 kr").
4. `costTier` (not SEK) and ingredient names (not SKUs) are the only
   commerce-adjacent inputs.

### Substitution framing

The model proposes `acceptableSubstitutions` with a by-weight `conversionRatio`
and a culinary `notes` caveat. It does **not** choose the final substitution —
the BasketEngine does, based on availability and price. Only an unlisted forced
substitution escalates to Call C.

---

## 7. Validation & retry

All of this lives in `lib/ai/` (client, model config, prompts, schemas, parse,
validate, retry, errors) — nothing scattered in route handlers.

### Schema + semantic validation (Zod, after `output_parsed`)

- Structure is guaranteed by `strict: true`; still re-parse with Zod to get typed
  objects and to catch a `refusal`.
- Semantic checks the schema can't do:
  - `servings === hardConstraints.servings`.
  - every `requiredGrams > 0`, `confidence ∈ [0,1]`.
  - `steps[].stepNumber` contiguous from 1.
  - every `usesIngredientIds` / `quantitiesUsed.ingredientId` exists in
    `ingredientRequirements[].id`.
  - for each ingredient, `Σ quantitiesUsed.grams` across steps is within ±8% of
    `requiredGrams` (garnish/seasoning exempt).
  - `sourcePreference === "catalog"` ⇒ `catalogIngredientId` non-null and present
    in the catalog passed in.
  - no disallowed numeric claims in user-facing strings (regex, see §6).
  - `estimatedTotalMinutes <= maxCookMinutes × 1.15` (soft warn; hard check is in
    the constraint gate after BasketEngine, using real data where possible).

### On invalid output

1. **One repair retry** on the same response chain via `previous_response_id`,
   sending a short `"Följande fält bröt mot reglerna: … Returnera hela objektet
   igen, korrigerat."` message. Cheap (cached context), usually fixes it.
2. If still invalid → **retry once on the fallback model** (fresh call, `effort`
   bumped one level).
3. If still invalid → graceful failure (§8). Never ship an unvalidated recipe.

### Transport retry / backoff

- Retry on `429`, `5xx`, connection/timeout: 3 attempts, exponential backoff
  `~0.5s / 2s / 8s` with jitter; honor `Retry-After`.
- Do **not** retry `400` (schema/programming error) or content refusals — surface
  them.

### Timeouts & token budgets

| Call | Request timeout | `max_output_tokens` | reasoning effort |
| --- | --- | --- | --- |
| A (interpret) | 15 s | 700 | `minimal` |
| B (recipe) | 45 s (stream; hard cap 60 s) | 3000 | `low` → `medium` on repair |
| C (finalize steps) | 30 s | 1500 | `low` |

- Stream Call B so COOK content can render progressively and the user sees
  motion within ~2 s.
- Cache Call A output keyed by a hash of its normalized input (vibe + hard
  constraints + pantry) — re-submitting the same PLAN form should not re-bill.

---

## 8. Fallback behavior

| Situation | Behavior |
| --- | --- |
| Call A fails after all retries | PLAN cannot proceed. Show an explicit Swedish error state ("Vi kunde inte tolka din önskan just nu") + "Försök igen" button. Form input preserved. No fabricated interpretation. |
| Call B fails after all retries | Keep the successful `InterpretedPreferences`. Show "Vi kunde inte skapa ett recept just nu" + "Försök igen" that re-runs **only Call B** (Call A result reused from cache). Stores/products already resolved stay on screen. |
| OpenAI wholly unavailable (repeated 5xx / DNS) | Same graceful states; a small status note "AI-tjänsten är otillgänglig". Never invent recipe, prices, or macros. |
| Partial stream then disconnect | Discard the partial, treat as Call B failure. |
| **Demo mode** (`DEMO_MODE=true` env or `/demo` route) | Serve a **canned Swedish recipe fixture** + canned `InterpretedPreferences`, clearly badged "Demoläge". Crucially, the fixture is still run through the **real BasketEngine against fixture products**, so cost, budget-remaining, and nutrition are genuinely computed and internally consistent — only the AI outputs are canned. Demo data must never render without the badge and never in the production path. |

Error taxonomy (in `lib/ai/errors.ts`): `AiTimeout`, `AiRateLimited`,
`AiInvalidOutput`, `AiRefusal`, `AiUnavailable` — each maps to one UI state.

---

## 9. Open questions

Tagged for the responsible role.

**For Architect**
- `[ARCH-1]` Where does BasketEngine run — Node serverless function vs edge? It
  needs the grocery API + nutrition DB; latency budget after Call B?
- `[ARCH-2]` Is product candidate selection (step 3) deterministic enough that
  Call B's `availableIngredients` list is stable for the same input? If not, Call
  A caching helps but Call B caching won't.
- `[ARCH-3]` Stream Call B to the client, or resolve fully server-side then push
  the assembled PLAN? Affects perceived latency vs implementation complexity.
- `[ARCH-4]` Model IDs (`gpt-5.6-*`) are moving fast — confirm the exact IDs
  enabled on our account and pin them in config; decide upgrade cadence.

**For Data specialist**
- `[DATA-1]` Does the grocery API reliably expose `packageGrams` and per-100g
  macros for every SKU? Fallback when a product lacks nutrition data (skip line?
  use a generic table? fail the plan?).
- `[DATA-2]` Do we have a canonical ingredient taxonomy with stable IDs to join
  `catalogIngredientId` (model output) to products? Who owns it?
- `[DATA-3]` How many candidate ingredients can we pass to Call B before token
  cost/latency hurts? Target ~40–60; is that enough coverage?
- `[DATA-4]` Distance/store data source and its freshness; how is
  `maxShoppingDistance` enforced — pre-filter stores before product selection?

**For Product / UX**
- `[UX-1]` How to present the recipe-quantity vs purchased-package gap in SHOP
  and COOK (leftover framing, "räcker till fler portioner")?
- `[UX-2]` How to surface `riskFlags` and forced substitutions without eroding
  trust?
- `[UX-3]` Is a clarification round-trip (`clarificationNeeded`) acceptable, or
  must the app always produce a plan on first submit?
- `[UX-4]` Swedish tone: confirm `du`-form, casual-but-not-jokey.
- `[UX-5]` Per-plan AI cost ceiling and demo-mode scope (public demo? investor
  demo only?).

---

## Appendix — cost estimate per full PLAN request

Primary models, standard tier, 2026-08-27 pricing.

| Call | Model | ~Input tok | ~Output tok | Input $ | Output $ | Call $ |
| --- | --- | --- | --- | --- | --- | --- |
| A interpret | gpt-5.6-luna | 1,000 | 500 | $0.00020 | $0.00060 | **$0.0008** |
| B recipe | gpt-5.6-terra | 3,000 | 2,500 | $0.00600 | $0.03000 | **$0.0360** |
| C finalize (≈12% of plans) | gpt-5.6-terra | 2,000 | 1,200 | amortized | amortized | **~$0.002** |
| **Total (typical)** | | | | | | **≈ $0.039** |

- ≈ **0.40–0.45 SEK per PLAN** at current FX.
- With a repair-retry buffer (~20% of Call B): budget **≈ $0.05 / ≈ 0.5 SEK**.
- All-cheap variant (luna/nano everywhere): **≈ $0.004 / ≈ 0.04 SEK** — viable
  for a high-volume free tier if recipe quality holds.
- Prompt caching on the static system prompts (cached input ~10× cheaper) shaves
  Call B input cost meaningfully once warm.
- Latency: Call A ~1–2 s (`minimal`), Call B ~6–12 s (`low`, streamed). Store /
  product lookups overlap where possible but Call A must finish first.
