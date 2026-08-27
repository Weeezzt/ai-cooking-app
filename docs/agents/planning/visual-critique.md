# Visual Critique — "Midnight Supermarket Editorial"

_Owner: Visual Critic. Status: adversarial review of `visual-direction.md` v1, cross-read against
`product-ux.md` v1. Date: 2026-08-27. No application code proposed._

---

## 0. Verdict

### Does this look AI-generated?

**No — not in the way the requirement means it.** This direction is mechanically inoculated
against the 2024-era AI-SaaS look. The inoculation is structural, not cosmetic: shadows are
*removed from the token set* rather than discouraged, radius is reset to `0` globally with an
exhaustive two-item exception list, separation is assigned to rules/background-shift/inversion,
and the smell tests are greppable. A model asked to produce "a modern dashboard" cannot
accidentally land here. That is a genuine achievement and most of this document should survive.

**But there are two honest qualifications, and the second is the more serious one.**

**(a) It trades one template for another.** Near-black ground + zero radius + uppercase mono
micro-labels + a single hot yellow accent + hairline rules is not a neutral space in 2026. It is
the *other* current default — the dev-tool/brutalist-editorial dark look. Asked for "not generic
AI SaaS," a model in 2026 produces roughly this. Recognisable-with-logos-removed is the stated
bar, and against that bar the current spec is recognisable as *a genre*, not as *this product*.
The direction's strongest genuinely-uncommon assets are underplayed (see BLOCKER-1 and
CONSIDER-1): the paper-white inversion, and the numeral-as-ornament policy.

**(b) The AI-SaaS look re-enters through the components the document does not specify.** The
spec covers five components. The product needs roughly eighteen. Every unspecified one — the
entire PLAN input screen, the generating pipeline, bottom sheets, banners, the summary tiles —
is a place where an implementer falls back to defaults, and the defaults are rounded, padded,
shadowed boxes. `product-ux.md` even names three of them "card" (§2.2 Block C: *"One card"*;
§1.7 *"intro card"*; §1.9 *"Recap tiles"*). As written, the last screen of the demo is a card
grid and Smell 1 fires on it. This is the single highest-probability failure path and it is not
a hypothetical — it is what the two documents currently instruct.

### Overall: **APPROVE WITH CHANGES**

The concept is sound and the mechanism is real. The changes below are corrective, not a rework:
three blockers (mobile viability, spec coverage, cross-document contradictions), nine
should-fixes, six considerations. Nothing here asks for more decoration; most of it asks the
direction to commit harder to what it already believes.

---

## 1. BLOCKERS

### BLOCKER-1 — The identity is specified at desktop widths. The product is a 390px phone.

This is the most important finding in the review.

`product-ux.md` §4: *"Design at 390×844 first; desktop is a centered ~480px column with generous
margins, not a different layout. No responsive redesign work in MVP."* SHOP and COOK are
explicitly one-handed, in-store, over-a-pan contexts.

Now audit what carries the identity at 390px:

| Identity carrier | Exists at 390px? |
|---|---|
| PLAN's asymmetric 7/5 or 8/4 editorial split | **No** — 12-col grid starts at `md` (904px). Collapses to one column. |
| SHOP's 560px paper strip on a dark ground | **No** — 390 − 32 margin = 358px. The "strip on a counter" is edge-to-edge; there is no counter. |
| SHOP's 320px total/store rail | **No** — `lg` only. |
| COOK's 720px column | **No** — same width as SHOP. |
| Three distinct mode grounds | **Barely** — `#0B0D0C` / `#070908` / `#131614` differ by ~1–3% luminance. On a phone at 30% brightness in a supermarket, these are one colour. |
| Full-range type scale (§2.1) | **No** — see below. |
| Images bleeding past the margin | Partially, but at 390px "bleed to viewport edge" is just "full width," which is the default, not a move. |

**The type scale collapses too.** Every large token is a `clamp()` whose *minimum* governs at
390px, because 5vw = 19.5px, 8vw = 31.2px, 14vw = 54.6px — all below their floors:

| Token | Desktop (1440px) | Mobile (390px) |
|---|---|---|
| `--t-h4` | 24 | 24 |
| `--t-h3` | 32 | 32 |
| `--t-h2` | 52 | **36** |
| `--t-h1` | 76 | **48** |
| `--t-display` | 132 | **72** |

Desktop: 24 → 32 → 52 → 76 → 132. Genuinely violent, exactly as claimed.
Mobile: 24 → 32 → **36** → 48 → 72. The h3→h2 jump is **1.13×**. That is not editorial contrast;
that is a bunched modular scale. §2.1's central claim — *"the jumps between h3 and h1 are
deliberately violent"* — is true only on the viewport the product will not ship.

Net: on the target device, the direction reduces to *type on near-black with hairline rules and a
yellow accent*. That is the genre, not the identity.

**Correction (concrete):**

1. **Rewrite §2.1 mobile-first with fixed steps, and delete a level.** Editorial contrast comes
   from *fewer sizes, further apart*. At 390px use four display-ish steps, not five:
   `--t-h3: 26` / `--t-h1: 44` / `--t-display: 68` and drop `--t-h2` entirely below `md`
   (h2 becomes h3 with a `--rule-heavy`, which is more editorial anyway). Ratios become
   1.7× and 1.55× instead of 1.13×. Express as `clamp(mobile-value, vw, desktop-value)` where
   the *mobile value is the designed one* and the clamp scales up, not a desktop value clamped
   down.
2. **Name a mobile substitute for the asymmetric split.** The 7/5 split is unavailable; the
   editorial device that survives at 390px is the **hanging indent / offset baseline**: label
   column at a fixed `--s-14` (56px) left inset with the rule running full-bleed *underneath
   both*, so text sits in two optical columns inside one physical one. Specify it, or PLAN has
   no compositional identity on mobile.
3. **Make the mode grounds differ by something perceptible on a phone.** Three near-blacks 3%
   apart do not qualify. See CONSIDER-3 for the strong option; the minimum acceptable version is
   that at least one mode changes *material*, not luminance.
4. **All three smell tests must be run at 390×844**, not on a desktop screenshot. Currently
   unstated, and a desktop screenshot would pass every test while the shipped product fails.

### BLOCKER-2 — Five components specified, ~eighteen needed. The gaps are exactly where the AI look re-enters.

§5 specifies: product row, nutrition panel, SHOP row, COOK step, buttons. Cross-referencing
`product-ux.md`, the following are load-bearing, appear in the demo path, and have **zero**
visual specification:

| Missing component | Source | Default failure mode |
|---|---|---|
| Budget slider + numeric field | UX §1.2 #2 | Native `input[type=range]`: rounded track, round thumb, iOS shadow |
| Portions stepper `− 4 +` | UX §1.2 #3 | Rounded pill group with icon buttons |
| Segmented chips (time, distance, diet, examples) | UX §1.2 #4,5,8; Advanced | **`9999px` pills** — explicitly banned, and there are ~15 of them on screen 1 |
| Text input / textarea / accordion | UX §1.2 #7,9 | Rounded, bordered, focus-glow |
| Location row + "Använd min plats" | UX §1.2 #6 | Icon + pill |
| Generating pipeline (4 staged lines) | UX §1.3 | Spinner, or a rounded progress card |
| `PLAN — HANDLA — LAGA` journey indicator | UX §2.1 — *"the single element that makes it read as one journey"* | Rounded stepper with circles and connecting lines |
| Constraint chip row (4× ✓/⚠) | UX §2.2 Block A — *"the single most important IA element"* | Four green rounded pills |
| Budget bar + over-fill segment | UX §2.2 Block B, §3.3 rung 4 | Rounded progress bar |
| Store block | UX §2.2 Block C — *"One card"* | A card |
| Banners: demoläge / offline / stale plan / allergy | UX §3.7, §3.13, §3.14, §3.11 | Tinted rounded box with an icon |
| Bottom sheets (SHOP confirm, COOK "Alla ingredienser") | UX §1.6, §1.8 | 16px top radius + a rounded drag handle. Universally. |
| Timer dock (up to 3 concurrent) | UX §1.8 #4 | Floating rounded pills — the UX doc literally says *"a pill"* and uses an emoji ⏱ (banned by Smell 3) |
| SHOP→COOK intro card (1.5s) | UX §1.7 | A card |
| COOK summary "recap tiles" | UX §1.9 | **A responsive card grid.** Smell 1 fires on the final screen of the demo. |
| Section subtotals / grand total row | UX §2.2 Block D | — |
| Out-of-stock row variant + swap CTA | UX §3.8 | Badge pill |
| Pantry group ("HAR DU HEMMA") | UX §3.10 | — |

The direction's discipline is only as strong as its coverage. A `border-radius: 0` global reset
does not save you: an implementer building a segmented control will write `border-radius: 9999px`
locally because there is no specified alternative, and it will look correct to them because it is
the only way they know to make a segmented control.

**Correction (concrete):** before implementation starts, add a §5.8 covering, at minimum, the
five that appear on the demo path and have no zero-radius precedent anywhere in the doc. Each
needs one specified alternative, not a prohibition:

- **Segmented chips → a rule-bounded selector strip.** Options sit in a row separated by 1px
  `--rule` verticals inside a 1px `--rule-strong` frame, zero radius, no gaps. Selected =
  `--invert-bg`/`--invert-ink` fill (not yellow — see SHOULD-FIX-4 on accent budget). This is a
  shelf-label ticket rail, on-concept, and it removes ~15 pills from screen 1.
- **Constraint verdict → a mono table, not chips.** Four rows or one 4-column mono row: label in
  `--t-micro`, value in `--t-num-s`, hairline between. **Pass = `--ink`, no colour at all. Fail =
  `--negative` and nothing else on the screen is coloured.** This resolves the "four saturated
  green chips vs. one saturated element per screen" contradiction *and* is better product: a
  failing constraint becomes the only coloured thing on the page and is unmissable, which is
  precisely what UX §2.2 wants from it.
- **Bottom sheets → full-bleed panels.** Slide up from the bottom edge, `--rule-heavy` (3px
  `--rule-ink`) on the top edge, `--bg-base` ground, no radius, no handle, no scrim blur (solid
  `--bg-sunk` at opacity, never `backdrop-filter`). Dismiss is an uppercase `STÄNG` text button,
  not an ×.
- **Banners → full-bleed inverted bars.** `--invert-bg`/`--invert-ink`, `--t-micro` uppercase,
  full width, sticky where UX requires persistence. The demoläge banner is *supposed* to be
  unmissable (UX §3.7); a paper-white bar across a black screen is the most unmissable thing this
  palette can produce, and it costs no new tokens.
- **Recap tiles → a receipt block.** UX §1.9's four "tiles" become four label/value rows in the
  SHOP totals idiom (`--rule-receipt`, `--t-micro` label left, `--t-num-l` value right). This
  deletes the one guaranteed card grid in the product and makes the summary screen the payoff of
  the receipt metaphor rather than a Bootstrap stat row.
- **Sliders/steppers/timer dock** need a line too, even if brief.

Also: the icon budget of "at most eight in the whole app" is already exceeded by the UX doc's
needs (check, close, timer, prev/next, accordion chevron, geolocation, map, filter, wake-lock
indicator, pipeline state ✓/●/○). Either recount honestly against §1–3 of the UX doc or restate
the rule as what it actually means — *no icon may accompany a heading, a feature, or a menu item;
icons exist only where a glyph is the control* — which is the enforceable version.

### BLOCKER-3 — Six direct contradictions with `product-ux.md`. Two teams will build opposite things.

These are cheap to resolve now and expensive later. Each needs a named winner before
implementation.

| # | `visual-direction.md` | `product-ux.md` | Recommendation |
|---|---|---|---|
| 1 | §5.3: checked row *"does not move, reflow, animate away, or reorder. Position is memory in a store."* | §1.6: checked row *"animates down to the bottom of its own section"* | **Visual wins.** This is better product thinking than the product doc. Positional memory in a store is real; re-sorting under a thumb mid-scroll is the classic shopping-list bug. Defend it explicitly. |
| 2 | §5.3: row min-height **56px**; check target **28×28** (44px hit area) | §4: SHOP rows **≥64px**; min tap target **48×48**; *"checkbox is a large left affordance, not a small square"* | **UX wins.** Note that 56px is non-binding anyway: `--t-body` (17×1.5=25.5) + `--t-micro` (11×1.25=13.8) + `--s-3` padding ×2 = ~64px. The spec's stated number is simply wrong; state 64. Check target → 32×32 visual / 48 hit. |
| 3 | §3: **two first-class themes**, full light palette | §5 cut list: *"Dark/light toggle — Art Direction picks one committed look"* | **UX wins — cut light mode.** See SHOULD-FIX-4; the light palette currently contains the clearest AI-SaaS tell in the document. Cutting it removes a whole class of bugs and is the more committed position. If it stays, it needs the fixes in SHOULD-FIX-4 and an owner. |
| 4 | §7: motion list is *"allowed, exhaustively"* — six items, no shared-element transition | §1.5: *"the basket-total row animates into the SHOP header progress bar (shared element)"* | Resolve deliberately. The shared element is on-concept (the number is the product) but it is a scale+position tween of a live element, which is the exact family §7 bans. **Suggested resolution:** replace with a *cut* — the total's tabular column holds its x-position and type size across the route change, so the number appears not to move while everything around it changes. Same idea, no tween, no ban violation. |
| 5 | §3.3: *"One saturated element per screen"* in PLAN | §2.2 Block A: four green/amber constraint chips above the fold, plus the budget bar, plus swap chips | Resolved by BLOCKER-2's mono constraint table. |
| 6 | §2.1: `--t-body-s` 15, `--t-meta` 13, `--t-micro` 11 | §4: *"Type scale floor: 16px body (prevents iOS input zoom)"* | Not a real conflict for body (17px) but **inputs specifically must be ≥16px** and §2.1 has no input token. Add one. Also state where sub-16px is permitted and where it is not (see SHOULD-FIX-1). |

---

## 2. SHOULD-FIX

### SHOULD-FIX-1 — The app's most-repeated line is its least legible one, in its worst-conditions mode.

§5.1 calls the mono metadata line *"the signature of the whole system and appears under every
product everywhere in the app."* It is specified as `--t-micro`: **11px, Plex Mono 500,
UPPERCASE, +0.14em tracking, `--muted`.**

- `--muted` `#838B84` on `#0B0D0C` measures **5.6:1** — nominally passing, but that floor assumes
  normal-size text, and this is 11px.
- SHOP is used *"in a cold store"*, *"at 30% brightness"*, one-handed, at arm's length
  (UX §4). §5.3 additionally loads this line with brand + package size + **shelf location**.
- Uppercase + `+0.14em` costs ~23% width. `KRONFÅGEL · 700 G · 92,14 KR/KG` ≈ 250px at 11px;
  the available width at 390px after a 56px thumb and gutters is ~285px. It fits, barely, and
  then truncates the moment a brand is longer or shelf location is appended — silently removing
  the field that makes SHOP work.

The signature of the system should not be the thing that disappears first.

**Correction:** split the token by mode. Keep `--t-micro` (11/uppercase/+0.14em/`--muted`) for
PLAN eyebrows, section bars and desktop labels, where it is doing genuine typographic work.
In **SHOP and in any row a user reads while moving**, the metadata line is `--t-meta` (13px,
Plex Mono 400, **`--ink-2` not `--muted`**, tracking +0.02em, **not uppercase**). Contrast rises
to ~10:1, width drops ~25%, and the shelf location survives. The identity is not lost — mono +
`·` separators + the position under the name is the recognisable part; the uppercasing was
costing more than it earned.

### SHOULD-FIX-2 — Archivo at `wdth: 100` is Familjen Grotesk. The two-face system silently becomes one.

§2's premise is *"One family, two personalities."* That works at `wdth` 112–125 (`--t-h2`,
`--t-h1`, `--t-display`, buttons, section bars) — genuinely signage-like. But `--t-h3` is
specified at **Archivo 700, `wdth` 100**, and `--t-h4` is Familjen Grotesk 600 at 24px.

Archivo at default width is a neutral grotesque. Familjen Grotesk is a neutral grotesque with
mild warmth. At 32px vs 24px, adjacent, the reader sees one typeface at two sizes — and `--t-h3`
is the *most used* display token in the product (panel titles, recipe title, empty states, and
every mobile section head once `--t-h2` is dropped per BLOCKER-1). The width axis, which is the
entire justification for choosing Archivo over anything else, is switched off precisely where
the two faces meet.

**Correction:** **hard floor `wdth: 112` on every Archivo usage.** `--t-h3` becomes Archivo 700
`wdth` 112 at 30px (slightly smaller compensates for the width gain). Add the rule to §2 as a
policy line: *"Archivo is never set at `wdth` < 112 in the expanded role, and never above 90 in
the condensed role. There is no Archivo at default width in this product."* The absence of the
middle is what makes the two-face system read.

Optional strengthening: actually *use* the condensed end. §2 promises *"at `wdth` 87 it becomes a
condensed ticket header"* and then no token in the document uses it. The SHOP inverted section bar
is the natural home — a condensed shelf sign is a real, specific thing. Either use it or remove
the claim.

### SHOULD-FIX-3 — The COOK 34ch measure does not bind on the target device, and `--t-step`'s clamp minimum overflows it.

`--t-step` at 390px resolves to its clamp minimum, **28px**. At 28px Familjen Grotesk, 34ch ≈
**520px**. Available width at 390px with `--s-4` margins is 358px. The actual measure is ~23ch.

So the one measure constraint in the document is inert where it matters, and if anyone
"implements 34ch" literally with `max-width: 34ch`, nothing changes — the text just wraps
earlier and the spec appears satisfied while controlling nothing. Meanwhile UX §4 asks for
*"≤ 45 chars"*, a different number, also unmet.

**Correction:** state the real constraint, which is *line count and physical size*, not `ch`.
For COOK: *"instruction sets to 2–4 lines at the target width; `max-width: min(34ch, 100%)`.
On viewports < 420px, `--t-step` steps down to 25px so a 2-sentence Swedish instruction reaches
3 lines rather than 6."* Then verify with the actual demo recipe copy — Swedish compound nouns
(`kycklinglårfilé`, `vitlöksklyfta`) are long and will produce ugly rags at 23ch that no `ch`
value predicts. This needs a real-copy proof, not a token.

### SHOULD-FIX-4 — Light mode is a white card on a grey page. That is the AI-SaaS tell, expressed as tokens.

In §3.2: `--bg-base: #F6F7F4` (grey), `--surface-1: #FFFFFF` (**brighter than the page**).

That is the card idiom, encoded in the palette. Every raised block in light mode becomes a white
rectangle floating on grey — visually a card even with radius 0 and no shadow, because the
figure/ground relationship *is* the card. In dark mode the direction correctly does the opposite
(surfaces lighter than ground = physically true, light falls on raised things). In light mode it
inherits the SaaS convention without noticing.

Second problem: **"Lysrör" is not cold.** `#F6F7F4` has R > B — it is a slightly *warm* green-grey.
The doc explicitly promises *"a cold, bright store-lighting white — deliberately not the warm
cream that every generated design reaches for"* and then ships a warm-neutral. Fluorescent aisle
light is blue-green with a green spike; the ground should have B ≥ R.

**Correction, in order of preference:**

1. **Cut light mode.** `product-ux.md` §5 already cut the toggle. Committing to dark-only is the
   more confident position, removes an entire untested surface from an MVP demo, and removes this
   whole finding. *This is my recommendation.*
2. If it survives: invert the figure/ground. **Paper is the ground** — `--bg-base: #FFFFFF` or a
   genuinely cold `#F4F7F8`, and `--surface-1` equals the ground or is *darker* (`#EDF0F0`).
   "Raised" is expressed only by rules and inversion, exactly as the dark mode's own philosophy
   claims. And push the ground cold: B ≥ R.

Credit where due: §3.3's *"yellow is never text on light"* is correct and well-caught —
`#FFD100` on `#F6F7F4` measures **1.3:1**, unusable. The rule is right.

### SHOULD-FIX-5 — The "cold green cast" is imperceptible at the luminance where it is specified.

`#0B0D0C` is 2 points off neutral at ~0.4% relative luminance. Hue is not perceivable at that
darkness on any display; `#0B0D0C` and `#0A0A0A` are the same colour to a human eye. The claim
*"near-black with a cold green cast, not blue/purple"* is a rationale attached to the same
near-black every dark app ships — which is a small, specific instance of the exact failure mode
this whole document exists to prevent: asserting a quality rather than building a mechanism.

**Correction:** hue needs luminance to exist. Move the cast **up the ramp**, where there is enough
light to carry it: leave `--bg-base` as-is (it can be neutral, no one can tell), and push
`--surface-1` / `--surface-2` further into cold green — e.g. `--surface-1: #141A17`,
`--surface-2: #1D2620`. Now the cast appears on hover rows, input fields, image placeholders and
the SHOP strip — the surfaces the user actually looks at — and the claim becomes true. Then
verify on an OLED phone at 30% brightness, since these gradations are exactly where cheap panels
band.

### SHOULD-FIX-6 — The ghost step numeral at `--accent-dim` will read as a smudge, not a decision.

§5.4 sets the COOK step number at `--t-display` (72–132px) in `--accent-dim` `#6B5600` on
`--bg-sunk` `#070908`. That measures **2.8:1** — deliberately low, and as `aria-hidden` scenery
that is defensible. But at display size, a large muddy dark-olive shape bleeding off the left
margin, on a phone at low brightness in a kitchen, is more likely to read as a rendering artifact
or a dirty screen than as a designed element. It is also the one thing on the screen that could
orient a user who glanced away, and it is illegible.

Note that the obvious swap is worse: `--rule-strong` `#3A413B` on `#070908` measures **1.9:1**,
dimmer still. The fix is not a different fill.

**Correction:** make it **line-work, not a fill** — `-webkit-text-stroke: 1.5px var(--rule-strong)`
with `color: transparent`. An outlined numeral reads as intentional at any luminance because the
eye resolves the *stroke*, not the area; it is more editorial than a tinted fill; and it removes
the second use of yellow from a mode whose accent budget is *"exactly one: the primary action."*
Whichever is chosen, verify on a real OLED phone at 30% brightness before it ships — this is not
a decision that can be made on a desktop monitor.

### SHOULD-FIX-7 — Line-heights of 0.90 / 0.98 collide with Å Ä Ö in multi-line Swedish headlines.

§2.3 handles uppercase diacritics well (`line-height` ≥ 1.2, ≥ 4px from the rule above,
+0.10em tracking minimum) — this is a real and unusually careful piece of the document. But it
does not cover the *display* tokens, which are where the problem is worst:

- `--t-display` at `line-height: 0.90`
- `--t-h1` at `line-height: 0.98`

Archivo has no cap-height-specific diacritics — the ring on Å and the diaeresis on Ä/Ö sit above
cap height at full size. At lh 0.90, any wrapped Swedish headline whose second line begins with
Å/Ä/Ö collides with the descenders above it. And this is Swedish: `MÅLTID`, `LÄGG TILL`,
`FÖRSLAG`, `NÄRINGSVÄRDE`, `ÅTERSTÅR` are ordinary words here, not edge cases. At 390px, `--t-h1`
at 48px in a narrow column wraps constantly.

**Correction:** add to §2.3: *"Any token with `line-height` < 1.05 is single-line-only by policy
and must be applied with `text-wrap: nowrap` or a guaranteed-short string (mode names, step
numbers, the hero numeral). Any token that can wrap Swedish text has `line-height` ≥ 1.06."* In
practice: `--t-display` stays 0.90 (it only ever sets a numeral or `PLANERA`), `--t-h1` goes to
1.02–1.06, and the PLAN hero headline gets an explicit character budget.

### SHOULD-FIX-8 — The SHOP density numbers are stated below what the content produces and below the product's floors.

Covered as BLOCKER-3 #2, restated here because it is a usability answer, not just a
contradiction: **the ~45% mono share is fine; the 56px row and 28px check target are not.**

Mono at 45% in SHOP is correct and on-concept — that mode *is* a document, and Plex Mono's
tabular grid is what makes a price column scannable at arm's length. The density problem is not
mono, it is (a) the 11px uppercase micro line (SHOULD-FIX-1) and (b) targets sized below the
product's own ergonomic floors in the highest-stress context in the app. Fix those two and the
density is genuinely usable.

One addition: §5.3's quantity treatment (value + unit stacked, `3ch` fixed) is good and
shelf-label-correct, but two stacked lines on the left plus two on the right in a 56px row is
four text baselines in 56px. At 64px with 12px padding it works. Below that it does not.

### SHOULD-FIX-9 — The three smell tests are all negative. Nothing tests for presence of identity.

Assessment of each:

- **Smell 1 (card grid).** Good, mechanical, will catch real regressions. One sharpening: *"more
  than two sibling boxes with equal width and their own background"* will false-positive a
  legitimate table and false-negative a 2-up tile row. **Add the actual card signature:** flag any
  element that has (a) a `background` differing from its parent **and** (b) non-zero padding on
  all four sides **and** (c) is not in the allow-list. That is what a card *is*; radius is just
  its most common symptom.
- **Smell 2 (greyscale + blur).** **Excellent — the best test in the document**, and rare. Keep
  verbatim. Two additions: specify a threshold (*"at 8px blur on a 390×844 screenshot, the primary
  action and the single most important number must still be identifiable"*), and add the inverse:
  **re-render with `--accent` forced to `--ink`.** If the screen becomes unreadable or its
  hierarchy inverts, yellow was structuring rather than accenting — which is Smell 2's stated
  concern, tested directly rather than by eye.
- **Smell 3 (grep for defaults).** Good, cheap, CI-able. Add `border-radius: 9999px`, `9999px`,
  `999px`, `rounded-full`, `backdrop-blur`, `bg-gradient`, `shadow-` (Tailwind's class forms, since
  those are how the leak will actually arrive), `Inter`, `system-ui`, and any emoji in a JSX/TSX
  literal — `product-ux.md` §1.8 already contains a ⏱ emoji used as an icon, so this test has a
  live hit today.

**What is missing is a positive test, and it is the one that matters most.** All three tests can
pass on a screen that is entirely generic — plain text on near-black with no rounded boxes
violates nothing and expresses nothing. Add:

> **Smell 4 — "It avoided everything and became nothing."**
> A screen can pass 1–3 by being empty. The identity must be *present*, not merely un-violated.
> **Test:** on any screen at 390×844, count the identity carriers. At least **three** of the
> following must be visibly present:
> 1. a `--rule-heavy` (3px `--rule-ink`) running full-bleed under a section head;
> 2. the mono metadata line beneath a name;
> 3. a right-aligned fixed-width tabular numeric column with ≥ 2 rows aligned in it;
> 4. a full-bleed inverted (`--invert-bg`) bar;
> 5. a numeral set at least two scale steps larger than any type adjacent to it.
>
> Fewer than three ⇒ the screen is generic regardless of what it avoided, and must be rebuilt —
> not decorated.

And make the stated bar testable: **the logos-removed test.** Put a screenshot of any finished
screen beside a screenshot of a well-known dark dev-tool product and a generic Tailwind
dashboard, show all three to someone who has not seen the app, and ask which one sells groceries.
Costs ten minutes, and it is the actual requirement.

---

## 3. CONSIDER

### CONSIDER-1 — Yellow-on-black is the correct referent but the safest available choice. The paper-white inversion is the braver one you already own.

Asked directly: **`#FFD100` is right, not brave.** It is the true colour of a Swedish
shelf-edge *Extrapris* label, and it is the one accent that survives a store's fluorescent glare
on a dimmed phone, and it hits 13.4:1 on the dark ground. Those are three good reasons and I
would not change it.

But it is also Lidl, Blocket, Post-it, Bloomberg, and roughly every "brutalist" dark template of
the last five years. Yellow-on-near-black is the second-most-defaulted accent in dark UI after
purple. It does not, on its own, make anything recognisable.

The genuinely uncommon asset in this palette is **`--invert-bg` — full paper-white blocks in a
dark app.** Almost nobody does it, because it is uncomfortable to commit to, and it is *exactly*
the printed-matter concept the document is built on. Right now it is used in two places (SHOP
section bars, text-over-image) and is doing more identity work per pixel than the yellow.

**Correction:** promote inversion to a co-signature and use it in all three modes, with a stated
rule — e.g. *"one inverted block per screen, always full-bleed to at least one container edge,
never floating."* Candidates already in the product: the mode header, the demoläge banner, the
SHOP section bars, the COOK intro card, the summary receipt. Yellow then narrows to what it is
best at — the single most important number or the single primary action — which also enforces
§3.3's one-saturated-element rule automatically.

### CONSIDER-2 — IBM Plex Mono carries ~45% of SHOP and is the most-defaulted face in the stack.

Of the three faces, the mono is the one that carries the most surface area in the mode that most
defines the product, and it is the safest pick available. IBM Plex Mono is *the* dev-tool /
brutalist-editorial monospace — it is the face that most signals "a designer chose a mono," which
is a different thing from signalling this product.

The document's own logic argues for bravery here: if mono is 45% of SHOP, the mono is the
identity, and it should get the boldest choice, not the most familiar one.

**Consider testing** (all Google Fonts, all with full Swedish diacritics, all tabular by
construction):
- **Martian Mono** — has a `wdth` axis, unmistakable, genuinely receipt/ticket-like. Heavy at
  small sizes; test at 13px before committing.
- **DM Mono** — narrower, warmer, less coded-in-a-terminal.
- **Spline Sans Mono** — closest to Plex with more character in the figures.

Not a demand — Plex is a defensible, legible, safe choice and switching costs a round of
re-fitting the numeric columns. But it should be a *decision*, and right now the document does not
show that alternatives were considered. Whatever is chosen, the test is the same: set
`1 249,50 kr` / `129,50 kr/kg` / `92,14 KR/KG` at 13px and 34px, on `#0B0D0C`, on a phone.

### CONSIDER-3 — The strongest available per-mode differentiation: make SHOP literally paper.

Asked directly: **do PLAN / SHOP / COOK feel like different rooms?** On desktop, yes — the
column structure, mono share, and scale shifts are more than density tweaks, and changing the
ground on mode switch is a real device. On a 390px phone, mostly no: the grids collapse to the
same single column, and the three grounds differ by ~3% luminance in a supermarket.

The concept already contains the answer and does not take it. A receipt is white. A shelf label
is white and yellow. SHOP is *the document*.

**Consider: in dark mode, SHOP's list ground is `--invert-bg` — actual paper-white with
near-black ink, full-bleed, with the perforated edge and the dashed receipt rule already
specified in §3.4 and §4.3.** PLAN and COOK stay midnight.

That gives three unmistakable rooms at any width, in any light: **black editorial spread → white
paper receipt → black kitchen void.** No one will confuse them, and the mode switch becomes the
most memorable moment in the product for free.

Trade-offs to weigh honestly, not to dismiss:
- A white screen in a dim room is harsh. But SHOP is used under supermarket fluorescents, which
  is the one context where a bright screen is *correct* — better under glare, better for
  scanning, and it matches the light the user is standing in. That is the "Lysrör" idea, applied
  where it belongs instead of to an unused theme toggle.
- It requires the light-mode ink/rule tokens to exist and be tested even though the theme toggle
  is cut — but they exist already in §3.2, and this gives them a purpose.
- Yellow must not be text on white (§3.3, correctly) — so SHOP's check fill (yellow block,
  near-black glyph) still works, and the budget delta uses the light-mode `--positive`/
  `--negative` values already specified.

If this is too aggressive, the fallback minimum still stands from BLOCKER-1: at least one mode
must differ by material, not by 3% luminance.

### CONSIDER-4 — Discipline: enforceable, but permit one moment of warmth, and name where it goes.

Asked directly: **is the zero-radius / no-shadow / one-accent policy too strict?** No. It is
enforceable *because* it is strict — a policy with a "use judgment" clause gets violated in week
one; a global reset plus an exhaustive two-item exception list does not. Keep it exactly as
written. The realistic violation points are all in BLOCKER-2's uncovered components, and that is
a coverage problem, not a strictness problem.

The real risk is not austerity, it is **joylessness at the one moment the product is supposed to
be joyful.** UX §1.9 ends the journey with *"Smaklig måltid!"* and the *"19 kr kvar"* payoff. The
direction's single sanctioned indulgence — the tabular digit swap on basket re-tally (§7.4) — is
extremely well chosen and correctly justified (*"the numbers are the product"*). But it fires in
PLAN, not at the end.

**Consider** permitting exactly one more, defined not as decoration but as a **change of
material**: the COOK summary renders as a full-bleed inverted (paper) receipt — perforated top
and bottom edge, `--rule-receipt`, mono throughout, the yellow used once on the closing budget
line. It is a keepsake, it is entirely on-concept, it uses only existing tokens, and it deletes
the card grid from BLOCKER-2 in the same move. That is warmth achieved by material, which is the
one kind this direction is allowed to have.

### CONSIDER-5 — Font payload: `--t-micro` uses Plex 500, `--t-num-s` uses Plex 500, everything else uses 400/600.

IBM Plex Mono has no variable version on Google Fonts, so 400/500/600 = three static families
(×2 with latin-ext split). Weight 500 appears in only two tokens and both sit adjacent to 600
usages where the distinction will not be perceived at 11–15px.

**Consider** dropping Plex 500 (micro → 400 with its existing tracking; `--t-num-s` → 600 to
match the other numeric tokens). Saves a font file on a mobile-first product whose first screen
is the LCP screen. Minor, but free.

### CONSIDER-6 — §9's utility-class approach is right; add the enforcement that makes it stick.

*"Typography roles ship as utility classes ... rather than as ad-hoc per-component declarations,
so the scale cannot drift"* is correct and is the mechanism that keeps §2.1 alive past week two.

**Consider** adding the guard that makes it enforceable: a lint rule (or a CI grep, in the same
place Smell 3 runs) banning raw `font-size`, `line-height`, `letter-spacing`, `border-radius`,
`box-shadow` and raw hex colours anywhere outside `tokens.css`. Without it, the utility classes
become suggestions the first time someone needs "just slightly smaller."

---

## 4. What this direction gets genuinely right — preserve through revision

Listed so none of it is lost in a rewrite. This is the majority of the document.

1. **Shadows are removed from the token set, not discouraged.** §4.5 is the single most effective
   line in the document. A designer cannot reach for a shadow that does not exist. The two
   permitted line-drawing `box-shadow` forms are the correct escape hatch.
2. **Separation is assigned to rules, background shift and inversion.** This is *the* mechanism
   that makes "editorial" a fact rather than an adjective. Most "editorial" directions assert the
   word and then ship cards; this one names the replacement device and specs five rule tokens with
   distinct meanings (§4.3). Keep the *"a rule belongs to the thing above it"* spacing rule — that
   is a real typographic instinct.
3. **The mono metadata line as a declared, repeating, system-wide signature.** Correctly
   identified as an identity carrier. (Fix its size and case per SHOULD-FIX-1; do not remove it.)
4. **The right-aligned fixed-width tabular numeric column as a global law**, plus §2.2's
   non-negotiables. *"Never let a price column ragged-align"* and the fallback-to-Plex-if-jitter
   rule show someone thought about what happens at runtime, not just in a mockup.
5. **Swedish number formatting specified precisely** — decimal comma, space thousands separator,
   non-breaking space before unit, unit always in `--t-meta` `--muted`, `kr` at 0.34em with a
   fixed `translateY` and never superscripted. This is the texture of an authored product. Nothing
   generated produces this level of local specificity.
6. **The nutrition panel as a literal nutrition label**, with *"trust comes from citing, not from
   a badge."* On-concept, and the right answer to a real product problem. The single-accent macro
   bar responding to the user's own request is a genuinely smart detail.
7. **The checked SHOP row does not move.** Better product thinking than `product-ux.md`. *"Position
   is memory in a store"* should survive into the final spec verbatim.
8. **No skeleton shimmer** — loading draws the real rule structure with `--surface-2` blocks and a
   `HÄMTAR PRISER…` label. Correct, on-concept, and it removes one of the most reliable AI-app
   tells. Empty states as one line and one outline button, with no illustration, likewise.
9. **The motion list is closed, short, and bans the right things** (parallax, scroll-triggered
   reveals, stagger cascades, hover lift, spring easing, shimmer, anything > 240ms). The single
   indulgence — the tabular digit swap — is well chosen, well justified, and on-concept. The
   `prefers-reduced-motion` collapse is specified rather than gestured at.
10. **Smell 2 (greyscale + blur) is an unusually good test** and the one most likely to catch a
    real regression that a linter cannot.
11. **Yellow is never text on light** (§3.3) — correctly caught, and the measured contrast (1.3:1)
    confirms it. The accent-as-fill / underline / marker-bar alternative is the right answer.
12. **The uppercase + Swedish diacritics policy exists at all** (§2.3). Almost no direction
    documents think about Å/Ä/Ö above cap height. Extend it to the display tokens (SHOULD-FIX-7),
    but the instinct is right.
13. **Focus is square, uses the accent, is never removed, and flips to `--ink` on yellow fills.**
    Specified with the inversion case handled — that last clause is the part everyone forgets.
14. **Segmented, non-rounded, non-continuous progress strip** in COOK. Small detail, exactly right,
    and it is the anti-pattern of every generated progress bar.
15. **Photography direction is specific and restrictive** — single hard light, real shadow, dark
    surface, 4:5 / 1:1 only, *"never a smiling-people stock shot, never a gradient scrim,"* and
    text-on-image sits in a solid inverted block. Note that `product-ux.md` §5 cuts dish
    photography entirely, so this mostly governs the product feed thumbs — but the rule against
    circle-cropping product images is the one that will actually get used.

---

## 5. Open questions for Visual Direction

1. **Is light mode in or out?** `product-ux.md` cut the toggle; `visual-direction.md` ships two
   full palettes. Someone must decide, because the answer changes CONSIDER-3, SHOULD-FIX-4, and
   the QA surface of the whole MVP. (Recommendation: out.)
2. **What is the mobile composition device for PLAN**, now that the 7/5 asymmetric split does not
   exist at 390px? Without an answer, PLAN has no compositional identity on the shipping viewport.
3. **Does §2.1 get rewritten mobile-first?** The clamp minima currently produce a 1.13× step
   between `--t-h3` and `--t-h2` on the target device, which contradicts the document's own
   central typographic claim.
4. **Who owns the ~13 unspecified components?** Specifically: does Visual Direction extend §5, or
   is it delegated to implementation? If delegated, BLOCKER-2 is not resolved and the card grid
   will appear on the summary screen.
5. **Constraint verdict — chips or mono table?** This is a joint Visual/UX decision and it
   determines whether PLAN's most important IA element obeys the one-saturated-element rule.
6. **Shared-element PLAN→SHOP transition — banned or excepted?** §7's list is declared exhaustive
   and UX §1.5 requires the transition. Pick one, or adopt the cut-not-tween resolution.
7. **Is `--accent-dim` verified on real hardware?** The 2.8:1 ghost numeral is the one spec in the
   document that cannot be evaluated on a desktop monitor.
8. **Was the mono face actually chosen, or defaulted to?** It carries ~45% of the mode that
   defines the product; the reasoning should be on the record either way.
