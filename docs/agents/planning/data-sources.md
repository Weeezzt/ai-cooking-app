# Data Sources — Research & Validation

Owner: API / Data specialist
Date: 2026-08-27
Status: Primat validated against public docs + live demo endpoints. Full validation blocked on credentials (see §2).

Scope: what feeds Swedish grocery **store discovery + distance**, **product search + store-specific prices**,
**package sizes / product IDs**, **availability**, and **nutrition** for the cooking / meal-planning app.

---

## 1. Primat findings

**What Primat is:** `primat.nu` — a Swedish consumer price-comparison site (self-described "under
development") that also sells its underlying data as an HTTP API "built for developers and AI agents".
Independent of, and not to be confused with, Matpriskollen (the other big SE grocery-price data vendor).

- Base URL: `https://primat.nu`
- API root (self-describing): `GET /api/v3` — machine contract: `GET /api/v3/openapi.json`
- Human docs (English): `https://primat.nu/api` · Plans/keys: `https://primat.nu/data` · Terms: `https://primat.nu/villkor`
- Current surface is **v3**; v1/v2 remain frozen-serving for existing integrations.
- Self-reported scale (landing page, 2026-08-27): **12,982,509 prices tracked · 2,931 stores · 6 chains**.
- Price history change-log **since December 2025**.

### 1.1 Capabilities table

| Capability | Status | Detail (source) |
|---|---|---|
| **Retailer coverage** | CONFIRMED | Exactly 6 chains, enum `ica, coop, willys, hemkop, lidl, citygross` (openapi.json `Product.chain`). All 6 retailers of interest **except** that no others are covered. |
| **Store-specific pricing** | CONFIRMED (with caveats) | Prices are per `(chain, store_id)`. Each store carries a `tier`: `full` = complete assortment + prices; `offers_only` = campaign prices only (no assortment feed exists for that store); `null` = register-only. In the Uppsala live sample, Willys / Lidl / Hemköp / City Gross doors were mostly `full`; **most ICA and Coop doors were `offers_only`**, with only a handful of `full` ICA/Coop doors per city. So true store-level *assortment* pricing is strong for Willys/Lidl/Hemköp/CityGross, partial for ICA/Coop. |
| **National vs store price** | CONFIRMED | Model is always store-keyed; you pass `stores=chain:store_id,...` (max 15) and get one row per carrying store. Without `stores=`, product search returns one row per product at its cheapest carrying store nationally. |
| **Product search** | CONFIRMED | `GET /api/v3/products?q=...` ranked, bounded (not paginated). `GET /api/v3/prices?stores=...` = full store catalogs via opaque keyset cursor (`next_cursor` until null; `limit` default 500, max 1000; stable pages). `GET /api/v3/deals` (price drops, has `previous` + `discount_ratio`), `GET /api/v3/cheap` (by unit price). `POST /api/v3/batch` up to 100 lookups/call by `{gtin}` or `{chain,store_id,product_id}` or `{chain,product_id}`. |
| **Product ID scheme** | CONFIRMED | `product_id` is **chain-native, unique only per chain** (e.g. Willys `100891634_ST`). Cross-store / cross-chain key is **`gtin`** (GTIN/EAN barcode), nullable where a chain publishes none. |
| **Package size fields** | CONFIRMED | `amount` (number, nullable), `unit` (`g` / `ml` / `st` / `kg` / `l` / `m`, nullable), `package` (display string, e.g. `"1000 ml"`). Plus `prices.comparison` = `{price, unit}` unit price per kg/l/st/m computed on the regular price. |
| **Price fields** | CONFIRMED | `prices`: `regular`, `member` (set only while a member price runs), `multiprice` / `member_multiprice` `{price, quantity}` (per-unit multibuy, "5 for 35 kr"), `comparison {price,unit}`, `offer {price,label,valid_from,valid_until}` (null when none), `effective` (least a card-carrying shopper pays now — convenience fold), `previous` (on `/deals`). Flat `PriceRow` variant on `/prices`. Timestamps: `changed_at` (price last changed), `confirmed_at` (store last checked). "No change since `changed_at`" = confirmed unchanged, not unmeasured. |
| **Historical pricing** | CONFIRMED | `GET /api/v3/history/{chain}/{store_id}/{product_id}` and `GET /api/v3/history/{gtin}` (≤6 series). Daily price-**change** points `{date, price, member_price, effective}`. **Paid only** — Pro: 12 months (generation-pinned); Byrå: full (Dec 2025→) + bulk CSV/Parquet export. Deep reads time-budgeted (`504 history_timeout`). |
| **Availability info** | CONFIRMED | `Product.available` (bool). `Store.available` (bool = pipeline has price data). `HistoryPoint.price = null` means delisted from that store. |
| **Nutrition data** | CONFIRMED ABSENT | **No nutrition anywhere** in the schema (no energy/protein/carb/fat fields on `Product` or `PriceRow`). Must be sourced elsewhere and joined by `gtin`. |
| **Store location data** | CONFIRMED | `GET /api/v3/stores` (register with `tier`, `confirmed_at`; `all=1` adds register-only). `Store`: `name`, `address`, `postcode`, `city`, `coordinates {latitude, longitude}` (nullable). `GET /api/v3/stores/resolve` takes `place=` (locality name or 5-digit postcode) **or** `postcode=` **or** `lat=&lon=` and returns geocoded `place {label, locality, postal_code, latitude, longitude}`, a ranked `stores[]` list with `km` distance + `tier` + `selected`, and `default_selection` (chain:store_id keys ready to drop into `stores=`). Live-verified for "Uppsala". |
| **Auth mechanism** | CONFIRMED | API key as `Authorization: Bearer <key>` or `X-API-Key: <key>`. Two key types: **secret** `primat_live_…` (server-side) and **publishable** `primat_pk_…` (browser-safe: origin-locked to your domains, read-only, own quota, CORS enabled). Multiple named keys per account, individually rotatable/revocable at `primat.nu/data` or `primat.nu/konto`. No OAuth. Instant self-serve: `POST /api/v3/signup {"email":...}` → provisional secret key (7-day TTL, tight shared quota) → `POST /api/v3/confirm/request` + one click in email → free tier. |
| **Rate limits** | CONFIRMED w/ 1 discrepancy | Demo (no key): 25 results/call, 250 req/day per IP. Provisional key: 60 req/min, 2,000 rows/day + shared pool. Free: **60 req/min**, rows/day = **20,000 (Plans table on /api & /data)** vs **50,000 (signup/confirm prose in same docs)** — UNVERIFIED, resolve via `GET /api/v3/me`. App: 250/min (+250 burst), 100,000 rows/day. Pro: 600/min (+600), 1,000,000 rows/day. Byrå: 3,000/min (+3,000), unlimited. "Rows" = product/price rows returned, also capped per-call by plan. |
| **Cost of the API** | CONFIRMED | Prices **ex VAT**, billed via Stripe, cancel anytime. Gratis **0**; App **249 SEK/mo**; Pro **1,995 SEK/mo**; Byrå **7,495 SEK/mo**. Free tier is explicitly "for development, test and personal use"; **App is the tier for a live app serving users**. Image links (chain original product-image URLs) are App tier and up. |
| **Licensing / ToS** | CONFIRMED | Commercial use allowed ("build apps, services and analyses, including commercially"). Two hard rules: (1) **Attribution on the free tier** — must show "Prisdata från primat.nu" with a link wherever the data is displayed; every response carries `attribution {text,url}`. Paid tiers have **no** attribution requirement. (2) **No redistribution as a dataset** on *any* tier — data may not be resold, mirrored, dumped, or re-exposed as your own price-data API; "build products, don't resell the data". Byrå exists for system-wide needs by agreement. Terms may change (product "under development") but **existing accounts' terms are not worsened** — changed prices/quotas apply to new accounts only; users notified by email. Quota circumvention (key farming, IP rotation) → keys disabled (with warning first unless clearly malicious). |
| **Product images** | CONFIRMED | `urls.image` / `image_url` = the chain's *original* image URL on the chain's own server, App tier+. Best-effort pointer only; **no image rights conveyed** — Primat licenses price/product data, not the chains' photos. For licensed stable images: pair `gtin` with your own source (GS1 Validoo suggested). |

### 1.2 Verified live response shape (demo, no key)

`GET /api/v3/demo/products?q=mjölk&stores=willys:2103` →
```
{ demo, attribution:{text,url}, query, count, note,
  data:[ { chain, store_id, product_id, name, brand,
           category:"mejeri-ost-och-agg > mjolk > standardmjolk",
           amount:1000.0, unit:"ml", package:"1000 ml", available:true,
           gtin:"7340083427312",
           prices:{ regular:11.5, member:null,
                    multiprice:{price:null,quantity:null},
                    member_multiprice:{price:null,quantity:null},
                    comparison:{price:11.5,unit:"l"}, offer:null, effective:11.5 },
           changed_at, confirmed_at,
           urls:{ primat:"https://primat.nu/vara/willys/2103/101205891_ST",
                  source:"https://www.willys.se/produkt/101205891_ST" } } ] }
```
`GET /api/v3/demo/stores/resolve?place=Uppsala` → geocoded place (`59.8585, 17.6454`), 30 ranked
stores with `km`, `tier`, `selected`, and `default_selection`
`["hemkop:4256","ica:1004458","willys:2193","lidl:SE0227","citygross:3235","coop:251311"]`.

### 1.3 What is CONFIRMED vs UNVERIFIED

**CONFIRMED** (public docs + live demo calls, no credentials used):
schema, endpoints, chain list, ID scheme, package-size fields, price-fact semantics, store
location + resolver, auth model, plan prices, licensing rules, absence of nutrition.

**UNVERIFIED / needs a key to confirm:**
- Exact free-tier rows/day (20,000 vs 50,000 — doc contradiction).
- Real coverage breadth: how many `full`-tier ICA/Coop doors exist nationally; assortment size per store; how fresh `confirmed_at` runs in practice.
- Behaviour of keyed `/products`, `/prices` (cursor stability), `/batch`, `/deals`, `/cheap`, `/me` at volume.
- Whether member prices / multibuy are populated densely or sparsely (demo sample had them mostly `null`).
- History endpoint depth and `history_timeout` frequency (Pro/Byrå only).
- Publishable-key CORS / origin-lock behaviour from a browser.

---

## 2. Exactly what I need from the human

1. **Primat secret API key** (`primat_live_…`), delivered out-of-band (password manager / secret store — **not** committed to the repo).
   - Note: the human's Primat account is already set up. At `primat.nu/data` a key named **`cookingapp`** exists (created 2026-08-27, "never used"), shown only masked. Either hand over that key's full value, or create a **fresh named secret key** for this project plus a **publishable key** (`primat_pk_…`) locked to our dev + prod web origins.
2. **Which Primat plan the account is on / will be on** (Gratis / App / Pro / Byrå). This decides rows/day, whether history is available, whether image links resolve, and — critically — whether a **live user-facing app is licensed** (free tier is dev/test/personal only; a shipped app needs **App, 249 SEK/mo**).
3. **Confirmation they have accepted `primat.nu/villkor`** and the account email on file (also needed as our Open Food Facts `User-Agent` contact).
4. **Do we need price history in the demo?** If yes, the account must be **Pro or Byrå**.
5. **Target demo city / region** (e.g. Uppsala) so the fixture dataset is captured where `full`-tier coverage across chains actually exists.
6. **Sign-off on attribution placement** ("Prisdata från primat.nu" + link) if we stay on the free tier for the demo.
7. **Confirmation we may use Open Food Facts data under ODbL share-alike** and Livsmedelsverket data under CC-BY-4.0 (attribution obligations, see §7).

With items 1–2 I can finish validating everything in §1.3 in under an hour via `/api/v3/me` + a handful of keyed calls.

---

## 3. Open Food Facts assessment

Primary role: **nutrition + richer product metadata, joined to Primat products by GTIN.**

| Aspect | Finding |
|---|---|
| **Base URLs** | Prod `https://world.openfoodfacts.org`; staging `https://world.openfoodfacts.net` (HTTP basic `off`/`off`). Country views e.g. `https://se-en.openfoodfacts.org`. |
| **API shape** | REST. Read a product: `GET /api/v2/product/{barcode}.json` (or v3). Search: `GET /api/v2/search?...` (filter by category/brand/nutrient/country) and legacy `GET /cgi/search.pl`. Also newer "Search-a-licious" and a taxonomy/facets API. Official Python SDK (`openfoodfacts` pip). |
| **Nutrition fields** | `product.nutriments` per-100g and per-serving: `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g` (+ sugars, fiber, salt, saturated-fat…). Plus `product_name`, `brands`, `quantity`, `categories_tags`, `ingredients_text`, `nutriscore_grade`, `nova_group`, `ecoscore`, `labels_tags`, `allergens_tags`, images. |
| **Swedish coverage** | ~**26,900 products** on the Sweden view (`se-en.openfoodfacts.org`, 2026-08-27); ~3,600 SE brands. Global DB > 4M products. Coverage is decent for mainstream branded SE groceries (Arla, Garant, ICA, Coop, Felix, etc.) but **patchy** — many products missing, and among present products a meaningful share lack complete `nutriments` or have stale/wrong data. |
| **Rate limits** | **Product read: 15 req/min/IP. Search: 10 req/min/IP.** Per-user when calls come from an app. Far too low for live per-request lookups at any real traffic. |
| **Auth** | Reads: none, but a **custom `User-Agent` is mandatory** (`AppName/Version (contact-email)`) or you risk being bot-blocked. Writes: account auth. |
| **Licensing** | Database under **ODbL v1.0**; contents under DbCL; images CC-BY-SA. Conditions: **attribution + share-alike**. The share-alike bite: if you *combine* OFF data with other data into a new database and *publicly distribute* that database, the derived database must also be released as open data (ODbL). Using it at runtime and displaying values with attribution does not trigger that; **baking OFF nutrition into a shipped/redistributed product DB alongside Primat data could.** |
| **Data-quality caveats** | Crowd-sourced: incompleteness, unit inconsistencies (per-100g vs per-serving), occasional wrong barcode↔product, outdated formulations, non-normalised `quantity`. Always null-check `nutriments`; treat as best-effort. |

**Recommendation: use it, but not as a live per-request dependency.**
- For the **demo**: query OFF by GTIN for the fixture products once, at capture time, and freeze the results into the fixture nutrition table (with `source: "openfoodfacts"` + retrieval date).
- For **production later**: run a nightly job against the **daily data export / MongoDB dump / Parquet** (or a self-hosted Product Opener) filtered to SE + our GTIN set, into our own cache keyed by GTIN. Never hit the live API in the request path. Keep attribution ("Nutrition data © Open Food Facts contributors, ODbL") visible.
- Get legal comfort on share-alike before merging OFF fields into any DB we redistribute; the runtime-cache pattern is the low-risk path.

---

## 4. Store geocoding / distance

**Recommended for the demo: use Primat's own resolver. No Google Places bill.**

- `GET /api/v3/stores/resolve?place=<ort|postnr>` (or `postcode=`, or `lat=&lon=`) already returns:
  place lat/lon (geocoded), every nearby store of the 6 chains with `coordinates`, **`km` distance
  pre-computed**, `tier`, and a ready-made `default_selection`. This covers "nearby store discovery +
  distance" end-to-end for the retailers we care about.
- Client obtains the user's position via the browser Geolocation API (`lat`/`lon`) or a typed
  postcode/locality; pass straight through. Keep coordinates client-side / out of logs (GDPR).

**Fallbacks / supplements (if we outgrow Primat's resolver or need arbitrary-address geocoding):**
- **Nominatim (OpenStreetMap)** — free geocoding, ~1 req/s, attribution required, no key. Fine for
  place/postcode → lat/lon. For volume, self-host Nominatim or use a paid OSM geocoder (Geoapify /
  LocationIQ free tiers, ~5k/day).
- **Overpass API (OSM)** — query `shop=supermarket` + `brand=ICA|Coop|Willys|Hemköp|Lidl|City Gross`
  for store POIs + coordinates nationwide, free. Data completeness for SE grocery is good but not
  perfect; no opening-hours guarantee.
- **Retailer store-locator endpoints** — ICA, Coop, Willys, Hemköp, Lidl, City Gross each expose an
  undocumented JSON store-locator behind their websites (store list + coordinates + services). Usable
  as a cross-check for the authoritative store register, but ToS-grey and brittle; only if needed.
- **Haversine** on our side for distance if we ever have coordinates but no `km`.

Google Places / Maps: not needed for the demo, and not worth the billing setup. Keep it as a
"only if we need rich place autocomplete / POI metadata later" option.

---

## 5. Nutrition fallback strategy

Two-layer, GTIN-first:

1. **Per-product (branded):** Open Food Facts by `gtin` (see §3). Covers most mainstream SE branded
   groceries.
2. **Per-ingredient (generic) fallback** when (a) a Primat product has no GTIN, (b) OFF has no entry
   or no `nutriments`, or (c) the recipe is expressed in generic ingredients ("2 dl grädde", "500 g
   nötfärs") rather than a specific SKU:
   - **Livsmedelsverket Livsmedelsdatabasen** (Swedish Food Agency food composition DB).
     - API: `https://dataportal.livsmedelsverket.se/livsmedel/` (Swagger:
       `.../livsmedel/swagger/index.html`), JSON.
     - ~2,500 generic Swedish foods × 50+ nutrients (energy, protein, carbs, fat, fiber, salt…).
     - **Licence: CC-BY 4.0** — attribution only ("Källa: Livsmedelsverket"), no share-alike, free.
       This is the clean, low-risk choice for a curated per-ingredient table.
   - Build a **curated static lookup**: ~150–300 common cooking ingredients → macros per 100 g,
     seeded from Livsmedelsverket, checked into the repo as data (not fetched at runtime).
   - **USDA FoodData Central** (`api.nal.usda.gov/fdc`, key via api.data.gov, 1,000 req/h,
     **public domain**) — optional secondary for items Livsmedelsverket lacks; US formulations, so
     prefer Livsmedelsverket for Swedish accuracy.

Every nutrition value carries a `source` enum (`openfoodfacts` | `livsmedelsverket` | `usda` |
`manual`) so the UI can disclose provenance and we can honour each licence's attribution.

---

## 6. Recommended data architecture

### 6.1 Source → pipeline mapping

| Pipeline stage | Source | Notes |
|---|---|---|
| Place/postcode → nearby stores + distance | **Primat** `/stores/resolve` | one call; returns `default_selection` for the next step |
| Store register / store detail (coords, address, tier) | **Primat** `/stores` | cache; changes rarely |
| Product search (user types "mjölk") | **Primat** `/products?q=&stores=` | ranked, store-scoped |
| Basket / recipe-ingredient → priced SKUs per store | **Primat** `/batch` (by gtin or chain+product_id) | ≤100 lookups/call |
| Full store catalog (browse / price-index features) | **Primat** `/prices?stores=` keyset cursor | Pro/Byrå-scale row budgets |
| Deals / cheapest-by-unit-price | **Primat** `/deals`, `/cheap` | |
| Price history / trend charts | **Primat** `/history/*` | Pro (12 mo) or Byrå (full) only |
| Package size / unit / comparison price | **Primat** `Product.amount/unit/package/comparison` | |
| Per-product nutrition | **Open Food Facts** by `gtin` (cached, nightly export) | never in request path |
| Per-ingredient nutrition fallback | **Livsmedelsverket** (curated static table) | CC-BY-4.0 |
| Generic geocoding (typed address) fallback | **Nominatim / Overpass (OSM)** | only if Primat resolver insufficient |
| Product images | avoid; if required, GS1 Validoo by `gtin` (App tier `urls.image` is unlicensed) | |

### 6.2 Isolated fixture dataset (what the demo must contain)

Capture from Primat **demo** + OFF for **one city** (per §2 item 5), one or two realistic baskets /
recipes. Store as versioned JSON under e.g. `fixtures/`. Entities + fields:

- **place** — `{ query, label, locality, postal_code, latitude, longitude }`
- **stores[]** — `{ chain, store_id, key, name, address, postcode, city, latitude, longitude, tier,
  km, available, confirmed_at }` (~8–15 stores across all 6 chains, mix of `full` and `offers_only`)
- **default_selection** — `string[]` of `chain:store_id`
- **products[]** — `{ product_id, chain, gtin, name, brand, category, amount, unit, package,
  available }` (~40–80 products spanning the demo baskets, in ≥2 chains each so comparison works)
- **prices[]** — one row per `(product_id, chain, store_id)`: `{ regular, member,
  multiprice:{price,quantity}, member_multiprice:{...}, comparison:{price,unit},
  offer:{price,label,valid_from,valid_until}, effective, changed_at, confirmed_at }`
- **price_history[]** *(optional, only if demo shows trends)* — `{ gtin | (chain,store_id,product_id),
  points:[{date, price, member_price, effective}] }` (~6–12 months synthetic-but-plausible if no Pro key)
- **nutrition[]** — `{ gtin, energy_kcal_100g, protein_100g, carbs_100g, fat_100g, sugars_100g,
  salt_100g, source, retrieved_at }`
- **ingredient_nutrition[]** — `{ ingredient, per_100g:{energy_kcal, protein, carbs, fat}, source:"livsmedelsverket" }`
  (~150–300 rows; the curated fallback table, shipped as real data)
- **recipes[]** *(app domain)* — `{ id, title, servings, ingredients:[{ ingredient, quantity, unit,
  gtin_candidates:[...], preferred_package }] }`
- **attribution** — keep Primat's `{text,url}` and an OFF/Livsmedelsverket credit string in the payload

### 6.3 Real → mock swap

- Define provider interfaces in the app: `StoreDiscoveryProvider`, `ProductSearchProvider`,
  `PriceProvider`, `NutritionProvider`.
- Two implementations each:
  - **Live**: `PrimatClient` (secret key server-side, or `primat_pk_` from the browser),
    `OpenFoodFactsClient` / cache reader.
  - **Fixture**: `FixtureProvider` reading the JSON above.
- Select via env var, e.g. `DATA_SOURCE=fixture|live` (default `fixture` for the demo and CI).
- **Response shapes must be byte-identical** to the live API. Enforce this with a small recorder
  script (`scripts/capture-fixtures.*`) that calls the live Primat demo + OFF endpoints and writes
  the raw JSON verbatim, so fixtures are real recorded payloads, not hand-authored.
- Keep Primat's `attribution` field flowing through both paths so the UI always renders the credit.
- Never check secret keys into the repo; fixture mode needs no secrets (works from Primat demo tier).

---

## 7. Risks & licensing constraints (Architect + Master must know)

1. **Primat is a single small vendor, "under development".** Schema, data, and pricing "may change";
   the only notification channel is email. No SLA; error codes include `service_unavailable` and
   `history_timeout`. Mitigation: the provider-interface abstraction (§6.3) + our own cache; don't
   let Primat sit uncached in the request path.
2. **Primat licensing — two hard limits:**
   - **No redistribution of the data as a dataset on any tier** — no mirrors, dumps, or re-exposing
     it as our own price API. Our fixture file is a small demo sample for internal dev; do **not**
     publish it as a reusable dataset or ship the full catalog to clients as data.
   - **Free tier = dev/test/personal only + mandatory visible attribution.** A shipped, user-facing
     app must be on **App tier (249 SEK/mo ex VAT)** minimum. Confirm the plan before launch.
3. **Primat has zero nutrition data.** All nutrition is a GTIN join to OFF / Livsmedelsverket — a
   separate reliability + licensing surface. Products without a GTIN get only the generic
   per-ingredient fallback.
4. **ICA & Coop store-level assortment coverage is partial** (many doors are `offers_only`). Basket
   totals and per-store comparisons will be incomplete or campaign-only for those chains in many
   locations. Choose demo city + basket where `full` coverage exists; surface `tier` in the UI so
   users understand gaps.
5. **Open Food Facts ODbL share-alike.** Runtime display with attribution is fine. **Merging OFF
   fields into a database we then distribute may obligate us to open-source that derived DB.** Keep
   OFF data in a separate runtime cache, not fused into a redistributed product table, until legal
   sign-off. Also: OFF images are CC-BY-SA (attribution + share-alike) — avoid or attribute.
6. **OFF rate limits (15/10 req/min/IP)** make live per-request use a non-starter at scale — must use
   the daily export / local mirror + cache. Mandatory custom `User-Agent` with contact email.
7. **Product images:** Primat's `urls.image` conveys **no image rights** (chains' photos). Using them
   in a shipped product is a rights risk. Use GS1 Validoo (licensed) or ship without images.
8. **Livsmedelsverket** CC-BY-4.0 and **USDA FDC** public domain are both low-risk; just carry the
   attribution string. USDA foods are US formulations — prefer Livsmedelsverket for Swedish dishes.
9. **GDPR / location:** the store resolver consumes user coordinates. Keep them client-side, pass
   through without persisting, and don't log precise lat/lon.
10. **Attribution obligations stack:** if we end up on Primat free + OFF + Livsmedelsverket, the UI
    must simultaneously show "Prisdata från primat.nu", "© Open Food Facts contributors (ODbL)", and
    "Källa: Livsmedelsverket". Design for a data-credits area now.

---

## Appendix: verified live demo payload (2026-08-27, `GET /api/v3/demo/products?q=banan`, no key)

Real response inspected by the human. Confirms and refines the findings above.

**Confirmed product shape** (per result):
`chain, store_id, product_id, name, brand (nullable), category (string path OR null),
amount (float), unit ("g"|"ml"|"st"|"kg"|"l"|"m"), package (display string),
available (bool), gtin (nullable), prices{ regular, member (nullable),
multiprice{price,quantity}, member_multiprice{price,quantity},
comparison{price, unit}, offer{price,label,valid_from,valid_until} (nullable), effective },
changed_at, confirmed_at, urls{primat, source}` — note: **no `image` field in the demo payload.**

**Key refinements to the plan:**
- **`amount` is always normalized to a base unit.** "18.5kg" package → `amount: 18500.0, unit: "g"`.
  The mapper trusts `amount`+`unit`, not the `package` string. No label parsing needed for quantity.
  (`package` is display-only; keep it for the UI.)
- **`prices.effective`** is the vendor's resolved price (applies offers / sometimes member price).
  **`prices.regular`** is the shelf price. DECISION NEEDED (engine policy): the basket total should
  use `regular` for a non-member shopper and surface `member`/`offer`/`effective` as
  "potential savings", OR use `effective`. Recommend `regular` as the deterministic default
  (a stranger walking in pays shelf price) with member/offer shown as secondary. This must be
  one explicit, documented rule.
- **Free-text search is NOISY — matches substrings in `name`.** `q=banan` returned real bananas
  plus "Bananschalottenlök" (shallots), "Bananchips", "Bananrulle 6-pack" (pastry), "It's Bananas"
  (a board game, 299 kr), and "Chimpanzini Bananini" (a plush toy, 149 kr). => The ingredient→
  product resolution layer **must** filter by `category` path + plausibility (comparison unit,
  price sanity, amount range) and never blind-pick result #1. This is a first-class engine concern,
  not an edge case. Confirms `[ARCH]`/`[DATA]` risk about ingredient→product mapping.
- **`category` is a chain-specific string path and can be `null`.** Formats vary:
  `"Frukt & Grönsaker > Frukt & bär > Banan"` (Coop), `"Frukt & Grönt > Frukt > Banan"` (ICA),
  `"frukt-och-gront > frukt > bananer"` (Axfood slug style), or `null` (some Willys). The
  category→{FRUKT & GRÖNT, KÖTT & PROTEIN, MEJERI, TORRVAROR, KRYDDOR, ÖVRIGT} normalizer must
  own a per-chain mapping table + a null/unknown → ÖVRIGT fallback. We own this mapping.
- **Variable-weight goods exist and are useful.** Loose fruit/veg/meat: `product_id` often ends
  `_KG`, name contains "ca"/"ca." (cirka), `comparison.unit == "kg"`. For these the recipe can buy
  *exactly* `requiredGrams` priced at `comparison.price` per kg — no package-rounding waste. The
  BasketEngine should detect variable-weight and branch: fixed pack → buy whole packs; variable
  weight → buy exact grams. This materially improves budget realism.
- **Axfood chains share `product_id`** (Willys `2102` and Hemköp `4142` both sell
  `product_id: 100235247_KG`). Cross-store key remains `gtin` where present; `product_id` is only
  unique within a chain (sometimes within a chain group).
- **Store-specific pricing confirmed:** GTIN `7311042004714` = 3.90 kr at Hemköp 4142 vs 3.72 kr at
  Willys 2102. Store selection genuinely affects basket total.
- **The demo endpoint needs no key, no signup.** Base `https://primat.nu/api/v3/demo/…`,
  25 results/call, 250 req/day per IP. Sufficient to (a) record fixtures and (b) run a live demo on
  a modest budget. Free keyed tier is dev-only per ToS; App tier (249 SEK/mo) only needed for a
  genuinely shipped product. Instant key: `POST /api/v3/signup {"email": "..."}`.
- OpenAPI contract is public at `https://primat.nu/api/v3/openapi.json` — the builder should
  codegen or hand-write types from it, not from prose.

---

## Sources

- Primat API docs — https://primat.nu/api
- Primat OpenAPI contract — https://primat.nu/api/v3/openapi.json
- Primat plans & keys — https://primat.nu/data
- Primat terms (villkor) — https://primat.nu/villkor
- Primat live demo — https://primat.nu/api/v3/demo/products , https://primat.nu/api/v3/demo/stores/resolve
- Open Food Facts API docs — https://openfoodfacts.github.io/openfoodfacts-server/api/
- Open Food Facts data / exports — https://world.openfoodfacts.org/data
- Open Food Facts API reuse conditions — https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse
- Open Food Facts Sweden — https://se-en.openfoodfacts.org/
- Livsmedelsverket open data / food composition — https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data/
- Livsmedelsverket data portal (Swagger) — https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html
- USDA FoodData Central API — https://fdc.nal.usda.gov/api-guide.html
- Nominatim usage policy — https://operations.osmfoundation.org/policies/nominatim/
