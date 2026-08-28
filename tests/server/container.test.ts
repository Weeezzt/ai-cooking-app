import { describe, expect, it, vi } from "vitest";
import { FixedClock } from "@/core/clock";
import { createDataContainer } from "@/server/container";

const clock = new FixedClock(); const options = { clock, deadlineAt:clock.now()+10_000 };
describe("data container",()=>{
  it("fixture mode needs neither network nor a key",async()=>{
    const fetchSpy=vi.spyOn(globalThis,"fetch"); const container=createDataContainer("fixture");
    const result=await container.stores.resolve(null,options); expect(result.stores.length).toBeGreaterThan(0); expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.status()).toMatchObject({mode:"fixture",isDemoData:true,usedFallback:false,attribution:"Prisdata från primat.nu"}); fetchSpy.mockRestore();
  });
  it("badges a live provider failure and keeps the remaining session on fixtures",async()=>{
    const previous=process.env.PRIMAT_API_KEY; delete process.env.PRIMAT_API_KEY;
    try { const container=createDataContainer("live"); const result=await container.stores.resolve("Umeå",options); expect(result.location.isDemoDefault).toBe(true); expect(container.status()).toMatchObject({isDemoData:true,usedFallback:true,fallbackProviders:["stores"]}); }
    finally { if(previous===undefined) delete process.env.PRIMAT_API_KEY; else process.env.PRIMAT_API_KEY=previous; }
  });
});
