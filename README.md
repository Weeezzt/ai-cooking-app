# AI Cooking App

A cooking / grocery-planning application. A user describes the meal they want using hard
constraints (budget, portions, cooking time, shopping distance) plus natural language
("something fresh but filling, Asian-ish, high protein"). The app interprets the intent,
finds nearby grocery stores, selects real purchasable products, builds a compatible recipe,
computes the basket price and nutrition **deterministically**, checks the constraints, and
presents the result through a connected **PLAN → SHOP → COOK** experience.

## Status

Early planning. See [`docs/agents/project-state.md`](docs/agents/project-state.md) for current
state, active work, and next priorities. Persistent project knowledge lives in
[`docs/agents/`](docs/agents/).

## Principles

- **Separate semantic reasoning from factual data from deterministic calculation.** AI (OpenAI)
  interprets fuzzy preferences and generates recipes/instructions. It is never the source of
  truth for prices, package sizes, basket totals, distances, or macros.
- **Real Swedish grocery data where available** (Primat), abstracted behind app-owned
  interfaces, with an isolated fixture dataset for reliable demos. Fabricated data is never
  presented as verified real-time store data.
- **Deterministic basket + nutrition engine.** Recipe quantity and purchase quantity are
  distinct concepts.
- **Distinct editorial visual identity** — "Midnight Supermarket Editorial". Not generic
  AI-SaaS.

## Stack

Next.js 16 (App Router) + TypeScript `strict`, pnpm, Tailwind v4, Vitest, ESLint (flat config).
CI and production run on Node 22; local dev works on Node 20.11+. See
[`docs/agents/architecture-decisions.md`](docs/agents/architecture-decisions.md) (AD-1, AD-2, AD-12).

## Setup

Prerequisites: Node 20.11+ (CI uses 22 — see `.nvmrc`), pnpm 9 (`corepack enable` or
`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env.local   # fill in as needed; .env*.local is gitignored
pnpm dev                     # http://localhost:3000  (/plan, /shop, /cook)
```

Never commit real secrets. `OPENAI_API_KEY` and all external API credentials stay
server-side only and are absent from `.env.example`.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Next dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (incl. the `src/core` import-boundary rule) |
| `pnpm test` | Vitest (incl. `tests/architecture.test.ts`) |

The merge bar (CI, every PR): `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.

## Repository structure

`src/core` (pure domain), `src/ports` (interfaces), `src/adapters` (implementations),
`src/fixtures` (demo data), `src/server` (wiring + route handlers), `src/app` (Next routes),
`tests`. Each has a `README.md` stub. The `src/core` boundary is enforced by ESLint and by
`tests/architecture.test.ts`.
