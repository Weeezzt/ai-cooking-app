# Visual Direction — "Midnight Supermarket Editorial"

_Owner: Visual / Art Direction. Status: proposed, ready for critic review. Planning artifact —
no application code here, but every token below is intended to ship verbatim._

---

## 1. The concept

**A Swedish grocery store at 23:00, redrawn as a magazine.** The identity is built from the
printed matter of food retail — shelf-edge price labels, thermal receipts, the nutrition table on
the back of a package, the ticket rail in a restaurant kitchen — set on a near-black "midnight"
ground and composed with the discipline of an editorial spread. Its material is **type, rules,
alignment and numbers**, not containers: information is separated by hairlines, background shifts,
uppercase mono labels and column structure, almost never by a floating rounded box. Numbers are
the ornament — prices, grams, kronor per kilo, macros and step counts are set large, tabular and
proudly, because the promise of the product is that the numbers are real. One saturated colour
does all the signalling: **shelf-label yellow**, the colour of an *Extrapris* sign seen through a
dark window. Everything else is ink, paper, and hairline. With every logo removed, you would still
recognise it by the yellow, the zero radius, the mono metadata line under every product name, and
the right-aligned tabular column that runs down the edge of every list.

---

## 2. Type system

Three faces, all Google Fonts, all with complete Swedish diacritics (å ä ö Å Ä Ö). Self-host via
`next/font/google` — no runtime CDN link, no FOIT.

| Role | Face | Why | Fallback stack |
|---|---|---|---|
| **Display / signage** | **Archivo** (variable: `wght` 400–800, `wdth` 62–125) | A grotesque with a real width axis. Set at `wdth` 112–125 it becomes shelf-signage and price-sticker; at `wdth` 87 it becomes a condensed ticket header. One family, two personalities. Not Bebas, not Anton, not a high-contrast serif. | `'Archivo', 'Helvetica Neue', Arial, sans-serif` |
| **Text** | **Familjen Grotesk** (400/500/600/700 + italic) | Swedish by origin and by feel — a slightly warm, slightly irregular grotesque that is not Inter and not a system stack. Carries Swedish body copy and recipe instructions with character at 17–34px. | `'Familjen Grotesk', 'Helvetica Neue', Arial, sans-serif` |
| **Data / utility** | **IBM Plex Mono** (400/500/600) | The receipt, the ticket, the label. Monospaced ⇒ tabular by construction, so every price column aligns without relying on OpenType support. | `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace` |

**Loaded weights (budget):** Archivo variable (wght+wdth), Familjen Grotesk 400/600/700,
IBM Plex Mono 400/500/600. Latin + latin-ext subsets only.

### 2.1 Type scale

Base 16px. Hand-tuned, not a blind modular ratio — the jumps between `h3` and `h1` are deliberately
violent because editorial hierarchy is about contrast, not evenness.

| Token | Size | Line-height | Tracking | Face / weight | Used for |
|---|---|---|---|---|---|
| `--t-micro` | 11px | 1.25 | +0.14em | Plex Mono 500, UPPERCASE | Labels, units, aisle names, eyebrows, section bars |
| `--t-meta` | 13px | 1.35 | +0.02em | Plex Mono 400 | Package size, brand, kr/kg, timestamps |
| `--t-body-s` | 15px | 1.45 | 0 | Familjen Grotesk 400 | Dense list text, secondary copy |
| `--t-body` | 17px | 1.5 | −0.005em | Familjen Grotesk 400 | Default body, PLAN prose |
| `--t-lead` | 21px | 1.4 | −0.01em | Familjen Grotesk 400 | Ingress / deck under a PLAN headline |
| `--t-h4` | 24px | 1.2 | −0.01em | Familjen Grotesk 600 | Sub-headings inside prose |
| `--t-h3` | 32px | 1.15 | −0.02em | Archivo 700, `wdth` 100 | Panel titles, recipe title |
| `--t-h2` | `clamp(36px, 5vw, 52px)` | 1.05 | −0.025em | Archivo 700, `wdth` 112 | Section heads |
| `--t-h1` | `clamp(48px, 8vw, 76px)` | 0.98 | −0.03em | Archivo 800, `wdth` 118 | PLAN hero headline |
| `--t-display` | `clamp(72px, 14vw, 132px)` | 0.90 | −0.04em | Archivo 800, `wdth` 125 | Hero basket total, COOK step number |
| `--t-step` | `clamp(28px, 4.2vw, 38px)` | 1.35 | −0.01em | Familjen Grotesk 500 | COOK instruction body |

Numeric-specific:

| Token | Size | Face | Notes |
|---|---|---|---|
| `--t-num-s` | 15px | Plex Mono 500 | List-row prices |
| `--t-num` | 20px | Plex Mono 600 | Panel totals, macro values |
| `--t-num-l` | 34px | Plex Mono 600 | SHOP summa, per-store subtotal |
| `--t-num-hero` | `--t-display` | Archivo 800 + `tnum` | Hero price only |

### 2.2 Numeral treatment (non-negotiable)

- **Every number that can change or be compared is monospaced** — prices, quantities, grams,
  kcal, macros, distances, timers, step counters. Plex Mono, right-aligned, in a fixed-width
  column. Never let a price column ragged-align.
- Where a numeral must be display-sized (hero total, COOK step number) it is set in Archivo with
  `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`. If a build ever shows
  jitter on digit change, fall back to Plex Mono at the same optical size — correctness of
  alignment beats the display face.
- **Swedish formatting:** decimal comma, space as thousands separator, non-breaking space before
  the unit — `1 249,50 kr`, `129,50 kr/kg`, `450 g`, `2,5 dl`, `18 min`. The unit is always
  `--t-meta` in `--muted`, never the same size or colour as the number.
- Currency suffix in hero numerals: `kr` at `0.34em`, weight 600, colour `--muted`, baseline
  nudged with a fixed `translateY` — never superscripted.
- `font-variant-numeric: tabular-nums` is applied globally to `.num`, `td`, and every mono class.

### 2.3 Uppercase and Swedish diacritics

Uppercase is a real device here (labels, section bars, buttons) but Å/Ä/Ö carry marks above the
cap height. **Any uppercase line has `line-height` ≥ 1.2 and never sits closer than 4px to the rule
above it.** Uppercase tracking is +0.10em minimum (+0.14em at `--t-micro`). Never uppercase a
sentence longer than ~34 characters; never uppercase body copy or recipe instructions.

---

## 3. Colour

Two first-class themes. **Dark ("Midnight") is the default and the identity.** Light
("Lysrör" / fluorescent aisle) is a cold, bright store-lighting white — deliberately *not* the
warm cream that every generated design reaches for.

One accent does all signalling. Positive/negative exist only for budget and safety. There is no
third decorative hue, no tint ramp of the accent, no gradient anywhere.

### 3.1 Dark — default

```css
:root, [data-theme="dark"] {
  /* ground */
  --bg-base:       #0B0D0C;  /* page — near-black with a cold green cast, not blue/purple */
  --bg-sunk:       #070908;  /* deepest ground; COOK, modal scrims */
  --surface-1:     #131614;  /* raised block, SHOP list column, hover row */
  --surface-2:     #1B1F1D;  /* input fields, image placeholders, pressed state */

  /* ink */
  --ink:           #F2F4F1;  /* primary text */
  --ink-2:         #C2C7C1;  /* secondary text, macro bars */
  --muted:         #838B84;  /* units, metadata, disabled */

  /* structure */
  --rule:          #262B27;  /* hairline, 1px */
  --rule-strong:   #3A413B;  /* 2px frames, checkbox borders */
  --rule-ink:      #F2F4F1;  /* the heavy 3px editorial rule */

  /* signal */
  --accent:        #FFD100;  /* shelf-label yellow — the identity colour */
  --accent-ink:    #0B0D0C;  /* text ON accent, always near-black */
  --accent-dim:    #6B5600;  /* accent at low emphasis: underlines, empty bar tracks */
  --positive:      #57C98A;  /* within budget, verified price, checked */
  --negative:      #FF5A3C;  /* over budget, allergen, missing product */

  /* inversion (SHOP section bars, price stickers) */
  --invert-bg:     #F2F4F1;
  --invert-ink:    #0B0D0C;
}
```

### 3.2 Light — "Lysrör"

```css
[data-theme="light"] {
  --bg-base:       #F6F7F4;
  --bg-sunk:       #ECEEE9;
  --surface-1:     #FFFFFF;
  --surface-2:     #E7EAE4;

  --ink:           #0B0D0C;
  --ink-2:         #3A403B;
  --muted:         #6E756F;

  --rule:          #D6D9D2;
  --rule-strong:   #A9AEA6;
  --rule-ink:      #0B0D0C;

  --accent:        #FFD100;
  --accent-ink:    #0B0D0C;
  --accent-dim:    #E4C64F;
  --positive:      #14713F;   /* darkened for AA on white */
  --negative:      #B72E0C;

  --invert-bg:     #0B0D0C;
  --invert-ink:    #F6F7F4;
}
```

### 3.3 Colour rules

- **Yellow is never text on light.** `#FFD100` on `--bg-base` light fails contrast. In light mode
  the accent appears only as a *fill* (with `--accent-ink` on top), a 3px underline, or a marker
  bar. In dark mode yellow-as-text is permitted at `--t-micro`/`--t-h3` and above only.
- **One saturated element per screen** in PLAN and SHOP. COOK is allowed exactly one: the primary
  action button.
- Positive/negative are **never used as decoration** — only on a budget delta, a verified-price
  badge, or an allergen warning. A checked shopping row uses `--accent` (fill) + opacity, not green.
- Food photography is the only place other colours are allowed to exist. The UI never samples from
  it.
- Contrast floor: body text ≥ 7:1 against its ground; `--muted` ≥ 4.5:1; any interactive target
  ≥ 3:1 for its boundary.

### 3.4 Texture — the one allowance

A single fine grain overlay, dark mode only: 128×128 tiled SVG/PNG noise at **4% opacity**,
`mix-blend-mode: overlay`, fixed to the viewport, `pointer-events: none`. It reads as printed
matter under fluorescent light. In SHOP the receipt column additionally gets a **perforated edge**
— a repeating radial-gradient mask cutting 5px semicircles at 10px intervals along its top and
bottom. That is the entire texture budget. No paper photos, no gradient blobs, no glass.

---

## 4. Spacing, grid, layout primitives

### 4.1 Spacing scale (4px base)

```
--s-1: 4    --s-2: 8    --s-3: 12   --s-4: 16   --s-5: 20   --s-6: 24
--s-8: 32   --s-10: 40  --s-14: 56  --s-18: 72  --s-24: 96  --s-32: 128
```

Vertical rhythm between major sections: `--s-18` (mobile) / `--s-24` (desktop) in PLAN,
`--s-8` in SHOP, `--s-24` in COOK. Inside a list, rows have **no gap** — they are separated by
rules, not space.

### 4.2 Grid

| Breakpoint | Columns | Gutter | Page margin | Content max |
|---|---|---|---|---|
| `xs` < 600 | 4 | 16px | 16px | — |
| `sm` 600–903 | 8 | 20px | 24px | — |
| `md` 904–1279 | 12 | 24px | 40px | 1120px |
| `lg` ≥ 1280 | 12 | 24px | 64px | 1360px |

- Prose measure is capped at **68ch** regardless of column span; COOK instructions at **34ch**.
- PLAN uses an **asymmetric editorial split**: 7/5 or 8/4, never 6/6. Images are allowed to break
  the margin and bleed to the viewport edge; text never does.
- SHOP is a single column of max **560px**, centred, sitting on `--surface-1` against a
  `--bg-sunk` page — a paper strip on a dark counter. On `lg` a second column (max 320px) holds the
  running total and store info, separated by a 1px vertical rule, not a gap.
- COOK is a single centred column, max **720px**, with a fixed bottom action bar outside the grid.

### 4.3 Rules and dividers — the primary structural device

| Token | Spec | Meaning |
|---|---|---|
| `--rule-hair` | 1px solid `--rule` | Between rows in a list. Full container width. |
| `--rule-mid` | 2px solid `--rule-strong` | Frames a nutrition panel; separates a group of rows. |
| `--rule-heavy` | 3px solid `--rule-ink` | Under a section head. The editorial move. |
| `--rule-double` | 3px `--rule-ink` + 1px `--rule` with 4px gap | Mode header only (PLAN/SHOP/COOK). |
| `--rule-receipt` | 1px dashed `--rule-strong`, 3px dash / 4px gap | SHOP totals block only. |

Rules run **full width of their container, edge to edge** — never inset, never faded, never with a
gradient. A rule below a heading is spaced `--s-2` under the text and `--s-5` above the next block:
the rule belongs to the thing above it.

### 4.4 Border-radius policy

**Default is `0`.** Global reset sets `border-radius: 0` on all elements. Exceptions, exhaustive:

| Allowed | Value | Where |
|---|---|---|
| Optical softening | `2px` | Text inputs, select, textarea, small tags, the SHOP check target |
| True circle | `50%` | Two places only: the COOK step badge and the SHOP checked-state dot |

Not allowed anywhere: 8px, 12px, 16px, 24px, `9999px` pills, rounded images, rounded buttons,
rounded avatars, rounded modals, rounded cards.

### 4.5 Elevation

**There are no shadow tokens.** Separation is achieved with background shift (`--bg-base` →
`--surface-1`), a rule, or inversion. Sticky bars use a solid background plus a 1px rule on the
leading edge. The only permitted `box-shadow` values are ones that draw a line
(`0 1px 0 0 var(--rule)`, `inset 3px 0 0 0 var(--accent)`).

### 4.6 Focus

`outline: 2px solid var(--accent); outline-offset: 2px;` — square, visible in both themes, never
removed, never replaced by a glow. On yellow fills, focus flips to `--ink`.

---

## 5. Component-level direction

### 5.1 Product line item (PLAN basket, product picker)

Not a card. A **full-width row**, bounded above and below by `--rule-hair`, min-height 64px,
padding `--s-3` 0.

```
[ 56×56 img ]  Kycklinglårfilé                                    2 ×      64,50 kr
   0 radius    KRONFÅGEL · 700 G · 92,14 KR/KG                          32,25 kr/st
```

- Thumb: 56×56, `object-fit: cover`, radius 0. Missing image ⇒ `--surface-2` tile with the product
  initial in Archivo 800 `wdth` 125, `--muted`, centred.
- Name: `--t-body`, Familjen Grotesk 600, `--ink`, single line with ellipsis.
- Metadata line directly under, `--t-micro`, `--muted`, uppercase, separated by ` · ` — brand,
  package size, unit price. This line is the signature of the whole system and appears under every
  product everywhere in the app.
- Right rail: fixed-width numeric column (`min-width: 110px`, `text-align: right`), quantity in
  `--t-num-s` above, line price in `--t-num-s` weight 600 `--ink`. Columns align across all rows.
- Hover (pointer only): background `--surface-1` + `inset 3px 0 0 0 var(--accent)`. No lift, no
  scale, no shadow, no radius change.
- Swapped/substituted product: name gets a 1px `--negative` underline and a `BYTT` micro-tag
  (2px radius, `--negative` 1px border, transparent fill).

### 5.2 Nutrition panel

Literally a nutrition label, not a chart widget.

- Container: 2px solid `--rule-strong` frame, background `--bg-base` (dark) / `--surface-1`
  (light), padding `--s-4`, radius 0.
- Title `NÄRINGSVÄRDE` in Archivo 800 `wdth` 118, `--t-micro`, followed immediately by a
  `--rule-heavy` (3px).
- Basis switch — `PER PORTION` / `PER 100 G` — as two uppercase `--t-micro` text targets separated
  by a `|`; the active one is `--ink` with a 2px `--accent` underline, the inactive is `--muted`.
  Not a segmented pill.
- Energy row is the hero: `kcal` value at `--t-num-l`, right-aligned, with `kJ` in `--t-meta`
  `--muted` beneath it. Under it, a `--rule-mid`.
- Macro rows: label left (`--t-body-s`, Familjen 400), value right (`--t-num`, Plex 600) with unit
  in `--muted`. `--rule-hair` between rows. Sub-nutrients (varav mättat fett, varav sockerarter)
  are indented `--s-5` and set in `--t-body-s` `--ink-2`.
- Reference bar: 4px tall, radius 0, full row width, track `--surface-2`, fill `--ink-2`. **One**
  macro may use `--accent` fill — the one the user's request emphasised (e.g. protein when they
  asked for "high protein"). Percentage of daily reference in `--t-micro` `--muted` at the right end.
- A closing `--rule-mid` then a `--t-micro` `--muted` footnote naming the data source. Trust comes
  from citing, not from a badge.

### 5.3 Shopping list row (SHOP)

Denser, mono-forward, thumb-scannable at arm's length in a store.

```
┌ FRUKT & GRÖNT ─────────────────────────────────── 4 ST ┐   ← inverted sticky bar, 28px
  [ ]  2   Gul lök                                  9,90
       ST  ICA · 1 KG NÄT                          
  [✓]  1   Ingefära                                24,00
       ST  FÄRSK · CA 150 G
```

- Row min-height 56px, `--rule-hair` between rows, padding `--s-3` `--s-4`.
- Check target: 28×28, 2px `--rule-strong` border, 2px radius, ≥44px total hit area via padding.
  Checked = solid `--accent` fill with an `--accent-ink` check glyph.
- Quantity: Plex Mono 600 `--t-num-s`, fixed `3ch` width, right-aligned, with the unit
  (`ST`, `G`, `PKT`) in `--t-micro` `--muted` directly beneath — a shelf-label stack.
- Name: `--t-body`, Familjen 600. Metadata line under it in `--t-micro` `--muted` — brand, package
  size, and (when known) shelf location.
- Price right-aligned in a fixed numeric column, `--t-num-s`.
- **Checked state:** the row drops to `opacity: 0.42` and the *name only* gets a 1px strikethrough.
  The row does **not** move, reflow, animate away, or reorder. Position is memory in a store.
- Section headers: full-bleed inverted bar (`--invert-bg` / `--invert-ink`), 28px tall, uppercase
  `--t-micro` Archivo 800 `wdth` 112, sticky at scroll, item count right-aligned. This is the shelf
  sign.
- Totals block at the end: `--rule-receipt` above, then `SUMMA` in `--t-micro` left with the value
  in `--t-num-l` right; beneath it a budget line — `BUDGET 400 kr` / `−37,50 kr` in `--positive`
  or `+62,00 kr` in `--negative`. Then a perforated bottom edge.

### 5.4 Cook step (COOK)

One instruction fills the screen. Two levels of hierarchy, maximum.

- Ground `--bg-sunk`. No panels, no rules except the progress strip and the action bar edge.
- **Step number**: `--t-display` Archivo 800 `wdth` 125, colour `--accent-dim` (dark) — set at the
  top-left and allowed to bleed one-third off the left page margin. It is scenery, not a label;
  `aria-hidden`, with the real "Steg 3 av 7" as `--t-micro` beside it.
- **This step's ingredients**: a single mono line above the instruction, `--t-meta`, `--ink-2`,
  items separated by a thin `|` in `--muted`: `400 G KYCKLINGLÅRFILÉ | 2 MSK RAPSOLJA | 1 TSK SALT`.
  Wraps to at most two lines. Not chips, not pills, not a bulleted sidebar.
- **Instruction**: `--t-step`, Familjen Grotesk 500, `--ink`, measure 34ch, left-aligned, ragged
  right. Any duration or temperature inside the sentence is wrapped in Plex Mono 600 `--accent`
  (dark) so it is findable at a glance from a metre away.
- **Timer** (steps that have one): the countdown at `--t-display` in Plex Mono 600, tabular,
  centred, with `START` / `PAUSA` as full-width square buttons below.
- **Progress**: a 3px strip pinned to the very top of the viewport, divided into *n* equal segments
  with 3px gaps — filled `--accent`, pending `--rule`. Segmented, not continuous, not rounded.
- **Action bar**: fixed bottom, full-bleed, 1px `--rule` top edge, height 76px (plus safe-area
  inset). Split 34/66: `FÖREGÅENDE` as a ghost button (`--ink-2` text, 1px `--rule-strong` right
  edge only) and `NÄSTA STEG` as a solid `--accent` / `--accent-ink` block, uppercase `--t-micro`
  Archivo 800 `wdth` 112. Radius 0. Both ≥ 56px tall — this is the dirty-hands target.
- Tap anywhere in the main content area also advances; the button is the affordance, the whole
  panel is the target.

### 5.5 Buttons (global)

Three variants, zero radius (2px on inputs only):

1. **Solid** — `--accent` bg, `--accent-ink` text, uppercase `--t-micro` Archivo 800 `wdth` 112,
   height 48 (56 in COOK). One per view.
2. **Outline** — transparent, 1px `--rule-strong`, `--ink` text. Hover: border → `--ink`.
3. **Text** — `--ink` with a 2px `--accent` underline offset 4px. Hover: underline → 3px.

No icon-only buttons except the check target and a close ×. Labels are Swedish verbs in the
imperative: `LÄGG TILL`, `BYT PRODUKT`, `BÖRJA HANDLA`, `NÄSTA STEG`.

### 5.6 Iconography and imagery

- Icons: at most eight in the whole app, 20px, 1.5px stroke, square terminals, `currentColor`.
  Never decorative, never inside a heading, never one-per-feature-card.
- Photography: overhead or 3/4, single hard light source with a real shadow, dark surface, tight
  crop on the food. 4:5 and 1:1 only. Radius 0. Never a smiling-people stock shot, never a
  gradient scrim — if text must sit on an image, it sits in a solid `--invert-bg` block over it.
- Product images from the grocery feed are shown at 56–80px on `--surface-2`, unmodified, never
  cropped to circles.

### 5.7 Loading and empty states

No skeleton shimmer. A loading list draws its rules and its `--rule-hair` structure immediately
with `--surface-2` blocks where content will land, plus a `--t-micro` `--muted` label
(`HÄMTAR PRISER…`). Empty states are a single `--t-h3` line and one outline button — no
illustration, no icon.

---

## 6. Per-mode differentiation

All three share the three faces, the palette, the zero-radius policy, the rule system, the
uppercase mono label idiom, and the right-aligned tabular numeric column. They differ in
**density, scale, ground, and rule vocabulary** — never in colour palette or typeface.

| | **PLAN** | **SHOP** | **COOK** |
|---|---|---|---|
| Character | Editorial spread | Receipt / picking list | Kitchen ticket |
| Ground | `--bg-base` | `--surface-1` strip on `--bg-sunk` | `--bg-sunk` |
| Grid | 12-col, asymmetric 7/5 or 8/4 | Single 560px column (+320px rail on `lg`) | Single 720px column |
| Scale | Full range, `--t-h1`/`--t-display` used | Shifted down one step; ceiling `--t-num-l` | Shifted up two steps; only `--t-step` + `--t-display` |
| Density | Loose — `--s-24` between sections | Tight — rows touch, `--s-8` between sections | Extremely loose — one idea per screen |
| Rules | `--rule-heavy` under section heads; wide whitespace does most of the separating | `--rule-hair` everywhere + `--rule-receipt` + inverted sticky section bars | Almost none — progress segments and one action-bar edge |
| Mono share | ~15% (metadata, prices) | ~45% (the mode is a document) | ~10% (times, temps, timer) |
| Imagery | Full-bleed hero, 4:5 portraits, generous | 56px thumbs only, or none | None |
| Accent use | One element per screen (the total, or the budget verdict) | Check fills + budget delta | The primary action, at full strength |
| Motion | Entrance fade only | State toggles only | Step cross-cut |

The transition between modes is itself a visual move: the mode header uses `--rule-double`, and the
mode name is set in Archivo `wdth` 125 uppercase — `PLANERA` / `HANDLA` / `LAGA`. Switching modes
changes the ground colour, which is the clearest possible signal that you have entered a different
room of the same store.

---

## 7. Motion

Restrained by policy. Durations: `--dur-1: 120ms`, `--dur-2: 180ms`, `--dur-3: 240ms`.
Easing: `--ease: cubic-bezier(0.2, 0, 0, 1)` for entrances, `linear` for progress and timers.

**Allowed, exhaustively:**

1. **Mode / route change** — content fades in over `--dur-2` with an 8px upward translate. No
   scale, no blur, no stagger cascade.
2. **SHOP check** — the checkbox fill paints in `--dur-1`; the row opacity drops over `--dur-2`.
   Nothing moves.
3. **COOK step advance** — outgoing instruction fades over 100ms, incoming enters over `--dur-2`
   with a 12px translate; the step number swaps with no tween.
4. **Basket total re-tally** — the one indulgence: when the basket changes, each changed digit
   swaps vertically over `--dur-3`, tabular width holding the column steady. This is the app's
   single memorable animated moment; it earns its place because the numbers are the product.
5. **Progress segment fill** — `--dur-1`, opacity/colour only.
6. **Timer countdown** — `linear`, second-granular, no easing.

**Banned:** parallax, scroll-jacking, scroll-triggered reveals, staggered card cascades, hover
lift/scale, spring or bounce easing, skeleton shimmer, animated gradients, looping ambient motion,
anything over 240ms.

`@media (prefers-reduced-motion: reduce)`: all of 1–5 collapse to a ≤100ms opacity change; the
digit swap becomes an instant value change; timers still count.

---

## 8. Three smells to check against

Run these before any screen is called done. Each has a mechanical test.

**Smell 1 — "The card grid returned."**
A view has become a set of similar rounded boxes, each with an icon, a bold title and two lines of
grey text, laid out in a responsive 3-up grid with gaps.
*Test:* in DevTools, count elements whose computed `border-radius` is > 2px. It must be zero
outside the two circle exceptions. Then count sibling boxes with equal width and their own
background — more than two in a row means the layout is a card grid and must be rebuilt as rows,
rules or an asymmetric split.

**Smell 2 — "The identity is in the shell, not the type."**
The design only reads as designed because of a gradient, a blur, a shadow or a coloured container;
strip those and the hierarchy collapses.
*Test:* screenshot the view, convert to greyscale, and blur it slightly. Hierarchy must still be
legible from type size, weight, width and rules alone. If the yellow is doing the structuring work
instead of accenting it, there is too much yellow.

**Smell 3 — "Generated defaults leaked in."**
Purple/indigo/violet anywhere, a multi-stop gradient, a translucent blurred panel, a soft ambient
shadow, an emoji used as an icon, a floating pill, a `9999px` radius, an icon paired with every
heading, or `Inter`/system-UI creeping into the stack.
*Test:* grep the stylesheet for `linear-gradient`, `radial-gradient` (except the perforation mask),
`backdrop-filter`, `blur(`, `box-shadow` not matching the two line-drawing forms,
`border-radius:` with a value other than `0`, `2px` or `50%`, and any hex in the 240–300° hue
range. All hits must be zero or explicitly justified in this document.

---

## 9. Token summary for implementation

Ship as a single `tokens.css` with `:root` + `[data-theme]` blocks: colour (§3.1/3.2), spacing
(§4.1), rules (§4.3), radius (§4.4), type sizes/line-heights/tracking (§2.1), motion (§7).
Typography roles ship as utility classes (`.t-micro`, `.t-meta`, `.t-body`, `.t-h1`, `.num`, …)
rather than as ad-hoc per-component declarations, so the scale cannot drift. Fonts load through
`next/font/google` with `display: swap` and the fallback stacks in §2. Global reset sets
`border-radius: 0` and `font-variant-numeric: tabular-nums` on numeric classes.
