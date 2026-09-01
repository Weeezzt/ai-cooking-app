import { describe, expect, it } from "vitest";
import { decisionState, degradationNotices } from "@/lib/degradation";

describe("AD-11 degradation states", () => {
  it.each([["ok","plan"],["over_budget","over_budget"],["infeasible","infeasible"],["unknown","retry"]] as const)("renders %s as %s", (outcome, state) => expect(decisionState(outcome)).toBe(state));
  it("surfaces every fallback, low coverage and stale state", () => {
    const notices = degradationNotices({ isDemoData: true, isDemoRecipes: true, nutritionSuppressed: true, stale: true });
    expect(notices).toHaveLength(4); expect(notices.join(" ")).toMatch(/Demodata/); expect(notices.join(" ")).toMatch(/Demorecept/); expect(notices.join(" ")).toMatch(/70/); expect(notices.join(" ")).toMatch(/24/);
  });
});
