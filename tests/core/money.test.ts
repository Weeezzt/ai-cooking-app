import { describe, expect, it } from "vitest";

import {
  addOre,
  clampSubOre,
  formatOre,
  mulOre,
  ore,
  oreToSek,
  parseSekToOre,
  roundHalfUp,
  scaleOre,
  subOre,
  sumOre,
} from "@/core/money";

describe("roundHalfUp", () => {
  it("rounds .5 away from zero", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4999)).toBe(2);
    expect(roundHalfUp(0)).toBe(0);
  });
  it("throws on non-finite", () => {
    expect(() => roundHalfUp(Number.NaN)).toThrow();
  });
});

describe("ore()", () => {
  it("brands integers and rejects fractions", () => {
    expect(ore(150)).toBe(150);
    expect(() => ore(1.5)).toThrow(/integer/);
  });
});

describe("Ore arithmetic", () => {
  it("adds, subtracts, sums, multiplies, scales", () => {
    expect(addOre(ore(100), ore(50))).toBe(150);
    expect(subOre(ore(100), ore(30))).toBe(70);
    expect(sumOre([ore(10), ore(20), ore(30)])).toBe(60);
    expect(sumOre([])).toBe(0);
    expect(mulOre(ore(199), 3)).toBe(597);
    expect(scaleOre(ore(1000), 0.335)).toBe(335);
  });
  it("clampSubOre never goes negative", () => {
    expect(clampSubOre(ore(100), ore(250))).toBe(0);
    expect(clampSubOre(ore(250), ore(100))).toBe(150);
  });
  it("mulOre rejects a negative or fractional count", () => {
    expect(() => mulOre(ore(100), -1)).toThrow();
    expect(() => mulOre(ore(100), 1.5)).toThrow();
  });
});

describe("parseSekToOre", () => {
  it("parses plain integers and decimals", () => {
    expect(parseSekToOre("150")).toBe(15000);
    expect(parseSekToOre("149,90")).toBe(14990);
    expect(parseSekToOre("149.90")).toBe(14990);
    expect(parseSekToOre("0,01")).toBe(1);
  });
  it("rounds half-up at the third decimal", () => {
    expect(parseSekToOre("12,345")).toBe(1235);
    expect(parseSekToOre("12,344")).toBe(1234);
    expect(parseSekToOre("12,9996")).toBe(1300);
  });
  it("tolerates currency suffix and spacing", () => {
    expect(parseSekToOre("  149,90 kr ")).toBe(14990);
    expect(parseSekToOre("1 500 kr")).toBe(150000);
    expect(parseSekToOre("1 500")).toBe(150000);
  });
  it("rejects junk", () => {
    expect(() => parseSekToOre("abc")).toThrow();
    expect(() => parseSekToOre("")).toThrow();
    expect(() => parseSekToOre("1,2,3")).toThrow();
  });
  it("rejects budgets outside the safe integer öre range", () => {
    expect(() => parseSekToOre("9007199254740991")).toThrow(/safe integer/);
    expect(() => ore(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe("formatting boundary", () => {
  it("oreToSek is a plain division", () => {
    expect(oreToSek(ore(14990))).toBeCloseTo(149.9, 5);
  });
  it("formatOre renders sv-SE currency", () => {
    const formatted = formatOre(ore(14990));
    expect(formatted).toMatch(/149,90/);
    expect(formatted).toMatch(/kr/);
  });
});
