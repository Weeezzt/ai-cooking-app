# tests

Vitest. Run with `pnpm test`.

- `architecture.test.ts` — mechanical guards for AD-2: the `src/core` import boundary,
  plus a smoke check of the `assertNoForbiddenKeys` helper (AD-6, fleshed out in issue #6).
- `helpers/assertNoForbiddenKeys.ts` — exported placeholder helper for the AI-schema guard.
- `unit/` — unit coverage. Engine coverage (`src/core`) is TDD and high-coverage per
  `docs/agents/engineering-rules.md`.

- `core/` — engine unit coverage (money, units, basket, nutrition, constraints) +
  `pipeline.test.ts` (the required scenarios and the golden determinism test).

Planned (AD-2): `adapters/` (contract tests against both live-shaped and fixture
implementations).
