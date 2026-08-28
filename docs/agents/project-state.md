# Project State

_Last updated: 2026-08-28 by Master (Sonnet)_

## Snapshot

| | |
|---|---|
| Phase | Backend build (issues #4–#6) → then pipeline #7 → experiences #8–#10 → QA #11 |
| Repo | https://github.com/Weeezzt/ai-cooking-app (main) |
| Stack | Next.js 16.3 App Router, TS strict, pnpm, Tailwind v4 + hand-authored tokens, Vitest, Node 22 CI |
| AI | OpenAI Responses API, official SDK, server-side. Model IDs resolved + health-checked at startup. |
| Data | Primat live (keyed) with badged fixture fallback. Nutrition = OFF GTIN snapshot + Livsmedelsverket. |
| Demo geo | Umeå (17 full-tier stores verified) |
| Design | "Midnight Supermarket Editorial", dark-only. `design-system.md` |

## Decisions locked (human)

- MVP scope cut ACCEPTED + **multi-store price comparison kept** (2–3 store shortlist).
- **Live Primat must work in the demo** (fixture = automatic badged fallback).
- Demo city = **Umeå**. Price basis = `prices.regular`.
- Full resolved plan: `architecture-decisions.md` (AD-0..AD-12). Binding over the `planning/` docs.

## Merged to main

| # | PR | What | Review path |
|---|---|---|---|
| 1 | #12 | Foundation + CI (Next 16.3, TS strict, Vitest, ESLint core-boundary allowlist) | Claude build → Codex review (3 fix) |
| 3 | #14 | Deterministic engine (money öre, basket, nutrition agg, constraint taxonomy, over-budget repair, pipeline skeleton). 122 tests, ~99% line cov | Claude build → Codex review (5 blockers) → Codex rework → Claude re-review |
| 2 | #15 | Design tokens + 12 UI primitives + `/styleguide`. Dark-only, mobile-first, zero-radius | Claude build → Codex review + Master browser pass |
| 5 | #13 | Nutrition provider — OFF 30-GTIN snapshot + Livsmedelsverket 75-row table, `NutritionSource.lookup` | Codex build → Codex reconcile → Claude review |

## Active work

- **Issue #4 (Primat) — PR #17, in REWORK.** Codex build → Claude review = **rework** (2 blockers:
  variable-weight over-detected on ~90% of packaged goods; candidate-filter + section-normalizer
  shipped as dead code the pipeline can't reach). Master decided the seam: `ProductSearch.search()`
  returns `{products, rejections}`, `Product` gains `section: StoreSection`, adapter owns the filter.
  Codex reworking on `4-primat-data`. Re-review by Claude.
- **Issue #6 (OpenAI recipe service) — Codex builder in flight**, worktree `issue-6`. Verifying live
  model IDs for Responses API + strict structured output; `assertNoForbiddenKeys` over schemas;
  demo-recipe fallback.

## Not started

- #7 pipeline orchestration + API route + client persistence (needs #4, #6 merged; #3, #5 done).
  **#7 must consume the new `ProductSearchResult` + `Product.section` from the #4 rework.**
- #8 PLAN, #9 SHOP, #10 COOK (need #2 done ✓ + #7).
- #11 integration QA + demo readiness (needs #8–#10).

## Deferred → issue #16

Engine: nutrition coverage denominator ignores non-gram lines; repair enumeration lacks unit-compat
gate; `NutritionFact.retrievedAtIso` should be capture date not lookup time; 3 NITs. Design:
type-scale "violence" (drop a mobile heading level). Infra: CI `actions/*@v4` Node-20 deprecation.

## Operating notes (for a resuming Master)

- **Builders:** Codex (`codex exec --sandbox workspace-write`, `gpt-5.6-sol`) is the default builder
  right now — Claude account hit its usage cap twice under parallel Opus/heavy-builder load. Claude
  subagents = cross-family review + light work. Model policy in [[master-role]] still holds, weighted
  to Codex until headroom returns.
- **Codex + worktrees:** `codex exec` can't commit through a shared-index worktree; it commits via a
  temp clone + push. So after a Codex task: `git fetch`, and `git reset --hard origin/<branch>` the
  worktree before inspecting (the local branch ref is stale). Remove the worktree with `--force`.
- **Every PR:** built by one family, reviewed by the other, blockers fixed, CI green, before merge.
  Master does the merge (squash + delete branch), closes the issue with a one-line trail.
- `gh` works (`Weeezzt`); the GitHub MCP server is broken. `.env.local` (both keys, verified) is
  gitignored — `cp` it into each builder worktree that needs it.
- Chrome MCP tools available (deferred; `ToolSearch` to load) for UI review — dev server + navigate.
