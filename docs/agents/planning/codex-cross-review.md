# Codex cross-review — planning package

_Independent architecture review. Date: 2026-08-27. Scope: `product-ux.md`, `architecture.md`, `ai-architecture.md`, and `data-sources.md`._

## Executive verdict

Do not cut a backlog from these documents yet. They contain a credible product idea and several good invariants (integer öre, consumed-versus-purchased quantities, visible fixture provenance), but they do not yet specify one coherent pipeline. The central unresolved issue is store-specific assortment: a store cannot truthfully be selected for “best basket price” before its product candidates have been queried, while querying only the already-selected store cannot support the comparison claimed by the UX.

The MVP should commit to one store, one fixture-backed demo geography, one normalized provider contract, one deterministic basket engine, and at most two AI calls. Live Primat should be an explicitly badged beta path until coverage, keyed endpoints, latency, and licensing are validated with the actual account.

## BLOCKER

### B1. Store choice and product lookup are circular, and the current ordering makes an unsupported claim

`architecture.md` steps 5–7 resolve stores, pick a primary store by “most concepts covered,” and only then query products for that store. Coverage and basket price are unknowable before product results exist. `product-ux.md` then says the store was selected for “bäst pris på din korg” and offers alternative-store basket totals. `data-sources.md` confirms that assortment/prices are per `(chain, store_id)` and that many ICA/Coop stores are only `offers_only`. These cannot all be true under the proposed single-store query.

Recommendation:

1. Resolve and distance-filter stores first. Reject `null`/register-only stores and, for MVP, normally reject `offers_only` stores for full-basket claims.
2. Deterministically shortlist at most 2–3 `full` stores using distance, freshness, supported chain, and stable tie-breakers. Do not claim price optimization yet.
3. Run intent interpretation or a deterministic ingredient-archetype lookup to obtain search concepts.
4. Search the same bounded concepts against every shortlisted store, with concurrency and row limits. Normalize results into store-scoped candidate sets.
5. Compute a provisional coverage score and comparable proxy basket per store using the same deterministic selection rules. Choose the store by: required/core coverage first, complete basket cost second, distance third, stable store key last. Never compare totals when coverage differs without labeling that fact.
6. Issue price-free, app-scoped product handles from the chosen store to recipe generation.
7. Generate the recipe, resolve exact quantities to packages, compute the final basket/nutrition/constraints, and repair deterministically.
8. If the generated recipe invalidates store ranking, either accept the chosen store for MVP or evaluate the exact basket once against the already-fetched other-store candidates. Do not start an unbounded refetch loop.

This means products must be fetched before final store selection, but only for a small shortlist—not 15 stores and not full catalogs. If latency cannot support 2–3 stores, simplify the claim to “närmaste butik med tillräcklig täckning” and remove “bäst pris” and alternative totals from MVP.

### B2. The recipe/product contracts conflict across documents

There are at least three incompatible versions:

- `architecture.md` gives the model `IngredientOption { ingredientId, conceptId, displayName, packageLabel, soldBy, dietaryFlags }` and requires it to answer only with app-issued `ingredientId`.
- `ai-architecture.md` says Call B receives `{ catalogIngredientId, displayName, category, typicalPackageGrams[], coarseCostTier, perishability }`, and its output may use `sourcePreference: "additional"` with a null catalog id followed by supplementary lookup.
- `architecture.md` describes `RecipeConcept` requirements as `{ ingredientId, requiredGrams, importance, substitutionAllowed }`, whereas `ai-architecture.md` defines a substantially larger `GeneratedRecipe`, uses both a recipe-local `id` and `catalogIngredientId`, and calls the role field `role` rather than `importance`.

The “additional” escape hatch also contradicts “no unknown or invented ingredients”: it permits the model to create ingredients after the bounded candidate fetch, causing more network calls, forced substitutions, and possible Call C.

Recommendation: define one canonical contract before implementation. For MVP, every purchasable requirement must reference an opaque, request-scoped `optionId` issued by the application and belonging to the chosen store. Pantry-only seasonings may reference a separate, finite canonical pantry id list. Remove `sourcePreference: additional`, model-authored substitution names/ratios, and supplementary searches from the happy path. Keep product facts in a server-side `optionId -> Product` map. The model may choose quantities and cooking treatment, but not expand the shopping universe.

### B3. The over-budget mechanisms are genuinely different, not three descriptions of one ladder

`product-ux.md` defines four rungs: cheaper product, reduce recipe quantity, regenerate a different recipe, show over budget. `architecture.md` defines seven numbered states: pantry offsets, merge duplicates, cheaper candidate, smaller sufficient pack, drop up to two garnishes, one AI re-plan, terminal. It does not implement Product’s quantity-reduction rung. `ai-architecture.md` defines Call C for unauthorized substitutions/technique changes, not budget re-planning. Architecture separately uses a third model call for budget re-plan. In the combined design, a request can therefore require Call A + Call B + budget re-plan + substitution Call C, plus validation and transport retries.

The pure portion of Architecture’s ladder can terminate, but the full mechanism is not deterministic once rung 5 invokes AI. “Closest basket” is also undefined: lowest overshoot, fewest changes, best coverage, or culinary similarity. The smaller-package rung is not necessarily cheaper and can be subsumed by candidate enumeration. Dropping garnish changes the recipe while leaving steps and per-step quantities stale. Product’s quantity reduction has no model-authored minimum/tolerance field on the canonical architecture type.

Recommendation: use one bounded repair algorithm and name preprocessing separately:

- Normalize pantry offsets and duplicate-product merges before the initial price; these are not repair rungs.
- Enumerate only authorized SKU/package alternatives for the same canonical ingredient; choose the feasible basket by a deterministic lexicographic objective: preserve all core/supporting requirements, satisfy dietary rules, minimize overshoot, minimize substitutions, minimize leftover, then stable ids.
- Optionally remove explicitly model-tagged `optional_garnish` items, and deterministically remove their references from steps. Do not reduce core quantities without explicit min/max tolerances and recipe-step rewriting.
- If still over budget, return `over_budget` with the cheapest valid basket under that objective.

Move “generate a different recipe” to a separate user-triggered regeneration operation. Do not put an AI call inside a function described as pure/deterministic. For MVP, omit automatic budget AI re-plan and Call C entirely.

### B4. The deterministic/AI boundary is not airtight

The schema ban prevents some obvious output fields, but it does not make the result factual:

- The model sees `packageLabel` / `typicalPackageGrams` and `coarseCostTier` in AI Architecture, directly contradicting “never sees package sizes” and, in the latter case, indirectly exposing price classification. A label such as “2 för 50 kr, 700 g” may contain price unless projected from structured fields rather than copied.
- Product display names can contain promotional quantities, member markers, sizes, or other factual claims. Regex checks on generated prose are brittle and cannot distinguish “30 min,” “2 dl,” “45 g protein,” and product-name echoes reliably.
- Cooking time is model-estimated, yet presented as a hard, deterministically checked constraint. Code can compare numbers but cannot establish that the model’s time estimate is true, especially after portion scaling or substitution.
- Dietary/allergen compatibility depends on product metadata and ingredient interpretation. Primat’s verified shape does not establish complete allergen or dietary fields. Name/category filtering is not a hard safety check.
- `available: true` is a provider observation, not real-time stock. The UX’s “Slut i butik” transition after plan creation requires a refresh that the immutable/offline snapshot explicitly avoids.
- Package arithmetic is underspecified for `ml` versus `g` (density), pieces, variable weight, drained weight, multi-packs, minimum-weight goods, and nullable/unparseable package amounts. A `packageLabel` parser is not a factual structured size.
- Effective/member/multibuy price semantics are not a settled business rule. `effective` may assume a loyalty card; a multibuy may change packages-to-buy. “Exact price” is unsafe without price type, timestamp, eligibility, and offer-validity policy.
- Unquantified pantry claims (“I have oil”) can remove arbitrarily large quantities from the basket. Product explicitly says even 300 ml remains excluded, so the budget can pass despite a likely purchase.
- Nutrition joins can be stale, missing, or mismatched by GTIN; generic fallback is an estimate. That is acceptable only with coverage and source labels, never as an exact factual value.
- Rounding policies are incomplete. Money should be integer öre from source parsing onward; variable-weight lines require a declared half-up rule. Nutrition should retain high precision internally and round only at display. Per-portion rounded values will not necessarily multiply back to rounded totals, contrary to Product’s “every number reconciles” requirement.

Recommendation: replace the slogan with enforceable information-flow rules. The AI input projection may include only opaque option ids plus carefully sanitized culinary descriptors (generic ingredient label, form, category, dietary assertions whose provenance is known). It should not receive package labels, sizes, brands, retailers, price tiers, availability, or nutrition. The server map owns all SKU facts. Treat time as an AI estimate (`ca`) rather than a hard fact unless a deterministic timing model is introduced. Define explicit money, unit-conversion, pantry-cap, offer/member, freshness, nutrition-confidence, and display-rounding policies. Hard dietary safety must be limited to claims supported by authoritative fields; allergies remain disclaimed and should never be called “validated.”

### B5. Proposed model identifiers are likely a Codex-tier/API-model confusion

`gpt-5.6-luna` and `gpt-5.6-terra` are presented as OpenAI API model ids with precise API prices. Luna/Terra/Sol are Codex execution tier names in this environment, not evidence that identically named models are available through a customer’s Responses API. The documents themselves admit ids are volatile, but still build estimates and fallbacks around guessed names.

Recommendation: the plan must not prescribe guessed ids or prices. Say: “At implementation/deployment time, query or inspect the live OpenAI models available to the project/account, verify Responses API + Structured Outputs + requested reasoning controls, and select one low-latency model for intent and one quality model for recipe generation. Store verified ids in environment/config, validate them at startup/health check, and maintain a tested fallback.” Pin a dated, actually returned snapshot only after credentials exist. Cost and latency estimates must be recalculated from the then-current official pricing page.

### B6. The latency and Vercel execution plan is not realistic as written

Product promises `<12 s`. AI Architecture budgets Call A at 1–2 s and Call B at 6–12 s, while Architecture allows 12 s for Primat fan-out, 35–45 s for Call B, retries, optional model repairs, optional budget re-plan, nutrition lookup, persistence, and a 60 s route cap. Sequential dependencies consume the full budget before retries. An 8–12 query Primat fan-out is not “one batched call” merely because the port accepts an array; `/products?q=...&stores=...` is a bounded query endpoint, not a confirmed multi-query batch API. `/batch` resolves known ids/GTINs and does not replace discovery searches. Vercel buffering and a single POST also cannot both provide real stage ticks and progressively render an unvalidated structured recipe. “Stream Call B so COOK content renders” conflicts with returning only `{planId}` after validation and persistence.

Recommendation:

- Set an honest MVP SLO: fixture path p95 under 3 s; live path target p50 under 12 s and p95 under 25 s, measured rather than promised.
- Bound to 2–3 stores, 6–8 ingredient concepts, 3–5 results per concept, and a concurrency limit. Cache store resolution and common store-scoped searches.
- Use one AI call if practical: deterministic/keyword intent extraction plus a single recipe call, or have Call A return only search concepts with a strict small output. No automatic Call C or budget re-plan.
- Give every stage a deadline and fail over early; retries must share the global deadline, not reset it. Do not use an 8 s backoff inside a 60 s interactive request.
- Implement progress as explicit server events or polling over a durable job only if measured latency requires it. Otherwise label the four-stage UI as narrated activity, not verified completion. Do not stream model JSON to the result UI before full parse and deterministic validation.
- Confirm the deployed Vercel plan’s actual max duration and streaming behavior. Do not assume `maxDuration = 60` guarantees availability on every plan/runtime.

### B7. Failure/degradation behavior contradicts itself

- Intent failure: Architecture continues with `HeuristicIntentInterpreter`; AI Architecture says PLAN cannot proceed; Product says show an error and allow a cached proposal.
- Recipe schema failure: Product silently serves a deterministic fixture recipe; Architecture serves a scripted recipe only in demo/fallback mode and badges it; AI Architecture fails outside explicit demo mode. Silent fixture recipe conflicts with the global “degrade visibly” rule.
- Primat failure: Architecture’s `live_with_fallback` silently enters fixtures automatically (with badge); Product asks the user to choose “Visa demoläge.”
- Location failure: Product defaults to Södermalm and says never block; Architecture says never guess and returns `needs_input`.
- Partial/core product failure: Architecture says it may drop a core ingredient, despite also saying budget repair never drops core requirements and Product saying SHOP cannot be empty/a plan always has items.

Recommendation: one state machine. Suggested MVP policy: missing location uses a clearly visible demo default only in demo mode; live mode asks for postcode. Live provider failure never mixes live stores with fixture products—offer a user-controlled switch to an entirely fixture-backed, persistently badged plan. AI failure offers a pre-baked badged demo plan. Incomplete core coverage yields `infeasible`, not a mutilated recipe. No fallback is unlabeled.

### B8. Live/fixture normalization and provenance are internally inconsistent

`data-sources.md` says fixture responses must be “byte-identical” raw live payloads, while Architecture defines provider interfaces with normalized domain shapes. Both are useful at different layers, but cannot be the same fixture. Data Sources proposes four provider interfaces/two implementations each; Architecture proposes more ports, decorators, modes, and separate store/geocoder providers. Architecture’s `Provenance.storeSource` omits Primat even though Data Sources recommends Primat as the store resolver. Architecture calls Primat nutrition a possibility in open questions although Data Sources confirms nutrition is absent. Architecture still treats store-specific price as unknown although Data Sources confirms it.

Recommendation: maintain two fixture classes: raw HTTP contract recordings for adapter tests, and small normalized domain fixtures for engine/demo tests. Never claim byte identity after mapping. Update architecture decisions with the confirmed Primat facts: store-scoped prices, Primat store resolver, no Primat nutrition, partial coverage tiers, max 15 stores, and product search versus known-id batch semantics. Add `primat_live|primat_cached|fixture` consistently to both store and price provenance.

### B9. Persistence, sharing, expiry, and offline state are not one design

Product says plans live for “session + localStorage,” declares sharing out of scope, calls plans stale after 24 hours, and requires SHOP to work offline after load. Architecture makes a public Vercel Blob capability URL the source of truth, explicitly makes links shareable, retains for 30 days, and uses localStorage only for UI annotations. Its write-failure fallback puts the result in `sessionStorage`, but RSC routes cannot retrieve that payload after navigation without an additional client path. A public blob is also not “effectively private” merely because its key is random; the blob URL/data and deletion/retention policy need threat and licensing review. Demo mode selects `MemoryPlanStore`, which is not dependable across Vercel serverless instances.

Recommendation: for demo MVP, persist the complete immutable `PlanResult` client-side (session/local storage) and make PLAN/SHOP/COOK client routes read the same snapshot; no sharing, no Blob, no server read-after-write dependency. If server persistence is retained, use a private server-mediated store, define 24-hour price staleness separately from 30-day object expiry, implement the inline-write-failure navigation contract, and explicitly build offline caching. Defer sharing.

## SHOULD-FIX

### S1. The scope is too wide for the stated team and deadline

The proposed eight ports, three engines, three data modes, blob persistence, SSE-ready API, store comparison, offline SHOP, background timers, wake lock, geolocation/geocoding, live substitutions, nutrition source joins, three scripted plans, recorder tooling, 90–100% coverage targets, Playwright, and extensive degradation matrix are a platform roadmap, not a demo MVP.

Recommended minimum viable core:

- One mobile-first PLAN → SHOP → COOK journey for one meal.
- One tested Swedish city/postcode and 1–2 `full` stores in a normalized, dated Primat-derived fixture.
- One fixture provider interface for stores/products/prices; one live Primat adapter behind an opt-in beta flag if keyed validation succeeds.
- One OpenAI recipe call against a bounded option list; optionally a very small intent call only if measured search quality requires it.
- One deterministic module (it may have internal functions) for package selection, integer-öre basket totals, consumed-gram nutrition, and constraint reporting.
- One store per plan, chosen by a simple documented rule. No expandable alternative basket totals unless actually computed.
- One immutable plan snapshot stored locally; checkmarks and current cook step stored locally.
- Nutrition from a curated fixture table with source/coverage; only kcal and protein are necessary for the demo story.
- One fully pre-baked, persistently badged fallback scenario that reconciles exactly.
- Honest over-budget terminal state after deterministic SKU alternatives; user-triggered regenerate.

Explicitly defer: Blob/sharing, multiple live/fallback modes beyond `fixture` and opt-in `live`, provider health endpoint, OSM/curated geocoding stack, multi-store comparison, dynamic out-of-stock substitutions, Call C, automatic AI budget re-plan, model-response chaining, live OFF lookups/nightly cache, product images, opening hours, push/notification timers, concurrent timers, service worker/offline install work, post-generation portion scaling, price history, and broad nationwide coverage.

### S2. Product scope contradicts itself

Product cuts real-time stock, sharing, recipe editing/swapping, PWA/service-worker work, and price comparison as first-class features, but still specifies post-PLAN stock discovery plus one-tap replacement and repricing, alternative-store basket totals, share-related assumptions, offline behavior, background notifications, and multiple concurrent timers. These “exceptions” contain most of the complexity of the cut features.

Recommendation: remove those interaction requirements from MVP instead of preserving them as edge cases. A frozen shopping list should say prices/availability were checked at plan time and instruct the user to choose a reasonable in-store substitute manually.

### S3. Hard constraints need a feasibility taxonomy

Budget and distance are deterministic given trusted facts. Portions are an equality. Cooking time is an estimate. Nutrition is an estimate with partial coverage. Dietary requests may be supported only at ingredient-name level. Treating all of them as equivalent green/red “hard checks” overstates certainty.

Recommendation: define `verified`, `estimated`, and `unsupported` checks. Only verified checks can be pass/fail. Estimated checks show `ca` plus confidence. Unsupported safety claims never become green. Define the overall-status aggregation explicitly and distinguish `infeasible` (valid facts prove failure) from `unknown` (coverage/provider failure).

### S4. Primat commercial and coverage gates must precede “live MVP” backlog work

The actual key, plan, keyed endpoint behavior, quotas, terms acceptance, demo city, `full` coverage, freshness, and paid licensing are still unverified. The most popular chains may have only campaign data at many stores. A full basket presented as exact can therefore be incomplete while looking authoritative.

Recommendation: create a go/no-go spike with measurable exit criteria: keyed calls work; chosen city has at least two suitable `full` stores; 8 representative queries have acceptable coverage; p95 latency and row consumption fit; offer/member policy is defined; fixture/public-repo use is cleared; App-tier launch cost is approved. Until it passes, market the demo as fixture-backed.

### S5. “Real products compatible with recipe” needs explicit matching acceptance criteria

The plans under-weight the hardest domain problem: translating a culinary concept and quantity into the correct purchasable SKU without semantic errors. String match plus category/package fit can select prepared meals, wrong cuts, flavored variants, concentrates, multipacks, or a product whose unit cannot satisfy the recipe. GTIN helps identify products but does not provide ingredient equivalence.

Recommendation: for the demo, curate a canonical ingredient-to-approved-SKU mapping for the bounded fixture catalog. Live search may suggest candidates, but only candidates passing a deterministic allowlist/category/unit test enter the model option set. Record rejection reasons and measure core-ingredient coverage. Do not let the LLM perform this factual join.

### S6. API/result status semantics are inconsistent

Architecture says infeasible may return 503, but infeasibility is a valid business result, not service unavailability. Product expects a decision screen with actionable constraint details. The POST returning only `{planId}` also conflicts with the inline fallback on store-write failure and narrated progress.

Recommendation: use 201/200 for a completed `ok|over_budget|infeasible|unknown` plan outcome, 422 for invalid/contradictory user input, 503 for dependency failure with no valid fallback, and a stable error object. Specify exactly whether POST returns the result, id, or both.

### S7. Security/privacy and licensing need a concrete data-flow review

Precise coordinates, vibe text (which may contain allergy/health data), retailer data, model prompts, public blob snapshots, logs, and captured fixtures cross several services/licences. “Keep coordinates client-side” contradicts sending them to a server-side resolver. Raw recorded OpenAI/Primat payloads may contain user text or licensed data and should not automatically enter a public repository.

Recommendation: minimize and round location where possible, redact prompts/coordinates from logs, define retention, never capture real user prompts into fixtures, keep licensed raw recordings private or synthetic where required, and document attribution at the rendered-value level. Review public Blob access before use.

## CONSIDER

### C1. Collapse Call A unless it demonstrably improves product retrieval

For a bounded demo catalog, deterministic keyword/archetype mapping is faster and more reproducible. A single model call can design a recipe from a curated option set and return the interpretation echo. Retain two calls only if an evaluation set shows Call A materially improves Swedish search recall/precision.

### C2. Prefer a plan job only after measurements justify it

SSE/polling/job persistence adds failure states. Start with a single bounded request and a clearly non-literal progress treatment. If live p95 exceeds the interaction budget, move generation to a durable job with idempotency and polling; do not bolt SSE semantics onto an in-memory serverless request.

### C3. Define idempotency, cancellation, and regeneration budgets

The cancellable UI cannot necessarily cancel provider/model billing unless the abort signal is propagated. Double submit can create duplicate plans. “Another suggestion” can trigger repeated fan-outs and calls.

Recommendation: client-generated idempotency key, request-scoped abort signal, a server-side deadline, and explicit max regeneration count. Cancellation is best-effort and should be described as such.

### C4. Separate source freshness from numerical precision

An integer-öre price is precise but may be stale, member-only, or incomplete. A distance can be accurately calculated from approximate coordinates. Nutrition can have many decimals and still be low-confidence.

Recommendation: every displayed fact carries source, observed/retrieved time, eligibility, coverage, and confidence independently of formatting precision.

## Recommended ordered pipeline (MVP contract)

1. Validate structured request; convert budget to integer öre; classify unsupported safety claims.
2. Resolve location and distance-filter stores. In fixture demo, use the fixed visibly labeled location; in live mode require a valid location.
3. Keep at most 2–3 eligible `full` stores using deterministic distance/freshness rules.
4. Interpret vibe into at most 6–8 canonical search concepts, preferably deterministically for the bounded demo; otherwise use a small, timed AI call.
5. Query those concepts for all shortlisted stores with bounded concurrency and normalize facts. Reject candidates with unusable units/packages or unsupported dietary evidence.
6. Score provisional coverage/basket consistently across stores and select one. If only one store was queried, state a coverage/distance reason, never “cheapest.”
7. Build sanitized, request-scoped option handles for approved products in the chosen store. Keep all price, package, store, stock, nutrition, and provenance facts server-side.
8. Call OpenAI once to generate a Swedish recipe using only those option ids, recipe quantities, steps, and qualitative prose. Validate all ids, quantities, steps, portions, and estimated time.
9. Resolve quantities to real packages; apply pantry caps; choose price policy; compute basket in integer öre and nutrition from consumed quantities with coverage.
10. Evaluate constraints by evidence class. Try only bounded deterministic SKU/package alternatives and optional-garnish removal.
11. Return `ok`, `over_budget`, `infeasible`, or `unknown`, with full provenance and adjustment audit. Persist one immutable local snapshot for PLAN/SHOP/COOK.
12. On upstream failure, offer—not silently mix in—a complete persistently badged pre-baked demo plan.

## Biggest collectively under-weighted risk

The largest risk is not the LLM or arithmetic; it is factual coverage and semantic product resolution at one real store. The value proposition fails if “kycklingfilé” maps to an unsuitable product, a core ingredient is absent because the store is `offers_only`, a package cannot be normalized, or the displayed “exact basket” silently excludes unmatched products. All downstream precision then becomes false confidence. The demo should prove a bounded, curated ingredient→approved SKU→package→price chain before investing in the broader architecture.
