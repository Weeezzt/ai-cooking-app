# src/adapters

Concrete port implementations. Wired to ports in exactly one place: `src/server/container.ts`.

Planned (AD-2 / AD-9): `primat/` (live client, types derived from `openapi.json`),
`fixtures/` (fixture implementation of every port), `openai/` (RecipeGenerator +
prompt/schema module), `nutrition/` (OFF snapshot + Livsmedelsverket table readers).
