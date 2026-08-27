# Product / UX Plan — PLAN → SHOP → COOK

_Owner: Product/UX specialist. Status: planning handoff v1. Date: 2026-08-27._

Scope: demo-oriented MVP, Swedish-language UI, SEK, km, mobile-first. Small surface,
exceptional execution. This document is normative for screens, states, and copy intent;
exact visual language is owned by Art Direction.

---

## 0. Product principles that drive UX decisions

1. **One journey, three rooms.** PLAN, SHOP, COOK are the *same* plan seen through three
   lenses. Never a wizard restart, never a re-fetch, never a new "session". The plan object
   is created once in PLAN and only *annotated* (checked items, completed steps) afterwards.
2. **Hard constraints are hard.** Budget, cooking time, and distance are contracts. The UI
   either satisfies them or explicitly, loudly says it could not — with the reason and a
   choice. There is no third option.
3. **No fake precision.** Every number is labeled with its provenance strength. Prices from
   store data are exact. Nutrition is estimated per-ingredient and labeled as `ca` (cirka).
   Distance is `ca X,X km`. Never render a decimal the data cannot support.
4. **Purchase quantity ≠ recipe quantity.** The user buys packages; the recipe uses grams.
   Both are always visible, and surplus is named, not hidden.
5. **Phone-in-hand ergonomics beat density.** SHOP and COOK are used one-handed, in a cold
   store or over a hot pan. Tap targets ≥ 48px, thumb-reachable primary actions, no
   horizontal scroll, no modal that traps a wet finger.

---

## 1. Refined user journey

### 1.1 Journey map

```
[Start]
  → PLAN/input      "Vad vill du äta?"        structured controls + free text
  → PLAN/generating staged progress narration  (cancellable)
  → PLAN/result     the recommendation        primary CTA: "Gör till handlingslista"
  → SHOP            checkable grocery list     primary CTA: "Börja laga"
  → COOK/steps      sequential large-type      primary CTA: "Nästa steg" → "Klar!"
  → COOK/summary    what you made, cost, macro, "Planera nästa måltid"
```

Back navigation is always available and lossless: SHOP → PLAN returns to the *same result*,
not the form. COOK → SHOP returns with checkmarks intact. Forward state is preserved for the
session (see §2.5 persistence).

### 1.2 PLAN — screen 1: input (`/`)

Single screen. No multi-step wizard — the demo must reach a result in one submit.

Layout order (mobile, top to bottom):

| # | Element | Control type | Default | Notes |
|---|---|---|---|---|
| 1 | Headline + one-line value prop | static | — | "Beskriv måltiden. Vi handlar och lagar." |
| 2 | **Budget** | structured — slider **and** numeric input, snapping to 10 kr | 250 kr | Range 50–800 kr. Label: "Budget (totalt)". Live derived caption: "≈ 62 kr/portion" |
| 3 | **Portioner** | structured — stepper `− 4 +` | 4 | Range 1–8. Stepper, not a dropdown: one tap to adjust |
| 4 | **Max tillagningstid** | structured — segmented chips: 15 / 30 / 40 / 60 / 90+ min | 40 min | Chips, not a slider — time is categorical in users' heads |
| 5 | **Max avstånd till butik** | structured — segmented chips: 1 / 2 / 5 / 10 km | 2 km | Paired with the location row below |
| 6 | **Plats** | derived + editable — "Använd min plats" button, or postcode/address text field | prompt for geolocation | Shows resolved label: "Södermalm, Stockholm". Never blocks submit; see §3.1 |
| 7 | **Fritext-önskemål** | free text, multiline, 3 rows, ~200 char soft cap | empty | Placeholder = the demo scenario. Label: "Vad är du sugen på?" |
| 8 | Example chips (tap to fill free text) | 3–4 preset chips | — | "Fräscht & asiatiskt", "Trösteftermat", "Högt protein", "Vegetariskt" — tapping *appends* to free text, does not replace |
| 9 | **Skafferi (valfritt)** | collapsed accordion, multi-select chips of ~12 common staples | collapsed, none selected | "Jag har redan hemma": salt, peppar, olja, smör, ris, pasta, soja, vitlök, lök, ägg, mjöl, socker |
| 10 | Primary CTA | button, full-width, sticky at bottom on mobile | enabled always | **"Hitta min måltid"** |

**Structured vs. free text — the rule:** anything the deterministic engine must *check* is a
structured control (budget, portions, time, distance, location, pantry). Anything only the
LLM interprets is free text (cuisine, mood, texture, protein preference, dislikes,
allergies-as-phrasing). Rationale: a hard constraint parsed out of prose is a hard constraint
we can silently get wrong.

**Allergies:** MVP treats them as free text only, and the result screen shows an explicit
disclaimer chip when the free text matches allergy-like language (see §3.11). We do not claim
allergen safety.

**Advanced (behind "Fler val", collapsed):** diet toggle chips (Vegetariskt / Veganskt /
Fläskfritt / Glutenfritt-önskemål), and "Tillåt att gå över budget" (default OFF). These are
present but visually de-emphasized; the demo path never opens this.

### 1.3 PLAN — screen 2: generating (`/plan/genererar`)

Not a spinner. A **narrated pipeline** that doubles as the product's proof of work — this is
where the "more than an LLM" claim is made visible. 4 stages, each with its own line, ticked
as it completes:

```
✓ Tolkar din önskan            "fräscht, kryddstarkt, asiatiskt, högt protein"
✓ Hittar butiker inom 2 km     3 butiker hittade
● Väljer produkter             ICA Kvantum Södermalm · 1,2 km
○ Bygger recept & räknar
```

- Stage 3 reveals the chosen store as soon as it's known — the reveal is a moment, not a
  loading detail.
- Total budget target: **< 12 s**. If a stage exceeds 6 s, swap its caption for a reassurance
  line ("Jämför priser på 40+ produkter…").
- **Cancellable** — a subtle "Avbryt" returns to input with all fields preserved.
- Skeleton of the result card fades in beneath the pipeline so the transition is continuous.

### 1.4 PLAN — screen 3: result (`/plan/[id]`)

The most important screen in the product. Full IA in §2.2. Ends with a sticky bottom bar:

- Primary: **"Gör till handlingslista"** → SHOP
- Secondary (text button): **"Ge mig ett annat förslag"** → re-runs generation with an
  exclusion of the current recipe; max 3 regenerations per session (then: "Justera dina val
  för fler förslag" pointing back to input).
- Tertiary (icon): "Ändra önskemål" → input, prefilled.

### 1.5 Transition PLAN → SHOP

Explicit and celebratory-but-fast. On tap: the basket-total row animates into the SHOP header
progress bar (shared element), route changes to `/handla/[id]`. The plan is **frozen** at
this moment: prices, products, and quantities are snapshotted into the shopping list so a
background data refresh can never mutate a list the user is standing in a store with. If the
user goes back and regenerates, a *new* plan id is created.

### 1.6 SHOP (`/handla/[id]`)

Single scrolling screen, section-grouped.

Top (sticky, compact — max ~92px):
- Store name + distance + "Öppet till 22:00" if known → tapping opens maps deep link.
- **Progress**: `7 av 12 varor · 168 kr av 250 kr` with a horizontal progress bar.
- The running total counts **checked items only** — it climbs as you shop. The plan total
  stays visible as the denominator. This is the core SHOP delight mechanic.

Body: sections in **physical store-walk order**, not alphabetical:
`FRUKT & GRÖNT → KÖTT & PROTEIN → MEJERI → TORRVAROR → KRYDDOR → ÖVRIGT`

Each item row:
```
[ ]  Kycklingfilé, färsk                          89,90 kr
     ICA Basic · 700 g  ·  1 förp.
     Receptet använder 600 g · 100 g över
```
- Line 1: product display name (bold) + price for the quantity bought (right-aligned).
- Line 2: brand · package size · purchase quantity.
- Line 3 (conditional, muted): recipe usage vs. surplus — only when they differ.
- Whole row is the tap target; checkbox is a large left affordance, not a small square.
- Checked state: strikethrough name, reduced opacity, row **animates down to the bottom of
  its own section** (not out of the list — the user must be able to un-check).

Pantry items: rendered in a separate final section **"HAR DU HEMMA"**, pre-checked, muted,
not counted in the total or the progress denominator, with the label "Räknas inte in i
priset". Never mixed into buy sections.

Utility row above the sections: "Visa alla" / "Visa kvar att handla" filter toggle, and a
text button "Ändra planen" → back to PLAN result.

Bottom sticky CTA: **"Börja laga"**.
- Enabled always (people cook with substitutions).
- If unchecked items remain, tapping opens a lightweight confirm sheet: "3 varor är inte
  ibockade. Börja laga ändå?" → [Fortsätt handla] [Börja laga]. One sheet, no nagging.

### 1.7 Transition SHOP → COOK

Direct route change to `/laga/[id]` with a brief full-bleed intro card (~1.5 s, tap to skip):
recipe name, portions, total time, "X steg". This resets the user's posture from scanning to
following.

### 1.8 COOK (`/laga/[id]`)

**One step per screen.** No scrolling between ingredients and instructions — each step
carries everything it needs.

Step screen anatomy (top to bottom):
1. Thin progress bar + `Steg 3 av 7` (small, top).
2. **Ingredients for this step only** — a compact card: `600 g kycklingfilé · 2 msk soja ·
   1 vitlöksklyfta`. Amounts already scaled to the chosen portions.
3. **The instruction** — the hero. Large type (≥ 22px mobile, targeting ~28px), max ~2
   sentences, imperative Swedish. This is the largest text on the screen.
4. **Inline timer** when the step contains a duration: a pill "⏱ 8 min" that starts on tap,
   counts down in place, and continues running while the user advances steps (a persistent
   mini-timer docks to the top bar). Completion = vibration + sound + visual pulse. Multiple
   concurrent timers allowed (max 3), stacked in the dock.
5. Temperatures/visual doneness cues rendered as emphasized inline text, never buried.
6. Bottom sticky: **"Nästa steg"** primary, "Föregående" as a back affordance.

Global COOK affordances:
- **Skärmen släcks inte** — wake lock on, with a small persistent indicator so it's
  understood and trusted.
- "Alla ingredienser" — a bottom-sheet with the full scaled ingredient list, reachable from
  any step, one tap to dismiss. Escape hatch only; the default path never needs it.
- Swipe left/right also advances/retreats steps (buttons remain the primary affordance).

Last step's CTA is **"Klar!"** → summary.

### 1.9 COOK — summary (`/laga/[id]/klar`)

- "Smaklig måltid!" + recipe name.
- Recap tiles: total cost, kr/portion, kcal & protein per portion, actual time bucket.
- "Budget: 231 kr av 250 kr — 19 kr kvar" restated as the closing proof.
- CTAs: **"Planera nästa måltid"** (primary, → PLAN input, fields preserved) and
  "Spara måltiden" (secondary; MVP = localStorage only, see §5).

---

## 2. Information architecture

### 2.1 Cross-mode header identity

Each mode is visually distinct (Art Direction owns the palette shift) but shares a persistent
3-step progress indicator: `PLAN — HANDLA — LAGA`, current step emphasized, completed steps
tappable. This is the single element that makes it read as one journey. It is *not* a nav
bar; you cannot jump to LAGA before a plan exists.

### 2.2 PLAN result — making BUDGET→STORE→PRODUCTS→RECIPE→NUTRITION legible

The screen must answer, in reading order, five questions: *What am I making? Why this? Where
do I buy it? What exactly, for how much? What does it do to my body?* Order and weight:

**Block A — The verdict (hero).**
- Recipe name, large.
- One-line AI rationale, 1–2 sentences, in the user's own vocabulary: *"Fräsch och rejält
  kryddstark wok med hög proteinhalt — klar på 32 minuter och 19 kr under din budget."*
- **Constraint chip row** — the single most important IA element. Four chips, each showing
  the hard constraint and its actual value, each green/pass or amber/fail:
  `✓ 231 kr / 250 kr` `✓ 32 min / 40 min` `✓ 1,2 km / 2 km` `✓ 4 portioner`
  This row is the deterministic engine speaking directly to the user. It appears *above* the
  fold, before any product detail. Tapping a chip scrolls to the block that explains it.

**Block B — Budget bar.** A single horizontal bar: filled = basket total, remainder labeled
**"19 kr kvar"**. Under it, `58 kr per portion`. This is the budget→everything anchor.

**Block C — Store.** One card: store name, chain logo/mark, `1,2 km · ca 15 min gång`,
address, and (if known) opening hours. Secondary text: **"3 butiker inom 2 km — vald för
bäst pris på din korg"** or "…närmast" depending on selection reason. The reason must be
stated; a silently chosen store is a trust hole. Tapping expands the other candidate stores
with their basket totals — this is a cheap, very high-value proof of real data.

**Block D — Products (the basket).** Grouped by the same six store sections used in SHOP, so
the mapping to SHOP is 1:1 and learned once. Each row: name, package size, qty, line price.
Section subtotals right-aligned; grand total in a heavier row at the bottom. Pantry items
shown as a muted trailing group, `0 kr`, labeled "har du hemma".

**Block E — Recipe.** Cooking time, portions, difficulty, step count, and the *first three
step titles* as a preview. Full instructions are deliberately **not** here — they live in
COOK. This preserves the mode separation and keeps the result screen scannable.

**Block F — Nutrition.** A two-column table, **per portion** as the primary column (left,
heavier) and **totalt** secondary (right, muted). Rows: kcal, protein, kolhydrater, fett.
Protein is emphasized when the user asked for high protein — the table highlights whichever
macro the free text mentioned. Footnote, always: *"Näringsvärden är uppskattade utifrån
produktdata och avser tillagad portion."*

Ordering rationale: constraint verdict → money → place → things → process → body. Money and
place before products because they are the *filters* that produced the products; putting the
basket first would read as an arbitrary list.

### 2.3 SHOP hierarchy

Primary: checkbox state + product name. Secondary: price. Tertiary: package/qty/surplus.
Ambient: store, progress, running total. Everything analytical (nutrition, rationale, recipe)
is *absent* from SHOP — it is one tap away via "Ändra planen" and nothing more.

### 2.4 COOK hierarchy

Primary: the instruction sentence. Secondary: this step's quantities. Tertiary: timer,
step counter. Absent: price, store, nutrition, full ingredient list (behind a sheet). COOK
shows nothing the hands don't need.

### 2.5 State & persistence

- Plan is a server-side object with an id; the URL is shareable within the session.
- Check state (SHOP) and step progress (COOK) persist in `localStorage` keyed by plan id, so
  a phone lock / accidental refresh mid-store loses nothing. This is the one place we must
  not be stateless.
- Prices are snapshotted at PLAN→SHOP and never re-fetched for that plan.

---

## 3. Edge cases & states

Format: **trigger → what the UI shows**. Every failure state must name what failed, what the
app did about it, and give exactly one obvious next action.

### 3.1 Missing / denied location
Do not block. Fall back in order: (1) browser geolocation, (2) manual postcode field,
(3) **demo default: Stockholm, Södermalm (11857)** with a visible chip "Plats: Södermalm
(standard) — Ändra". Never fail generation for lack of location.

### 3.2 No store within max distance
PLAN result is **not** rendered. Instead a decision screen: *"Ingen butik inom 2 km."*
Two options, both explicit, no auto-relaxation:
`[Utöka till 5 km — närmaste butik är 3,4 km]` and `[Byt plats]`.
The distance constraint is never quietly widened.

### 3.3 Over budget — the strategy ladder
The engine attempts, in order, and the UI reports which rung it landed on:
1. **Substitute product** — cheaper equivalent (private label, larger unit price, frozen for
   fresh where the recipe tolerates it).
2. **Adjust recipe quantities** — reduce the expensive ingredient within the recipe's stated
   tolerance, never below a sensible portion.
3. **Regenerate candidate** — a different recipe entirely.
4. **Show over budget, honestly.**

- Rungs 1–2 succeed → result renders as normal **plus** an informational chip under the
  budget bar: *"Bytte till ICA Basic kycklingfilé för att hålla budgeten (−24 kr)"*.
  Tappable → shows what was swapped from/to. Never silent.
- Rung 3 succeeds → normal result; no special messaging needed beyond the rationale line.
- Rung 4 → the constraint chip goes amber: `⚠ 268 kr / 250 kr — 18 kr över`, the budget bar
  renders an over-fill segment, and a banner sits above Block B: *"Vi hittade ingen kombination
  inom 250 kr. Det här är det billigaste förslaget — 18 kr över."* CTAs:
  `[Höj budgeten till 270 kr]` `[Färre portioner]` `[Prova ett annat förslag]`.
  The primary CTA "Gör till handlingslista" stays enabled — the user is allowed to accept an
  over-budget plan, but only by seeing it.

### 3.4 Very tight budget (e.g. 80 kr / 4 pers)
Detect pre-generation: if kr/portion < ~25, show an inline (non-blocking) hint under the
budget control: *"~20 kr/portion är tajt — förslagen blir enkla."* Generation still runs.
If nothing at all is feasible, use the 3.2-style decision screen with
`[Höj budgeten]` `[Färre portioner]` `[Ta bort tidsgränsen]` and a stated minimum:
*"Minsta genomförbara budget för 4 portioner här är ca 140 kr."*

### 3.5 Very generous budget (e.g. 600 kr / 2 pers)
Never spend the budget just because it exists. Show the underspend as a *positive*:
`✓ 214 kr / 600 kr` and a rationale line naming the upgrade choice: *"Vi valde färsk lax och
färska örter eftersom budgeten tillät det."* Do not pad the basket. Optional secondary CTA:
"Uppgradera råvarorna" (out of MVP scope — see §5).

### 3.6 OpenAI down / LLM error / malformed output
Never show a raw error. Screen: *"Vi kunde inte tolka din önskan just nu."* + `[Försök igen]`
(retries once automatically before showing this) + `[Använd ett färdigt förslag]` which loads
the demo scenario's cached plan. Free-text input is preserved. If the LLM returns a recipe
that fails schema validation, retry once with a repair prompt, then fall back to a
deterministic recipe template from the fixture set, labeled internally but **not** to the
user (it is a real recipe, just not freshly generated).

### 3.7 Grocery API down / store data unavailable
Distinguish loudly from LLM failure, because the value prop is real data.
*"Vi når inte butiksdatan just nu."* + `[Försök igen]` + `[Visa demoläge]`.
**Demoläge** renders the fixture dataset with a persistent, unmissable banner:
*"Demoläge — priser och produkter är exempeldata, inte live butiksdata."* The banner rides
through SHOP too. We never present fixtures as live data.

### 3.8 Unavailable / out-of-stock product
- At PLAN time: never selected.
- Discovered between PLAN and SHOP: the item row in SHOP shows a `Slut i butik` badge, an
  alternative product suggested inline with its price delta (`+6 kr`), and a one-tap
  `[Byt till denna]` that updates the row and the running total. The plan total updates and
  the change is logged into the budget chip.
- No alternative: the item is marked `Hoppa över` with a note on which recipe step is
  affected, and COOK's affected step gets an inline caution line.

### 3.9 Missing nutrition data
Never invent it. Per-item: if an ingredient's macro data is absent, the nutrition table shows
the totals with a footnote *"Näringsvärden saknas för 1 produkt (färsk koriander) och ingår
inte i summan."* If > 30% of the basket's mass lacks data, suppress the numeric table
entirely and show *"Näringsvärden kan inte beräknas tillförlitligt för den här måltiden."*
Suppressing beats guessing.

### 3.10 Pantry items already owned
Selected in PLAN input → excluded from basket total and from the budget check → shown in PLAN
Block D as a muted `har du hemma` group → shown in SHOP as a separate pre-checked section
excluded from progress. If a pantry-marked item is needed in an amount the user plausibly
lacks (e.g. 300 ml olja), still exclude it but flag: *"Behövs i större mängd — kolla hemma."*

### 3.11 Unusual / unparseable NL preference
Two cases, both handled by **echoing the interpretation back**:
- Parsed fine → the result's rationale line quotes the user's own terms so they can verify.
- Partially unparseable (e.g. "något som smakar som min mormors kök") → the result renders
  normally, plus an interpretation chip: *"Vi tolkade det som: husmanskost, mustigt,
  långkok."* with `[Inte riktigt? Justera]`. The user always sees the interpretation before
  trusting the output.
- Contradictory constraints ("vegetariskt, mycket kött") → decision screen naming the
  conflict, asking which wins. Do not guess.
- Allergy-like language detected → an amber chip on the result: *"Vi kan inte garantera
  allergiinformation. Kontrollera alltid förpackningen."* Non-dismissible for that plan.

### 3.12 Portions: 1 vs many
- **1 portion**: package sizes dominate the basket (you cannot buy 150 g of chicken). The
  surplus line becomes primary, not conditional, and PLAN shows a summary line:
  *"Du får ca 2 portioner råvaror över — receptet skalar till 3 portioner."* Offer
  `[Laga 2 portioner istället]` as an inline suggestion. This is honest and genuinely useful.
- **6–8 portions**: check that cooking time is still feasible at scale; if the recipe's time
  scales past the constraint, the time chip must reflect the *scaled* time, not the base
  recipe's.

### 3.13 Loading & empty states
- PLAN input: no empty state — it *is* the entry.
- PLAN generating: §1.3 narrated pipeline. Never a bare spinner.
- SHOP: cannot be empty (a plan always has items). If all items are pantry: show a friendly
  "Du har redan allt hemma!" and jump the CTA straight to "Börja laga".
- COOK: cannot be empty. If a step fails to render, skip it and log; never show a blank step.
- Slow network in-store: SHOP is fully client-side after load (snapshotted) — it must work
  offline. State this in the UI once: a subtle "Listan fungerar utan uppkoppling" on first
  entry.

### 3.14 Session / plan expiry
Plans live for the session + localStorage. On opening a stale plan id (> 24 h), show a banner
*"Den här planen är från igår — priser kan ha ändrats."* with `[Uppdatera priser]`. Do not
auto-refresh a list someone might be shopping from.

---

## 4. Mobile-first usability notes

**Global**
- Design at 390×844 first; desktop is a centered ~480px column with generous margins, not a
  different layout. No responsive redesign work in MVP.
- Every primary CTA is a full-width sticky bottom button inside the thumb zone; nothing
  critical in the top corners.
- Minimum tap target 48×48; item rows in SHOP ≥ 64px tall.
- Type scale floor: 16px body (prevents iOS input zoom), 17–18px for SHOP item names,
  22–28px for COOK instructions.
- Contrast ≥ 4.5:1 for all text, ≥ 3:1 for the checked/unchecked distinction — a grocery
  store's lighting and a phone at 30% brightness are the real conditions.
- No hover-dependent affordances anywhere.
- Motion: respect `prefers-reduced-motion`; the check animation and step transitions have
  static fallbacks.

**PLAN specific**
- The budget slider must also be a tappable number field — sliders are imprecise with a thumb.
- Free-text field must not be the last element above the fold; the CTA should be visible
  without dismissing the keyboard. Sticky CTA sits *above* the keyboard on focus.
- Autofocus nothing on load — an unbidden keyboard hides the whole form.

**SHOP specific (highest-stress context)**
- One-handed: checkboxes on the **left** but the whole row tappable, so either thumb works.
- No swipe-to-delete (accidental in a moving cart); un-check is the only reversal.
- Haptic feedback on check (`navigator.vibrate(10)` where supported) — confirmation without
  looking.
- Sticky section headers while scrolling so the user always knows which aisle they're in.
- The running total must never require scrolling to see. It is the sticky header's job.
- Works offline after load; no action requires a round-trip except the 3.8 substitution.

**COOK specific**
- Screen wake lock, mandatory.
- Large type, high contrast, short lines (≤ 45 chars) — readable at arm's length across a
  counter.
- Timers must survive backgrounding: store start timestamps, recompute on resume, and fire a
  notification if permission was granted.
- Advance controls are big and at the bottom — reachable with a knuckle when hands are messy.
- No destructive action reachable by mistap; "avsluta" requires confirmation.

---

## 5. MVP scope cut list

**Explicitly NOT building for the demo:**

| Cut | Why |
|---|---|
| Accounts, auth, user profiles | Session + localStorage covers the demo; auth is pure cost |
| Saved recipes / history / favorites | "Spara måltiden" writes to localStorage and lists nowhere in MVP; cut the whole library |
| Multi-store baskets (split shopping) | Doubles routing and pricing complexity; one store per plan |
| Real-time stock levels | Data likely unavailable; handled as §3.8 exception, not a feature |
| Price comparison as a first-class feature | Only the expandable "other stores" list in Block C |
| Weekly meal planning / multiple meals | Single meal is the whole story |
| Recipe editing, ingredient swapping by the user | Regenerate is the only lever; per-item swapping only in the out-of-stock flow |
| Scaling portions *after* generation | Portions are fixed at PLAN; change = regenerate |
| Photos of finished dishes / step photos | No trustworthy image source; illustration/typography carries it instead |
| Voice input, voice-guided cooking | Delightful, out of scope |
| Native app, PWA install prompt, push notifications | Web only; local timer notifications only if free |
| Nutrition beyond kcal/protein/carbs/fat | No fiber, sodium, micronutrients — data quality won't support it |
| Allergen certification / diet guarantees | Explicitly disclaimed (§3.11), never claimed |
| Sharing a plan / collaborative shopping | No multi-user state |
| Internationalization | Swedish only, SEK only, no locale switch |
| Dark/light toggle | Art Direction picks one committed look |
| Analytics dashboards, admin tooling | Log to console/server only |

**The default demo scenario that must always work flawlessly:**

> **"250 kr, mat för fyra, max 40 min, något fräscht, kryddstarkt och asiatiskt-inspirerat,
> gärna högt protein"** — location Södermalm, Stockholm; 2 km; pantry: salt, peppar, olja,
> ris, soja.

Requirements on this scenario:
- Fully cached / fixture-backed fallback so it renders **without any network call** if
  everything upstream fails.
- Lands comfortably **under** budget (target ~225–240 kr) so the "19 kr kvar" moment is real.
- Cooking time lands ~30–35 min against a 40 min constraint — passing, not scraping.
- Chosen store is a real, recognizable Stockholm store at ~1–2 km.
- Basket of 10–13 items spanning **at least four** of the six store sections, so SHOP's
  grouping is visibly doing work.
- Recipe is 6–8 steps with **at least two timed steps**, so COOK's timer is demonstrated.
- Protein ≥ 35 g/portion, so the "högt protein" request is visibly honored in Block F.
- Every number on screen must reconcile: section subtotals sum to the basket total; recipe
  quantities ≤ purchased quantities; per-portion macros × portions = totals. A reviewer
  *will* check this with a calculator.

Rehearse this exact path before every demo. Any change that breaks it is a P0.

---

## 6. Open questions

**For the Software Architect**
1. Is the plan a persisted server object with a real id, or session-only? SHOP/COOK deep
   links and the §3.14 expiry banner assume an id exists.
2. Where does the price snapshot live at PLAN→SHOP — server-side frozen record, or client
   payload? Offline SHOP (§3.13) requires the full list client-side.
3. Can we stream the generation pipeline (SSE) so §1.3's stage ticks are real progress rather
   than a timed animation? Real staging is a meaningfully better demo.
4. Timer persistence across backgrounding — is a service worker in scope, or do we recompute
   from timestamps only? (I've assumed timestamps only.)
5. Regeneration budget: is "ge mig ett annat förslag" a full re-run, or can we generate N
   candidates in one pass and page through them client-side? The latter is far better UX and
   caps cost.

**For the AI / Prompt Architect**
6. What exactly is the LLM's output contract? I'm assuming: interpreted-preferences object +
   recipe (steps, per-step ingredient refs, per-step durations) + ingredient list in *grams/
   units*, and it never emits prices, package sizes, or macros.
7. Can the model reliably emit **per-step ingredient attribution** (which quantities belong to
   which step)? COOK's "no scrolling between list and instructions" depends entirely on this.
8. Can it emit a machine-readable interpretation echo for §3.11 ("we read this as: …") and a
   confidence signal for when to show the "Inte riktigt?" affordance?
9. Ingredient tolerance metadata: can a recipe declare which ingredients are substitutable /
   reducible, to power budget-ladder rungs 1–2 (§3.3) without the LLM re-running?
10. Does the model produce Swedish instruction copy directly, or English-then-translate?
    (Direct Swedish, please — translated cooking copy reads wrong.)
11. Latency budget per call — how many LLM round-trips is the pipeline, and can we hit < 12 s?

**For the API / Data specialist**
12. Does Primat expose: product name, brand, package size + unit, price, store id, section/
    category, and nutrition per 100 g? Which of these are actually populated in practice?
13. Nutrition coverage rate — what % of products carry macros? This decides whether §3.9's
    suppression rule fires on the demo scenario.
14. Is there a mapping from product category → the six Swedish store sections, or must we
    build and maintain that mapping ourselves?
15. Store data: do we get geocoordinates, address, and opening hours? Opening hours appear in
    SHOP's header and can be cut if unavailable.
16. Stock/availability signal: exists at all? If not, §3.8 is dead code and should be cut.
17. Are prices per-store or chain-level? Block C's "3 butiker — vald för bäst pris" claim is
    only honest if prices genuinely vary per store.
18. Unit-price data (kr/kg) — available? It would strengthen budget-ladder rung 1 and could
    surface as a tertiary line in SHOP.
19. What's the realistic latency and rate limit for a product search across ~15 ingredients ×
    3 stores? This sizes the whole PLAN pipeline.
