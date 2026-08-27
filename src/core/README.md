# src/core

Pure domain. **No I/O, no `Date.now()` (take a clock), no imports from `src/server`,
`src/app`, `src/adapters`, or any external SDK.** See AD-2 and `docs/agents/engineering-rules.md`.

Enforced two ways:

- ESLint `import/no-restricted-paths` + `no-restricted-imports` (`eslint.config.mjs`,
  `core-boundary/paths` block).
- `tests/architecture.test.ts` scans every file here for outward imports.

Planned contents (later issues): `types.ts`, `money.ts`, `units.ts`, `basket/`,
`nutrition/`, `constraints/`, `pipeline/`.
