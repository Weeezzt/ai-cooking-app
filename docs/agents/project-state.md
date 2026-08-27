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

## Active work

- Master creating GitHub issues (~10) and starting the foundation build.

## Blocked / waiting on human

- **`OPENAI_API_KEY` in `.env.local`** — needed before AI service (Issue: AI recipe service).
  Fixture mode + all other work proceeds without it.
- **Primat API key** — `POST https://primat.nu/api/v3/signup {"email":"..."}` gives one instantly,
  OR provide the existing `cookingapp` key. Demo endpoint (keyless, 250 req/day/IP) is enough to
  start; a key is needed for the live-in-demo requirement to be reliable. Put in `.env.local` as
  `PRIMAT_API_KEY`.

## Next priorities

1. Create backlog issues.
2. Build Issue 1 (foundation) via isolated builder → Codex review → merge.
3. Parallelize Issues 2–5 (engine, Primat data, nutrition, AI) once foundation lands.

## Active branches / PRs

None yet.

## Agent notes

- Subagents = Claude only (opus/sonnet/haiku/fable). Codex available via `codex exec` CLI
  (`gpt-5.6-sol` default) — use for independent cross-family review of Claude-built PRs.
