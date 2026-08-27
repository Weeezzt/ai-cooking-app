# Project State

_Last updated: 2026-08-27 by Master (Sonnet)_

## Snapshot

| | |
|---|---|
| Phase | Planning complete → backlog creation → foundation build |
| Repo | https://github.com/Weeezzt/ai-cooking-app (main) |
| Stack | Next.js 16 App Router + TS strict, pnpm, Tailwind v4 + tokens, Vitest, Node 22 (CI/prod) |
| AI | OpenAI Responses API, official SDK, server-side. Model IDs resolved at startup, not hardcoded. |
| Data | Primat live (P0) with badged fixture fallback. Nutrition = OFF GTIN snapshot + Livsmedelsverket table. |
| Demo geo | Umeå (17 full-tier stores verified) |
| Design | "Midnight Supermarket Editorial", dark-mode only. See design-system.md |

## Decisions locked (human)

- MVP scope cut ACCEPTED, with **multi-store price comparison kept** (2–3 store shortlist).
- **Live Primat must work in the demo** (fixture is automatic badged fallback, not opt-in).
- Demo city = **Umeå**.
- Full decision set + resolved cross-review contradictions: `architecture-decisions.md` (AD-0..AD-12).

## Completed

- Repo bootstrapped; base docs.
- 6 planning specialists + independent Codex cross-review done (`docs/agents/planning/`).
- Unified plan written: `architecture-decisions.md`, `design-system.md`, `engineering-rules.md`.
- **Issue #1 (foundation + CI)** — merged (PR #12, squash `ac2007a`). Next 16.3.3, TS strict,
  Tailwind v4, Vitest, ESLint core-boundary (allowlist model). Independent Codex review → 3
  SHOULD-FIX addressed → merged. All 4 CI gates green. First foundation builder (Claude subagent)
  died on an account session rate limit after pushing; Master verified + fixed + merged.

## Backlog (GitHub issues)

| # | Title | Labels | Depends on |
|---|---|---|---|
| 1 | Project foundation & CI baseline | foundation | — |
| 2 | Design token layer + UI primitives (mobile-first, dark-only) | ui | 1 |
| 3 | Domain core: deterministic engine | engine | 1 |
| 4 | Primat data integration (live + badged fixture fallback) | data | 1 |
| 5 | Nutrition provider (OFF snapshot + Livsmedelsverket table) | data | 1 |
| 6 | OpenAI recipe service | ai | 1 |
| 7 | Plan pipeline orchestration + API route + client persistence | engine | 3,4,5,6 |
| 8 | PLAN experience | ui | 2,7 |
| 9 | SHOP experience | ui | 2,7 |
| 10 | COOK experience | ui | 2,7 |
| 11 | Integration QA + demo readiness | qa | 8,9,10 |

**Implementation order:** 1 → {2, 3, 4, 5, 6 in parallel} → 7 → {8, 9, 10 in parallel} → 11.

## Active work

- Issue #3 (deterministic engine) — Claude Sonnet builder, worktree. IN FLIGHT.
- Issue #4 (Primat data integration) — Claude Sonnet builder, worktree. IN FLIGHT.
- Issue #6 (OpenAI recipe service) — Claude Sonnet builder, worktree. IN FLIGHT.
- Issue #5 (nutrition) — **PR #13 open** (Codex-built). CI green. HELD for merge until #3 lands
  (both touch `src/core/types.ts` — reconcile onto #3's canonical types). Needs Claude review.
- Issue #2 (design tokens/UI) — queued; slack in schedule (only blocks #8–#10 which also need #7).

## Credentials (done)

- `.env.local` has working `OPENAI_API_KEY` + `PRIMAT_API_KEY` (both verified by Master 2026-08-27:
  Primat keyed resolve → 200; OpenAI models list → 126 models). `.env.local` is gitignored; copy it
  into each builder worktree that needs it (`cp /Users/williamvesterberg/cooking-app/.env.local .`).

## OpenAI models available on this account (2026-08-27)

`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`(+pro), `gpt-5.4`(+mini/nano/pro),
`gpt-5`(+mini/nano/pro), gpt-4.1 family, o3/o4-mini. So `gpt-5.6-luna/terra` ARE real API model
IDs here (not only Codex CLI tier names). Issue #6 verifies Responses API + structured-output
support and records the chosen IDs; AD-6 gets updated with them afterward.

## Next priorities

1. Land #3 → then reconcile + merge #4, #5; review each (cross-family).
2. #6 review (Codex) when its PR opens.
3. Dispatch #2. Then #7 once 3/4/5/6 are merged.

## Active branches / PRs

- PR #13 — Issue #5 nutrition provider (Codex). Open, CI green, held for #3.
- Branches in flight: `3-domain-core`, `4-primat-data`, `6-openai-recipe-service`.

## Agent notes

- Subagents = Claude only (opus/sonnet/haiku/fable). Codex available via `codex exec` /
  `codex exec review` CLI (`gpt-5.6-sol`) — used as builder for #5 and as cross-family reviewer.
- Codex `--sandbox workspace-write` cannot commit through a shared-index git worktree; it commits
  via a temp clone + push. Net effect is fine (remote branch is correct) but the local worktree is
  left dirty — remove it after (`git worktree remove --force`).
- One Claude builder (#1) died mid-task on an account session rate limit ~17:40 Europe/Stockholm.
  Pace concurrent Claude subagents; Codex is not on that limit.
