# Design System — "Midnight Supermarket Editorial"

_Implemented design decisions. Full rationale in `planning/visual-direction.md`; critic's required
changes in `planning/visual-critique.md`. This file is the reconciled build spec._

Verdict from the Visual Critic: **not the AI-SaaS look** (shadows deleted from the token set, radius
globally zeroed, separation reassigned to rules/background-shift/inversion, smell tests are
greppable). **Approve with changes** — the changes below are mandatory.

## The concept

A Swedish grocery store at 23:00, redrawn as a magazine. Material = **type, rules, alignment,
numbers** — not containers. Identity carriers (must be recognisable with all logos removed):
shelf-label yellow `#FFD100`, zero border-radius, the uppercase-mono metadata line under every
product name, the right-aligned tabular numeric column down every list, and the two-step numeral
jump.

## Mandatory changes from the critique (do these, not the raw visual-direction spec)

1. **Mobile-first, not desktop-first.** The product is a 390 px phone. Rewrite the type scale with
   **fixed mobile steps** (no `clamp()` minimums governing the real viewport) and drop one level:
   target ~`22 → 28 → 34 → 44` for the display ladder at 390 px, scaling up (not down) at ≥ 904 px.
   Define an explicit mobile composition device for PLAN (hanging indent + full-bleed rules), since
   the 7/5 desktop split doesn't exist on a phone. Run all three smell tests at 390×844.
2. **Dark mode only.** Ship one palette (§3.1 of visual-direction). Delete the light/"Lysrör"
   palette from the token file — it's deferred and the proposed light palette was white-surface-on-
   grey-page (the card idiom re-encoded).
3. **Specify the ~13 unspecified components** before building them — this is where defaults leak.
   Zero-radius alternatives, not the obvious ones:
   - PLAN input controls → rule-bounded selector strips, **not** `9999px` pills.
   - Constraint verdict → a **mono table** (`✓` in `--ink`, fail in `--negative`, nothing else
     coloured), not a row of green chips. Resolves the "four green chips vs. one saturated element"
     tension and is better product.
   - PLAN—HANDLA—LAGA indicator → the element that makes it read as one journey; `--rule-double`
     header, mode name in condensed display caps, ground-colour shift on switch.
   - Bottom sheets / banners / timer dock → full-bleed panels with a `--rule-heavy` top edge and
     inverted bars. **No drag handles, no 16 px top radius, no ⏱ emoji** (Smell 3).
   - COOK summary → a receipt block, **not** recap tiles / a card grid.
4. **Resolve the 6 conflicts with `product-ux.md`:** checked SHOP rows do **not** move/reorder
   (visual wins); tap targets ≥ 44 px effective, rows compute to ~64 px (UX wins on numbers);
   motion list gains one shared-element exception for PLAN→SHOP but as a **cut, not a tween**.
5. **Legibility:** the mono metadata line is the most-repeated text in the app and 11 px uppercase
   `--muted` at arm's length in SHOP is too weak — bump SHOP's metadata line to 12–13 px and a
   less-muted ink, and don't append shelf location if it causes truncation.
6. **Archivo width axis:** floor it at `wdth: 112` everywhere it's used (at `wdth: 100` it reads as
   Familjen Grotesk — the whole reason Archivo was chosen is off). If the build can't ship the
   variable font, that's a blocking issue — a static Archivo loses the signage character.
7. **Add Smell 4** (positive test): count identity carriers per screen (rule-heavy divider, mono
   metadata line, tabular numeric column, inverted bar, two-step numeral jump). Fewer than three →
   the screen is generic regardless of what it avoided.

## Fixed tokens (ship as `tokens.css`)

- **Type:** Archivo (variable, display/signage, `wdth` ≥ 112) · Familjen Grotesk (text) ·
  IBM Plex Mono (all data/numerals). Self-hosted via `next/font/google`. Latin + latin-ext.
- **Colour:** dark palette from visual-direction §3.1 — `--bg-base #0B0D0C`, `--surface-1 #131614`,
  `--ink #F2F4F1`, `--muted #838B84`, `--rule #262B27`, `--accent #FFD100`, `--positive #57C98A`,
  `--negative #FF5A3C`, inversion `#F2F4F1`/`#0B0D0C`. One accent. No gradients. No third hue.
- **Radius:** global reset `0`. Only exceptions: `2px` on text inputs / small tags / check target;
  `50%` on exactly two dots (COOK step badge, SHOP checked dot).
- **Elevation:** **no shadow tokens.** Separation = background shift / rule / inversion. The only
  permitted `box-shadow` values draw a line (`0 1px 0 0 var(--rule)`, `inset 3px 0 0 0 var(--accent)`).
- **Numerals:** every comparable number is IBM Plex Mono, right-aligned, tabular, in a fixed-width
  column. Swedish formatting: decimal comma, nbsp before unit — `129,50 kr/kg`, `450 g`, `18 min`.
- **Spacing:** 4px base scale. Lists have **no row gap** — rows are separated by `--rule-hair` (1px).
- **Motion:** durations 120/180/240 ms, one signature moment (basket total digit re-tally).
  Banned: parallax, scroll reveals, hover lift/scale, spring/bounce, skeleton shimmer, anything > 240 ms.
- **Focus:** `outline: 2px solid var(--accent); outline-offset: 2px` — square, never removed.

## Per-mode character

| | PLAN | SHOP | COOK |
|---|---|---|---|
| Character | Editorial spread | Receipt / picking list | Kitchen ticket |
| Ground | `--bg-base` | `--surface-1` strip on `--bg-sunk` | `--bg-sunk` |
| Density | Loose | Tight (rows touch) | One idea per screen |
| Mono share | ~15% | ~45% | ~10% |
| Accent | one element/screen | check fills + budget delta | the primary action only |

## Smell tests (run before any screen is "done")

1. **Card grid returned** — DevTools: count elements with computed `border-radius > 2px` (must be 0
   outside the 2 circle exceptions); > 2 equal-width sibling boxes with their own background in a
   row → rebuild as rows/rules/split.
2. **Identity in the shell, not the type** — greyscale + blur the screenshot; hierarchy must still
   read from type size/weight/width/rules alone. If yellow is structuring rather than accenting,
   there's too much yellow.
3. **Generated defaults leaked** — grep the CSS for `linear-gradient`, `radial-gradient` (except the
   SHOP perforation mask), `backdrop-filter`, `blur(`, non-line `box-shadow`, `border-radius` other
   than `0`/`2px`/`50%`, emoji-as-icon, `9999px`, hues in 240–300°. All hits zero or justified here.
4. **Identity carriers present** (positive) — count per screen; ≥ 3 required.
