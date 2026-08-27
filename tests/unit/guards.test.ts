import { describe, expect, it } from "vitest";

import { isNonEmptyString } from "@/core/guards";

describe("isNonEmptyString", () => {
  it("is true for a non-empty string", () => {
    expect(isNonEmptyString("kokosmjölk")).toBe(true);
  });

  it("is false for empty, whitespace, or non-strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });
});
