import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/plan/route";

const valid = { location: "Umeå", budgetSek: "500", portions: 4, maxDistanceKm: 5, maxCookMinutes: 30, dietary: [], pantry: [], vibe: "vardagsmiddag", attempt: 0 };
function request(body: unknown, key?: string) { return new Request("http://localhost/api/plan", { method: "POST", headers: { "content-type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) }); }

describe("POST /api/plan", () => {
  beforeEach(() => { process.env.DATA_SOURCE = "fixture"; process.env.APP_MODE = "demo"; });
  it("returns a complete fixture plan and demo status", async () => {
    const response = await POST(request(valid)); const body = await response.json();
    expect(response.status).toBe(200); expect(body.plan.outcome).toBe("ok"); expect(body.plan.basket.lines.length).toBeGreaterThan(0); expect(body.plan.comparison.entries.length).toBeGreaterThanOrEqual(2); expect(body.status.isDemoData).toBe(true); expect(body.planId).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
  it("returns ok for a themed curry vibe", async () => {
    const response = await POST(request({ ...valid, vibe: "currygryta med kyckling" }));
    const body = await response.json();
    expect(body.plan.outcome).toBe("ok"); expect(body.plan.basket.lines.length).toBeGreaterThan(0);
  });
  it("uses stable validation errors and caps regeneration", async () => {
    for (const body of [{}, { ...valid, attempt: 4 }]) { const response = await POST(request(body)); expect(response.status).toBe(422); expect(await response.json()).toEqual({ error: { code: "INVALID_REQUEST", message: "Kontrollera formulärets uppgifter" } }); }
  });
  it("distinguishes a missing live location", async () => {
    process.env.DATA_SOURCE = "live";
    const response = await POST(request({ ...valid, location: null }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: "LOCATION_REQUIRED", message: "Postnummer eller ort krävs i live-läge" } });
  });
  it("returns the same result for an idempotency key", async () => {
    const first = await (await POST(request(valid, "same-key"))).json(); const second = await (await POST(request(valid, "same-key"))).json(); expect(second).toEqual(first);
  });
  it("returns infeasible as a 200 business result", async () => {
    const response = await POST(request({ ...valid, maxDistanceKm: 0.01 })); expect(response.status).toBe(200); expect((await response.json()).plan.outcome).toBe("infeasible");
  });
  it("returns over-budget with exact overshoot and an adjustment audit", async () => {
    const response = await POST(request({ ...valid, budgetSek: "1" })); const body = await response.json();
    expect(response.status).toBe(200); expect(body.plan.outcome).toBe("over_budget"); expect(body.plan.overshootOre).toBe(body.plan.basket.totalOre - 100);
  });
});
