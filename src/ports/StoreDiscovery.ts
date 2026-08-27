/**
 * `StoreDiscovery` port (AD-2, AD-9). The canonical definition lives in
 * `src/core/ports.ts` so the pure engine can reference it without importing
 * outward (see `tests/architecture.test.ts`); this file gives it the AD-2 path.
 */
export type {
  StoreDiscovery,
  StoreDiscoveryResult,
  ResolvedLocation,
  PortCallOptions,
} from "@/core/ports";
