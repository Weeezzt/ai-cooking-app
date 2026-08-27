# src/server

Server-only wiring and route handlers.

Planned (AD-2): `container.ts` (the ONLY file that wires concrete adapters to ports,
mode-switched on `DATA_SOURCE`), `pipeline-route.ts` (POST handler:
validate → `runPlanPipeline` → return `PlanResult`).
