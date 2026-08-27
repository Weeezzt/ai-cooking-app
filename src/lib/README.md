# src/lib

Client-side helpers that are not pure domain and not server wiring: the client
plan store (sessionStorage/localStorage per AD-8), `sv-SE` formatting helpers,
small UI utilities. May import from `@/core` (types + pure functions) but not
from `@/server` or `@/adapters`. Populated from Issue #7 onward.
