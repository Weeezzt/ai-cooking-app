import { describe, expect, it } from "vitest";
import type { Clock } from "@/core/clock";
import { PrimatClient, PrimatProductSearch, PrimatStoreDiscovery } from "@/adapters/primat";

const enabled = Boolean(process.env.PRIMAT_API_KEY);
const clock: Clock = { now: () => Date.now(), nowIso: () => new Date().toISOString() };

describe.skipIf(!enabled)("Primat keyed live smoke", () => {
  it("resolves Umeå and covers six concepts at all three fixture stores", async () => {
    const client = new PrimatClient(); const discovery = new PrimatStoreDiscovery(client); const search = new PrimatProductSearch(client);
    const options = { clock, deadlineAt: Date.now() + 60_000 }; const result = await discovery.resolve("Umeå", options);
    const keys = new Set(["coop:232400", "willys:2276", "ica:1003828"]);
    const stores = result.stores.filter((store) => keys.has(`${store.chain}:${store.storeId}`) && store.tier === "full");
    expect(stores).toHaveLength(3);
    for (const store of stores) for (const concept of ["banan", "kyckling", "ris", "pasta", "tomat", "ägg"]) {
      expect((await search.search({ concept, store, limit: 5 }, options)).length, `${store.chain}:${store.storeId}/${concept}`).toBeGreaterThan(0);
    }
  }, 65_000);
});
