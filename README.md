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

## Setup

_To be documented as the stack is finalized._ Environment configuration will be described in
`.env.example`. Never commit real secrets. `OPENAI_API_KEY` and all external API credentials
stay server-side only.
